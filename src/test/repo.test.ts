import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { IdbBackend, MemoryBackend, openIdb, type Backend } from '../lib/db';
import { buildLockedPreview, isPreviewEmpty } from '../lib/preview';
import {
  collectGarbage,
  eraseEverything,
  loadAppData,
  mediaRefs,
  resetToDemo,
  stripMissingMedia,
  writesFor,
  type DemoMediaLoader,
} from '../lib/repo';
import { DEMO_MEDIA, demoAppData } from '../lib/seed';

const noMedia: DemoMediaLoader = async () => new Set();

const allMedia: DemoMediaLoader = async (backend) => {
  const ids = new Set<string>();
  for (const [id, { mime }] of Object.entries(DEMO_MEDIA)) {
    await backend.putMedia({ id, blob: new Blob(['x'], { type: mime }), mime, createdAt: 0 });
    ids.add(id);
  }
  return ids;
};

async function freshIdb(): Promise<Backend> {
  return new IdbBackend(await openIdb(new IDBFactory()));
}

describe('IndexedDB storage', () => {
  it('seeds the demo profile on first load and reads it back later', async () => {
    const backend = await freshIdb();
    const first = await loadAppData(backend, noMedia);
    expect(first.profile.preferredName).toBe('Peggy');
    expect(first.contacts.map((c) => c.name)).toEqual(['Maya', 'Sam', 'Priya']);
    expect(first.songs.map((s) => s.title)).toEqual(['The Riverside Waltz', "Peggy's lullaby", "Sunday hymns at St Mary's"]);
    // Media that could not be stored is not referenced.
    expect(mediaRefs(first)).toEqual([]);

    const again = await loadAppData(backend, async () => {
      throw new Error('should not reseed');
    });
    expect(again).toEqual(first);
  });

  it('persists a changed slice atomically', async () => {
    const backend = await freshIdb();
    const data = await loadAppData(backend, noMedia);
    const next = { ...data, approvals: { ...data.approvals, homeCue: false }, contacts: data.contacts.slice(0, 1) };
    await backend.write(writesFor(next, ['approvals', 'contacts']));
    const loaded = await loadAppData(backend, noMedia);
    expect(loaded.approvals.homeCue).toBe(false);
    expect(loaded.contacts).toHaveLength(1);
    expect(buildLockedPreview(loaded).home.cue).toBeNull();
  });

  it('erasing leaves an empty locked preview and no data', async () => {
    const backend = await freshIdb();
    await loadAppData(backend, noMedia);
    const erased = await eraseEverything(backend);
    expect(isPreviewEmpty(buildLockedPreview(erased))).toBe(true);
    const loaded = await loadAppData(backend, noMedia);
    expect(loaded.contacts).toEqual([]);
    expect(loaded.profile.preferredName).toBe('');
  });

  it('restoring the demo deletes edits', async () => {
    const backend = await freshIdb();
    const data = await loadAppData(backend, noMedia);
    await backend.write(writesFor({ ...data, profile: { ...data.profile, preferredName: 'Changed' } }, ['profile']));
    const restored = await resetToDemo(backend, noMedia);
    expect(restored.profile.preferredName).toBe('Peggy');
    expect((await loadAppData(backend, noMedia)).profile.preferredName).toBe('Peggy');
  });
});

describe('database upgrade', () => {
  it('opens a version 1 database, keeps its data, and adds the songs store', async () => {
    const factory = new IDBFactory();
    await new Promise<void>((resolve, reject) => {
      const req = factory.open('familiar-place', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('kv');
        for (const name of ['contacts', 'routines', 'memories', 'media']) db.createObjectStore(name, { keyPath: 'id' });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['kv', 'contacts'], 'readwrite');
        tx.objectStore('kv').put({ seeded: true, version: 1 }, 'meta');
        tx.objectStore('kv').put({ preferredName: 'Ada', photo: null, intro: '', details: [], voice: null }, 'profile');
        tx.objectStore('contacts').put({ id: 'c1', name: 'Lee', relationship: 'Friend', photo: null, phone: '1', primary: true, order: 0 });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const backend = new IdbBackend(await openIdb(factory));
    const data = await loadAppData(backend, noMedia);
    expect(data.profile.preferredName).toBe('Ada');
    expect(data.contacts.map((c) => c.name)).toEqual(['Lee']);
    // Contacts saved before voice messages existed get an empty message.
    expect(data.contacts[0].voice).toBeNull();
    expect(data.songs).toEqual([]);
    const song = { id: 's1', title: 'Song', artist: '', note: '', photo: null, audio: null, order: 0 };
    await backend.write(writesFor({ ...data, songs: [song] }, ['songs']));
    expect((await loadAppData(backend, noMedia)).songs.map((x) => x.title)).toEqual(['Song']);
  });
});

describe('media', () => {
  it('keeps references to media that was stored', async () => {
    const backend = new MemoryBackend();
    const data = await loadAppData(backend, allMedia);
    expect(mediaRefs(data)).toContain('demo-maya');
    expect(mediaRefs(data)).toEqual(
      expect.arrayContaining(['demo-song-waltz', 'demo-song-lullaby', 'demo-record-player', 'demo-maya-message', 'demo-sam-message']),
    );
    expect(data.contacts[0].photo?.id).toBe('demo-maya');
  });

  it('cleans up unreferenced media but keeps protected ids', async () => {
    const backend = new MemoryBackend();
    const data = await loadAppData(backend, allMedia);
    await backend.putMedia({ id: 'orphan', blob: new Blob(['o']), mime: 'image/png', createdAt: 0 });
    await backend.putMedia({ id: 'draft', blob: new Blob(['d']), mime: 'image/png', createdAt: 0 });
    const withoutMemories = { ...data, memories: [], songs: data.songs.filter((s) => s.id !== 'song-lullaby') };
    const removed = await collectGarbage(backend, withoutMemories, new Set(['draft']));
    expect(removed).toContain('orphan');
    expect(removed).toContain('demo-beach');
    expect(removed).toContain('demo-song-lullaby');
    expect(removed).not.toContain('demo-song-waltz');
    expect(removed).not.toContain('draft');
    expect(removed).not.toContain('demo-maya');
    expect(await backend.getMedia('draft')).toBeDefined();
    expect(await backend.getMedia('orphan')).toBeUndefined();
  });

  it('reset deletes all stored media', async () => {
    const backend = new MemoryBackend();
    await loadAppData(backend, allMedia);
    await backend.putMedia({ id: 'mine', blob: new Blob(['m']), mime: 'image/png', createdAt: 0 });
    await resetToDemo(backend, noMedia);
    expect(await backend.listMediaIds()).toEqual([]);
  });

  it('strips references to missing media', () => {
    const data = stripMissingMedia(demoAppData(), new Set(['demo-maya']));
    expect(mediaRefs(data)).toEqual(['demo-maya']);
    expect(data.profile.photo).toBeNull();
    expect(data.routines[0].steps[1].audio).toBeNull();
  });
});
