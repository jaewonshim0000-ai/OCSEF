import type { Backend } from './db';
import type { MediaId } from './types';

/** Object-URL cache for stored media. Media records are immutable per id. */
export class MediaCache {
  private urls = new Map<MediaId, Promise<string | null>>();
  constructor(private backend: Backend) {}

  setBackend(backend: Backend): void {
    this.backend = backend;
  }

  url(id: MediaId): Promise<string | null> {
    let entry = this.urls.get(id);
    if (!entry) {
      entry = this.backend
        .getMedia(id)
        .then((rec) => (rec ? URL.createObjectURL(rec.blob) : null))
        .catch(() => null);
      this.urls.set(id, entry);
      // Do not cache a miss: the record may be written moments later.
      entry.then((u) => {
        if (u === null && this.urls.get(id) === entry) this.urls.delete(id);
      });
    }
    return entry;
  }

  forget(ids: MediaId[]): void {
    for (const id of ids) {
      const entry = this.urls.get(id);
      this.urls.delete(id);
      entry?.then((u) => u && URL.revokeObjectURL(u));
    }
  }

  forgetAll(): void {
    this.forget(Array.from(this.urls.keys()));
  }
}

const MAX_IMAGE_DIMENSION = 1280;
const MAX_RAW_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    img.src = url;
  });
}

/**
 * Shrinks a chosen photo so local storage stays small. Returns a JPEG no
 * larger than 1280px on its longest side.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo file.');
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    throw new Error("This photo couldn't be opened. Try a JPG or PNG photo.");
  }
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
  const width = Math.max(1, Math.round((img.naturalWidth || MAX_IMAGE_DIMENSION) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || MAX_IMAGE_DIMENSION) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (file.size <= MAX_RAW_BYTES) return file;
    throw new Error('This photo is too large. Try a smaller photo.');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (blob) return blob;
  if (file.size <= MAX_RAW_BYTES) return file;
  throw new Error('This photo is too large. Try a smaller photo.');
}

export function recordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder === 'function' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}
