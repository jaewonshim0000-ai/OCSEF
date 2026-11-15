import type { MediaId, MediaRecord } from './types';

/**
 * Local storage for Familiar Place. Everything stays on this device: there is
 * no upload, sync, or analytics. IndexedDB is used when available; otherwise
 * an in-memory store keeps the app usable for the current visit.
 */

export const DB_NAME = 'familiar-place';
/** Version 2 added the songs store. Upgrades keep all existing data. */
export const DB_VERSION = 2;

export const COLLECTIONS = ['contacts', 'routines', 'memories', 'songs'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const KV_KEYS = ['meta', 'profile', 'home', 'schedule', 'approvals', 'prefs', 'security', 'setup'] as const;
export type KvKey = (typeof KV_KEYS)[number];

export interface SliceWrite {
  kv?: Partial<Record<KvKey, unknown>>;
  /** Each collection given here is replaced in full. */
  collections?: Partial<Record<CollectionName, Array<{ id: string }>>>;
}

export interface Backend {
  readonly persistent: boolean;
  getKV<T>(key: KvKey): Promise<T | undefined>;
  getAll<T>(name: CollectionName): Promise<T[]>;
  /** Applies all writes in one transaction. */
  write(writes: SliceWrite): Promise<void>;
  putMedia(record: MediaRecord): Promise<void>;
  getMedia(id: MediaId): Promise<MediaRecord | undefined>;
  listMediaIds(): Promise<MediaId[]>;
  deleteMedia(ids: MediaId[]): Promise<void>;
  clearAll(): Promise<void>;
}

function req<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

const ALL_STORES = ['kv', ...COLLECTIONS, 'media'];

/** How long to wait for an older tab to let go before falling back to memory. */
const BLOCKED_TIMEOUT_MS = 4000;

export function openIdb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let blockedTimer: ReturnType<typeof setTimeout> | undefined;
    let gaveUp = false;
    const request = factory.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      clearTimeout(blockedTimer);
      const db = request.result;
      if (gaveUp) {
        // We already fell back to memory storage; don't hold the database open.
        db.close();
        return;
      }
      // A newer version of the app opened in another tab: let it upgrade, and
      // reload this tab so it picks up the new version too.
      db.onversionchange = () => {
        db.close();
        if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') window.location.reload();
      };
      resolve(db);
    };
    request.onerror = () => {
      clearTimeout(blockedTimer);
      reject(request.error);
    };
    // An older tab still holds the database open. It is asked to close (see
    // onversionchange above); if it doesn't, fall back after a short wait.
    request.onblocked = () => {
      blockedTimer = setTimeout(() => {
        gaveUp = true;
        reject(new Error('Storage is in use by another tab.'));
      }, BLOCKED_TIMEOUT_MS);
    };
  });
}

export class IdbBackend implements Backend {
  readonly persistent = true;
  constructor(private readonly db: IDBDatabase) {}

  async getKV<T>(key: KvKey): Promise<T | undefined> {
    const tx = this.db.transaction('kv', 'readonly');
    return (await req(tx.objectStore('kv').get(key))) as T | undefined;
  }

  async getAll<T>(name: CollectionName): Promise<T[]> {
    const tx = this.db.transaction(name, 'readonly');
    return (await req(tx.objectStore(name).getAll())) as T[];
  }

  async write(writes: SliceWrite): Promise<void> {
    const kvEntries = Object.entries(writes.kv ?? {});
    const collEntries = Object.entries(writes.collections ?? {}) as Array<[CollectionName, Array<{ id: string }>]>;
    const stores = [...(kvEntries.length ? ['kv'] : []), ...collEntries.map(([name]) => name)];
    if (!stores.length) return;
    const tx = this.db.transaction(stores, 'readwrite');
    const finished = done(tx);
    for (const [key, value] of kvEntries) tx.objectStore('kv').put(value, key);
    for (const [name, records] of collEntries) {
      const store = tx.objectStore(name);
      store.clear();
      for (const record of records) store.put(record);
    }
    await finished;
  }

  async putMedia(record: MediaRecord): Promise<void> {
    const tx = this.db.transaction('media', 'readwrite');
    const finished = done(tx);
    tx.objectStore('media').put(record);
    await finished;
  }

  async getMedia(id: MediaId): Promise<MediaRecord | undefined> {
    const tx = this.db.transaction('media', 'readonly');
    return (await req(tx.objectStore('media').get(id))) as MediaRecord | undefined;
  }

  async listMediaIds(): Promise<MediaId[]> {
    const tx = this.db.transaction('media', 'readonly');
    return (await req(tx.objectStore('media').getAllKeys())) as MediaId[];
  }

  async deleteMedia(ids: MediaId[]): Promise<void> {
    if (!ids.length) return;
    const tx = this.db.transaction('media', 'readwrite');
    const finished = done(tx);
    for (const id of ids) tx.objectStore('media').delete(id);
    await finished;
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction(ALL_STORES, 'readwrite');
    const finished = done(tx);
    for (const name of ALL_STORES) tx.objectStore(name).clear();
    await finished;
  }
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

/** Fallback used when IndexedDB is unavailable (for example, blocked storage). */
export class MemoryBackend implements Backend {
  readonly persistent = false;
  private kv = new Map<KvKey, unknown>();
  private collections = new Map<CollectionName, Map<string, unknown>>();
  private media = new Map<MediaId, MediaRecord>();

  async getKV<T>(key: KvKey): Promise<T | undefined> {
    return clone(this.kv.get(key) as T | undefined);
  }

  async getAll<T>(name: CollectionName): Promise<T[]> {
    return Array.from(this.collections.get(name)?.values() ?? []).map((v) => clone(v as T));
  }

  async write(writes: SliceWrite): Promise<void> {
    for (const [key, value] of Object.entries(writes.kv ?? {})) this.kv.set(key as KvKey, clone(value));
    for (const [name, records] of Object.entries(writes.collections ?? {})) {
      const map = new Map<string, unknown>();
      for (const r of records as Array<{ id: string }>) map.set(r.id, clone(r));
      this.collections.set(name as CollectionName, map);
    }
  }

  async putMedia(record: MediaRecord): Promise<void> {
    this.media.set(record.id, record);
  }

  async getMedia(id: MediaId): Promise<MediaRecord | undefined> {
    return this.media.get(id);
  }

  async listMediaIds(): Promise<MediaId[]> {
    return Array.from(this.media.keys());
  }

  async deleteMedia(ids: MediaId[]): Promise<void> {
    for (const id of ids) this.media.delete(id);
  }

  async clearAll(): Promise<void> {
    this.kv.clear();
    this.collections.clear();
    this.media.clear();
  }
}

export async function openBackend(): Promise<Backend> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB unavailable');
    return new IdbBackend(await openIdb());
  } catch {
    return new MemoryBackend();
  }
}
