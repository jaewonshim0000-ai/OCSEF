import { Capacitor } from '@capacitor/core';

/** True inside the Android app, false in a browser. */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
