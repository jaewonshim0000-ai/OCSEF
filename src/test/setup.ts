import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// jsdom has no object URLs or media playback; provide small stand-ins.
if (!URL.createObjectURL) {
  let n = 0;
  URL.createObjectURL = () => `blob:test/${++n}`;
  URL.revokeObjectURL = () => undefined;
}

HTMLMediaElement.prototype.play = function play() {
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function pause() {};

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}
