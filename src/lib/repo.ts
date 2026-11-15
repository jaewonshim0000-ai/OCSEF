import type { Backend, CollectionName, KvKey, SliceWrite } from './db';
import {
  defaultPrefs,
  emptyAppData,
  emptyApprovals,
  emptyPlace,
  emptyProfile,
  emptySchedule,
  emptySecurity,
  newSetup,
} from './defaults';
import { hashPin } from './pin';
import { DEMO_MEDIA, SAMPLE_PIN, demoAppData } from './seed';
import type { BackupContents } from './backup';
import type { AppData, Approvals, AudioRef, MediaId, MediaRecord, PhotoRef, Security, SetupState } from './types';

interface Meta {
  seeded: boolean;
  version: number;
}

const META_VERSION = 2;

export type DemoMediaLoader = (backend: Backend) => Promise<Set<MediaId>>;

/** Loads the bundled sample media into local storage. Missing files are skipped. */
export const fetchDemoMedia: DemoMediaLoader = async (backend) => {
  const base = import.meta.env.BASE_URL ?? '/';
  const stored = new Set<MediaId>();
  await Promise.all(
    Object.entries(DEMO_MEDIA).map(async ([id, { file, mime }]) => {
      try {
        const res = await fetch(`${base}demo/${file}`);
        if (!res.ok) return;
        const blob = new Blob([await res.arrayBuffer()], { type: mime });
        await backend.putMedia({ id, blob, mime, createdAt: Date.now() });
        stored.add(id);
      } catch {
        // Offline on first load or a missing file: the app shows its
        // missing-photo and missing-audio states instead.
      }
    }),
  );
  return stored;
};

/** Every media id referenced by the data. */
export function mediaRefs(data: AppData): MediaId[] {
  const ids: MediaId[] = [];
  const add = (ref: PhotoRef | AudioRef | null) => {
    if (ref) ids.push(ref.id);
  };
  add(data.profile.photo);
  add(data.profile.voice);
  add(data.home.photo);
  data.home.spaces.forEach((s) => add(s.photo));
  data.contacts.forEach((c) => (add(c.photo), add(c.voice)));
  data.routines.forEach((r) => r.steps.forEach((s) => (add(s.photo), add(s.audio))));
  data.memories.forEach((m) => (add(m.photo), add(m.audio)));
  data.songs.forEach((s) => (add(s.photo), add(s.audio)));
  return Array.from(new Set(ids));
}

/** Clears references to media that could not be stored. */
export function stripMissingMedia(data: AppData, available: Set<MediaId>): AppData {
  const keep = <T extends PhotoRef | AudioRef | null>(ref: T): T | null => (ref && available.has(ref.id) ? ref : null);
  return {
    ...data,
    profile: { ...data.profile, photo: keep(data.profile.photo), voice: keep(data.profile.voice) },
    home: {
      ...data.home,
      photo: keep(data.home.photo),
      spaces: data.home.spaces.map((s) => ({ ...s, photo: keep(s.photo) })),
    },
    contacts: data.contacts.map((c) => ({ ...c, photo: keep(c.photo), voice: keep(c.voice) })),
    routines: data.routines.map((r) => ({
      ...r,
      steps: r.steps.map((s) => ({ ...s, photo: keep(s.photo), audio: keep(s.audio) })),
    })),
    memories: data.memories.map((m) => ({ ...m, photo: keep(m.photo), audio: keep(m.audio) })),
    songs: data.songs.map((s) => ({ ...s, photo: keep(s.photo), audio: keep(s.audio) })),
  };
}

export type Slice = keyof AppData;
const COLLECTION_SLICES: ReadonlySet<Slice> = new Set<Slice>(['contacts', 'routines', 'memories', 'songs']);
export const ALL_SLICES: Slice[] = [
  'profile', 'home', 'contacts', 'schedule', 'routines', 'memories', 'songs', 'approvals', 'prefs', 'security', 'setup',
];

export function writesFor(data: AppData, slices: Slice[]): SliceWrite {
  const writes: Required<SliceWrite> = { kv: {}, collections: {} };
  for (const slice of slices) {
    if (COLLECTION_SLICES.has(slice)) {
      writes.collections[slice as CollectionName] = data[slice as CollectionName];
    } else {
      writes.kv[slice as KvKey] = data[slice];
    }
  }
  return writes;
}

function normaliseApprovals(stored: Partial<Approvals> | undefined): Approvals {
  const base = emptyApprovals();
  return { ...base, ...stored, contact: { ...base.contact, ...(stored?.contact ?? {}) } };
}

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function writeAll(backend: Backend, data: AppData): Promise<void> {
  const writes = writesFor(data, ALL_SLICES);
  writes.kv = { ...writes.kv, meta: { seeded: true, version: META_VERSION } satisfies Meta };
  await backend.write(writes);
}

async function sampleSecurity(): Promise<Security> {
  return { personPin: await hashPin(SAMPLE_PIN), helperPin: null, lockEnabled: true, lockHelp: true };
}

/** Deletes everything, then loads the fictional sample family. */
export async function seedSample(backend: Backend, loader: DemoMediaLoader): Promise<AppData> {
  await backend.clearAll();
  const available = await loader(backend);
  const data: AppData = { ...stripMissingMedia(demoAppData(), available), security: await sampleSecurity() };
  await writeAll(backend, data);
  return data;
}

export async function loadAppData(backend: Backend): Promise<AppData> {
  const meta = await backend.getKV<Meta>('meta');
  if (!meta?.seeded) {
    // A new install: start empty. The sample family loads only when asked for.
    const data = emptyAppData();
    await writeAll(backend, data);
    return data;
  }

  const [profile, home, schedule, approvals, prefs, security, setup, contacts, routines, memories, songs] = await Promise.all([
    backend.getKV<AppData['profile']>('profile'),
    backend.getKV<AppData['home']>('home'),
    backend.getKV<AppData['schedule']>('schedule'),
    backend.getKV<Approvals>('approvals'),
    backend.getKV<AppData['prefs']>('prefs'),
    backend.getKV<Security>('security'),
    backend.getKV<SetupState>('setup'),
    backend.getAll<AppData['contacts'][number]>('contacts'),
    backend.getAll<AppData['routines'][number]>('routines'),
    backend.getAll<AppData['memories'][number]>('memories'),
    backend.getAll<AppData['songs'][number]>('songs'),
  ]);

  const data: AppData = {
    profile: { ...emptyProfile(), ...profile },
    home: { ...emptyPlace(), ...home },
    schedule: { ...emptySchedule(), ...schedule },
    approvals: normaliseApprovals(approvals),
    prefs: { ...defaultPrefs(), ...prefs },
    security: { ...emptySecurity(), ...security },
    setup: { ...newSetup(), ...setup },
    // Contacts saved before voice messages existed have no voice field.
    contacts: contacts.map((c) => ({ ...c, voice: c.voice ?? null })).sort(byOrder),
    routines: [...routines].sort(byOrder),
    memories: [...memories].sort(byOrder),
    songs: [...songs].sort(byOrder),
  };

  if (!setup) {
    // Saved before Foundation, so this is the demo profile: open it as the sample family.
    data.setup = { mode: 'sample', wizardStep: null, lastBackupAt: null };
    data.security = await sampleSecurity();
    const writes = writesFor(data, ['security', 'setup']);
    writes.kv = { ...writes.kv, meta: { seeded: true, version: META_VERSION } satisfies Meta };
    await backend.write(writes);
  }
  return data;
}

/** Deletes everything and starts with a blank profile and an empty locked preview. */
export async function eraseEverything(backend: Backend): Promise<AppData> {
  await backend.clearAll();
  const data = emptyAppData();
  await writeAll(backend, data);
  return data;
}

/**
 * Removes stored media that no record references any more. Ids in `protect`
 * (for example, a photo chosen in a form that has not been saved yet) are kept.
 */
export async function collectGarbage(
  backend: Backend,
  data: AppData,
  protect: ReadonlySet<MediaId> = new Set(),
): Promise<MediaId[]> {
  const referenced = new Set(mediaRefs(data));
  const stale = (await backend.listMediaIds()).filter((id) => !referenced.has(id) && !protect.has(id));
  await backend.deleteMedia(stale);
  return stale;
}

/** Everything a backup needs: all data, plus each stored media record the data refers to. */
export async function collectBackup(backend: Backend, data: AppData): Promise<BackupContents> {
  const media: MediaRecord[] = [];
  for (const id of mediaRefs(data)) {
    const record = await backend.getMedia(id);
    if (record) media.push(record);
  }
  return { data, media };
}

export async function estimateBackupBytes(backend: Backend, data: AppData): Promise<number> {
  const { media } = await collectBackup(backend, data);
  return JSON.stringify(data).length + media.reduce((n, m) => n + m.blob.size, 0);
}

/**
 * Replaces everything with a backup. Media goes first and the data plus meta
 * last, so an interrupted restore looks like a new install and can be retried.
 */
export async function restoreBackupContents(backend: Backend, { data, media }: BackupContents): Promise<AppData> {
  await backend.clearAll();
  for (const m of media) await backend.putMedia(m);
  await writeAll(backend, { ...data, setup: { ...data.setup, mode: 'real', wizardStep: null } });
  return loadAppData(backend);
}
