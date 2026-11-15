import { afterEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ on: false }));
const fs = vi.hoisted(() => ({ writeFile: vi.fn() }));
const share = vi.hoisted(() => ({ share: vi.fn() }));
const tts = vi.hoisted(() => ({ speak: vi.fn(), stop: vi.fn() }));
vi.mock('../lib/native', () => ({ isNative: () => native.on }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: fs, Directory: { Cache: 'CACHE' } }));
vi.mock('@capacitor/share', () => ({ Share: share }));
vi.mock('@capacitor-community/text-to-speech', () => ({ TextToSpeech: tts }));

import { saveBackupFile } from '../lib/backup';
import { isStoragePersisted, persistStorage } from '../lib/db';
import { cancelSpeech, speak, speechAvailable } from '../lib/speech';

afterEach(() => {
  native.on = false;
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('backups in the Android app', () => {
  it('writes the file to the app cache and opens the share sheet', async () => {
    native.on = true;
    fs.writeFile.mockResolvedValue({ uri: 'file:///cache/b.fpbackup' });
    share.share.mockResolvedValue({});
    expect(await saveBackupFile(new Blob(['abc']), 'b.fpbackup')).toBe(true);
    expect(fs.writeFile).toHaveBeenCalledWith({ path: 'b.fpbackup', data: btoa('abc'), directory: 'CACHE' });
    expect(share.share).toHaveBeenCalledWith(expect.objectContaining({ files: ['file:///cache/b.fpbackup'] }));
  });

  it('reports a cancelled share sheet as not saved', async () => {
    native.on = true;
    fs.writeFile.mockResolvedValue({ uri: 'file:///cache/b.fpbackup' });
    share.share.mockRejectedValue(new Error('Share canceled'));
    expect(await saveBackupFile(new Blob(['abc']), 'b.fpbackup')).toBe(false);
  });

  it('still downloads in a browser', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    expect(await saveBackupFile(new Blob(['abc']), 'b.fpbackup')).toBe(true);
    expect(click).toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
});

describe('storage in the Android app', () => {
  it('counts as kept for good', async () => {
    native.on = true;
    expect(await isStoragePersisted()).toBe(true);
    expect(await persistStorage()).toBe(true);
  });
});

describe('Read aloud in the Android app', () => {
  it("uses the phone's text-to-speech and reports when it ends", async () => {
    native.on = true;
    tts.speak.mockResolvedValue(undefined);
    tts.stop.mockResolvedValue(undefined);
    expect(speechAvailable()).toBe(true);
    const onEnd = vi.fn();
    speak('Hello Ada', onEnd);
    expect(tts.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hello Ada' }));
    await vi.waitFor(() => expect(onEnd).toHaveBeenCalled());
    cancelSpeech();
    expect(tts.stop).toHaveBeenCalled();
  });
});
