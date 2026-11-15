# Today's Note, "I need…" Board, Help Card — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add three orientation features: a timed note for today, a picture board for saying needs, and a card to show someone nearby.

**Architecture:** Two new data fields (`schedule.note`, `approvals.helpCard`) feed `buildLockedPreview`. There are two new routes allowed while locked (`/needs`, `/card`), one new setup section (`card`), and small additions to Today, the help screens, Routine setup and the Before unlock review page.

**Tech Stack:** React 18, TypeScript 5.9, Vitest 4 + Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-14-orientation-features-design.md`

## Global Constraints

- Every personal field shown before unlock has a switch that is off by default. Locked screens read only `LockedPreview`.
- No new dependencies. British English copy. Touch targets of at least 44 px. Every control has a label, and each screen's `h1` keeps `data-screen-heading`.
- Old data and old backups load with defaults: `schedule.note = null`, `approvals.helpCard = { message: '', name: false, contact: false, address: false }`.
- Every task ends with `npm test` and `npm run typecheck` passing, then a commit ending `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **An ended note:** it must disappear from Today and from both help screens without a reload.
2. **A note whose time has already passed today:** it means that time tomorrow, so it is not born ended.
3. **Help card with every switch off:** only the default message shows, with no name, number or address, both locked and unlocked.
4. **Help card "Who to call" when that contact is deleted or has no number:** no Call button and no crash.
5. **Typed routes while locked (`#/needs`, `#/card`, `#/setup/card`):** `/needs` and `/card` work, and `/setup/card` goes to help.

---

### Task 1: Data and preview

**Files:** `src/lib/types.ts`, `src/lib/defaults.ts`, `src/lib/repo.ts` (normalise `approvals.helpCard`), `src/lib/preview.ts`, `src/lib/seed.ts`. Tests: `src/test/preview.test.ts`, `src/test/repo.test.ts`.

**Interfaces produced:**
- `Schedule.note: TodayNote | null`, where `TodayNote = { text: string; until: number }`
- `Approvals.note: boolean`
- `Approvals.helpCard: HelpCardSettings`, where `HelpCardSettings = { message: string; name: boolean; contact: boolean; address: boolean }`
- `DEFAULT_HELP_MESSAGE`, in `preview.ts`
- `LockedPreview.note: TodayNote | null`
- `LockedPreview.helpCard: LockedHelpCard`, where `LockedHelpCard = { message: string; name: string | null; contact: { name: string; call: LockedCall | null } | null; address: string | null }`
- `helpCardContact(data): Contact | undefined`: the before-unlock contact, else the primary one, else the first one

**Tests first:**
- Note: off → `null`; on with blank text → `null`; on → `{text, until}`.
- Card:
  - All off → `{ message: DEFAULT_HELP_MESSAGE, name: null, contact: null, address: null }`.
  - Custom message is used, after trimming.
  - `name` comes from `profile.preferredName` when its switch is on.
  - `address` comes from `home.address` when its switch is on.
  - `contact` is the approved contact, falling back to the primary one. Its call follows `callMode`, and there's no call without a number.
- Repo: data saved without the new fields loads the defaults.

### Task 2: Today's note

**Files:** `src/screens/setup/SetupRoutine.tsx`, `src/screens/companion/Today.tsx`, `src/screens/locked/LockedViews.tsx` (help screen), `src/App.tsx` (`HelpUnlocked`), a new `src/components/TodayNote.tsx`, `src/styles.css`. Test: `src/test/app.test.tsx`.

**Interfaces:**
- `TodayNoteCard({ note }: { note: TodayNote | null })` renders nothing when the note is `null` or has ended, using `useNow()`.
- `noteUntil(time: string, now: Date): number`: an empty `time` means the end of today, and a time that has already passed means tomorrow. Exported from `src/lib/schedule.ts` and unit-tested.

**Tests first:**
- `noteUntil`: empty → 23:59:59.999 today; a later time → today; an earlier time → tomorrow.
- App:
  1. Write a note in Routine setup, Save, then go to Today. The note shows.
  2. Lock. The help screen has no note.
  3. Unlock, turn on "Show before unlock", lock again. The help screen shows the note.
  4. Move the fake clock past the time. The note is gone.

### Task 3: "I need…" board

**Files:** `src/lib/router.ts` (`needs` route, allowed while locked), a new `src/screens/NeedsBoard.tsx`, `src/App.tsx` (route case, unlocked help button), `src/screens/companion/Today.tsx`, `src/screens/locked/LockedViews.tsx`, `src/styles.css`. Tests: `src/test/router.test.ts`, `src/test/app.test.tsx`.

**Tests first:**
- Router: `/needs` parses, and while locked it isn't redirected.
- App:
  - From Today: "I need…" → "I'm cold" → the full-screen message has heading "I'm cold" → Back to the list.
  - Locked: Get help → "I need…" works without unlocking. Its back button returns to help.

### Task 4: Help card

**Files:** `src/lib/router.ts` (`card` route allowed while locked, and the `card` setup section), a new `src/screens/HelpCard.tsx`, a new `src/screens/setup/SetupCard.tsx`, `src/screens/setup/SetupHub.tsx`, `src/screens/setup/SetupPrivacy.tsx` (review items), `src/App.tsx`, `src/screens/locked/LockedViews.tsx`, `src/styles.css`. Tests: `src/test/router.test.ts`, `src/test/app.test.tsx`.

**Tests first:**
- Router: `/card` is allowed while locked, and `/setup/card` parses as setup section `card`.
- App:
  1. Real profile, locked. Get help → "Show someone a message" shows only the default message, with no name and no Call link.
  2. Unlock. Helper setup → Help card: turn on Their name and Who to call, and write a message. Lock.
  3. The card shows the message, "My name is Ada.", and a Call link with `tel:` to the trusted person.
  4. Before unlock lists the card items.
