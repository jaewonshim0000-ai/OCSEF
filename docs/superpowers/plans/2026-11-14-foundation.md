# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Familiar Place judging demo into a real-use app: guided first run from blank, a real person PIN and helper PIN, an optional in-app lock, encrypted backup/restore, and no demo leftovers outside an opt-in sample mode.

**Architecture:** Evolve the existing React + Vite app in place. Two new `AppData` slices (`security`, `setup`) live in the existing IndexedDB `kv` store; a new `pin.ts` and `backup.ts` use only Web Crypto. Navigation becomes mode-aware (`new` / `sample` / `real`), the keypad becomes a shared `PinPad`, and Helper setup sits behind a render-time helper gate. The locked-preview privacy layer is untouched.

**Tech Stack:** React 18, TypeScript 5.9 (strict), Vite 7, Vitest 4 + Testing Library + jsdom + fake-indexeddb, Web Crypto (PBKDF2-SHA256, AES-GCM). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-14-foundation-design.md`

## Global Constraints

- No new npm dependencies. Crypto uses `crypto.subtle` and `crypto.getRandomValues` only.
- Person PIN: 4 digits (`PIN_LENGTH`). Helper PIN: 6 digits (`HELPER_PIN_LENGTH`).
- PIN hashes: PBKDF2-SHA256, 16-byte salt, **100,000** iterations, 32-byte output, base64 strings.
- Backups: PBKDF2-SHA256 **600,000** iterations → AES-GCM 256; password at least **8** characters; magic `FPBK`, format version **1**; filename `familiar-place-backup-YYYY-MM-DD.fpbackup`.
- In-app lock relocks after **5 minutes** in the background. Helper PIN stays verified for **10 minutes**. **5** wrong helper PINs in a row → **30-second** wait.
- Entered digits are never stored or logged. Only hashes are saved.
- `buildLockedPreview` never reads `security` or `setup`. Locked routes and the preview allowlist stay as they are.
- Copy: plain British English, as in the existing UI ("favourite", "colour"). No medical claims.
- Accessibility: every control has a visible or accessible label; screens keep `data-screen-heading` on their `h1`; rem sizing; touch targets at least 44 px.
- Every task ends with `npm test` and `npm run typecheck` passing, then a commit whose message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Deliberate deviation from the spec: the "All set" message is a notice on Today (via a `setup-done` flash), not a separate screen. Same words, one less route.

## Review Focus

1. **Typing fast while a PIN is being checked** — digits pressed during "Checking…" must be ignored; only one attempt counts. Test in Task 4 (`pinpad.test.tsx`).
2. **Closing the app halfway through setup** — reopening resumes at the same wizard step with earlier answers kept. Test in Task 5.
3. **Going Back to the trusted-person step and forward again** — must edit the same contact, never add a second one. Test in Task 5.
4. **Mistyping the confirmation when changing a PIN** — nothing is saved; the old PIN keeps working. Test in Task 6.
5. **Backing up a profile whose photo or recording is missing from storage** — backup and restore still succeed; the reference stays so the UI shows its missing-media state. Test in Task 7.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/pin.ts` | Create | Hash and verify PINs (Web Crypto) |
| `src/lib/backup.ts` | Create | Encode/decode encrypted backup files, filename, download, `blobBytes`, `formatBytes` |
| `src/lib/types.ts` | Modify | `PinHash`, `Security`, `AppMode`, `SetupState`; `AppData` gains `security`, `setup` |
| `src/lib/defaults.ts` | Modify | `emptySecurity`, `newSetup`; `callMode` defaults to `'phone'` |
| `src/lib/db.ts` | Modify | `KV_KEYS` gains `security`, `setup`; `persistStorage`, `isStoragePersisted` |
| `src/lib/seed.ts` | Modify | `SAMPLE_PIN`; sample `security`/`setup` |
| `src/lib/repo.ts` | Modify | New-install load, migration, `seedSample`, `collectBackup`, `estimateBackupBytes`, `restoreBackupContents` |
| `src/lib/store.tsx` | Modify | `snapshot`, `startSample`, `createBackup`, `estimateBackupBytes`, `applyBackup` |
| `src/lib/session.ts` | Modify | `LockSession`, `submitPin(…, matched)`, helper-gate reducer, timing constants |
| `src/lib/router.ts` | Modify | `welcome`, `start` routes; `resolveRoute(…, mode)` |
| `src/app/nav.tsx` | Modify | Async PIN check, start-on-ready, `restart`, relock on background, helper gate state |
| `src/components/PinPad.tsx` | Create | Shared keypad + dots + live prompt |
| `src/components/ChoosePin.tsx` | Create | Enter-twice PIN chooser |
| `src/components/RestoreDialog.tsx` | Create | Choose file + password → restore |
| `src/components/SampleBanner.tsx` | Create | Sample-mode banner + "Start setting up for real" |
| `src/components/fields.tsx` | Modify | `TextField` accepts `type="password"` |
| `src/screens/LockScreen.tsx` | Modify | Uses `PinPad`; sample PIN button only in sample mode; no demo banner |
| `src/screens/start/Welcome.tsx` | Create | First screen on a new install |
| `src/screens/start/SetupWizard.tsx` | Create | Six-step first run |
| `src/screens/setup/HelperGate.tsx` | Create | Helper PIN gate + forgot flow |
| `src/screens/setup/SaveBackupDialog.tsx` | Create | Password + save backup |
| `src/screens/setup/SetupSettings.tsx` | Modify | Lock, helper PIN, backup cards; drop calls + demo reset |
| `src/screens/setup/SetupHub.tsx` | Modify | Backup reminder replaces demo notice |
| `src/screens/setup/SetupPrivacy.tsx` | Modify | Lock-off notice |
| `src/screens/companion/Today.tsx` | Modify | "All set" notice; **Lock** button (hidden when lock off) |
| `src/App.tsx` | Modify | Mode-aware screen switch, helper gate, sample banner; no demo notes/status bar |
| `src/styles.css` | Modify | PIN pad light tone, wizard, sample banner, plain app frame |
| `index.html`, `package.json`, `README.md` | Modify | Real-use wording |
| `src/test/*.test.ts(x)` | Modify/Create | See each task |

---

### Task 1: PIN hashing

**Files:**
- Modify: `src/lib/types.ts` (add `PinHash` near the top, after `MediaRecord`)
- Create: `src/lib/pin.ts`
- Test: `src/test/pin.test.ts`

**Interfaces:**
- Produces: `interface PinHash { salt: string; hash: string; iterations: number }`; `PIN_ITERATIONS = 100_000`; `hashPin(pin: string, iterations?: number): Promise<PinHash>`; `verifyPin(pin: string, stored: PinHash): Promise<boolean>`; `class PinUnavailableError extends Error`; `toBase64(bytes: Uint8Array): string`; `fromBase64(text: string): Uint8Array<ArrayBuffer>`.

- [ ] **Step 1: Write the failing test** — `src/test/pin.test.ts`

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/test/pin.test.ts`
Expected: FAIL — `Failed to resolve import "../lib/pin"`.

- [ ] **Step 3: Add the type** — in `src/lib/types.ts`, after the `MediaRecord` interface:

```ts
/** A salted PBKDF2-SHA256 hash of a PIN. The PIN itself is never stored. */
export interface PinHash {
  /** base64, 16 random bytes */
  salt: string;
  /** base64, 32 bytes */
  hash: string;
  iterations: number;
}
```

- [ ] **Step 4: Implement** — `src/lib/pin.ts`

```ts
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
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx vitest run src/test/pin.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Full check and commit**

Run: `npm test` then `npm run typecheck` — both pass.

```bash
git add src/lib/pin.ts src/lib/types.ts src/test/pin.test.ts
git commit -m "Add PIN hashing with Web Crypto PBKDF2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Data model, new-install load, migration, sample seeding

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/defaults.ts`, `src/lib/db.ts:16`, `src/lib/seed.ts`, `src/lib/repo.ts`, `src/lib/store.tsx`, `src/screens/setup/SetupSettings.tsx`
- Test: `src/test/repo.test.ts`, `src/test/app.test.tsx` (helper only), `src/test/preview.test.ts` (only if it relied on `callMode: 'demo'` defaults)

**Interfaces:**
- Consumes: `hashPin`, `PinHash` (Task 1).
- Produces:
  - `interface Security { personPin: PinHash | null; helperPin: PinHash | null; lockEnabled: boolean }`
  - `type AppMode = 'new' | 'sample' | 'real'`
  - `interface SetupState { mode: AppMode; wizardStep: number | null; lastBackupAt: number | null }`
  - `AppData.security: Security`, `AppData.setup: SetupState`
  - `emptySecurity(): Security`, `newSetup(): SetupState` (in `defaults.ts`)
  - `SAMPLE_PIN = '2580'` (in `seed.ts`)
  - `loadAppData(backend: Backend): Promise<AppData>` (no loader argument any more)
  - `seedSample(backend: Backend, loader: DemoMediaLoader): Promise<AppData>`
  - `writeAll(backend: Backend, data: AppData): Promise<void>` (now exported)
  - `ALL_SLICES` includes `'security'` and `'setup'`
  - Store: `snapshot(): AppData`, `startSample(): Promise<void>` (replaces `resetToDemo`)

- [ ] **Step 1: Write the failing repo tests** — in `src/test/repo.test.ts`:

Change the imports to:

```ts
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { IdbBackend, MemoryBackend, openIdb, type Backend } from '../lib/db';
import { verifyPin } from '../lib/pin';
import { buildLockedPreview, isPreviewEmpty } from '../lib/preview';
import {
  collectGarbage,
  eraseEverything,
  loadAppData,
  mediaRefs,
  seedSample,
  stripMissingMedia,
  writesFor,
  type DemoMediaLoader,
} from '../lib/repo';
import { DEMO_MEDIA, SAMPLE_PIN, demoAppData } from '../lib/seed';
```

Replace the test `'seeds the demo profile on first load and reads it back later'` with these three:

```ts
  it('a new install starts empty, in new mode, without fetching sample media', async () => {
    const backend = await freshIdb();
    const first = await loadAppData(backend);
    expect(first.setup).toEqual({ mode: 'new', wizardStep: 1, lastBackupAt: null });
    expect(first.security).toEqual({ personPin: null, helperPin: null, lockEnabled: true });
    expect(first.profile.preferredName).toBe('');
    expect(first.contacts).toEqual([]);
    expect(isPreviewEmpty(buildLockedPreview(first))).toBe(true);
    expect(await backend.listMediaIds()).toEqual([]);
    expect(await loadAppData(backend)).toEqual(first);
  });

  it('seedSample loads the sample family with the sample PIN', async () => {
    const backend = await freshIdb();
    const data = await seedSample(backend, noMedia);
    expect(data.profile.preferredName).toBe('Peggy');
    expect(data.contacts.map((c) => c.name)).toEqual(['Maya', 'Sam', 'Priya']);
    expect(data.songs.map((s) => s.title)).toEqual(['The Riverside Waltz', "Peggy's lullaby", "Sunday hymns at St Mary's"]);
    expect(data.setup).toEqual({ mode: 'sample', wizardStep: null, lastBackupAt: null });
    expect(data.security.helperPin).toBeNull();
    expect(data.security.lockEnabled).toBe(true);
    expect(await verifyPin(SAMPLE_PIN, data.security.personPin!)).toBe(true);
    // Media that could not be stored is not referenced.
    expect(mediaRefs(data)).toEqual([]);
    expect(await loadAppData(backend)).toEqual(data);
  });

  it('opens an install from before Foundation as the sample family, keeping its data', async () => {
    const backend = await freshIdb();
    const old = demoAppData();
    const writes = writesFor(old, ['profile', 'home', 'contacts', 'schedule', 'routines', 'memories', 'songs', 'approvals', 'prefs']);
    writes.kv = { ...writes.kv, meta: { seeded: true, version: 1 } };
    await backend.write(writes);

    const loaded = await loadAppData(backend);
    expect(loaded.setup.mode).toBe('sample');
    expect(loaded.profile.preferredName).toBe('Peggy');
    expect(loaded.contacts).toHaveLength(3);
    expect(await verifyPin(SAMPLE_PIN, loaded.security.personPin!)).toBe(true);
    // The migration is written once, so the next load is identical.
    expect(await loadAppData(backend)).toEqual(loaded);
  });
```

Then, everywhere else in `repo.test.ts`:
- `loadAppData(backend, noMedia)` / `loadAppData(backend, allMedia)` used to obtain the demo profile → `seedSample(backend, noMedia)` / `seedSample(backend, allMedia)`.
- `loadAppData(backend, <anything>)` used to *re-read* saved data → `loadAppData(backend)`.
- `resetToDemo(backend, X)` → `seedSample(backend, X)`.
- A test asserting that erasing leaves "an empty locked preview and no data" also asserts `expect(erased.setup.mode).toBe('new')` where `erased` is the value returned by `eraseEverything(backend)`.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/repo.test.ts`
Expected: FAIL — `seedSample` / `SAMPLE_PIN` not exported.

- [ ] **Step 3: Types** — in `src/lib/types.ts`:

Replace the file's header comment with:

```ts
/**
 * Record types for Familiar Place.
 *
 * Personal data (everything in AppData) lives in IndexedDB. The lock session
 * (LockSession, see session.ts) lives only in memory and is never written to
 * storage.
 */
```

Add before `export interface AppData`:

```ts
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
```

Add two fields at the end of `AppData`:

```ts
  security: Security;
  setup: SetupState;
```

- [ ] **Step 4: Defaults** — in `src/lib/defaults.ts`:

Change the import line to `import type { AppData, Approvals, Place, Prefs, Profile, Schedule, Security, SetupState } from './types';` and add:

```ts
export function emptySecurity(): Security {
  return { personPin: null, helperPin: null, lockEnabled: true };
}

export function newSetup(): SetupState {
  return { mode: 'new', wizardStep: 1, lastBackupAt: null };
}
```

In `defaultPrefs()` change `callMode: 'demo'` to `callMode: 'phone'`.

In `emptyAppData()` add `security: emptySecurity(),` and `setup: newSetup(),` after `prefs: defaultPrefs(),`.

- [ ] **Step 5: KV keys** — in `src/lib/db.ts` change line 16 to:

```ts
export const KV_KEYS = ['meta', 'profile', 'home', 'schedule', 'approvals', 'prefs', 'security', 'setup'] as const;
```

- [ ] **Step 6: Sample seed** — in `src/lib/seed.ts`:

After the `DEMO_MEDIA` constant add:

```ts
/** The sample family's PIN. Shown on the keypad in sample mode only. */
export const SAMPLE_PIN = '2580';
```

In `demoAppData()`, after the `prefs` line, add:

```ts
    // seedSample replaces personPin with a hash of SAMPLE_PIN.
    security: { personPin: null, helperPin: null, lockEnabled: true },
    setup: { mode: 'sample', wizardStep: null, lastBackupAt: null },
```

Update the file's top comment: replace "Fictional demo profile." with "Fictional sample family." and "The demo profile ships as if…" with "The sample family ships as if…".

- [ ] **Step 7: Repo** — in `src/lib/repo.ts`:

Imports become:

```ts
import type { Backend, CollectionName, KvKey, SliceWrite } from './db';
import {
  defaultPrefs,
  emptyAppData,
  emptyApprovals,
  emptyPlace,
  emptyProfile,
  emptySchedule,
  emptySecurity,
  newSetup,
} from './defaults';
import { hashPin } from './pin';
import { DEMO_MEDIA, SAMPLE_PIN, demoAppData } from './seed';
import type { AppData, Approvals, AudioRef, MediaId, PhotoRef, Security, SetupState } from './types';
```

Set `const META_VERSION = 2;` and

```ts
export const ALL_SLICES: Slice[] = [
  'profile', 'home', 'contacts', 'schedule', 'routines', 'memories', 'songs', 'approvals', 'prefs', 'security', 'setup',
];
```

Replace `writeAll`, `seedDemo`, `loadAppData` and `resetToDemo` with:

```ts
export async function writeAll(backend: Backend, data: AppData): Promise<void> {
  const writes = writesFor(data, ALL_SLICES);
  writes.kv = { ...writes.kv, meta: { seeded: true, version: META_VERSION } satisfies Meta };
  await backend.write(writes);
}

async function sampleSecurity(): Promise<Security> {
  return { personPin: await hashPin(SAMPLE_PIN), helperPin: null, lockEnabled: true };
}

/** Deletes everything, then loads the fictional sample family. */
export async function seedSample(backend: Backend, loader: DemoMediaLoader): Promise<AppData> {
  await backend.clearAll();
  const available = await loader(backend);
  const data: AppData = { ...stripMissingMedia(demoAppData(), available), security: await sampleSecurity() };
  await writeAll(backend, data);
  return data;
}

export async function loadAppData(backend: Backend): Promise<AppData> {
  const meta = await backend.getKV<Meta>('meta');
  if (!meta?.seeded) {
    // A new install: start empty. The sample family loads only when asked for.
    const data = emptyAppData();
    await writeAll(backend, data);
    return data;
  }

  const [profile, home, schedule, approvals, prefs, security, setup, contacts, routines, memories, songs] = await Promise.all([
    backend.getKV<AppData['profile']>('profile'),
    backend.getKV<AppData['home']>('home'),
    backend.getKV<AppData['schedule']>('schedule'),
    backend.getKV<Approvals>('approvals'),
    backend.getKV<AppData['prefs']>('prefs'),
    backend.getKV<Security>('security'),
    backend.getKV<SetupState>('setup'),
    backend.getAll<AppData['contacts'][number]>('contacts'),
    backend.getAll<AppData['routines'][number]>('routines'),
    backend.getAll<AppData['memories'][number]>('memories'),
    backend.getAll<AppData['songs'][number]>('songs'),
  ]);

  const data: AppData = {
    profile: { ...emptyProfile(), ...profile },
    home: { ...emptyPlace(), ...home },
    schedule: { ...emptySchedule(), ...schedule },
    approvals: normaliseApprovals(approvals),
    prefs: { ...defaultPrefs(), ...prefs },
    security: { ...emptySecurity(), ...security },
    setup: { ...newSetup(), ...setup },
    // Contacts saved before voice messages existed have no voice field.
    contacts: contacts.map((c) => ({ ...c, voice: c.voice ?? null })).sort(byOrder),
    routines: [...routines].sort(byOrder),
    memories: [...memories].sort(byOrder),
    songs: [...songs].sort(byOrder),
  };

  if (!setup) {
    // Saved before Foundation, so this is the demo profile: open it as the sample family.
    data.setup = { mode: 'sample', wizardStep: null, lastBackupAt: null };
    data.security = await sampleSecurity();
    const writes = writesFor(data, ['security', 'setup']);
    writes.kv = { ...writes.kv, meta: { seeded: true, version: META_VERSION } satisfies Meta };
    await backend.write(writes);
  }
  return data;
}
```

Leave `eraseEverything` as it is (it already writes `emptyAppData()`, which is now `new` mode).

- [ ] **Step 8: Store** — in `src/lib/store.tsx`:

- Replace `resetToDemo,` in the repo import with `seedSample,`.
- In the `Store` interface, replace `resetToDemo(): Promise<void>;` with:

```ts
  /** The latest data, updated as soon as a save commits (before React re-renders). */
  snapshot(): AppData;
  /** Deletes everything and loads the fictional sample family. */
  startSample(): Promise<void>;
```

- In the load effect, change both `loadAppData(backend, loader)` calls to `loadAppData(backend)`.
- In `save`, change the cleanup condition to:

```ts
        const recordSlices = slices.filter((s) => !['approvals', 'prefs', 'schedule', 'security', 'setup'].includes(s));
        if (recordSlices.length) {
```

- Replace `doReset` with:

```ts
  const startSample = useCallback(
    () =>
      enqueue(async () => {
        cacheRef.current.forgetAll();
        pendingMedia.current.clear();
        commit(await seedSample(backendRef.current, loader));
      }),
    [commit, enqueue, loader],
  );

  const snapshot = useCallback(() => dataRef.current, []);
```

- In the `value` object and its dependency list, replace `resetToDemo: doReset` / `doReset` with `snapshot, startSample` / `snapshot, startSample`.

- [ ] **Step 9: Keep Settings compiling** — in `src/screens/setup/SetupSettings.tsx` replace `resetToDemo` with `startSample` (destructuring and the call in the reset dialog). The button keeps its label for now; Task 9 removes it.

- [ ] **Step 10: App tests start in sample mode** — in `src/test/app.test.tsx`:

Add `import { seedSample } from '../lib/repo';` and change `renderApp` to:

```ts
async function renderApp() {
  const user = userEvent.setup();
  const backend = new MemoryBackend();
  await seedSample(backend, loader);
  render(<App backend={backend} loader={loader} />);
  await screen.findByRole('heading', { name: 'Enter PIN' });
  return { user, backend };
}
```

If `src/test/preview.test.ts` builds data from `emptyAppData()` and expects a demo call, set `prefs: { ...data.prefs, callMode: 'demo' }` in that test's data.

- [ ] **Step 11: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass (85 existing, adjusted, plus the new repo and pin tests).

- [ ] **Step 12: Commit**

```bash
git add src/lib src/screens/setup/SetupSettings.tsx src/test
git commit -m "Add security and setup slices, new-install load, sample seeding and migration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lock session, helper-gate reducer, first-run routes

**Files:**
- Modify: `src/lib/session.ts`, `src/lib/router.ts`, `src/app/nav.tsx`, `src/screens/LockScreen.tsx`, `src/App.tsx` (DemoNotes import only), any file importing `DemoSession` (find with `grep -rn DemoSession src`)
- Test: `src/test/session.test.ts`, `src/test/router.test.ts`

**Interfaces:**
- Consumes: `AppMode` (Task 2), `SAMPLE_PIN` (Task 2).
- Produces (session.ts):
  - `type LockSession` (renamed from `DemoSession`, same shape)
  - `submitPin(session: LockSession, entry: string, matched: boolean): { session: LockSession; outcome: PinOutcome }`
  - `RELOCK_AFTER_MS = 300_000`, `HELPER_PIN_LENGTH = 6`, `HELPER_MAX_FAILS = 5`, `HELPER_WAIT_MS = 30_000`, `HELPER_GRACE_MS = 600_000`
  - `interface HelperGate { verifiedUntil: number; fails: number; waitUntil: number }`
  - `initialHelperGate(): HelperGate`, `helperOpenAt(g: HelperGate, now: number): boolean`, `helperAttempt(g: HelperGate, matched: boolean, now: number): HelperGate`
  - `DEMO_PIN` is removed.
- Produces (router.ts): `RouteName` gains `'welcome' | 'start'`; `resolveRoute(rawPath: string, unlocked: boolean, mode: AppMode = 'real'): Resolution`.

- [ ] **Step 1: Write the failing tests**

In `src/test/session.test.ts`, change the import to:

```ts
import {
  AUTO_HELP_AFTER,
  HELPER_GRACE_MS,
  HELPER_MAX_FAILS,
  HELPER_WAIT_MS,
  helperAttempt,
  helperOpenAt,
  initialHelperGate,
  initialSession,
  relock,
  submitPin,
  type LockSession,
} from '../lib/session';

const RIGHT = '2580';
const matches = (entry: string) => entry === RIGHT;
```

Then mechanically: every `submitPin(x, entry)` → `submitPin(x, entry, matches(entry))`; every `DEMO_PIN` → `RIGHT`; `DemoSession` → `LockSession`; rename the `describe('demo lock session'` to `describe('lock session'`.

Append:

```ts
describe('helper gate', () => {
  const t0 = 1_000_000;

  it('opens for 10 minutes after the right PIN', () => {
    const g = helperAttempt(initialHelperGate(), true, t0);
    expect(helperOpenAt(g, t0 + HELPER_GRACE_MS - 1)).toBe(true);
    expect(helperOpenAt(g, t0 + HELPER_GRACE_MS)).toBe(false);
  });

  it('waits 30 seconds after 5 wrong PINs in a row, then allows more tries', () => {
    let g = initialHelperGate();
    for (let i = 0; i < HELPER_MAX_FAILS - 1; i++) g = helperAttempt(g, false, t0);
    expect(g.waitUntil).toBe(0);
    g = helperAttempt(g, false, t0);
    expect(g.waitUntil).toBe(t0 + HELPER_WAIT_MS);
    // Even the right PIN is ignored while waiting.
    expect(helperAttempt(g, true, t0 + 1_000)).toBe(g);
    const after = helperAttempt(g, true, t0 + HELPER_WAIT_MS);
    expect(helperOpenAt(after, t0 + HELPER_WAIT_MS)).toBe(true);
  });

  it('a right PIN resets the wrong count', () => {
    let g = initialHelperGate();
    for (let i = 0; i < HELPER_MAX_FAILS - 1; i++) g = helperAttempt(g, false, t0);
    g = helperAttempt(g, true, t0);
    expect(g.fails).toBe(0);
    expect(g.waitUntil).toBe(0);
  });
});
```

In `src/test/router.test.ts` append:

```ts
describe('first run routing', () => {
  it('parses /welcome and /start only without extra parts', () => {
    expect(parseRoute('/welcome').name).toBe('welcome');
    expect(parseRoute('/start').name).toBe('start');
    expect(parseRoute('/start/3').name).toBe('not-found');
  });

  it('sends every path to Welcome on a new install, except the wizard', () => {
    for (const p of ['/lock', '/today', '/help', '/help/family', '/setup', '/nope']) {
      expect(resolveRoute(p, false, 'new').route.name).toBe('welcome');
      expect(resolveRoute(p, true, 'new').route.name).toBe('welcome');
    }
    expect(resolveRoute('/start', false, 'new').route.name).toBe('start');
    expect(resolveRoute('/welcome', false, 'new').route.name).toBe('welcome');
  });

  it('sends Welcome and the wizard away once set up', () => {
    for (const mode of ['real', 'sample'] as const) {
      expect(resolveRoute('/welcome', false, mode).route.name).toBe('lock');
      expect(resolveRoute('/start', true, mode).route.name).toBe('today');
    }
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/session.test.ts src/test/router.test.ts`
Expected: FAIL — missing exports / wrong route names.

- [ ] **Step 3: session.ts** — replace the whole file with:

```ts
/**
 * The in-app lock session and the helper gate.
 *
 * Both are held in memory only. Reloading creates a fresh session, which
 * returns to the keypad with zero failures. Entered digits are never stored
 * here or logged anywhere; the caller checks them against a hash and passes
 * in only whether they matched.
 */

export const PIN_LENGTH = 4;
/** The consecutive invalid submission that opens Get help automatically. */
export const AUTO_HELP_AFTER = 4;
/** Time in the background after which the app locks again. */
export const RELOCK_AFTER_MS = 5 * 60_000;

export interface LockSession {
  /** Current route path, e.g. "/lock" or "/help/family". */
  view: string;
  consecutiveInvalid: number;
  /** Whether automatic help has already opened in this failed-attempt sequence. */
  autoHelpShown: boolean;
  unlocked: boolean;
}

export type PinOutcome =
  /** Fewer than PIN_LENGTH digits. Not counted. */
  | 'incomplete'
  /** Wrong PIN. Counted. Field clears and a short prompt shows. */
  | 'invalid'
  /** Wrong PIN that reached the threshold for the first time in this sequence. */
  | 'invalid-open-help'
  /** Correct PIN. Count resets and the daily companion opens. */
  | 'unlocked';

export function initialSession(): LockSession {
  return { view: '/lock', consecutiveInvalid: 0, autoHelpShown: false, unlocked: false };
}

export function isCompleteEntry(entry: string): boolean {
  return entry.length === PIN_LENGTH && /^\d+$/.test(entry);
}

export function submitPin(
  session: LockSession,
  entry: string,
  matched: boolean,
): { session: LockSession; outcome: PinOutcome } {
  if (!isCompleteEntry(entry)) {
    return { session, outcome: 'incomplete' };
  }
  if (matched) {
    return {
      session: { view: '/today', consecutiveInvalid: 0, autoHelpShown: false, unlocked: true },
      outcome: 'unlocked',
    };
  }
  const consecutiveInvalid = session.consecutiveInvalid + 1;
  if (consecutiveInvalid >= AUTO_HELP_AFTER && !session.autoHelpShown) {
    return {
      session: { ...session, consecutiveInvalid, autoHelpShown: true, unlocked: false, view: '/help' },
      outcome: 'invalid-open-help',
    };
  }
  return { session: { ...session, consecutiveInvalid, unlocked: false }, outcome: 'invalid' };
}

/** Explicitly relocking starts a fresh failed-attempt sequence. */
export function relock(): LockSession {
  return initialSession();
}

/* ---------- Helper gate ---------- */

export const HELPER_PIN_LENGTH = 6;
export const HELPER_MAX_FAILS = 5;
export const HELPER_WAIT_MS = 30_000;
/** How long a correct helper PIN keeps Helper setup open. */
export const HELPER_GRACE_MS = 10 * 60_000;

export interface HelperGate {
  verifiedUntil: number;
  fails: number;
  waitUntil: number;
}

export function initialHelperGate(): HelperGate {
  return { verifiedUntil: 0, fails: 0, waitUntil: 0 };
}

export function helperOpenAt(g: HelperGate, now: number): boolean {
  return now < g.verifiedUntil;
}

/** Applies one helper-PIN attempt. While waiting, attempts are ignored. */
export function helperAttempt(g: HelperGate, matched: boolean, now: number): HelperGate {
  if (now < g.waitUntil) return g;
  if (matched) return { verifiedUntil: now + HELPER_GRACE_MS, fails: 0, waitUntil: 0 };
  const fails = g.fails + 1;
  if (fails >= HELPER_MAX_FAILS) return { verifiedUntil: 0, fails: 0, waitUntil: now + HELPER_WAIT_MS };
  return { verifiedUntil: 0, fails, waitUntil: 0 };
}
```

- [ ] **Step 4: router.ts**

Add `import type { AppMode, TileId } from './types';` (replacing the `TileId`-only import). Add `| 'welcome' | 'start'` to `RouteName`. In `parseRoute`'s switch add:

```ts
    case 'welcome':
      return parts.length === 1 ? { ...base, name: 'welcome' } : { ...base, name: 'not-found' };
    case 'start':
      return parts.length === 1 ? { ...base, name: 'start' } : { ...base, name: 'not-found' };
```

Replace the signature and first lines of `resolveRoute` with:

```ts
export function resolveRoute(rawPath: string, unlocked: boolean, mode: AppMode = 'real'): Resolution {
  const route = parseRoute(rawPath);
  const firstRun = route.name === 'welcome' || route.name === 'start';
  if (mode === 'new') {
    return firstRun ? { route, blockedPrivate: false } : { route: parseRoute('/welcome'), blockedPrivate: false };
  }
  if (firstRun) return { route: parseRoute(unlocked ? '/today' : '/lock'), blockedPrivate: false };
  if (!unlocked) {
```

(the rest of the function is unchanged). Update its doc comment's first sentence to: "Applies the first-run and lock guards."

- [ ] **Step 5: Callers compile against the new signature**

- `src/app/nav.tsx`: `DemoSession` → `LockSession` everywhere; add `import { SAMPLE_PIN } from '../lib/seed';` and in `doSubmit` change `submitPin(sessionRef.current, entry)` to `submitPin(sessionRef.current, entry, entry === SAMPLE_PIN)` (temporary; Task 4 replaces it with a hash check).
- `src/screens/LockScreen.tsx` and `src/App.tsx`: replace the `DEMO_PIN` import from `../lib/session` / `./lib/session` with `SAMPLE_PIN` from `../lib/seed` / `./lib/seed`, and rename uses.
- Any other `DemoSession` import found by `grep -rn DemoSession src` → `LockSession`.
- `src/test/app.test.tsx`: `import { DEMO_PIN } from '../lib/session';` → `import { SAMPLE_PIN } from '../lib/seed';` and rename uses.

- [ ] **Step 6: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Rename lock session, pass PIN match in, add helper gate reducer and first-run routes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared PIN pad, hashed PIN check, relock after 5 minutes

**Files:**
- Create: `src/components/PinPad.tsx`
- Modify: `src/screens/LockScreen.tsx`, `src/app/nav.tsx`, `src/styles.css`
- Test: `src/test/pinpad.test.tsx` (new), `src/test/app.test.tsx`

**Interfaces:**
- Consumes: `verifyPin` (Task 1), `snapshot()` (Task 2), `submitPin(…, matched)`, `isCompleteEntry`, `RELOCK_AFTER_MS` (Task 3).
- Produces:
  - `interface PinResult { message?: string; shake?: boolean }`
  - `PinPad({ length, onSubmit, disabled?, tone?, label? })` where `onSubmit: (entry: string) => Promise<PinResult | void>`; `tone: 'dark' | 'light'` (default `'dark'`).
  - `Nav.submitPin(entry: string): Promise<PinOutcome>` (now async).

- [ ] **Step 1: Write the failing PinPad tests** — `src/test/pinpad.test.tsx`

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PinPad } from '../components/PinPad';

describe('PinPad', () => {
  it('ignores digits while a PIN is being checked', async () => {
    const user = userEvent.setup();
    let release: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    render(<PinPad length={4} onSubmit={onSubmit} />);
    await user.keyboard('12345678');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');
    expect(screen.getByRole('status')).toHaveTextContent('Checking');
    await act(async () => release());
    expect(screen.getByRole('img', { name: '0 of 4 numbers entered' })).toBeInTheDocument();
    expect(screen.getByRole('status')).not.toHaveTextContent('Checking');
  });

  it('shows the message it is given', async () => {
    const user = userEvent.setup();
    render(<PinPad length={6} onSubmit={async () => ({ message: 'Nope.', shake: true })} />);
    for (const d of '123456') await user.click(screen.getByRole('button', { name: d }));
    expect(await screen.findByText('Nope.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 6 numbers entered' })).toBeInTheDocument();
  });

  it('asks for every number when Enter is pressed early, and deletes one at a time', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<PinPad length={4} onSubmit={onSubmit} />);
    await user.keyboard('12');
    await user.keyboard('{Backspace}');
    expect(screen.getByRole('img', { name: '1 of 4 numbers entered' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Enter all 4 numbers.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => undefined);
    render(<PinPad length={4} onSubmit={onSubmit} disabled />);
    await user.keyboard('1234');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '1' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/test/pinpad.test.tsx`
Expected: FAIL — cannot resolve `../components/PinPad`.

- [ ] **Step 3: Implement PinPad** — `src/components/PinPad.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export interface PinResult {
  /** Announced in the live prompt, e.g. "That PIN didn't match." */
  message?: string;
  shake?: boolean;
}

/**
 * A number keypad with dots and a live prompt. Digits live only in a ref while
 * typing, are handed to onSubmit once complete, and are never stored. Input is
 * ignored while onSubmit runs, so typing fast can't count twice.
 */
export function PinPad({
  length,
  onSubmit,
  disabled = false,
  tone = 'dark',
  label = 'Number keypad',
}: {
  length: number;
  onSubmit: (entry: string) => Promise<PinResult | void>;
  disabled?: boolean;
  tone?: 'dark' | 'light';
  label?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const entryRef = useRef('');
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const toggle = useRef(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [shake, setShake] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const say = (text: string) => {
    // Alternate an invisible character so a repeated prompt is announced again.
    toggle.current = !toggle.current;
    setPrompt(text ? text + (toggle.current ? '​' : '') : '');
  };

  const setEntry = (value: string) => {
    entryRef.current = value;
    setCount(value.length);
  };

  const submit = async (value: string) => {
    setEntry('');
    busyRef.current = true;
    setBusy(true);
    say('Checking…');
    try {
      const result = await onSubmit(value);
      if (!mounted.current) return;
      say(result?.message ?? '');
      if (result?.shake) setShake((n) => n + 1);
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const press = (digit: string) => {
    if (busyRef.current || disabled || entryRef.current.length >= length) return;
    const next = entryRef.current + digit;
    if (next.length === length) void submit(next);
    else setEntry(next);
  };

  const erase = () => {
    if (!busyRef.current) setEntry(entryRef.current.slice(0, -1));
  };

  const enterPressed = () => {
    // Only a complete entry is submitted; a partial one is never counted.
    if (entryRef.current.length < length) say(`Enter all ${length} numbers.`);
  };

  const handlers = useRef({ press, erase, enterPressed });
  handlers.current = { press, erase, enterPressed };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select') || target.isContentEditable)) return;
      // Ignore keys typed in a dialog, unless this keypad is inside that dialog.
      const dialog = target?.closest('[role="dialog"]');
      if (dialog && !dialog.contains(rootRef.current)) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handlers.current.press(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlers.current.erase();
      } else if (e.key === 'Enter') {
        // A focused button handles Enter itself.
        if (target?.closest('button, a')) return;
        e.preventDefault();
        handlers.current.enterPressed();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const locked = disabled || busy;

  return (
    <div className={`pinpad pinpad-${tone}`} ref={rootRef}>
      <div
        key={shake}
        className={`pin-dots${shake ? ' is-shaking' : ''}`}
        role="img"
        aria-label={`${count} of ${length} numbers entered`}
      >
        {Array.from({ length }, (_, i) => (
          <span key={i} className={`pin-dot${i < count ? ' is-filled' : ''}`} />
        ))}
      </div>

      <p className="pin-prompt" role="status" aria-live="polite">
        {prompt}
      </p>

      <div className="keypad" role="group" aria-label={label}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="key" onClick={() => press(k)} disabled={locked}>
            {k}
          </button>
        ))}
        <span className="key key-spacer" aria-hidden />
        <button type="button" className="key" onClick={() => press('0')} disabled={locked}>
          0
        </button>
        <button
          type="button"
          className="key key-delete"
          onClick={erase}
          aria-label="Delete last number"
          disabled={count === 0 || locked}
        >
          <Delete size={30} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the PinPad tests**

Run: `npx vitest run src/test/pinpad.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: PIN pad styles** — in `src/styles.css`, directly after the `.key-spacer` rule, add:

```css
.pinpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.pinpad-light .pin-dot {
  border-color: var(--ink);
}

.pinpad-light .pin-dot.is-filled {
  background: var(--ink);
}

.pinpad-light .pin-prompt {
  color: var(--ink);
}

.pinpad-light .key {
  border-color: var(--line);
  background: var(--surface);
  color: var(--ink);
}

.pinpad-light .key:active:not(:disabled) {
  background: var(--home-bg);
}
```

Delete the `.lock-banner` and `.lock-banner strong` rules (the banner goes in the next step).

- [ ] **Step 6: LockScreen uses PinPad** — replace `src/screens/LockScreen.tsx` with:

```tsx
import { KeyRound, LifeBuoy } from 'lucide-react';
import { useNav } from '../app/nav';
import { PinPad, type PinResult } from '../components/PinPad';
import { formatClock, formatDate } from '../lib/schedule';
import { SAMPLE_PIN } from '../lib/seed';
import { PIN_LENGTH } from '../lib/session';
import { useStore } from '../lib/store';
import { useNow } from '../lib/useNow';

const WRONG = "That PIN didn't match. Try again, or tap Get help.";

/** Familiar Place's own lock screen. Digits are checked against a hash and never stored. */
export function LockScreen() {
  const { submitPin, navigate } = useNav();
  const { data } = useStore();
  const now = useNow();

  const check = async (entry: string): Promise<PinResult | void> => {
    const outcome = await submitPin(entry);
    if (outcome === 'invalid') return { message: WRONG, shake: true };
  };

  return (
    <div className="screen lock">
      <main className="screen-scroll">
        <div className="lock-body">
          <div className="lock-clock" aria-label={`It is ${formatClock(now)} on ${formatDate(now)}`}>
            <span className="lock-time">{formatClock(now)}</span>
            <span className="lock-date">{formatDate(now)}</span>
          </div>

          <h1 className="lock-title" tabIndex={-1} data-screen-heading>
            Enter PIN
          </h1>

          <PinPad length={PIN_LENGTH} onSubmit={check} />

          <button type="button" className="btn btn-help btn-xl btn-block" onClick={() => navigate('/help')}>
            <LifeBuoy size={30} strokeWidth={2.5} aria-hidden />
            <span>Get help</span>
          </button>

          {data.setup.mode === 'sample' ? (
            <button type="button" className="lock-demo-pin" onClick={() => void submitPin(SAMPLE_PIN)}>
              <KeyRound size={20} strokeWidth={2.5} aria-hidden />
              <span>
                Use sample PIN <span className="lock-demo-digits">({SAMPLE_PIN.split('').join(' ')})</span>
              </span>
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Nav checks the hash and relocks** — in `src/app/nav.tsx`:

Imports: add `import { verifyPin } from '../lib/pin';`, `import { useStore } from '../lib/store';`; from `../lib/session` import `initialSession, isCompleteEntry, relock, submitPin, RELOCK_AFTER_MS, type LockSession, type PinOutcome`; remove the `SAMPLE_PIN` import added in Task 3.

In the `Nav` interface: `submitPin(entry: string): Promise<PinOutcome>;`

Inside `NavProvider`, first line: `const { snapshot } = useStore();`

Replace `doSubmit` with:

```ts
  const doSubmit = useCallback<Nav['submitPin']>(
    async (entry) => {
      if (!isCompleteEntry(entry)) return 'incomplete';
      const pin = snapshot().security.personPin;
      const matched = pin ? await verifyPin(entry, pin).catch(() => false) : false;
      const result = submitPin(sessionRef.current, entry, matched);
      setSession(result.session);
      if (result.outcome === 'unlocked') apply('/today', 'push', null);
      else if (result.outcome === 'invalid-open-help') apply('/help', 'push', 'auto-help');
      return result.outcome;
    },
    [apply, setSession, snapshot],
  );
```

After the `lock` callback add:

```ts
  // Lock again after RELOCK_AFTER_MS in the background, when the lock is on.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away < RELOCK_AFTER_MS) return;
      const d = snapshot();
      if (d.setup.mode !== 'new' && d.security.lockEnabled && sessionRef.current.unlocked) lock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [lock, snapshot]);
```

Update the `NavProvider` doc comment: "Holds the in-memory lock session and the hash route."

- [ ] **Step 8: Update app tests for the async check** — in `src/test/app.test.tsx`:

Replace `enterPin` with:

```ts
async function enterPin(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const d of digits) {
    await user.click(screen.getByRole('button', { name: d }));
  }
  // The PIN is checked against a hash, which takes a moment.
  await waitFor(() => expect(screen.queryByText(/Checking/)).not.toBeInTheDocument());
}
```

Then:
- Every `/Use demo PIN/` → `/Use sample PIN/`.
- Replace the test `'is clearly labelled as a demo and offers the demo PIN'` with:

```ts
  it('offers the sample PIN in sample mode, with no demo banner', async () => {
    await renderApp();
    expect(screen.queryByText('Demo phone lock screen')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Use sample PIN/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get help' })).toBeInTheDocument();
  });
```

- In `'accepts digits from a physical keyboard'`, after `await user.keyboard('4');` insert `await waitFor(() => expect(screen.queryByText(/Checking/)).not.toBeInTheDocument());`.
- In `'erase everything leaves an empty locked preview with clear next steps'`, delete everything from `await user.click(screen.getAllByRole('button', { name: 'Back to help' })[0]);` to the end of the test (after erasing there is no PIN to unlock with; Task 5 rewrites this test).

Add a file-level helper after `goToHash`:

```ts
function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
```

Append a new describe block:

```ts
describe('locking again', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('locks after 5 minutes in the background, but not after 1', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 60_000);
    setVisibility('visible');
    expect(screen.getByRole('heading', { name: /Good/ })).toBeInTheDocument();

    setVisibility('hidden');
    vi.setSystemTime(Date.now() + 5 * 60_000);
    setVisibility('visible');
    expect(await screen.findByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
  });
});
```

Add `afterEach` to the vitest import at the top of the file.

- [ ] **Step 9: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "Share the PIN pad, check PINs against hashes, relock after 5 minutes away

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: First run — Welcome, setup wizard, mode-aware navigation

**Files:**
- Create: `src/components/ChoosePin.tsx`, `src/screens/start/Welcome.tsx`, `src/screens/start/SetupWizard.tsx`
- Modify: `src/lib/db.ts` (persist helpers), `src/app/nav.tsx`, `src/App.tsx`, `src/screens/companion/Today.tsx`, `src/screens/setup/SetupSettings.tsx` (erase/reset → `restart`), `src/styles.css`
- Test: `src/test/app.test.tsx`

**Interfaces:**
- Consumes: `PinPad`, `PinResult` (Task 4); `hashPin`, `PinUnavailableError` (Task 1); `HELPER_PIN_LENGTH`, `PIN_LENGTH` (Task 3); `snapshot`, `startSample` (Task 2); `resolveRoute(…, mode)` (Task 3).
- Produces:
  - `ChoosePin({ length, onChosen, tone? })` with `onChosen: (pin: string) => Promise<void>`; `PIN_UNAVAILABLE` message constant.
  - `type Flash = 'auto-help' | 'private' | 'setup-done' | null`
  - `Nav.restart(opts?: { unlocked?: boolean; flash?: Flash }): void`
  - `persistStorage(): Promise<boolean>`, `isStoragePersisted(): Promise<boolean>` (in `db.ts`)
  - Test helpers `renderFresh(backend?)` and `quickSetup(user, opts?)` in `app.test.tsx`, used by Tasks 6, 8, 9.

- [ ] **Step 1: Write the failing integration tests** — in `src/test/app.test.tsx`:

Add `cleanup` to the `@testing-library/react` import. Add helpers after `goToHash`:

```ts
async function renderFresh(backend: MemoryBackend = new MemoryBackend()) {
  const user = userEvent.setup();
  render(<App backend={backend} loader={loader} />);
  await screen.findByRole('heading', { name: 'Welcome to Familiar Place' });
  return { user, backend };
}

const HELPER_PIN = '246810';

/** Runs the first-run wizard: helper PIN, name, their PIN (or none), skip home and contact. */
async function quickSetup(
  user: ReturnType<typeof userEvent.setup>,
  { pin = '1357', name = 'Ada' }: { pin?: string | null; name?: string } = {},
) {
  await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
  await screen.findByRole('heading', { name: 'Choose a helper PIN' });
  await enterPin(user, HELPER_PIN);
  await enterPin(user, HELPER_PIN);
  await user.type(await screen.findByLabelText('Preferred name'), name);
  await user.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByRole('heading', { name: 'Choose their PIN' });
  if (pin) {
    await enterPin(user, pin);
    await enterPin(user, pin);
  } else {
    await user.click(screen.getByRole('button', { name: "Don't use a PIN" }));
  }
  await screen.findByRole('heading', { name: 'Home' });
  await user.click(screen.getByRole('button', { name: 'Skip for now' }));
  await screen.findByRole('heading', { name: 'Someone they trust' });
  await user.click(screen.getByRole('button', { name: pin ? 'Skip for now' : 'Skip and finish' }));
  if (pin) {
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('button', { name: 'Finish' }));
  }
  await screen.findByRole('heading', { name: new RegExp(`Good (morning|afternoon|evening), ${name}`) });
}
```

Append:

```ts
describe('first run', () => {
  it('sets up from blank, then locks with their own PIN', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    expect(screen.getByText(/All set/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Music/ }));
    expect(screen.getByText('No favourite music has been added yet.')).toBeInTheDocument();
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(screen.queryByRole('button', { name: /Use sample PIN/ })).not.toBeInTheDocument();
    await enterPin(user, '2580');
    expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");
    await enterPin(user, '1357');
    expect(await screen.findByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
  });

  it('without a PIN, opens straight to Today, now, next time and after time away', async () => {
    const { user, backend } = await renderFresh();
    await quickSetup(user, { pin: null });
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      setVisibility('hidden');
      vi.setSystemTime(Date.now() + 6 * 60_000);
      setVisibility('visible');
      expect(screen.getByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
    cleanup();
    render(<App backend={backend} loader={loader} />);
    expect(await screen.findByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
  });

  it('resumes at the same step after closing the app', async () => {
    const { user, backend } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
    await enterPin(user, HELPER_PIN);
    await enterPin(user, HELPER_PIN);
    await user.type(await screen.findByLabelText('Preferred name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Choose their PIN' });
    cleanup();
    render(<App backend={backend} loader={loader} />);
    expect(await screen.findByRole('heading', { name: 'Choose their PIN' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 6')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Preferred name')).toHaveValue('Ada');
  });

  it('asks for a number for a named trusted person, and Back then Next never adds them twice', async () => {
    const { user, backend } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Set up for someone' }));
    await enterPin(user, HELPER_PIN);
    await enterPin(user, HELPER_PIN);
    await user.type(await screen.findByLabelText('Preferred name'), 'Ada');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Choose their PIN' });
    await enterPin(user, '1357');
    await enterPin(user, '1357');
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.type(await screen.findByLabelText('Name'), 'Maya');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Add a phone number');
    await user.type(screen.getByLabelText('Phone number'), '07700 900123');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText('Name')).toHaveValue('Maya');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Before unlock' });
    await user.click(screen.getByRole('switch', { name: "Maya's name" }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await screen.findByRole('heading', { name: /Good .*, Ada/ });
    expect(await backend.getAll('contacts')).toHaveLength(1);
    expect((await backend.getKV<{ contact: { id: string; name: boolean } }>('approvals'))?.contact.name).toBe(true);
  });

  it('opens the sample family from Welcome', async () => {
    const { user } = await renderFresh();
    await user.click(screen.getByRole('button', { name: 'Look around with a sample family' }));
    await user.click(await screen.findByRole('button', { name: /Use sample PIN/ }));
    expect(await screen.findByRole('heading', { name: /Good .*, Peggy/ })).toBeInTheDocument();
  });
});
```

Rewrite the test `'erase everything leaves an empty locked preview with clear next steps'` as:

```ts
  it('erase everything returns to Welcome with nothing kept', async () => {
    const { user, backend } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /Settings and reset/ }));
    await user.click(screen.getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
    expect(await backend.getAll('contacts')).toEqual([]);
    goToHash('/today');
    expect(screen.getByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
  });
```

Everywhere in the file: `{ name: 'Lock phone' }` → `{ name: 'Lock' }`.

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/app.test.tsx`
Expected: FAIL — no Welcome heading on an empty backend; no `Lock` button.

- [ ] **Step 3: Persist helpers** — append to `src/lib/db.ts`:

```ts
/** Asks the browser not to clear Familiar Place's data when space runs low. */
export async function persistStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export async function isStoragePersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: ChoosePin** — `src/components/ChoosePin.tsx`

```tsx
import { useRef, useState } from 'react';
import { PinUnavailableError } from '../lib/pin';
import { PinPad, type PinResult } from './PinPad';

export const PIN_UNAVAILABLE =
  "This browser can't keep a PIN safely. Open Familiar Place from its installed app or an https address.";

/** Choose a PIN by entering it twice. The first entry is held in memory only until the second. */
export function ChoosePin({
  length,
  onChosen,
  tone = 'light',
}: {
  length: number;
  onChosen: (pin: string) => Promise<void>;
  tone?: 'light' | 'dark';
}) {
  const first = useRef<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = async (entry: string): Promise<PinResult | void> => {
    if (first.current === null) {
      first.current = entry;
      setConfirming(true);
      return;
    }
    const match = first.current === entry;
    first.current = null;
    setConfirming(false);
    if (!match) return { message: "Those didn't match. Try again.", shake: true };
    try {
      await onChosen(entry);
    } catch (e) {
      return { message: e instanceof PinUnavailableError ? PIN_UNAVAILABLE : "That PIN couldn't be saved. Please try again." };
    }
  };

  return (
    <div className="choose-pin">
      <p className="choose-pin-step">{confirming ? 'Enter the same numbers again.' : `Enter ${length} numbers.`}</p>
      <PinPad length={length} onSubmit={submit} tone={tone} />
    </div>
  );
}
```

- [ ] **Step 5: Nav becomes mode-aware** — in `src/app/nav.tsx`:

- `export type Flash = 'auto-help' | 'private' | 'setup-done' | null;`
- Add to the `Nav` interface:

```ts
  /** Starts a fresh session at the right first screen for the saved data. */
  restart(opts?: { unlocked?: boolean; flash?: Flash }): void;
```

- `const { ready, snapshot } = useStore();`
- In `apply`, change the resolve line to `const resolution = resolveRoute(path, sessionRef.current.unlocked, snapshot().setup.mode);` and add `snapshot` to its dependency list.
- In the mount effect, delete `writeHash('/lock', true);` (restart now writes the first route).
- Add after `lock`:

```ts
  const restart = useCallback<Nav['restart']>(
    (opts) => {
      const d = snapshot();
      const isNew = d.setup.mode === 'new';
      const unlocked = !isNew && (opts?.unlocked ?? !d.security.lockEnabled);
      setSession({ ...initialSession(), unlocked });
      const path = isNew ? ((d.setup.wizardStep ?? 1) > 1 ? '/start' : '/welcome') : unlocked ? '/today' : '/lock';
      apply(path, 'replace', opts?.flash ?? null);
    },
    [apply, setSession, snapshot],
  );

  // Pick the first screen once saved data has loaded.
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    restart();
  }, [ready, restart]);
```

- Add `restart` to the `value` object and its dependency list.

- [ ] **Step 6: Welcome** — `src/screens/start/Welcome.tsx`

```tsx
import { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { useNav } from '../../app/nav';
import { Button, Heading, Notice, Screen, Stack } from '../../components/ui';
import { useStore } from '../../lib/store';

/** The first screen on a new install, and after Erase everything. */
export function Welcome() {
  const { startSample } = useStore();
  const { navigate, restart } = useNav();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const sample = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await startSample();
      restart();
    } catch {
      setProblem("The sample family couldn't be loaded. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Screen label="Welcome">
      <Heading sub="Familiar Place helps someone get their bearings and reach a person they trust. Set it up together.">
        Welcome to Familiar Place
      </Heading>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <Stack>
        <Button variant="primary" size="xl" icon={UserPlus} onClick={() => navigate('/start')}>
          Set up for someone
        </Button>
        <Button icon={Users} onClick={sample} disabled={busy}>
          {busy ? 'Loading the sample family…' : 'Look around with a sample family'}
        </Button>
      </Stack>
      <p className="muted">Everything stays on this phone. Nothing is uploaded.</p>
    </Screen>
  );
}
```

- [ ] **Step 7: Setup wizard** — `src/screens/start/SetupWizard.tsx`

```tsx
import { useState } from 'react';
import { ArrowRight, Check, Eye } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ChoosePin } from '../../components/ChoosePin';
import { PhotoField, TextField } from '../../components/fields';
import { Switch } from '../../components/Switch';
import { Button, Card, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { persistStorage } from '../../lib/db';
import { newId } from '../../lib/defaults';
import { hashPin } from '../../lib/pin';
import { HELPER_PIN_LENGTH, PIN_LENGTH } from '../../lib/session';
import { useStore } from '../../lib/store';
import type { AppData, Approvals, Contact } from '../../lib/types';
import { LockedPreviewModal } from '../setup/common';

type Next = (changes?: Partial<AppData>) => Promise<void>;

/**
 * The six-step first run. The current step is saved in setup.wizardStep, and
 * each step saves on Next or Skip, so closing the app resumes where it was.
 */
export function SetupWizard() {
  const { data, save } = useStore();
  const { restart } = useNav();
  const [problem, setProblem] = useState<string | null>(null);
  const step = data.setup.wizardStep ?? 1;
  const total = data.security.lockEnabled ? 6 : 5;

  const go = async (target: number, changes: Partial<AppData> = {}) => {
    setProblem(null);
    // A step that turns the lock off shortens the wizard.
    const lockOn = (changes.security ?? data.security).lockEnabled;
    const last = lockOn ? 6 : 5;
    try {
      if (target > last) {
        await save({ ...changes, setup: { ...data.setup, mode: 'real', wizardStep: null } });
        void persistStorage();
        restart({ unlocked: true, flash: 'setup-done' });
      } else {
        await save({ ...changes, setup: { ...data.setup, wizardStep: target } });
      }
    } catch {
      setProblem("That couldn't be saved. Please try again.");
    }
  };

  const next: Next = (changes) => go(step + 1, changes);
  const skip = () => go(step + 1);
  const isLast = step === total;

  return (
    <Screen
      top={<TopBar back={step > 1 ? { label: 'Back', onClick: () => void go(step - 1) } : undefined} />}
      label="Set up Familiar Place"
    >
      <p className="wizard-count">
        Step {step} of {total}
      </p>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {step === 1 ? <HelperPinStep data={data} onNext={next} /> : null}
      {step === 2 ? <AboutStep data={data} onNext={next} /> : null}
      {step === 3 ? <PinStep data={data} onNext={next} /> : null}
      {step === 4 ? <HomeStep data={data} onNext={next} onSkip={skip} /> : null}
      {step === 5 ? <ContactStep data={data} onNext={next} onSkip={skip} last={isLast} /> : null}
      {step === 6 ? <ApprovalsStep data={data} onNext={next} /> : null}
    </Screen>
  );
}

function HelperPinStep({ data, onNext }: { data: AppData; onNext: Next }) {
  return (
    <>
      <Heading sub="Only people who know this can change Familiar Place. Keep it somewhere safe.">Choose a helper PIN</Heading>
      <ChoosePin
        length={HELPER_PIN_LENGTH}
        onChosen={async (pin) => onNext({ security: { ...data.security, helperPin: await hashPin(pin) } })}
      />
    </>
  );
}

function AboutStep({ data, onNext }: { data: AppData; onNext: Next }) {
  const [name, setName] = useState(data.profile.preferredName);
  const [photo, setPhoto] = useState(data.profile.photo);
  const trimmed = name.trim();
  return (
    <>
      <Heading sub="The name they like to be called, and a photo they recognise.">About them</Heading>
      <Stack>
        <TextField label="Preferred name" value={name} onChange={setName} maxLength={60} />
        <PhotoField
          label="Their photo (optional)"
          value={photo}
          onChange={setPhoto}
          kind="person"
          defaultAlt={trimmed ? `Photo of ${trimmed}` : 'Their photo'}
          name={trimmed}
        />
        <Button
          variant="primary"
          icon={ArrowRight}
          disabled={!trimmed}
          onClick={() => void onNext({ profile: { ...data.profile, preferredName: trimmed, photo } })}
        >
          Next
        </Button>
      </Stack>
    </>
  );
}

function PinStep({ data, onNext }: { data: AppData; onNext: Next }) {
  return (
    <>
      <Heading sub="They'll use it to open Familiar Place. Use a different PIN from the phone's own passcode.">
        Choose their PIN
      </Heading>
      <ChoosePin
        length={PIN_LENGTH}
        onChosen={async (pin) =>
          onNext({ security: { ...data.security, personPin: await hashPin(pin), lockEnabled: true } })
        }
      />
      <Stack gap="sm">
        <Button
          variant="quiet"
          size="md"
          onClick={() => void onNext({ security: { ...data.security, personPin: null, lockEnabled: false } })}
        >
          Don't use a PIN
        </Button>
        <p className="field-hint">Without a PIN, Familiar Place opens straight to Today.</p>
      </Stack>
    </>
  );
}

function HomeStep({ data, onNext, onSkip }: { data: AppData; onNext: Next; onSkip: () => void }) {
  const [photo, setPhoto] = useState(data.home.photo);
  const [cue, setCue] = useState(data.home.cue);
  const [address, setAddress] = useState(data.home.address);
  return (
    <>
      <Heading sub="A photo and a few words help them recognise home.">Home</Heading>
      <Stack>
        <PhotoField label="Photo of home (optional)" value={photo} onChange={setPhoto} defaultAlt="The front of home" />
        <TextField
          label="Something to recognise it by (optional)"
          hint='For example: "My front door is blue."'
          value={cue}
          onChange={setCue}
        />
        <TextField label="Address (optional)" hint="Shown only after unlock." value={address} onChange={setAddress} />
        <Button
          variant="primary"
          icon={ArrowRight}
          onClick={() => void onNext({ home: { ...data.home, photo, cue: cue.trim(), address: address.trim() } })}
        >
          Next
        </Button>
        <Button variant="quiet" size="md" onClick={onSkip}>
          Skip for now
        </Button>
      </Stack>
    </>
  );
}

function ContactStep({
  data,
  onNext,
  onSkip,
  last,
}: {
  data: AppData;
  onNext: Next;
  onSkip: () => void;
  last: boolean;
}) {
  // Editing the first contact, so going Back and Next never adds a second one.
  const existing: Contact | undefined = data.contacts[0];
  const [name, setName] = useState(existing?.name ?? '');
  const [relationship, setRelationship] = useState(existing?.relationship ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [photo, setPhoto] = useState(existing?.photo ?? null);
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    if (!name.trim()) return onSkip();
    if (!phone.trim()) {
      setError(`Add a phone number, or tap ${last ? 'Skip and finish' : 'Skip for now'}.`);
      return;
    }
    const contact: Contact = {
      id: existing?.id ?? newId('contact'),
      name: name.trim(),
      relationship: relationship.trim(),
      phone: phone.trim(),
      photo,
      primary: true,
      voice: existing?.voice ?? null,
      order: 0,
    };
    void onNext({ contacts: [contact, ...data.contacts.slice(1)] });
  };

  return (
    <>
      <Heading sub="The person they'd most like to call for help. You can add more people later.">Someone they trust</Heading>
      <Stack>
        <TextField label="Name" value={name} onChange={setName} maxLength={60} />
        <TextField label="Relationship (optional)" hint="For example: My daughter" value={relationship} onChange={setRelationship} />
        <TextField label="Phone number" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={setPhone} />
        <PhotoField
          label="Their photo (optional)"
          value={photo}
          onChange={setPhoto}
          kind="person"
          defaultAlt={name.trim() ? `Photo of ${name.trim()}` : 'Photo'}
          name={name.trim()}
        />
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
        <Button variant="primary" icon={last ? Check : ArrowRight} onClick={next}>
          {last ? 'Finish' : 'Next'}
        </Button>
        <Button variant="quiet" size="md" onClick={onSkip}>
          {last ? 'Skip and finish' : 'Skip for now'}
        </Button>
      </Stack>
    </>
  );
}

function ApprovalsStep({ data, onNext }: { data: AppData; onNext: Next }) {
  const [a, setA] = useState<Approvals>(data.approvals);
  const [previewing, setPreviewing] = useState(false);
  const p = data.profile;
  const h = data.home;
  const c: Contact | undefined = data.contacts[0];
  const setContact = (patch: Partial<Approvals['contact']>) =>
    setA((x) => ({ ...x, contact: { ...x.contact, ...patch, id: c?.id ?? null } }));

  const rows: Array<{ label: string; show: boolean; checked: boolean; set: (v: boolean) => void; description?: string }> = [
    { label: `Their name (${p.preferredName})`, show: !!p.preferredName.trim(), checked: a.youName, set: (v) => setA((x) => ({ ...x, youName: v })) },
    { label: 'Their photo', show: !!p.photo, checked: a.youPhoto, set: (v) => setA((x) => ({ ...x, youPhoto: v })) },
    { label: 'Photo of home', show: !!h.photo, checked: a.homePhoto, set: (v) => setA((x) => ({ ...x, homePhoto: v })) },
    { label: `“${h.cue}”`, show: !!h.cue.trim(), checked: a.homeCue, set: (v) => setA((x) => ({ ...x, homeCue: v })) },
  ];
  if (c) {
    rows.push(
      { label: `${c.name}'s name`, show: true, checked: a.contact.name, set: (v) => setContact({ name: v }) },
      { label: `${c.name}'s relationship`, show: !!c.relationship.trim(), checked: a.contact.relationship, set: (v) => setContact({ relationship: v }) },
      { label: `${c.name}'s photo`, show: !!c.photo, checked: a.contact.photo, set: (v) => setContact({ photo: v }) },
      {
        label: `Button to call ${c.name}`,
        show: !!c.phone.trim(),
        checked: a.contact.call,
        set: (v) => setContact({ call: v }),
        description: "The phone's dialer may show this number on the lock screen.",
      },
    );
  }
  const visible = rows.filter((r) => r.show);

  return (
    <>
      <Heading sub="Choose what may show on the help screen while Familiar Place is locked. Everything else stays private. You can change this later.">
        Before unlock
      </Heading>
      <Stack>
        {visible.length ? (
          <Card>
            {visible.map((r) => (
              <Switch key={r.label} label={r.label} description={r.description} checked={r.checked} onChange={r.set} />
            ))}
          </Card>
        ) : (
          <Notice>Nothing has been added yet that could show before unlock.</Notice>
        )}
        <Button icon={Eye} onClick={() => setPreviewing(true)}>
          Preview locked view
        </Button>
        <Button variant="primary" icon={Check} onClick={() => void onNext({ approvals: a })}>
          Finish
        </Button>
      </Stack>
      {previewing ? <LockedPreviewModal source={{ ...data, approvals: a }} onClose={() => setPreviewing(false)} /> : null}
    </>
  );
}
```

- [ ] **Step 8: Wizard and Welcome styles** — append to `src/styles.css`:

```css
/* ---------- First run ---------- */

.wizard-count {
  margin: 0 0 4px;
  font-weight: 700;
  color: var(--ink-2);
}

.choose-pin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin: 8px 0 16px;
}

.choose-pin-step {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
}
```

- [ ] **Step 9: App renders first-run screens** — in `src/App.tsx`:

- Imports: `import { Welcome } from './screens/start/Welcome';` and `import { SetupWizard } from './screens/start/SetupWizard';`.
- In `Shell`, change the focus effect's dependency list to `[route.path, ready, data.setup.wizardStep]`.
- At the top of `ScreenSwitch`, add `const { data } = useStore();` and, before the defence-in-depth check:

```tsx
  if (data.setup.mode === 'new') return route.name === 'start' ? <SetupWizard /> : <Welcome />;
```

- [ ] **Step 10: Today** — in `src/screens/companion/Today.tsx`:

- Add `Check` to the lucide import and `Notice` to the `ui` import.
- `const { navigate, lock, flash } = useNav();`
- After `<Heading …>…</Heading>` add:

```tsx
      {flash === 'setup-done' ? (
        <Notice tone="ok" icon={Check}>
          All set. Add routines, memories and music any time in Helper setup.
        </Notice>
      ) : null}
```

- Replace the Lock button with:

```tsx
        {data.security.lockEnabled ? (
          <Button icon={Lock} onClick={lock}>
            Lock
          </Button>
        ) : null}
```

- [ ] **Step 11: Settings erase and reset restart the session** — in `src/screens/setup/SetupSettings.tsx`, add `import { useNav } from '../../app/nav';`, `const { restart } = useNav();`, and call `restart();` right after `await eraseEverything();` and after `await startSample();`.

- [ ] **Step 12: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add src
git commit -m "Add Welcome and the six-step first run; navigation follows the app mode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Helper gate and PIN settings

**Files:**
- Create: `src/screens/setup/HelperGate.tsx`
- Modify: `src/app/nav.tsx`, `src/App.tsx` (`SetupScreens`), `src/screens/setup/SetupSettings.tsx`
- Test: `src/test/app.test.tsx`

**Interfaces:**
- Consumes: `initialHelperGate`, `helperAttempt`, `helperOpenAt`, `HelperGate`, `HELPER_PIN_LENGTH` (Task 3); `verifyPin`, `hashPin` (Task 1); `ChoosePin` (Task 5); `PinPad` (Task 4); `restart` (Task 5).
- Produces: `Nav.isHelperOpen(): boolean`, `Nav.helperWaitUntil: number`, `Nav.checkHelperPin(entry: string): Promise<'ok' | 'wrong' | 'wait'>`. `HelperGate({ extraForgotActions?: (close: () => void) => ReactNode })` — Task 8 passes a "Restore a backup" button through this slot.

- [ ] **Step 1: Write the failing tests** — append to `src/test/app.test.tsx`:

```ts
describe('helper gate', () => {
  afterEach(() => vi.useRealTimers());

  it('asks for the helper PIN, waits after 5 wrong tries, then stays open for 10 minutes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { user } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Enter the helper PIN' })).toBeInTheDocument();
    for (let i = 0; i < 4; i++) await enterPin(user, '111111');
    expect(screen.getByRole('status')).toHaveTextContent("That isn't the helper PIN.");
    await enterPin(user, '111111');
    expect(screen.getByText(/Try again in 30 seconds/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeDisabled();

    vi.setSystemTime(Date.now() + 30_000);
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toBeEnabled(), { timeout: 2500 });
    await enterPin(user, HELPER_PIN);
    expect(await screen.findByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();

    vi.setSystemTime(Date.now() + 10 * 60_000);
    await user.click(screen.getByRole('button', { name: 'Back to Today' }));
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Enter the helper PIN' })).toBeInTheDocument();
  });

  it('Cancel returns to Today without opening setup', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: /Good/ })).toBeInTheDocument();
  });

  it('a forgotten helper PIN can only lead to erasing, after two confirmations', async () => {
    const { user, backend } = await renderFresh();
    await quickSetup(user);
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await user.click(screen.getByRole('button', { name: 'Forgot the helper PIN?' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Erase everything' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes, erase everything' }));
    expect(await screen.findByRole('heading', { name: 'Welcome to Familiar Place' })).toBeInTheDocument();
    expect((await backend.getKV<{ preferredName: string }>('profile'))?.preferredName).toBe('');
  });

  it('the sample family skips the gate', async () => {
    const { user } = await renderApp();
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await user.click(await screen.findByRole('button', { name: 'Helper setup' }));
    expect(screen.getByRole('heading', { name: 'Helper setup' })).toBeInTheDocument();
  });
});

describe('PIN settings', () => {
  async function toSettings(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await enterPin(user, HELPER_PIN);
    await user.click(await screen.findByRole('button', { name: /Settings and reset/ }));
  }

  it('changes their PIN only when both entries match', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await toSettings(user);
    await user.click(screen.getByRole('button', { name: 'Change their PIN' }));
    const dialog = screen.getByRole('dialog');
    await enterPin(user, '1111');
    await enterPin(user, '2222');
    expect(within(dialog).getByRole('status')).toHaveTextContent("Those didn't match");
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await enterPin(user, '1357');
    expect(await screen.findByRole('heading', { name: /Good/ })).toBeInTheDocument();

    await toSettings(user);
    await user.click(screen.getByRole('button', { name: 'Change their PIN' }));
    await enterPin(user, '9999');
    await enterPin(user, '9999');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    goToHash('/today');
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await enterPin(user, '1357');
    expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");
    await enterPin(user, '9999');
    expect(await screen.findByRole('heading', { name: /Good/ })).toBeInTheDocument();
  });

  it('turning the PIN off removes the Lock button', async () => {
    const { user } = await renderFresh();
    await quickSetup(user);
    await toSettings(user);
    await user.click(screen.getByRole('switch', { name: 'Ask for a PIN to open Familiar Place' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Turn off the PIN' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Ask for a PIN to open Familiar Place' })).toHaveAttribute('aria-checked', 'false'));
    goToHash('/today');
    expect(screen.queryByRole('button', { name: 'Lock' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/app.test.tsx`
Expected: FAIL — no "Enter the helper PIN" heading.

- [ ] **Step 3: Nav holds the gate** — in `src/app/nav.tsx`:

Import `helperAttempt, helperOpenAt, initialHelperGate, type HelperGate` from `../lib/session`.

Add to the `Nav` interface:

```ts
  /** True while a correct helper PIN is less than 10 minutes old. */
  isHelperOpen(): boolean;
  /** When the 30-second wait after 5 wrong helper PINs ends (ms since epoch), or 0. */
  helperWaitUntil: number;
  checkHelperPin(entry: string): Promise<'ok' | 'wrong' | 'wait'>;
```

Inside `NavProvider`, after the session state:

```ts
  const gateRef = useRef<HelperGate>(initialHelperGate());
  const [gate, setGateState] = useState<HelperGate>(gateRef.current);
  const setGate = useCallback((g: HelperGate) => {
    gateRef.current = g;
    setGateState(g);
  }, []);
  const closeGate = useCallback(() => setGate({ ...gateRef.current, verifiedUntil: 0 }), [setGate]);

  const isHelperOpen = useCallback(() => helperOpenAt(gateRef.current, Date.now()), []);

  const checkHelperPin = useCallback<Nav['checkHelperPin']>(
    async (entry) => {
      if (Date.now() < gateRef.current.waitUntil) return 'wait';
      const pin = snapshot().security.helperPin;
      const matched = pin ? await verifyPin(entry, pin).catch(() => false) : false;
      const now = Date.now();
      const next = helperAttempt(gateRef.current, matched, now);
      setGate(next);
      if (matched && helperOpenAt(next, now)) return 'ok';
      return now < next.waitUntil ? 'wait' : 'wrong';
    },
    [setGate, snapshot],
  );
```

- In `lock`, call `closeGate();` before `setSession(relock());` and add `closeGate` to its dependencies.
- In the visibility effect, call `closeGate();` right after the `if (away < RELOCK_AFTER_MS) return;` line (time away closes the gate even when the lock is off), and add `closeGate` to its dependencies.
- In `restart`, call `setGate(initialHelperGate());` first, and add `setGate` to its dependencies.
- Add `isHelperOpen, helperWaitUntil: gate.waitUntil, checkHelperPin` to `value` and `isHelperOpen, gate, checkHelperPin` to its dependency list.

- [ ] **Step 4: HelperGate screen** — `src/screens/setup/HelperGate.tsx`

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { PinPad, type PinResult } from '../../components/PinPad';
import { Button, Heading, Notice, Screen, TopBar } from '../../components/ui';
import { HELPER_PIN_LENGTH } from '../../lib/session';
import { useStore } from '../../lib/store';

type Forgot = null | 'menu' | 'erase1' | 'erase2';

/** Shown in place of any Helper setup screen until the helper PIN is entered. */
export function HelperGate({ extraForgotActions }: { extraForgotActions?: (close: () => void) => ReactNode }) {
  const { navigate, checkHelperPin, helperWaitUntil, restart } = useNav();
  const { data, eraseEverything } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [forgot, setForgot] = useState<Forgot>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const waiting = now < helperWaitUntil;
  const secondsLeft = Math.max(0, Math.ceil((helperWaitUntil - now) / 1000));
  const name = data.profile.preferredName.trim() || 'them';

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waiting]);

  const submit = async (entry: string): Promise<PinResult | void> => {
    const result = await checkHelperPin(entry);
    setNow(Date.now());
    if (result === 'wrong') return { message: "That isn't the helper PIN.", shake: true };
  };

  const erase = async () => {
    setForgot(null);
    try {
      await eraseEverything();
      restart();
    } catch {
      setProblem("Erasing didn't finish. Please try again.");
    }
  };

  return (
    <Screen top={<TopBar back={{ label: 'Cancel', onClick: () => navigate('/today') }} />} label="Helper PIN">
      <Heading sub="Helper setup changes what Familiar Place shows and who it calls.">Enter the helper PIN</Heading>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {waiting ? (
        <Notice tone="warn">
          Too many tries. Try again in {secondsLeft} {secondsLeft === 1 ? 'second' : 'seconds'}.
        </Notice>
      ) : null}
      <PinPad length={HELPER_PIN_LENGTH} onSubmit={submit} disabled={waiting} tone="light" />
      <Button variant="quiet" size="md" icon={HelpCircle} onClick={() => setForgot('menu')}>
        Forgot the helper PIN?
      </Button>

      {forgot === 'menu' ? (
        <Modal title="Forgot the helper PIN?" onClose={() => setForgot(null)}>
          <div className="modal-body">
            <p>
              The helper PIN can't be recovered. You can restore a backup, which has its own helper PIN, or erase
              everything and set up again.
            </p>
          </div>
          <div className="modal-actions">
            {extraForgotActions?.(() => setForgot(null))}
            <Button variant="danger" onClick={() => setForgot('erase1')}>
              Erase everything
            </Button>
            <Button onClick={() => setForgot(null)} data-autofocus>
              Cancel
            </Button>
          </div>
        </Modal>
      ) : null}
      {forgot === 'erase1' ? (
        <ConfirmDialog
          title="Erase everything?"
          body={<p>This deletes everything saved in Familiar Place on this phone, including photos and recordings.</p>}
          confirmLabel="Erase everything"
          danger
          onCancel={() => setForgot(null)}
          onConfirm={() => setForgot('erase2')}
        />
      ) : null}
      {forgot === 'erase2' ? (
        <ConfirmDialog
          title="Are you sure?"
          body={<p>Everything about {name} will be gone from this phone. This can't be undone.</p>}
          confirmLabel="Yes, erase everything"
          danger
          onCancel={() => setForgot(null)}
          onConfirm={() => void erase()}
        />
      ) : null}
    </Screen>
  );
}
```

- [ ] **Step 5: Gate the setup screens** — in `src/App.tsx`:

Import `HelperGate` from `./screens/setup/HelperGate`. Change the start of `SetupScreens` to:

```tsx
function SetupScreens() {
  const { route, isHelperOpen } = useNav();
  const { data } = useStore();
  // The sample family has no helper PIN, so it skips the gate.
  if (data.setup.mode === 'real' && !isHelperOpen()) return <HelperGate />;
  const id = route.id;
```

- [ ] **Step 6: Settings — Lock and Helper PIN cards** — in `src/screens/setup/SetupSettings.tsx`:

Imports to add: `KeyRound, Lock` from `lucide-react`; `{ ChoosePin }` from `../../components/ChoosePin`; `{ Modal }` alongside `ConfirmDialog`; `{ hashPin }` from `../../lib/pin`; `{ HELPER_PIN_LENGTH, PIN_LENGTH }` from `../../lib/session`; `type Security` from `../../lib/types`.

Inside the component:

```tsx
  const sample = data.setup.mode === 'sample';
  const security = data.security;
  const [pinDialog, setPinDialog] = useState<null | 'person' | 'helper'>(null);
  const [done, setDone] = useState<string | null>(null);

  const saveSecurity = (patch: Partial<Security>) => save({ security: { ...security, ...patch } });
```

Extend the `confirm` state union with `'lock-off'`.

Insert these cards after the Read aloud card:

```tsx
      {done ? (
        <div role="status">
          <Notice tone="ok">{done}</Notice>
        </div>
      ) : null}

      <Card>
        <h2 className="card-title">
          <Lock size={24} strokeWidth={2.5} aria-hidden /> Lock
        </h2>
        {sample ? (
          <p>PIN settings appear once Familiar Place is set up for real.</p>
        ) : (
          <>
            <Switch
              label="Ask for a PIN to open Familiar Place"
              description={
                security.lockEnabled
                  ? 'Familiar Place opens at the keypad, and locks again after 5 minutes in the background.'
                  : 'Familiar Place opens straight to Today.'
              }
              checked={security.lockEnabled}
              onChange={(on) => (on ? setPinDialog('person') : setConfirm('lock-off'))}
            />
            {security.lockEnabled ? (
              <Button size="md" icon={KeyRound} onClick={() => setPinDialog('person')}>
                Change their PIN
              </Button>
            ) : null}
          </>
        )}
      </Card>

      {!sample ? (
        <Card>
          <h2 className="card-title">
            <KeyRound size={24} strokeWidth={2.5} aria-hidden /> Helper PIN
          </h2>
          <p>Needed to open Helper setup.</p>
          <Button size="md" icon={KeyRound} onClick={() => setPinDialog('helper')}>
            Change helper PIN
          </Button>
        </Card>
      ) : null}
```

Add the dialogs next to the existing ones:

```tsx
      {pinDialog ? (
        <Modal title={pinDialog === 'person' ? 'Choose their PIN' : 'Choose a new helper PIN'} onClose={() => setPinDialog(null)}>
          <ChoosePin
            length={pinDialog === 'person' ? PIN_LENGTH : HELPER_PIN_LENGTH}
            onChosen={async (pin) => {
              const hash = await hashPin(pin);
              await saveSecurity(pinDialog === 'person' ? { personPin: hash, lockEnabled: true } : { helperPin: hash });
              setDone(pinDialog === 'person' ? 'Their PIN is saved.' : 'The helper PIN is saved.');
              setPinDialog(null);
            }}
          />
          <div className="modal-actions">
            <Button onClick={() => setPinDialog(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
      {confirm === 'lock-off' ? (
        <ConfirmDialog
          title="Turn off the PIN?"
          body={<p>Familiar Place will open straight to Today. The Before unlock choices are kept, but won't be used.</p>}
          confirmLabel="Turn off the PIN"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await saveSecurity({ personPin: null, lockEnabled: false });
            } catch {
              setMessage("That setting couldn't be saved. Please try again.");
            }
          }}
        />
      ) : null}
```

- [ ] **Step 7: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src
git commit -m "Gate Helper setup behind the helper PIN; add PIN settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Encrypted backup format and restore

**Files:**
- Create: `src/lib/backup.ts`
- Modify: `src/lib/repo.ts`
- Test: `src/test/backup.test.ts`

**Interfaces:**
- Consumes: `AppData`, `MediaRecord`; `writeAll`, `loadAppData`, `mediaRefs`, `seedSample`, `writesFor` (Task 2); `hashPin`, `verifyPin` (Task 1).
- Produces (backup.ts): `BACKUP_FORMAT = 1`, `BACKUP_ITERATIONS = 600_000`, `MIN_PASSWORD_LENGTH = 8`, `type BackupErrorCode = 'not-backup' | 'newer' | 'password' | 'damaged'`, `BACKUP_ERRORS`, `class BackupError { code }`, `interface BackupContents { data: AppData; media: MediaRecord[] }`, `encodeBackup(contents, password, now?): Promise<Blob>`, `decodeBackup(file: Blob, password: string): Promise<BackupContents>`, `blobBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>>`, `backupFilename(date?: Date): string`, `saveBackupFile(blob: Blob, filename: string): void`, `formatBytes(n: number): string`.
- Produces (repo.ts): `collectBackup(backend, data): Promise<BackupContents>`, `estimateBackupBytes(backend, data): Promise<number>`, `restoreBackupContents(backend, contents): Promise<AppData>`.

- [ ] **Step 1: Write the failing tests** — `src/test/backup.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { BackupError, backupFilename, blobBytes, decodeBackup, encodeBackup, formatBytes } from '../lib/backup';
import { MemoryBackend } from '../lib/db';
import { hashPin, verifyPin } from '../lib/pin';
import { collectBackup, loadAppData, restoreBackupContents, seedSample, writesFor, type DemoMediaLoader } from '../lib/repo';
import { DEMO_MEDIA } from '../lib/seed';
import type { AppData } from '../lib/types';

const PW = 'correct horse battery';

const allMedia: DemoMediaLoader = async (backend) => {
  const ids = new Set<string>();
  for (const [id, { mime }] of Object.entries(DEMO_MEDIA)) {
    await backend.putMedia({ id, blob: new Blob([`bytes of ${id}`], { type: mime }), mime, createdAt: 7 });
    ids.add(id);
  }
  return ids;
};

/** A set-up ("real") profile built from the sample family, with real PINs. */
async function realBackend(): Promise<{ backend: MemoryBackend; data: AppData }> {
  const backend = new MemoryBackend();
  const sample = await seedSample(backend, allMedia);
  const data: AppData = {
    ...sample,
    setup: { mode: 'real', wizardStep: null, lastBackupAt: null },
    security: { personPin: await hashPin('1357'), helperPin: await hashPin('246810'), lockEnabled: true },
  };
  await backend.write(writesFor(data, ['security', 'setup']));
  return { backend, data };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof BackupError ? e.code : `unexpected: ${String(e)}`;
  }
}

describe('backup files', () => {
  it('round-trips every slice and every media byte', async () => {
    const { backend, data } = await realBackend();
    const contents = await collectBackup(backend, data);
    expect(contents.media.length).toBeGreaterThan(5);
    const back = await decodeBackup(await encodeBackup(contents, PW), PW);
    expect(back.data).toEqual(data);
    expect(back.media.map((m) => m.id).sort()).toEqual(contents.media.map((m) => m.id).sort());
    for (const m of back.media) {
      const original = contents.media.find((x) => x.id === m.id)!;
      expect(new TextDecoder().decode(await blobBytes(m.blob))).toBe(new TextDecoder().decode(await blobBytes(original.blob)));
      expect(m.mime).toBe(original.mime);
      expect(m.createdAt).toBe(7);
    }
  });

  it('leaves out media nothing refers to', async () => {
    const { backend, data } = await realBackend();
    await backend.putMedia({ id: 'orphan', blob: new Blob(['x']), mime: 'image/png', createdAt: 0 });
    const contents = await collectBackup(backend, data);
    expect(contents.media.some((m) => m.id === 'orphan')).toBe(false);
  });

  it('rejects a wrong password', async () => {
    const { backend, data } = await realBackend();
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    expect(await codeOf(decodeBackup(file, 'not the password'))).toBe('password');
  });

  it('rejects files that are not backups', async () => {
    expect(await codeOf(decodeBackup(new Blob([]), PW))).toBe('not-backup');
    expect(await codeOf(decodeBackup(new Blob(['a photo, not a backup, but long enough to have a header']), PW))).toBe('not-backup');
  });

  it('rejects a backup from a newer version', async () => {
    const { backend, data } = await realBackend();
    const bytes = await blobBytes(await encodeBackup(await collectBackup(backend, data), PW));
    bytes[4] = 2;
    expect(await codeOf(decodeBackup(new Blob([bytes]), PW))).toBe('newer');
  });

  it('rejects a truncated or altered file without changing anything', async () => {
    const { backend, data } = await realBackend();
    const bytes = await blobBytes(await encodeBackup(await collectBackup(backend, data), PW));
    expect(await codeOf(decodeBackup(new Blob([bytes.slice(0, bytes.length - 10)]), PW))).toBe('password');
    const altered = bytes.slice();
    altered[60] ^= 1;
    expect(await codeOf(decodeBackup(new Blob([altered]), PW))).toBe('password');
  });

  it('restores onto another phone as a real profile, with the PINs from the backup', async () => {
    const { backend, data } = await realBackend();
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    const target = new MemoryBackend();
    await target.putMedia({ id: 'old', blob: new Blob(['old']), mime: 'image/png', createdAt: 0 });
    const restored = await restoreBackupContents(target, await decodeBackup(file, PW));
    expect(restored.profile).toEqual(data.profile);
    expect(restored.contacts).toEqual(data.contacts);
    expect(restored.setup).toEqual({ mode: 'real', wizardStep: null, lastBackupAt: null });
    expect(await verifyPin('1357', restored.security.personPin!)).toBe(true);
    expect(await verifyPin('246810', restored.security.helperPin!)).toBe(true);
    expect(await target.listMediaIds()).not.toContain('old');
    expect(await loadAppData(target)).toEqual(restored);
  });

  it('still backs up and restores when a referenced photo is missing from storage', async () => {
    const { backend, data } = await realBackend();
    const mayaPhoto = data.contacts.find((c) => c.name === 'Maya')?.photo?.id;
    expect(mayaPhoto).toBeTruthy();
    await backend.deleteMedia([mayaPhoto!]);
    const file = await encodeBackup(await collectBackup(backend, data), PW);
    const target = new MemoryBackend();
    const restored = await restoreBackupContents(target, await decodeBackup(file, PW));
    // The reference stays, so the app shows its missing-photo state.
    expect(restored.contacts.find((c) => c.name === 'Maya')?.photo?.id).toBe(mayaPhoto);
    expect(await target.getMedia(mayaPhoto!)).toBeUndefined();
  });

  it('names files by date and formats sizes', () => {
    expect(backupFilename(new Date(2026, 10, 4))).toBe('familiar-place-backup-2026-11-04.fpbackup');
    expect(formatBytes(500)).toBe('1 KB');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/test/backup.test.ts`
Expected: FAIL — cannot resolve `../lib/backup`.

- [ ] **Step 3: Implement** — `src/lib/backup.ts`

```ts
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
```

- [ ] **Step 4: Repo helpers** — in `src/lib/repo.ts`:

Add `import type { BackupContents } from './backup';` and `MediaRecord` to the types import. Append:

```ts
/** Everything a backup needs: all data, plus each stored media record the data refers to. */
export async function collectBackup(backend: Backend, data: AppData): Promise<BackupContents> {
  const media: MediaRecord[] = [];
  for (const id of mediaRefs(data)) {
    const record = await backend.getMedia(id);
    if (record) media.push(record);
  }
  return { data, media };
}

export async function estimateBackupBytes(backend: Backend, data: AppData): Promise<number> {
  const { media } = await collectBackup(backend, data);
  return JSON.stringify(data).length + media.reduce((n, m) => n + m.blob.size, 0);
}

/**
 * Replaces everything with a backup. Media goes first and the data plus meta
 * last, so an interrupted restore looks like a new install and can be retried.
 */
export async function restoreBackupContents(backend: Backend, { data, media }: BackupContents): Promise<AppData> {
  await backend.clearAll();
  for (const m of media) await backend.putMedia(m);
  await writeAll(backend, { ...data, setup: { ...data.setup, mode: 'real', wizardStep: null } });
  return loadAppData(backend);
}
```

- [ ] **Step 5: Run the backup tests**

Run: `npx vitest run src/test/backup.test.ts`
Expected: 9 passed.

- [ ] **Step 6: Full check and commit**

Run: `npm test` then `npm run typecheck` — both pass.

```bash
git add src/lib/backup.ts src/lib/repo.ts src/test/backup.test.ts
git commit -m "Add password-protected backup format and restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Backup and restore in the app

**Files:**
- Create: `src/screens/setup/SaveBackupDialog.tsx`, `src/components/RestoreDialog.tsx`
- Modify: `src/lib/store.tsx`, `src/components/fields.tsx` (`TextField` type union), `src/screens/setup/SetupSettings.tsx`, `src/screens/setup/SetupHub.tsx`, `src/screens/start/Welcome.tsx`, `src/App.tsx` (pass forgot action to `HelperGate`)
- Test: `src/test/app.test.tsx`

**Interfaces:**
- Consumes: everything from Task 7; `persistStorage`, `isStoragePersisted` (Task 5); `restart` (Task 5); `HelperGate`'s `extraForgotActions` (Task 6).
- Produces: Store `createBackup(password: string): Promise<Blob>`, `estimateBackupBytes(): Promise<number>`, `applyBackup(contents: BackupContents): Promise<void>`; `RestoreDialog({ confirmReplace, onClose, onRestored })`; `SaveBackupDialog({ onClose, onSaved })`.

- [ ] **Step 1: Write the failing test** — append to `src/test/app.test.tsx`:

```ts
describe('backup and restore', () => {
  it('saves a password-protected backup and restores it on a new phone', async () => {
    let saved = null as Blob | null;
    const realCreate = URL.createObjectURL;
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((obj) => {
      if (obj instanceof Blob && obj.type === 'application/octet-stream') saved = obj;
      return realCreate(obj);
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    try {
      const { user } = await renderFresh();
      await quickSetup(user);
      await user.click(screen.getByRole('button', { name: 'Helper setup' }));
      await enterPin(user, HELPER_PIN);
      expect(await screen.findByText(/No backup yet/)).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /Settings and reset/ }));
      expect(screen.getByText('Last backup: never')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Save a backup' }));
      const dialog = screen.getByRole('dialog');
      await user.type(within(dialog).getByLabelText('Password'), 'short');
      await user.type(within(dialog).getByLabelText('Type it again'), 'short');
      await user.click(within(dialog).getByRole('button', { name: 'Save backup' }));
      expect(within(dialog).getByRole('alert')).toHaveTextContent('at least 8 characters');
      await user.clear(within(dialog).getByLabelText('Password'));
      await user.clear(within(dialog).getByLabelText('Type it again'));
      await user.type(within(dialog).getByLabelText('Password'), 'riverton-2026');
      await user.type(within(dialog).getByLabelText('Type it again'), 'riverton-2026');
      await user.click(within(dialog).getByRole('button', { name: 'Save backup' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), { timeout: 4000 });
      expect(saved).not.toBeNull();
      expect(click).toHaveBeenCalled();
      expect(screen.queryByText('Last backup: never')).not.toBeInTheDocument();
      cleanup();

      // A new phone.
      const { user: user2 } = await renderFresh(new MemoryBackend());
      await user2.click(screen.getByRole('button', { name: 'Restore from a backup' }));
      const restore = screen.getByRole('dialog');
      await user2.upload(within(restore).getByLabelText('Backup file'), new File([saved!], 'familiar-place-backup.fpbackup'));
      await user2.type(within(restore).getByLabelText('Backup password'), 'wrong-password');
      await user2.click(within(restore).getByRole('button', { name: 'Restore' }));
      expect(await within(restore).findByText("That password didn't open this backup.", {}, { timeout: 4000 })).toBeInTheDocument();
      await user2.clear(within(restore).getByLabelText('Backup password'));
      await user2.type(within(restore).getByLabelText('Backup password'), 'riverton-2026');
      await user2.click(within(restore).getByRole('button', { name: 'Restore' }));
      expect(await screen.findByRole('heading', { name: 'Enter PIN' }, { timeout: 4000 })).toBeInTheDocument();
      await enterPin(user2, '1357');
      expect(await screen.findByRole('heading', { name: /Good .*, Ada/ })).toBeInTheDocument();
    } finally {
      createUrl.mockRestore();
      click.mockRestore();
    }
  });

  it('the sample family offers no backup', async () => {
    const { user } = await unlockToSetup();
    expect(screen.queryByText(/No backup yet/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Settings and reset/ }));
    expect(screen.queryByRole('button', { name: 'Save a backup' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/app.test.tsx`
Expected: FAIL — no "No backup yet", no "Save a backup".

- [ ] **Step 3: Store** — in `src/lib/store.tsx`:

Imports: `import { encodeBackup, type BackupContents } from './backup';` and add `collectBackup, estimateBackupBytes as estimateBytes, restoreBackupContents` to the repo import.

Add to the `Store` interface:

```ts
  /** Builds an encrypted backup of everything. */
  createBackup(password: string): Promise<Blob>;
  estimateBackupBytes(): Promise<number>;
  /** Replaces everything with a decoded backup. */
  applyBackup(contents: BackupContents): Promise<void>;
```

Inside the provider:

```ts
  const createBackup = useCallback(
    (password: string) =>
      enqueue(async () => encodeBackup(await collectBackup(backendRef.current, dataRef.current), password)),
    [enqueue],
  );

  const estimateBackupBytes = useCallback(() => estimateBytes(backendRef.current, dataRef.current), []);

  const applyBackup = useCallback(
    (contents: BackupContents) =>
      enqueue(async () => {
        cacheRef.current.forgetAll();
        pendingMedia.current.clear();
        commit(await restoreBackupContents(backendRef.current, contents));
      }),
    [commit, enqueue],
  );
```

Add all three to `value` and its dependency list.

- [ ] **Step 4: Password fields** — in `src/components/fields.tsx`, change `TextField`'s `type` prop to `type?: 'text' | 'tel' | 'time' | 'password';`.

- [ ] **Step 5: RestoreDialog** — `src/components/RestoreDialog.tsx`

```tsx
import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { BackupError, decodeBackup, type BackupContents } from '../lib/backup';
import { persistStorage } from '../lib/db';
import { useStore } from '../lib/store';
import { TextField } from './fields';
import { ConfirmDialog, Modal } from './Modal';
import { Button, Notice } from './ui';

/**
 * Choose a backup file and its password. The whole file is checked before
 * anything on the phone changes.
 */
export function RestoreDialog({
  confirmReplace,
  onClose,
  onRestored,
}: {
  /** Ask before replacing existing data. False on Welcome, where nothing exists yet. */
  confirmReplace: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { applyBackup } = useStore();
  const fileId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<BackupContents | null>(null);

  const apply = async (contents: BackupContents) => {
    setBusy(true);
    try {
      await applyBackup(contents);
      void persistStorage();
      onRestored();
    } catch {
      setReady(null);
      setError("The backup couldn't be restored. Please try again.");
      setBusy(false);
    }
  };

  const open = async () => {
    if (!file) {
      setError('Choose a backup file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const contents = await decodeBackup(file, password);
      setBusy(false);
      if (confirmReplace) setReady(contents);
      else await apply(contents);
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "This backup couldn't be opened.");
      setBusy(false);
    }
  };

  if (ready) {
    return (
      <ConfirmDialog
        title="Replace everything on this phone?"
        body={<p>Everything in Familiar Place on this phone will be replaced with this backup. This can't be undone.</p>}
        confirmLabel="Replace with backup"
        danger
        onCancel={onClose}
        onConfirm={() => void apply(ready)}
      />
    );
  }

  return (
    <Modal title="Restore from a backup" onClose={onClose}>
      <div className="modal-body stack stack-sm">
        <div className="field">
          <label className="field-label" htmlFor={fileId}>
            Backup file
          </label>
          <input id={fileId} type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <TextField label="Backup password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="modal-actions">
        <Button variant="primary" icon={Upload} onClick={() => void open()} disabled={busy}>
          {busy ? 'Opening…' : 'Restore'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
```

(No `accept` attribute: Android file pickers grey out unknown extensions.)

- [ ] **Step 6: SaveBackupDialog** — `src/screens/setup/SaveBackupDialog.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { TextField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { Button, Notice } from '../../components/ui';
import { MIN_PASSWORD_LENGTH, backupFilename, formatBytes, saveBackupFile } from '../../lib/backup';
import { useStore } from '../../lib/store';

export function SaveBackupDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { createBackup, estimateBackupBytes, save, snapshot } = useStore();
  const [size, setSize] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    estimateBackupBytes().then(setSize, () => setSize(null));
  }, [estimateBackupBytes]);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const blob = await createBackup(password);
      saveBackupFile(blob, backupFilename());
      const d = snapshot();
      await save({ setup: { ...d.setup, lastBackupAt: Date.now() } });
      onSaved();
    } catch {
      setError("The backup couldn't be made. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Save a backup" onClose={onClose}>
      <div className="modal-body stack stack-sm">
        <p>
          A backup file holds everything in Familiar Place{size !== null ? `, about ${formatBytes(size)}` : ''}. It is
          locked with a password.
        </p>
        <TextField label="Password" type={show ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete="new-password" />
        <TextField label="Type it again" type={show ? 'text' : 'password'} value={again} onChange={setAgain} autoComplete="new-password" />
        <Switch label="Show password" checked={show} onChange={setShow} />
        <Notice tone="warn">You'll need this password to restore. It can't be recovered.</Notice>
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="modal-actions">
        <Button variant="primary" icon={Download} onClick={() => void submit()} disabled={busy}>
          {busy ? 'Making the backup…' : 'Save backup'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 7: Settings backup card and storage note** — in `src/screens/setup/SetupSettings.tsx`:

Imports: `Archive, Download, Upload` from lucide; `useEffect`; `{ RestoreDialog }` from `../../components/RestoreDialog`; `{ SaveBackupDialog }` from `./SaveBackupDialog`; `{ isStoragePersisted }` from `../../lib/db`; `{ formatDate }` from `../../lib/schedule`.

Inside the component:

```tsx
  const [backupDialog, setBackupDialog] = useState<null | 'save' | 'restore'>(null);
  const [kept, setKept] = useState(true);
  useEffect(() => {
    isStoragePersisted().then(setKept);
  }, []);
  const last = data.setup.lastBackupAt;
```

Before the "Your information" card insert:

```tsx
      {!sample ? (
        <Card>
          <h2 className="card-title">
            <Archive size={24} strokeWidth={2.5} aria-hidden /> Back up and restore
          </h2>
          <p>Last backup: {last ? formatDate(new Date(last)) : 'never'}</p>
          <Button icon={Download} onClick={() => setBackupDialog('save')}>
            Save a backup
          </Button>
          <Button icon={Upload} onClick={() => setBackupDialog('restore')}>
            Restore a backup
          </Button>
        </Card>
      ) : null}
```

In the "Your information" card, after the persistent/not-persistent paragraph add:

```tsx
        {persistent && !kept ? (
          <p>This browser may clear Familiar Place's data if the phone runs low on space. Keep a recent backup.</p>
        ) : null}
```

Add the dialogs:

```tsx
      {backupDialog === 'save' ? (
        <SaveBackupDialog
          onClose={() => setBackupDialog(null)}
          onSaved={() => {
            setBackupDialog(null);
            setDone('Backup saved. Keep the file and its password somewhere safe.');
          }}
        />
      ) : null}
      {backupDialog === 'restore' ? (
        <RestoreDialog confirmReplace onClose={() => setBackupDialog(null)} onRestored={() => restart()} />
      ) : null}
```

- [ ] **Step 8: Backup reminder on the hub** — in `src/screens/setup/SetupHub.tsx`, replace the `<Notice tone="warn">Demo only: …</Notice>` block with:

```tsx
      {stale ? (
        <Notice tone="warn">
          {last === null ? 'No backup yet.' : 'The last backup is more than a month old.'} Familiar Place keeps
          everything on this phone only.{' '}
          <button type="button" className="link-button" onClick={() => navigate('/setup/settings')}>
            Back up now
          </button>
        </Notice>
      ) : null}
```

and before `const items = …` add:

```tsx
  const last = data.setup.lastBackupAt;
  const MONTH = 30 * 24 * 60 * 60 * 1000;
  const stale = data.setup.mode === 'real' && (last === null || Date.now() - last > MONTH);
```

Add to `src/styles.css`:

```css
.link-button {
  min-height: 44px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
```

- [ ] **Step 9: Restore from Welcome and from the forgot dialog**

In `src/screens/start/Welcome.tsx`: import `Upload` and `RestoreDialog`; add `const [restoring, setRestoring] = useState(false);`; add inside the `Stack`, after the sample button:

```tsx
        <Button icon={Upload} onClick={() => setRestoring(true)}>
          Restore from a backup
        </Button>
```

and before `</Screen>`:

```tsx
      {restoring ? <RestoreDialog confirmReplace={false} onClose={() => setRestoring(false)} onRestored={() => restart()} /> : null}
```

In `src/App.tsx`, wrap the gate so it can offer a restore:

```tsx
function GateWithRestore() {
  const { restart } = useNav();
  const [restoring, setRestoring] = useState(false);
  return (
    <>
      <HelperGate
        extraForgotActions={(close) => (
          <Button
            onClick={() => {
              close();
              setRestoring(true);
            }}
          >
            Restore a backup
          </Button>
        )}
      />
      {restoring ? <RestoreDialog confirmReplace onClose={() => setRestoring(false)} onRestored={() => restart()} /> : null}
    </>
  );
}
```

Import `useState` from react, `Button` from `./components/ui`, `RestoreDialog` from `./components/RestoreDialog`; in `SetupScreens` render `<GateWithRestore />` instead of `<HelperGate />`.

- [ ] **Step 10: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "Back up and restore from Settings, Welcome and the forgot-PIN dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Remove the demo frame; sample banner; settings and copy cleanup

**Files:**
- Create: `src/components/SampleBanner.tsx`
- Modify: `src/App.tsx`, `src/styles.css`, `src/screens/setup/SetupSettings.tsx`, `src/screens/setup/SetupPrivacy.tsx`, `index.html`, `package.json`, `README.md`
- Test: `src/test/app.test.tsx`

**Interfaces:**
- Consumes: `eraseEverything`, `restart`, `navigate`; test helpers from Task 5.
- Produces: no new interfaces.

- [ ] **Step 1: Write the failing tests and drop demo-panel assertions** — in `src/test/app.test.tsx`:

Delete the `wrongPinsInARow` helper and every line that calls it, then make these replacements so the behaviour stays covered:

- In `'backspace, incomplete entries and opening help do not count'`, replace the final `expect(wrongPinsInARow()).toBe('0');` with:

```ts
    await user.click(screen.getByRole('button', { name: 'Try PIN again' }));
    for (let i = 0; i < 3; i++) await enterPin(user, '1111');
    expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
    await enterPin(user, '1111');
    expect(await screen.findByRole('heading', { name: 'Need a hand?' })).toBeInTheDocument();
```

- In `'accepts digits from a physical keyboard'`, replace `expect(wrongPinsInARow()).toBe('1');` with `expect(screen.getByRole('status')).toHaveTextContent("That PIN didn't match");`.
- Replace the body of `'a correct PIN resets the count and opens the daily companion'` with:

```ts
    const { user } = await renderApp();
    await enterPin(user, '1111');
    await enterPin(user, '2222');
    await enterPin(user, SAMPLE_PIN);
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Peggy/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    for (let i = 0; i < 3; i++) await enterPin(user, '1111');
    expect(screen.getByRole('heading', { name: 'Enter PIN' })).toBeInTheDocument();
```

- Delete the `musicStatus()` helper in the `background music` describe block and every `expect(musicStatus())…` line. Each one already sits next to an equivalent assertion on the top-right music button (`'Background music playing: …'`, `'… paused: …'`, `'… paused for now: …'`, or the button being absent while locked), so coverage stays.

Append:

```ts
describe('real-use presentation', () => {
  it('shows no presenter notes or demo phone frame', async () => {
    await renderFresh();
    expect(screen.queryByText('Working prototype')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo phone')).not.toBeInTheDocument();
  });

  it('marks the sample family on unlocked screens; Start setting up for real clears it', async () => {
    const { user, backend } = await renderApp();
    expect(screen.queryByText(/Nothing here is real/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Use sample PIN/ }));
    await screen.findByRole('heading', { name: /Good/ });
    expect(screen.getByText('Sample family. Nothing here is real.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start setting up for real' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove the sample family' }));
    expect(await screen.findByRole('heading', { name: 'Choose a helper PIN' })).toBeInTheDocument();
    expect(await backend.getAll('contacts')).toEqual([]);
  });

  it('Settings no longer offers demo calls or the demo profile', async () => {
    const { user } = await unlockToSetup();
    await user.click(screen.getByRole('button', { name: /Settings and reset/ }));
    expect(screen.queryByText(/Demo call \(recommended/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Restore the demo profile/ })).not.toBeInTheDocument();
  });

  it('Before unlock says when the lock is off', async () => {
    const { user } = await renderFresh();
    await quickSetup(user, { pin: null });
    await user.click(screen.getByRole('button', { name: 'Helper setup' }));
    await enterPin(user, HELPER_PIN);
    await user.click(await screen.findByRole('button', { name: /Before unlock/ }));
    expect(screen.getByText(/The lock is off, so nothing here is used right now/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to see failures**

Run: `npx vitest run src/test/app.test.tsx`
Expected: FAIL — "Working prototype" still present; no sample banner.

- [ ] **Step 3: SampleBanner** — `src/components/SampleBanner.tsx`

```tsx
import { useState } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../lib/store';
import { ConfirmDialog } from './Modal';

/** Shown on unlocked screens while the fictional sample family is loaded. */
export function SampleBanner() {
  const { eraseEverything } = useStore();
  const { restart, navigate } = useNav();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState(false);

  const startForReal = async () => {
    setAsking(false);
    try {
      await eraseEverything();
      restart();
      navigate('/start');
    } catch {
      setProblem(true);
    }
  };

  return (
    <div className="sample-banner" role="note">
      <span>Sample family. Nothing here is real.</span>
      <button type="button" className="link-button" onClick={() => setAsking(true)}>
        Start setting up for real
      </button>
      {problem ? <span role="alert">That didn't work. Please try again.</span> : null}
      {asking ? (
        <ConfirmDialog
          title="Start setting up for real?"
          body={<p>This removes the sample family and anything you changed while trying it. Then you'll set up Familiar Place for someone.</p>}
          confirmLabel="Remove the sample family"
          cancelLabel="Keep looking around"
          danger
          onCancel={() => setAsking(false)}
          onConfirm={() => void startForReal()}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: App shell** — in `src/App.tsx`:

- Delete `DemoNotes`, `StatusBar` and their imports that become unused (`useMusic`, `formatClock`, `useNow`, `AUTO_HELP_AFTER`, `SAMPLE_PIN`).
- Import `SampleBanner` from `./components/SampleBanner`.
- `Shell` becomes:

```tsx
function Shell() {
  const { ready, data } = useStore();
  const { route, session } = useNav();

  // (keep the two existing effects unchanged)

  return (
    <div className="stage">
      <div className="device">
        <div className="device-screen">
          {ready && data.setup.mode === 'sample' && session.unlocked ? <SampleBanner /> : null}
          <div className="device-content">{ready ? <Screens /> : <Loading />}</div>
          <div id="modal-root" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Styles** — in `src/styles.css`:

Replace everything from the comment `/* ---------- Stage and phone frame ---------- */` up to (not including) `/* ---------- Screen layout ---------- */` with:

```css
/* ---------- App frame ---------- */

.stage {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
}

.device {
  width: 100%;
  max-width: 480px;
  height: 100vh;
  height: 100dvh;
  background: var(--bg);
}

.device-screen {
  position: relative;
  height: 100%;
  overflow: hidden;
  /* clip also blocks programmatic scrolling of the frame itself. */
  overflow: clip;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}

.device-screen:has(.lock),
.device-screen:has(.demo-call),
.device-screen:has(.locked-status) {
  background: var(--lock-bg);
}

.device-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (min-width: 521px) {
  .device {
    box-shadow:
      0 0 0 1px var(--line),
      0 12px 40px rgba(30, 24, 16, 0.12);
  }
}

@media (max-width: 520px) {
  body {
    background: var(--bg);
  }
}

.sample-banner {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 12px;
  padding: 4px 16px;
  background: var(--help);
  color: var(--help-ink);
  font-size: 0.9375rem;
  font-weight: 700;
  text-align: center;
}
```

- [ ] **Step 6: Settings cleanup** — in `src/screens/setup/SetupSettings.tsx`:

- Delete the Calls card, the `chooseCallMode` function, the `'phone'` confirm dialog, the **Restore the demo profile** button and the `'reset'` confirm dialog. Remove `'phone' | 'reset'` from the `confirm` union and the now-unused imports (`Phone`, `RotateCcw`, `CallMode`, `startSample`).
- In the Erase everything dialog body, change "The locked help screen will show nothing personal until it is set up again." to "Familiar Place will go back to its Welcome screen."

- [ ] **Step 7: Before unlock notice** — in `src/screens/setup/SetupPrivacy.tsx`, directly after the `{problem ? … : null}` line add:

```tsx
      {!data.security.lockEnabled ? (
        <Notice icon={ShieldCheck}>The lock is off, so nothing here is used right now. Turn the PIN on in Settings to use it.</Notice>
      ) : null}
```

- [ ] **Step 8: Remaining demo wording** — run `grep -rn -i "demo" src --include=*.tsx --include=*.ts | grep -v test | grep -v "demo-"` and, for each user-facing string that is not about sample-mode demo calls, rewrite it. Expected leftovers that stay: `DemoCallView` / "Demo call · nobody is phoned" / "This is a demo. No real call is being made." (only reachable in sample mode, where `callMode` is `'demo'`), `DEMO_MEDIA` ids, and `demoAppData`. In `src/screens/locked/LockedViews.tsx` line 13 change the comment to "Limited views shown while Familiar Place is locked."

- [ ] **Step 9: Page metadata** — `index.html`: description content becomes `Familiar Place helps people living with dementia get their bearings and reach someone they trust.`. `package.json`: `"description": "Phone-first assistive app for people living with dementia: a four-button help screen behind an in-app lock, plus a daily companion."`, and `"version": "0.2.0"`.

- [ ] **Step 10: README** — replace `README.md` with:

````markdown
# Familiar Place

A phone-first app for people living with Alzheimer's or another dementia, set up together with someone they trust. If they can't get past Familiar Place's own lock, four clear choices — **Home, Family, You, Routine** — show only what they chose to share. After unlocking, a daily companion adds the full views, guided routines, memories, favourite music, and Helper setup.

> **Promise:** If you can't unlock, you still have a way to get your bearings and reach someone you trust.

The app makes no medical claims. It does not diagnose anything, treat in any clinical sense, or read meaning into wrong PINs.

## Run it

Requires Node 20.19+ (tested on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173.

| Command | What it does |
| --- | --- |
| `npm test` | Runs all tests (Vitest + Testing Library) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Type-checks, then builds to `dist/` with an offline service worker |
| `npm run preview` | Serves the production build (port 4173) |

## First run

A new install opens on **Welcome**:

- **Set up for someone** — six short steps: a 6-digit helper PIN, their name and photo, their 4-digit PIN (or no PIN), home, one trusted person, and what may show before unlock. Steps save as you go.
- **Look around with a sample family** — the fictional Peggy and family, clearly marked. Sample PIN `2580`. **Start setting up for real** removes it.
- **Restore from a backup** — for a new phone.

## How it works

**Lock** (`src/lib/session.ts`): with a PIN, Familiar Place opens at its keypad and locks again after 5 minutes in the background. Only a complete wrong PIN counts. The 4th wrong PIN in a row opens help, once per sequence. There is no lockout: help is always one tap away. Without a PIN, it opens straight to Today.

**Helper setup** is behind the helper PIN, which stays open for 10 minutes. Five wrong tries in a row mean a 30-second wait. A forgotten helper PIN can't be recovered: restore a backup or erase everything.

**Privacy by construction** (`src/lib/preview.ts`): locked screens receive only a `LockedPreview`, built by copying explicitly approved values. Every **Show before unlock** switch starts off. The router returns any private route to help while locked.

**Backups** (`src/lib/backup.ts`): one `.fpbackup` file holding everything, encrypted on the phone with AES-GCM using a key derived from the helper's password (PBKDF2-SHA256, 600,000 rounds). A forgotten password means the backup can't be opened.

**Accessibility**: Atkinson Hyperlegible font, rem sizing, large high-contrast targets, visible focus, keyboard support, focus moved to each screen's heading, labelled switches, alt text and transcripts, no automatic audio except optional background music, reduced-motion support.

## Data and storage

- Everything is stored locally in IndexedDB (`src/lib/db.ts`), including photos and recordings. No upload, analytics, location or automatic messaging.
- After setup the app asks the browser to keep its data. If the browser may still clear it, Settings says so: keep a recent backup.
- PINs are stored only as salted PBKDF2 hashes. Entered digits are never stored or logged.

## Honest limits

- **PIN hashes stop casual snooping only.** Anyone who can copy the app's storage can brute-force a 4- or 6-digit PIN in seconds. The phone's own lock is the real protection.
- **The lock is Familiar Place's own**, not the phone's lock screen. Hooking the system lock screen is not part of this release.
- **Backups are built in memory**, which is fine up to a few hundred MB.
- It should be tested with people living with memory difficulties and their care partners before any wide rollout.

## Sample content

All sample people, places and numbers are fictional. Phone numbers use the UK range reserved for drama (07700 900xxx). Illustrations in `public/demo/*.svg` were drawn for this project; voice clips were generated locally; the two songs are original music-box melodies.

## Project layout

```
src/
  lib/          session, router, preview, schedule, db, repo, store, seed, media, playback, pin, backup
  app/          navigation context and path helpers
  components/   buttons, tiles, photos, sound, switches, dialogs, form fields, PIN pad
  screens/      LockScreen, start/, locked/, companion/, setup/
  test/         unit and integration tests
public/demo/    sample illustrations, voice clips and songs
docs/           design specs and implementation plans
```
````

- [ ] **Step 11: Run all tests and typecheck**

Run: `npm test` then `npm run typecheck`
Expected: all pass.

- [ ] **Step 12: Commit**

```bash
git add src index.html package.json README.md
git commit -m "Remove the demo frame and wording; add the sample-family banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verify the build and the real flow

**Files:** none changed unless a check fails.

- [ ] **Step 1: Full checks**

Run: `npm test`, then `npm run typecheck`, then `npm run build`
Expected: all tests pass; no type errors; build writes `dist/` including `sw.js`.

- [ ] **Step 2: Manual run in the browser preview**

Start the `dev` preview (`.claude/launch.json`). In the preview, at phone width (375 × 812) and at desktop width:

1. Welcome shows three choices; no presenter notes or phone bezel.
2. Set up for someone: helper PIN, name, PIN, skip, skip, approvals with Preview, Finish → Today with "All set".
3. Lock → keypad → 4 wrong PINs → help → Try PIN again → right PIN → Today.
4. Helper setup → gate → right helper PIN → Settings → Save a backup (file downloads) → Last backup shows today.
5. Settings → Erase everything → Welcome → Restore from a backup with that file → keypad → PIN → Today.
6. Welcome → sample family → banner shows → Start setting up for real → wizard step 1.
7. Console has no errors.

- [ ] **Step 3: Fix anything found**, with a test where the failure was logic, then re-run Step 1 and commit:

```bash
git add -A
git commit -m "Fix issues found in manual verification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
