/**
 * Only one sound at a time: starting a recording, Read aloud or a microphone
 * recording stops whatever else was playing. Background music is not one of
 * these sounds: it listens with `subscribeForeground` and steps aside while
 * any of them is active, then carries on.
 */

type Stopper = () => void;
type Listener = (active: boolean) => void;

let current: { token: symbol; stop: Stopper } | null = null;
let announced = false;
/** Above zero while claimPlayback is stopping the previous sound. */
let switching = 0;
const listeners = new Set<Listener>();

/** Tells listeners when a foreground sound starts or ends, without flicker between two sounds. */
function announce(): void {
  if (switching) return;
  const active = current !== null;
  if (active === announced) return;
  announced = active;
  for (const listener of Array.from(listeners)) listener(active);
}

export function claimPlayback(stop: Stopper): symbol {
  switching++;
  try {
    if (current) current.stop();
  } finally {
    switching--;
  }
  const token = Symbol('playback');
  current = { token, stop };
  announce();
  return token;
}

export function releasePlayback(token: symbol): void {
  if (current?.token === token) {
    current = null;
    announce();
  }
}

export function stopAllPlayback(): void {
  if (current) {
    const { stop } = current;
    current = null;
    stop();
  }
  if (speechAvailable()) window.speechSynthesis.cancel();
  announce();
}

/** True while a recording, Read aloud or the microphone is in use. */
export function foregroundActive(): boolean {
  return current !== null;
}

export function subscribeForeground(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function speechAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  );
}
