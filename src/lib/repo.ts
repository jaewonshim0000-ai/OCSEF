import type { Backend, CollectionName, KvKey, SliceWrite } from './db';
import {
  defaultPrefs,
  emptyAppData,
  emptyApprovals,
  emptyPlace,
  emptyProfile,
  emptySchedule,
} from './defaults';
import { DEMO_MEDIA, demoAppData } from './seed';
import type { AppData, Approvals, AudioRef, MediaId, PhotoRef } from './types';

interface Meta {
  seeded: boolean;
  version: number;
}

const META_VERSION = 1;

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
export const ALL_SLICES: Slice[] = ['profile', 'home', 'contacts', 'schedule', 'routines', 'memories', 'songs', 'approvals', 'prefs'];

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

async function writeAll(backend: Backend, data: AppData): Promise<void> {
  const writes = writesFor(data, ALL_SLICES);
  writes.kv = { ...writes.kv, meta: { seeded: true, version: META_VERSION } satisfies Meta };
  await backend.write(writes);
}

export async function seedDemo(backend: Backend, loader: DemoMediaLoader): Promise<AppData> {
  const available = await loader(backend);
  const data = stripMissingMedia(demoAppData(), available);
  await writeAll(backend, data);
  return data;
}

export async function loadAppData(backend: Backend, loader: DemoMediaLoader): Promise<AppData> {
  const meta = await backend.getKV<Meta>('meta');
  if (!meta?.seeded) return seedDemo(backend, loader);

  const [profile, home, schedule, approvals, prefs, contacts, routines, memories, songs] = await Promise.all([
    backend.getKV<AppData['profile']>('profile'),
    backend.getKV<AppData['home']>('home'),
    backend.getKV<AppData['schedule']>('schedule'),
    backend.getKV<Approvals>('approvals'),
    backend.getKV<AppData['prefs']>('prefs'),
    backend.getAll<AppData['contacts'][number]>('contacts'),
    backend.getAll<AppData['routines'][number]>('routines'),
    backend.getAll<AppData['memories'][number]>('memories'),
    backend.getAll<AppData['songs'][number]>('songs'),
  ]);

  return {
    profile: { ...emptyProfile(), ...profile },
    home: { ...emptyPlace(), ...home },
    schedule: { ...emptySchedule(), ...schedule },
    approvals: normaliseApprovals(approvals),
    prefs: { ...defaultPrefs(), ...prefs },
    // Contacts saved before voice messages existed have no voice field.
    contacts: contacts.map((c) => ({ ...c, voice: c.voice ?? null })).sort(byOrder),
    routines: [...routines].sort(byOrder),
    memories: [...memories].sort(byOrder),
    songs: [...songs].sort(byOrder),
  };
}

/** Deletes saved edits and media, then restores the fictional demo profile. */
export async function resetToDemo(backend: Backend, loader: DemoMediaLoader): Promise<AppData> {
  await backend.clearAll();
  return seedDemo(backend, loader);
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
