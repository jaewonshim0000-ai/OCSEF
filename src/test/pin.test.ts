import { describe, expect, it } from 'vitest';
import { PIN_ITERATIONS, fromBase64, hashPin, toBase64, verifyPin } from '../lib/pin';

describe('PIN hashing', () => {
  it('verifies the PIN it hashed', async () => {
    const h = await hashPin('2580');
    expect(await verifyPin('2580', h)).toBe(true);
  });

  it('rejects a different PIN', async () => {
    const h = await hashPin('2580');
    expect(await verifyPin('2581', h)).toBe(false);
    expect(await verifyPin('', h)).toBe(false);
  });

  it('salts every hash, so the same PIN gives a different hash each time', async () => {
    const a = await hashPin('123456');
    const b = await hashPin('123456');
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
    expect(a.iterations).toBe(PIN_ITERATIONS);
    expect(fromBase64(a.salt)).toHaveLength(16);
    expect(fromBase64(a.hash)).toHaveLength(32);
  });

  it('round-trips base64', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual([0, 1, 127, 128, 255]);
  });
});
