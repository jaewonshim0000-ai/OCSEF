import { describe, expect, it } from 'vitest';
import { claimPlayback, foregroundActive, releasePlayback, stopAllPlayback, subscribeForeground } from '../lib/playback';

describe('foreground sounds', () => {
  it('tells background music when a sound starts and ends, without flicker between two sounds', () => {
    const heard: boolean[] = [];
    const unsubscribe = subscribeForeground((active) => heard.push(active));
    let firstStopped = false;
    const first = claimPlayback(() => {
      firstStopped = true;
      releasePlayback(first);
    });
    expect(foregroundActive()).toBe(true);
    // A second sound replaces the first: still busy the whole time.
    const second = claimPlayback(() => releasePlayback(second));
    expect(firstStopped).toBe(true);
    expect(heard).toEqual([true]);
    releasePlayback(second);
    expect(heard).toEqual([true, false]);
    expect(foregroundActive()).toBe(false);
    unsubscribe();
  });

  it('stopAllPlayback ends the current sound and announces it once', () => {
    const heard: boolean[] = [];
    const unsubscribe = subscribeForeground((active) => heard.push(active));
    let stopped = 0;
    const token = claimPlayback(() => {
      stopped++;
      releasePlayback(token);
    });
    stopAllPlayback();
    expect(stopped).toBe(1);
    expect(heard).toEqual([true, false]);
    unsubscribe();
    // Unsubscribed listeners hear nothing more.
    const again = claimPlayback(() => undefined);
    releasePlayback(again);
    expect(heard).toEqual([true, false]);
  });
});
