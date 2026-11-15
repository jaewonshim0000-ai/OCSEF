# Android app — design (MVP sub-project 2)

**Date:** 2026-11-14
**Status:** Decided by Claude at the user's request ("stop asking questions and just decide on your own"). Every call below is recorded with its reason so it can be revisited.

## Context

Foundation (sub-project 1) made Familiar Place usable by a real family in a browser. The user then asked for every feature to "actually work — like calling, voice recording". In a desktop browser pane the microphone is blocked and there is no dialer; on a phone browser everything works but the app can't be reached from the phone's own lock screen, and "Add to Home Screen" needs a trusted certificate.

The user chose earlier: **web and Android, the same app packaged** (a Capacitor wrapper, not a rewrite). When the user clicked "Start Android app", the previous message had said the Android app would let help be reached from the phone's lock screen, so that is now in scope (decision 7).

## Success criteria

1. `npm run android:build` produces an installable debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`).
2. On an Android phone, the installed app does everything the web app does, working offline, and:
   - **Call** opens the phone's dialer with the number.
   - **Record** asks for the microphone once, then records.
   - **Choose photo** offers the camera or the gallery.
   - **Save a backup** opens the share sheet (Drive, Files, email…). **Restore** opens the file picker.
   - **Read aloud** speaks, using the phone's text-to-speech.
   - **Open in maps** opens the maps app.
3. With "Get help from the lock screen" on, a quiet notification sits on the phone's lock screen. Tapping it opens the help screen **over the lock screen without unlocking**. It shows only what the person chose to share. "Try PIN again" asks the phone to unlock, then opens the app normally.
4. The web app keeps working as before. `npm test`, `npm run typecheck` and `npm run build` pass.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Capacitor **8.6.0** (core, cli, android), pinned exactly. | Newest release at least two weeks old. It needs Node ≥ 22 (24 installed) and JDK 21 (installed). |
| 2 | App id `com.familiarplace.app`, name "Familiar Place". | Changing the id later breaks updates. This one is neutral and unique enough for sideloading. |
| 3 | Official plugins `@capacitor/filesystem` 8.1.5 and `@capacitor/share` 8.0.3 for backups. | Android's WebView ignores `<a download>` with blob URLs, so the file is written to the app cache and handed to the share sheet. |
| 4 | `@capacitor-community/text-to-speech` 8.0.2 for Read aloud on Android. | Android's WebView has no working `speechSynthesis`. A small `speech.ts` adapter picks native or web, so the screens don't change. |
| 5 | No service worker in the app. | The app's files are bundled in the APK, so offline works without it, and a worker could serve stale files after an update. |
| 6 | Storage counts as kept for good in the app. | App-private WebView storage is cleared only by uninstalling or "Clear data". The "browser may clear your data" note is hidden there. |
| 7 | **Lock-screen help** through a quiet, ongoing notification that opens a separate `LockHelpActivity` (`showWhenLocked`), which hosts the same web app in **over-lock mode**. | The phone only shows an activity over its lock screen if the manifest says so. Putting that flag on the main activity would show the whole app over the lock screen. A separate activity keeps the main app behind the phone's lock. |
| 8 | Over-lock mode shows the locked help views only. The in-app keypad is never shown there, so the in-app PIN can't unlock private screens over the phone's lock. "Try PIN again" calls `requestDismissKeyguard`. | The phone's lock stays the real protection. Over the lock screen the app shows exactly what it already shows when locked. |
| 9 | The notification text is generic: "Familiar Place" / "Tap for help". No name or photo. | Anyone can read a lock-screen notification. |
| 10 | Lock-screen help is on by default in real mode, with a switch in Settings → Lock. Off in sample and new modes. | Lock-screen help is the core promise, and the helper can turn it off. The sample family isn't a real person. |
| 11 | The notification is re-posted after a reboot (boot receiver) and whenever the app starts. | Otherwise it would vanish after a restart until someone opened the app. |
| 12 | Calls open the dialer (`tel:` → `ACTION_VIEW`), not a direct call. | No `CALL_PHONE` permission, so there's no accidental call from a stray tap and less for the Play Store to review. |
| 13 | Permissions: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `CAMERA`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`. | Recording, taking photos, and the lock-screen notification (runtime permission on Android 13+). |
| 14 | App icon: an adaptive vector icon redrawn from `public/favicon.svg` (house on blue). | No image tooling or extra dependency needed, and it stays sharp at every size. |
| 15 | Debug APK only. Release signing and Play Store listing are out of scope. | Enough to install on the family's phone. Store release is its own step. |
| 16 | The Android SDK uses the command-line tools only, no Android Studio. | A smaller download that can be scripted. Android Studio can be added later for an emulator. |

## Architecture

```
src/lib/native.ts       isNative(): boolean, one wrapper over Capacitor.isNativePlatform()
src/lib/speech.ts       speechAvailable(), speak(text, onEnd), cancelSpeech(): native TTS or speechSynthesis
src/lib/backup.ts       saveBackupFile(blob, name): Promise<boolean>. Native: cache file + share sheet
src/lib/db.ts           persistStorage / isStoragePersisted: true on native
src/lib/lockHelp.ts     typed wrapper for the custom LockHelp plugin (no-op on web)
src/app/nav.tsx         overLock flag: locked routes only, /lock → /help, "Try PIN again" → requestUnlock()
src/main.tsx            no service worker on native
capacitor.config.ts     appId, appName, webDir 'dist'
android/                generated by `cap add android`, then:
  app/src/main/AndroidManifest.xml   permissions, LockHelpActivity, BootReceiver
  app/src/main/java/com/familiarplace/app/
    MainActivity.java       registers LockHelpPlugin
    LockHelpActivity.java   BridgeActivity, showWhenLocked, separate task, excluded from recents
    LockHelpPlugin.java     setEnabled({enabled}), isOverLock(), requestUnlock()
    LockHelpNotifier.java   channel + ongoing notification, enabled flag in SharedPreferences
    BootReceiver.java       re-posts the notification after a reboot
  app/src/main/res/drawable/ic_launcher_foreground.xml, values/ic_launcher_background.xml
```

### The LockHelp plugin contract

- `setEnabled({ enabled: boolean }): Promise<{ enabled: boolean }>` saves the flag and posts or removes the notification. On Android 13+ it asks for the notification permission first. It resolves `enabled: false` if permission is denied.
- `isOverLock(): Promise<{ overLock: boolean }>` returns true only inside `LockHelpActivity` while the phone's lock screen is showing.
- `requestUnlock(): Promise<void>` asks the phone to unlock. When that succeeds it opens `MainActivity` and closes `LockHelpActivity`.

The web app syncs the flag once data has loaded and whenever `security.lockHelp` or the mode changes:

```
enabled = mode === 'real' && security.lockHelp
```

### Data

`Security` gains `lockHelp: boolean` (default `true`). Older saved data gets it from `emptySecurity()`, the same way other missing fields are filled in. Backups carry it automatically.

## Error handling

- **Share sheet cancelled:** `saveBackupFile` resolves `false`. The dialog stays open with no error, and "Last backup" doesn't change.
- **Writing the cache file fails:** the dialog shows "The backup couldn't be saved. Please try again."
- **Notification permission denied:** the Settings switch turns back off and a note says "Allow notifications for Familiar Place in the phone's settings to use this."
- **TTS fails or there's no TTS engine:** the Read aloud button behaves as if it finished, the same as a web speech error.
- **Over-lock and `requestUnlock` cancelled:** the help screen stays.

## Testing

- **Web unit and integration tests (Vitest)**, with `@capacitor/core` and the plugins mocked:
  - `saveBackupFile` on native writes and shares, and returns false when sharing is cancelled.
  - The speech adapter uses native TTS on native.
  - In over-lock mode, `/today` and `/lock` resolve to help, and "Try PIN again" calls `requestUnlock`.
  - The `lockHelp` switch calls `setEnabled`. A denied permission turns the switch back off.
- **Android:** `./gradlew assembleDebug` compiles the native code. Behaviour on a device (dialer, microphone, camera, share sheet, TTS, notification over the lock screen) is checked by hand on a real phone. There's no emulator in this environment, so the hand checks are listed in the README.

## Out of scope

Play Store release and signing, iOS, push notifications, direct calling, reminders at planned times (sub-project 3), and an emulator.
