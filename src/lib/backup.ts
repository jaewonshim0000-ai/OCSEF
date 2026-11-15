import type { AppData, MediaRecord } from './types';

/**
 * Encrypted backup files (.fpbackup), format version 1.
 *
 *   offset 0   "FPBK"
 *   offset 4   format version (1 byte)
 *   offset 5   PBKDF2 salt (16 bytes)
 *   offset 21  AES-GCM IV (12 bytes)
 *   offset 33  AES-GCM ciphertext; bytes 0–4 are authenticated as additional data
 *
 * Payload: u32 big-endian manifest length | manifest JSON (UTF-8) | media bytes.
 */
// ponytail: the whole file is built and read in memory; fine up to a few hundred MB. Switch to chunked encryption if real profiles grow past that.

export const BACKUP_FORMAT = 1;
export const BACKUP_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

const MAGIC = [0x46, 0x50, 0x42, 0x4b]; // "FPBK"
const HEADER = 5;
const SALT = 16;
const IV = 12;

export type BackupErrorCode = 'not-backup' | 'newer' | 'password' | 'damaged';

export const BACKUP_ERRORS: Record<BackupErrorCode, string> = {
  'not-backup': "This file isn't a Familiar Place backup.",
  newer: 'This backup was made by a newer version of Familiar Place.',
  password: "That password didn't open this backup.",
  damaged: "This backup is damaged and can't be used.",
};

export class BackupError extends Error {
  constructor(readonly code: BackupErrorCode) {
    super(BACKUP_ERRORS[code]);
    this.name = 'BackupError';
  }
}

export interface BackupContents {
  data: AppData;
  media: MediaRecord[];
}

interface ManifestMedia {
  id: string;
  mime: string;
  createdAt: number;
  offset: number;
  length: number;
}

interface Manifest {
  app: 'familiar-place';
  format: number;
  createdAt: number;
  data: AppData;
  media: ManifestMedia[];
}

const REQUIRED_SLICES: Array<keyof AppData> = [
  'profile', 'home', 'contacts', 'schedule', 'routines', 'memories', 'songs', 'approvals', 'prefs', 'security', 'setup',
];

/** A Blob's bytes. jsdom's Blob has no arrayBuffer(), so fall back to FileReader. */
export function blobBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer().then((b) => new Uint8Array(b));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: BACKUP_ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encodeBackup({ data, media }: BackupContents, password: string, now = Date.now()): Promise<Blob> {
  const bodies = await Promise.all(media.map((m) => blobBytes(m.blob)));
  let offset = 0;
  const entries: ManifestMedia[] = media.map((m, i) => {
    const entry = { id: m.id, mime: m.mime, createdAt: m.createdAt, offset, length: bodies[i].length };
    offset += bodies[i].length;
    return entry;
  });
  const manifest: Manifest = { app: 'familiar-place', format: BACKUP_FORMAT, createdAt: now, data, media: entries };
  const json = new TextEncoder().encode(JSON.stringify(manifest));

  const payload = new Uint8Array(4 + json.length + offset);
  new DataView(payload.buffer).setUint32(0, json.length);
  payload.set(json, 4);
  bodies.forEach((b, i) => payload.set(b, 4 + json.length + entries[i].offset));

  const header = new Uint8Array([...MAGIC, BACKUP_FORMAT]);
  const salt = crypto.getRandomValues(new Uint8Array(SALT));
  const iv = crypto.getRandomValues(new Uint8Array(IV));
  const key = await deriveKey(password, salt);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, payload));
  return new Blob([header, salt, iv, cipher], { type: 'application/octet-stream' });
}

export async function decodeBackup(file: Blob, password: string): Promise<BackupContents> {
  const bytes = await blobBytes(file);
  if (bytes.length < HEADER + SALT + IV || MAGIC.some((b, i) => bytes[i] !== b)) throw new BackupError('not-backup');
  if (bytes[4] > BACKUP_FORMAT) throw new BackupError('newer');
  if (bytes[4] !== BACKUP_FORMAT) throw new BackupError('damaged');

  const header = bytes.slice(0, HEADER);
  const salt = bytes.slice(HEADER, HEADER + SALT);
  const iv = bytes.slice(HEADER + SALT, HEADER + SALT + IV);
  const key = await deriveKey(password, salt);
  let payload: Uint8Array<ArrayBuffer>;
  try {
    payload = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: header }, key, bytes.slice(HEADER + SALT + IV)),
    );
  } catch {
    // AES-GCM can't tell a wrong password from an altered file; a wrong password is far more likely.
    throw new BackupError('password');
  }
  return parsePayload(payload);
}

function parsePayload(payload: Uint8Array<ArrayBuffer>): BackupContents {
  if (payload.length < 4) throw new BackupError('damaged');
  const start = 4 + new DataView(payload.buffer).getUint32(0);
  if (start > payload.length) throw new BackupError('damaged');

  let manifest: Manifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(payload.subarray(4, start))) as Manifest;
  } catch {
    throw new BackupError('damaged');
  }
  if (manifest?.app !== 'familiar-place' || !manifest.data || typeof manifest.data !== 'object' || !Array.isArray(manifest.media)) {
    throw new BackupError('damaged');
  }
  if (REQUIRED_SLICES.some((s) => !(s in manifest.data))) throw new BackupError('damaged');

  const mediaBytes = payload.length - start;
  const media: MediaRecord[] = manifest.media.map((m) => {
    const ok =
      typeof m.id === 'string' &&
      typeof m.mime === 'string' &&
      Number.isInteger(m.offset) &&
      Number.isInteger(m.length) &&
      m.offset >= 0 &&
      m.length >= 0 &&
      m.offset + m.length <= mediaBytes;
    if (!ok) throw new BackupError('damaged');
    const body = payload.slice(start + m.offset, start + m.offset + m.length);
    return { id: m.id, mime: m.mime, createdAt: m.createdAt, blob: new Blob([body], { type: m.mime }) };
  });
  return { data: manifest.data, media };
}

export function backupFilename(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `familiar-place-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.fpbackup`;
}

/** Hands the file to the browser as a download. Sub-project 2 replaces this on Android. */
export function saveBackupFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
