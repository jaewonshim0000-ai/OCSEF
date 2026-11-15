# Foundation: from judging demo to real-use MVP

**Date:** 2026-11-14
**Status:** Approved in conversation; awaiting spec review
**Sub-project:** 1 of 5 in the Familiar Place MVP

## Context

Familiar Place is a working prototype built for judges. It ships a fictional family, a fixed PIN (`2580`), demo-only calls and a presenter-notes panel. The MVP turns it into an app a real person and their helper can install and use, on the web (installable PWA) and on Android (the same build packaged with Capacitor).

The MVP is split into five sub-projects. Each gets its own spec, plan, build and tests.

| # | Sub-project | Depends on |
|---|---|---|
| 1 | **Foundation** (this spec) | — |
| 2 | Android packaging (Capacitor, permissions, file saving, notifications, icon) | 1 |
| 3 | Richer daily plan (weekday schedules, reminders, routine log) | 1, 2 for Android reminders |
| 4 | Deeper people and places | 1 |
| 5 | Deeper memories and music | 1, best after 4 |

### What the user asked for

- An MVP for real families, on web and Android.
- Android is the same app packaged; the lock screen stays inside the app, with no hook into the phone's system lock.
- Every current feature stays.
- In-app lock: on by default, and the helper can switch it off.
- Backups: password-protected.

### Assumptions

- Data stays on the device. No accounts, cloud or sync. The helper sets up on the person's phone.
- No medical claims and no medication tracking.
- One person per install. English only.

### Success criteria

A family installs the app, sets it up from blank in one sitting with no demo leftovers, and the person uses it day to day. The existing privacy rule still holds: nothing appears before unlock unless someone approved it.

## Goals

1. Guided first-run setup that starts from an empty profile.
2. A real PIN for the person and a separate helper PIN for Helper setup, stored as hashes.
3. An in-app lock that the helper can switch off.
4. Encrypted backup and restore.
5. No demo frame, demo wording or demo calls outside an optional sample mode.
6. Existing installs and all current features keep working.

## Non-goals

Android packaging, notifications, schedule changes, new fields on contacts, places, memories or songs, sync, multiple people, translations and biometrics. Each belongs to a later sub-project or a later release.

## Data model

Two new slices join `AppData`, each stored under its own key in the existing `kv` store. The database version stays at 2 because no new object store is needed.

```ts
// src/lib/types.ts
export interface PinHash {
  salt: string;       // base64, 16 random bytes
  hash: string;       // base64, PBKDF2-SHA256 output (32 bytes)
  iterations: number; // 100_000 for PINs
}

export interface Security {
  /** Null when the in-app lock is off. */
  personPin: PinHash | null;
  /** Null only in 'new' mode before wizard step 1, and in 'sample' mode. */
  helperPin: PinHash | null;
  lockEnabled: boolean;
}

export type AppMode = 'new' | 'sample' | 'real';

export interface SetupState {
  mode: AppMode;
  /** First-run step to resume at (1–6). Null once setup is finished. */
  wizardStep: number | null;
  /** When the last backup file was produced (ms since epoch). */
  lastBackupAt: number | null;
}

export interface AppData {
  // …existing slices unchanged…
  security: Security;
  setup: SetupState;
}
```

`KV_KEYS` gains `'security'` and `'setup'`. The internal `Meta` record moves to version 2.

**Invariants**

- `mode === 'real' && security.lockEnabled` implies `security.personPin !== null`.
- `mode === 'real'` implies `security.helperPin !== null`.
- `buildLockedPreview` never reads `security` or `setup`.

### Modes

| Mode | How you get there | What it means |
|---|---|---|
| `new` | First launch, or after **Erase everything** | Only Welcome and the setup wizard render |
| `sample` | **Look around with a sample family** on Welcome, or an existing demo install | The fictional demo profile. Banner on every unlocked screen. Demo calls. Helper gate skipped. Person PIN is `2580`, and a **Use sample PIN** button appears on the keypad. |
| `real` | Finishing the wizard, or restoring a backup | Normal use |

### Migration

`loadAppData` handles three cases:

1. **No meta** (new install): write `emptyAppData()` with `setup.mode = 'new'`, `wizardStep = 1`. No sample media is fetched.
2. **Meta present, no `setup` key** (an install that ran the demo): keep all data and set `setup.mode = 'sample'`, with sample security (lock on, PIN `2580` hashed, no helper PIN).
3. **Both present**: load as normal.

## PIN hashing — `src/lib/pin.ts`

- `hashPin(pin: string): Promise<PinHash>` generates a 16-byte salt with `crypto.getRandomValues` and derives 32 bytes with `crypto.subtle` PBKDF2-SHA256 at 100,000 iterations.
- `verifyPin(pin: string, stored: PinHash): Promise<boolean>` re-derives the hash and compares in constant time.
- The person's PIN has 4 digits. The helper PIN has 6.

**Limit:** anyone who can copy the app's storage can brute-force a 4- or 6-digit PIN in seconds. The hashes only stop casual snooping, and the phone's own lock remains the real protection. The README states this.

## First run

### Welcome (`/welcome`)

The only reachable route in `new` mode, together with `/start`. Any other path redirects here.

- Heading: "Welcome to Familiar Place". One sentence: "Familiar Place helps someone get their bearings and reach a person they trust. Set it up together."
- **Set up for someone** (primary): goes to `/start`.
- **Look around with a sample family**: seeds the demo profile (current `seedDemo`, media included), sets `mode = 'sample'`, then opens the lock screen.
- **Restore from a backup**: opens the restore flow (see Backup).

### Setup wizard (`/start`)

One route. The current step comes from `setup.wizardStep`. Each screen shows "Step N of 6", a **Back** button (except step 1), a primary **Next** button, and **Skip for now** on skippable steps. Each step saves on **Next** or **Skip for now**, so closing the app resumes at the same step. When the lock is off, step 6 is dropped and the counter reads "of 5".

| Step | Content | Rules |
|---|---|---|
| 1. Helper PIN | "Only people who know this can change Familiar Place." Enter 6 digits on the PIN pad, then again to confirm. | Required. A mismatch shows "Those didn't match. Try again." and restarts the step. |
| 2. About them | Preferred name (`TextField`), photo (`PhotoField`). | Name required. |
| 3. Their PIN | "Choose a 4-number PIN they'll use to open Familiar Place. Use a different PIN from the phone's own passcode." Enter twice on the PIN pad. A secondary button, **Don't use a PIN**, sets `lockEnabled = false`, so from then on the app opens straight to Today. | One of the two required. |
| 4. Home | Home photo, landmark cue, address. | Skippable. |
| 5. One trusted person | Name, relationship, phone, photo. Saved as the first contact with `primary: true`. | Skippable. A phone number is required only if a name is given. |
| 6. Before unlock | Switches, all off: their name, their photo, home photo, landmark cue, and the trusted person's name, relationship, photo and call button. Each switch appears only if its data exists. **Preview** opens the existing `LockedPreviewModal` with the draft. | Skippable. Hidden when the lock is off. |

**Finishing** sets `mode = 'real'`, `wizardStep = null` and `prefs.callMode = 'phone'`, calls `navigator.storage.persist()` (see Storage), and shows **All set**: "Add routines, memories and music any time in Helper setup." Its button opens Today, unlocked.

## Lock behaviour

### Lock on

- The app opens at the keypad on every launch or reload. The session stays memory-only, as today.
- It locks again after **5 minutes** in the background (`visibilitychange`: record the time when hidden, compare when visible) or when someone taps **Lock**.
- Wrong-PIN rules stay as in `session.ts`: only a complete entry counts, the 4th consecutive wrong PIN opens help once per sequence, and digits are never stored or logged.
- `submitPin` stays pure. It takes a `matched: boolean` from the async `verifyPin` instead of comparing strings. The keypad disables input and shows "Checking…" while verification runs.
- No lockout for the person's PIN: Get help must stay reachable.

### Lock off

- The app opens at Today. The **Lock** button is hidden.
- **Get help** still shows the four tiles, leading to the full unlocked views.
- The **Before unlock** page shows: "The lock is off, so nothing here is used right now." Approvals are kept, so turning the lock back on restores them.

### Shared PIN pad — `src/components/PinPad.tsx`

The keypad, dots, key handling and live prompt move out of `LockScreen` into a component with a `length` prop (4 or 6) and an `onComplete(entry)` callback. The lock screen, wizard steps 1 and 3, the helper gate and the PIN-change screens all use it.

## Helper gate

- Every `/setup…` screen renders the gate instead of its content unless the helper PIN was verified in the last **10 minutes**. The expiry timestamp lives in memory in `NavProvider`, and backgrounding the app for 5 minutes or more clears it.
- The gate shows "Enter the helper PIN", a 6-digit PIN pad and **Cancel**, which returns to Today.
- After 5 consecutive wrong entries, the pad disables for 30 seconds and shows a countdown. The count is memory-only.
- **Forgot the helper PIN?** opens a dialog: "The helper PIN can't be recovered. You can restore a backup, which has its own helper PIN, or erase everything and set up again." It offers **Restore a backup** and **Erase everything**. Erasing asks twice: a confirm dialog, then a second dialog with the button "Yes, erase everything".
- `sample` mode skips the gate.

## Settings changes

`SetupSettings` becomes:

1. Text size (unchanged)
2. Read aloud (unchanged)
3. **Lock**: an on/off switch and **Change their PIN**. Turning the lock on asks for a new 4-digit PIN, entered twice. Turning it off confirms: "Familiar Place will open straight to Today."
4. **Helper PIN**: **Change helper PIN**, entered twice. The gate has already verified the current PIN.
5. **Back up and restore** (see below)
6. **Your information**: the storage note, plus **Erase everything**, which returns to Welcome in `new` mode.

Removed: the Calls choice and **Restore the demo profile**. The dialer warning moves to the description of the "Call button before unlock" switch in Family setup: "The phone's dialer may show this number on the lock screen."

## Backup and restore — `src/lib/backup.ts`

### Saving

- **Settings → Back up and restore → Save a backup** shows the estimated size (data plus referenced media), then asks for a password of 8 or more characters, typed twice, with a show/hide toggle. The note reads: "You'll need this password to restore. It can't be recovered."
- Builds the file and passes it to `saveBackupFile(blob, filename)`. On the web this triggers an `<a download>`. Sub-project 2 replaces it for Android.
- Filename: `familiar-place-backup-YYYY-MM-DD.fpbackup`.
- On success, sets `setup.lastBackupAt`.
- Hidden in `sample` mode: a sample profile has no helper PIN, and restoring it as `real` would break the invariants.

### File format (version 1)

```
offset  size  content
0       4     ASCII "FPBK"
4       1     format version = 1
5       16    PBKDF2 salt
21      12    AES-GCM IV
33      …     AES-GCM ciphertext of the payload; bytes 0–4 are additional data

payload:
  u32 big-endian   manifest length in bytes
  UTF-8 JSON       manifest
  raw bytes        media, concatenated in manifest order

manifest: {
  app: "familiar-place",
  format: 1,
  createdAt: number,
  data: AppData,                 // every slice, including security and setup
  media: [{ id, mime, createdAt, offset, length }]
}
```

Key: PBKDF2-SHA256, **600,000 iterations**, 256-bit AES-GCM. The manifest includes only media that `mediaRefs(data)` references.

### Restoring

Available from Welcome, from the helper gate's forgot-PIN dialog and from Settings.

1. Choose a `.fpbackup` file and enter the password.
2. Validate the whole file in memory before touching storage:
   - wrong magic bytes: "This file isn't a Familiar Place backup."
   - format version above 1: "This backup was made by a newer version of Familiar Place."
   - decryption fails: "That password didn't open this backup."
   - manifest missing `app`, `data` or required slices: "This backup is damaged and can't be used."
3. Confirm: "Replace everything on this phone with this backup? This can't be undone." (Skipped on Welcome, where nothing exists yet.)
4. Write in this order: `clearAll`, every media record, then all slices, then meta last. If the app stops partway, the missing meta makes the next launch look like a new install, so the user can restore again.
5. Set `mode = 'real'` and `wizardStep = null`, request persistent storage, and open the lock screen, or Today if the backup has the lock off.

### Reminder

The Helper setup hub shows a notice when `lastBackupAt` is null or more than 30 days old: "No backup yet. Familiar Place keeps everything on this phone only." It links to Back up and restore. The notice is hidden in `sample` mode.

**Limit:** the whole file is built and read in memory. That is fine up to a few hundred MB. Streaming encryption is the upgrade path if real profiles grow beyond that.

## Demo removal

| Where | Change |
|---|---|
| `App.tsx` | Remove `DemoNotes` and `StatusBar`. |
| `styles.css` | Remove the phone bezel and presenter-panel styles. The app fills the viewport; on wide screens it is a centred column, at most 480 px wide. Existing `.device-screen` class names stay so focus handling keeps working. |
| `LockScreen.tsx` | Remove the "Demo phone lock screen" banner. Show **Use sample PIN (2 5 8 0)** only in `sample` mode. |
| Sample banner | New, on unlocked screens in `sample` mode: "Sample family. Nothing here is real." with **Start setting up for real**, which erases and opens the wizard after one confirm. |
| `SetupHub.tsx` | Replace the "Demo only" notice with the backup reminder. |
| `SetupSettings.tsx` | As in Settings changes. |
| `FamilyViews.tsx` | Keep `DemoCall` for `sample` mode only; `real` mode always dials. |
| `session.ts` | Rename `DemoSession` to `LockSession`. `DEMO_PIN` becomes `SAMPLE_PIN`, used only by the sample seed. |
| Other copy | Grep `src` for "demo" and rewrite user-facing strings that don't refer to sample mode. |
| `index.html`, `package.json` | Drop "prototype" from the descriptions. |
| `README.md` | Rewrite for real use, keeping the honest limits and adding the backup and PIN-hash limits. |

## Storage

After the wizard finishes or a restore completes, call `navigator.storage.persist()` when it exists. If it returns false or is missing, the **Your information** card adds: "This browser may clear Familiar Place's data if the phone runs low on space. Keep a recent backup."

## Routing

`resolveRoute(path, unlocked, mode)`:

- `mode === 'new'`: `/welcome` and `/start` render; everything else redirects to `/welcome`.
- Otherwise the current rules apply, and `/welcome` and `/start` redirect to `/lock` or `/today`.
- `NavProvider` picks the first route once the store is ready: `/welcome` in `new` mode, `/today` with the session unlocked when the lock is off, `/lock` otherwise.

The helper gate is a render-time check in `SetupScreens`, not a route, so the URL never changes when the gate appears.

## Error handling

- PIN hashing or verification throws (no `crypto.subtle`, e.g. a non-secure origin): the wizard shows "This browser can't keep a PIN safely. Open Familiar Place from its installed app or an https address." The app stays usable with the lock off.
- Any save fails: show the existing "couldn't be saved" notices, as today.
- Backup errors as listed under Restoring. A failed save leaves `lastBackupAt` unchanged.

## Testing

**Unit tests**

- `pin.test.ts`: hash then verify succeeds; a wrong PIN fails; the same PIN gives different salts and hashes.
- `backup.test.ts`: round trip preserves every slice and media bytes; wrong password; truncated or corrupted ciphertext; wrong magic; newer format version; unreferenced media left out.
- `session.test.ts`: existing cases rewritten for `matched: boolean`.
- `router.test.ts`: `new` mode redirects to `/welcome`; `/start` is allowed; `/welcome` redirects away in other modes.
- `repo.test.ts`: the three `loadAppData` migration cases.

**Integration tests (`app.test.tsx`)**

- Full first run: helper PIN, name, PIN, skip, skip, approvals, ending on Today.
- **Don't use a PIN**: the next launch opens on Today.
- Sample mode from Welcome, then **Start setting up for real** ends at wizard step 1 with no sample data.
- Helper gate: wrong PIN ×5 causes a 30-second wait (fake timers); a correct PIN opens setup; a second visit within 10 minutes skips the gate.
- Relock: hide the app for 5 minutes (fake timers), and it returns to the keypad.
- Backup then restore through the store returns identical data.
- An existing demo install opens in `sample` mode.

**Existing tests:** a `startInSample()` helper seeds `sample` mode so the 85 current tests keep covering today's features.

**Manual check:** run the full flow in the browser preview: first run, lock, help, helper gate, backup, erase, restore.
