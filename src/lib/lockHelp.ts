import { registerPlugin } from '@capacitor/core';
import { isNative } from './native';

/**
 * Lock-screen help, Android only: a quiet "Tap for help" notification on the
 * phone's lock screen opens the help screen over the lock screen, in a
 * separate activity (see android/…/LockHelpActivity.java). In a browser,
 * every call is a no-op.
 */
interface LockHelpPlugin {
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean }>;
  isOverLock(): Promise<{ overLock: boolean }>;
  requestUnlock(): Promise<void>;
}

const LockHelp = registerPlugin<LockHelpPlugin>('LockHelp');

export function lockHelpAvailable(): boolean {
  return isNative();
}

/** Shows or removes the notification. Resolves false if it isn't showing (e.g. notifications refused). */
export async function setLockHelp(enabled: boolean): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await LockHelp.setEnabled({ enabled })).enabled;
  } catch {
    return false;
  }
}

/** True when this copy of the app was opened over the phone's lock screen. */
export async function isOverLock(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    return (await LockHelp.isOverLock()).overLock;
  } catch {
    return false;
  }
}

/** Asks the phone to unlock; once it does, the app opens normally. */
export async function requestUnlock(): Promise<void> {
  if (!isNative()) return;
  await LockHelp.requestUnlock().catch(() => undefined);
}
