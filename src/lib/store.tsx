import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { MemoryBackend, openBackend, type Backend } from './db';
import { emptyAppData, newId } from './defaults';
import { MediaCache } from './media';
import { buildLockedPreview, type LockedPreview } from './preview';
import { encodeBackup, type BackupContents } from './backup';
import {
  collectBackup,
  collectGarbage,
  eraseEverything,
  estimateBackupBytes as estimateBytes,
  fetchDemoMedia,
  loadAppData,
  restoreBackupContents,
  seedSample,
  writesFor,
  type DemoMediaLoader,
  type Slice,
} from './repo';
import type { AppData, MediaId } from './types';

export interface Store {
  ready: boolean;
  /** False when IndexedDB was unavailable and edits last only for this visit. */
  persistent: boolean;
  data: AppData;
  /** Built only from approved fields of the saved data. */
  preview: LockedPreview;
  save(changes: Partial<AppData>): Promise<void>;
  addMedia(blob: Blob): Promise<MediaId>;
  mediaUrl(id: MediaId): Promise<string | null>;
  /** The latest data, updated as soon as a save commits (before React re-renders). */
  snapshot(): AppData;
  /** Deletes everything and loads the fictional sample family. */
  startSample(): Promise<void>;
  /** Builds an encrypted backup of everything. */
  createBackup(password: string): Promise<Blob>;
  estimateBackupBytes(): Promise<number>;
  /** Replaces everything with a decoded backup. */
  applyBackup(contents: BackupContents): Promise<void>;
  eraseEverything(): Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

interface ProviderProps {
  children: ReactNode;
  /** Injected in tests. */
  backend?: Backend;
  loader?: DemoMediaLoader;
}

export function StoreProvider({ children, backend: injected, loader = fetchDemoMedia }: ProviderProps) {
  const backendRef = useRef<Backend>(injected ?? new MemoryBackend());
  const cacheRef = useRef(new MediaCache(backendRef.current));
  const dataRef = useRef<AppData>(emptyAppData());
  /** Media added this visit but not yet saved into a record. Protected from cleanup. */
  const pendingMedia = useRef(new Set<MediaId>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const [data, setData] = useState<AppData>(dataRef.current);
  const [ready, setReady] = useState(false);
  const [persistent, setPersistent] = useState(true);

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  /** Serialises storage work so writes never interleave. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queue.current.then(task, task);
    queue.current = run.catch(() => undefined);
    return run;
  }, []);

  const cleanup = useCallback(async () => {
    const removed = await collectGarbage(backendRef.current, dataRef.current, pendingMedia.current);
    cacheRef.current.forget(removed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let backend = injected;
      if (!backend) {
        backend = await openBackend();
        backendRef.current = backend;
        cacheRef.current.setBackend(backend);
      }
      let loaded: AppData;
      try {
        loaded = await loadAppData(backend);
      } catch {
        backend = new MemoryBackend();
        backendRef.current = backend;
        cacheRef.current.setBackend(backend);
        loaded = await loadAppData(backend);
      }
      if (cancelled) return;
      setPersistent(backend.persistent);
      commit(loaded);
      setReady(true);
      enqueue(cleanup).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
    // Runs once per provider; the injected backend and loader never change.
  }, []);

  const save = useCallback(
    (changes: Partial<AppData>) =>
      enqueue(async () => {
        const next: AppData = { ...dataRef.current, ...changes };
        const slices = Object.keys(changes) as Slice[];
        await backendRef.current.write(writesFor(next, slices));
        commit(next);
        if (slices.some((s) => !['approvals', 'prefs', 'schedule', 'security', 'setup'].includes(s))) {
          // A record changed, so a replaced or removed photo may be unused now.
          // Media chosen this visit stays protected until the next visit.
          await cleanup();
        }
      }),
    [commit, enqueue, cleanup],
  );

  const addMedia = useCallback(
    (blob: Blob) =>
      enqueue(async () => {
        const id = newId('media');
        await backendRef.current.putMedia({ id, blob, mime: blob.type, createdAt: Date.now() });
        pendingMedia.current.add(id);
        return id;
      }),
    [enqueue],
  );

  const mediaUrl = useCallback((id: MediaId) => cacheRef.current.url(id), []);

  const startSample = useCallback(
    () =>
      enqueue(async () => {
        cacheRef.current.forgetAll();
        pendingMedia.current.clear();
        commit(await seedSample(backendRef.current, loader));
      }),
    [commit, enqueue, loader],
  );

  const snapshot = useCallback(() => dataRef.current, []);

  const createBackup = useCallback(
    (password: string) =>
      enqueue(async () => encodeBackup(await collectBackup(backendRef.current, dataRef.current), password)),
    [enqueue],
  );

  const estimateBackupBytes = useCallback(() => estimateBytes(backendRef.current, dataRef.current), []);

  const applyBackup = useCallback(
    (contents: BackupContents) =>
      enqueue(async () => {
        cacheRef.current.forgetAll();
        pendingMedia.current.clear();
        commit(await restoreBackupContents(backendRef.current, contents));
      }),
    [commit, enqueue],
  );

  const doErase = useCallback(
    () =>
      enqueue(async () => {
        cacheRef.current.forgetAll();
        pendingMedia.current.clear();
        commit(await eraseEverything(backendRef.current));
      }),
    [commit, enqueue],
  );

  const preview = useMemo(() => buildLockedPreview(data), [data]);

  const value = useMemo<Store>(
    () => ({
      ready,
      persistent,
      data,
      preview,
      save,
      addMedia,
      mediaUrl,
      snapshot,
      startSample,
      createBackup,
      estimateBackupBytes,
      applyBackup,
      eraseEverything: doErase,
    }),
    [ready, persistent, data, preview, save, addMedia, mediaUrl, snapshot, startSample, createBackup, estimateBackupBytes, applyBackup, doErase],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
