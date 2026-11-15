import { describe, expect, it } from 'vitest';
import { BackupError, backupFilename, blobBytes, decodeBackup, encodeBackup, formatBytes } from '../lib/backup';
import { MemoryBackend } from '../lib/db';
import { hashPin, verifyPin } from '../lib/pin';
import { collectBackup, loadAppData, restoreBackupContents, seedSample, writesFor, type DemoMediaLoader } from '../lib/repo';
import { DEMO_MEDIA } from '../lib/seed';
import type { AppData } from '../lib/types';

const PW = 'correct horse battery';

const allMedia: DemoMediaLoader = async (backend) => {
  const ids = new Set<string>();
  for (const [id, { mime }] of Object.entries(DEMO_MEDIA)) {
    await backend.putMedia({ id, blob: new Blob([`bytes of ${id}`], { type: mime }), mime, createdAt: 7 });
    ids.add(id);
  }
  return ids;
};

/** A set-up ("real") profile built from the sample family, with real PINs. */
async function realBackend(): Promise<{ backend: MemoryBackend; data: AppData }> {
  const backend = new MemoryBackend();
  const sample = await seedSample(backend, allMedia);
  const data: AppData = {
    ...sample,
    setup: { mode: 'real', wizardStep: null, lastBackupAt: null },
    security: { personPin: await hashPin('1357'), helperPin: await hashPin('246810'), lockEnabled: true, lockHelp: true },
  };
  await backend.write(writesFor(data, ['security', 'setup']));
  return { backend, data };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof BackupError ? e.code : `unexpected: ${String(e)}`;
  }
}

describe('backup files', () => {
  it('round-trips every slice and every media byte', async () => {
    const { backend, data } = await realBackend();
    const contents = await collectBackup(backend, data);
    expect(contents.media.length).toBeGreaterThan(5);
    const back = await decodeBackup(await encodeBackup(contents, PW), PW);
    expect(back.data).toEqual(data);
    expect(back.media.map((m) => m.id).sort()).toEqual(contents.media.map((m) => m.id).sort());
    for (const m of back.media) {
      const original = contents.media.find((x) => x.id === m.id)!;
      expect(new TextDecoder().decode(await blobBytes(m.blob))).toBe(new TextDecoder().decode(await blobBytes(original.blob)));
      expect(m.mime).toBe(original.mime);
      expect(m.createdAt).toBe(7);
    }
  });

  it('leaves out media nothing refers to', async () => {
    const { backend, data } = await realBackend();
    await backend.putMedia({ id: 'orphan', blob: new Blob(['x']), mime: 'image/png', createdAt: 0 });
    const contents = await collectBackup(backend, data);
    expect(contents.media.some((m) => m.id === 'orphan')).toBe(false);
  });

  it('rejects a wrong password', async () => {
    const { backend, data } = await realBackend();
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    expect(await codeOf(decodeBackup(file, 'not the password'))).toBe('password');
  });

  it('rejects files that are not backups', async () => {
    expect(await codeOf(decodeBackup(new Blob([]), PW))).toBe('not-backup');
    expect(await codeOf(decodeBackup(new Blob(['a photo, not a backup, but long enough to have a header']), PW))).toBe('not-backup');
  });

  it('rejects a backup from a newer version', async () => {
    const { backend, data } = await realBackend();
    const bytes = await blobBytes(await encodeBackup(await collectBackup(backend, data), PW));
    bytes[4] = 2;
    expect(await codeOf(decodeBackup(new Blob([bytes]), PW))).toBe('newer');
  });

  it('rejects a truncated or altered file without changing anything', async () => {
    const { backend, data } = await realBackend();
    const bytes = await blobBytes(await encodeBackup(await collectBackup(backend, data), PW));
    expect(await codeOf(decodeBackup(new Blob([bytes.slice(0, bytes.length - 10)]), PW))).toBe('password');
    const altered = bytes.slice();
    altered[60] ^= 1;
    expect(await codeOf(decodeBackup(new Blob([altered]), PW))).toBe('password');
  });

  it('restores onto another phone as a real profile, with the PINs from the backup', async () => {
    const { backend, data } = await realBackend();
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    const target = new MemoryBackend();
    await target.putMedia({ id: 'old', blob: new Blob(['old']), mime: 'image/png', createdAt: 0 });
    const restored = await restoreBackupContents(target, await decodeBackup(file, PW));
    expect(restored.profile).toEqual(data.profile);
    expect(restored.contacts).toEqual(data.contacts);
    expect(restored.setup).toEqual({ mode: 'real', wizardStep: null, lastBackupAt: null });
    expect(await verifyPin('1357', restored.security.personPin!)).toBe(true);
    expect(await verifyPin('246810', restored.security.helperPin!)).toBe(true);
    expect(await target.listMediaIds()).not.toContain('old');
    expect(await loadAppData(target)).toEqual(restored);
  });

  it('still backs up and restores when a referenced photo is missing from storage', async () => {
    const { backend, data } = await realBackend();
    const mayaPhoto = data.contacts.find((c) => c.name === 'Maya')?.photo?.id;
    expect(mayaPhoto).toBeTruthy();
    await backend.deleteMedia([mayaPhoto!]);
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    const target = new MemoryBackend();
    const restored = await restoreBackupContents(target, await decodeBackup(file, PW));
    // The reference stays, so the app shows its missing-photo state.
    expect(restored.contacts.find((c) => c.name === 'Maya')?.photo?.id).toBe(mayaPhoto);
    expect(await target.getMedia(mayaPhoto!)).toBeUndefined();
  });

  it('names files by date and formats sizes', () => {
    expect(backupFilename(new Date(2026, 10, 4))).toBe('familiar-place-backup-2026-11-04.fpbackup');
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
