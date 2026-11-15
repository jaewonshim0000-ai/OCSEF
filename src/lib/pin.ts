import type { PinHash } from './types';

/**
 * PIN hashing with the browser's own Web Crypto (PBKDF2-SHA256).
 *
 * Limit: anyone who can copy this app's storage can brute-force a 4- or
 * 6-digit PIN in seconds. The hash stops casual snooping only; the phone's
 * own lock is the real protection.
 */

export const PIN_ITERATIONS = 100_000;

/** Thrown when the browser has no Web Crypto, e.g. on a non-https address. */
export class PinUnavailableError extends Error {
  constructor() {
    super('Web Crypto is not available');
    this.name = 'PinUnavailableError';
  }
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) throw new PinUnavailableError();
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPin(pin: string, iterations = PIN_ITERATIONS): Promise<PinHash> {
  if (!globalThis.crypto?.subtle) throw new PinUnavailableError();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, iterations);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations };
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const actual = await derive(pin, fromBase64(stored.salt), stored.iterations);
  const expected = fromBase64(stored.hash);
  if (actual.length !== expected.length) return false;
  // Constant-time comparison.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
