# Familiar Place

A phone-first prototype for people living with Alzheimer's or another dementia. If someone can't unlock their phone, a simulated lock screen offers four clear choices — **Home, Family, You, Routine** — showing only what they chose to share. After unlocking, a daily companion adds the full views, guided routines, memories, favourite music, and setup with a trusted person.

> **Promise:** If your phone is locked, you still have a way to get your bearings and reach someone you trust.

The app makes no medical claims. It does not diagnose anything, treat in any clinical sense, or read meaning into wrong PINs.

## Run it

Requires Node 20.19+ (tested on Node 24).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. On a wide screen the phone sits in a frame next to a panel of presenter notes (lock state, wrong-PIN count, demo steps). On a phone it fills the screen.

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Runs all tests (Vitest + Testing Library) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Type-checks, then builds to `dist/` with an offline service worker |
| `npm run preview` | Serves the production build (port 4173) |

**Demo PIN: `2580`.** The lock screen also has a **Use demo PIN** button. It never asks for a real passcode.

## One-minute judging demo

1. Type a wrong PIN four times (e.g. `1111`). Help opens on its own after the fourth.
2. Tap **Family**: Maya's photo appears. Tap **Call Maya**. It's a clearly labelled demo call, and nobody is phoned.
3. Open **Routine** to see and hear (**Read aloud**) the approved cue. Open **Home** to see the familiar door photo.
4. Tap **Try PIN again**, then unlock with the demo PIN. Open **Home**: the full address shows only now.
5. Open **Routine → Get ready to go out** and step through it.

Refreshing the page always returns to the keypad with a fresh count.

## What's in it

**Lock-screen trigger** (`src/lib/session.ts`): only a complete wrong PIN counts. Backspace, partial entries, and opening help don't. The 4th consecutive wrong PIN opens help, once per sequence. A 5th or later wrong PIN leaves the keypad up. A correct PIN, or locking again, starts a fresh sequence. Entered digits are never stored or logged.

**Locked help** (`src/screens/locked/LockedViews.tsx`): the four tiles keep the same positions and labels as the unlocked app. Each detail screen has **Back to help** and one prominent action. Missing or private content is explained in plain words, with a way back (or to Family when a contact is shared).

**Privacy by construction** (`src/lib/preview.ts`): locked screens receive only a `LockedPreview`, built by copying explicitly approved values. Full records never reach them. Media loads only if its id is on the preview's allowlist. The phone number is copied only if the helper switched calls to the real dialer *and* approved the Call button. The router (`src/lib/router.ts`) returns any private route to the help screen while locked, and the screen switcher refuses to render one anyway.

**Daily companion**: Today (date, time, Next up), full Home (address, landmarks, open in maps after a confirmation), **Where things are** (a kitchen photo with tappable highlights), Family (numbers, demo calls), You, Routine (today's plan, step-by-step routines that save progress and offer to resume), **Memories** (one photo at a time, Play / Previous / Next, no quizzes, removable), and **Music** (below).

**Family voices** (`src/screens/setup/SetupFamily.tsx`, `src/screens/companion/YouView.tsx`): every family member can record a voice message (or choose an audio file) that reminds the person who they are. For example: “Hi Mum, it’s Maya, your daughter. You’re Peggy, and you’re at home with Biscuit.” Messages are recorded on each person's page in Helper setup → Family. They play from a **Voices from your family** section on You, and from that person in Family, only when tapped, with the words shown as a text alternative. The one person shown before unlock can also have their message on the locked Family and You screens, behind its own **Show voice message before unlock** switch, which starts off like every other switch.

**Favourite music** (`src/screens/companion/MusicView.tsx`, `src/screens/setup/SetupMusic.tsx`): songs the person loves, each with who sings it, the memory it brings back, an optional photo, and the music itself. The music can be a song file the family owns or a recording of someone singing (up to 15 MB or 5 minutes). Nothing plays until tapped, only one sound plays at a time, and each song has a written description as a text alternative. Music is shown only after unlock. It also appears on Today and on the You screen.

**Helper setup** (`src/screens/setup/`): edit every tile, contacts, routines, memories and music. Each eligible field has its own **Show before unlock** switch, and every new one starts off. Only one contact can be shown before unlock. Forms are drafts, with **Preview locked view** (the real locked components fed the draft) before **Save changes**. The **Before unlock** page lists everything shown, each with a **Stop showing** button that takes effect at once. **Settings** has text size, Read aloud on/off, call mode (demo by default), **Restore the demo profile**, and **Erase everything** (an empty locked preview).

**Accessibility**: Atkinson Hyperlegible font, rem sizing (in-app text size plus the browser's own setting), large high-contrast targets, visible focus rings, keyboard support (the keypad takes number keys), focus moved to each screen's heading, labelled switches that say On/Off, alt text and transcripts, no automatic audio, reduced-motion support. Read aloud is feature-detected and hidden when the browser can't speak.

## Data and storage

- Everything is stored locally in IndexedDB (`src/lib/db.ts`), including photo and audio blobs. There is no upload, analytics, location, or automatic messaging. If IndexedDB is blocked, the app keeps working in memory for that visit and says so.
- The demo session (lock state, wrong-PIN count) lives only in memory, separate from the profile.
- Chosen photos are shrunk to at most 1280 px. Unused media is cleaned up after saves.
- Database version 2 added the songs store; upgrading keeps existing data. Contacts saved before voice messages existed simply have no message yet.
- The production build registers a service worker that precaches the app and sample media, so it works offline after the first load.

The demo profile ships **as if a trusted helper had already completed setup**, so a few fields are approved for the locked view (Maya's card and voice message, the door photo and cue, the lunch cue, Peggy's name and photo). Anything added later starts with its switch off, and **Erase everything** returns to an empty locked preview.

## Sample content

All people, places and numbers are fictional. Phone numbers use the UK range reserved for drama (07700 900xxx).

- Illustrations in `public/demo/*.svg` were drawn for this project.
- Voice clips, including Maya's and Sam's messages, were generated locally with the Windows speech engine.
- The two songs (`song-waltz.wav`, `song-lullaby.wav`) are original music-box melodies synthesised for this demo.

## Not real security, not a real lock screen

The keypad is a simulation in a browser. A pretend PIN protects nothing, and browser storage is not device-protected. Before handling real personal data, a production app would need:

- device authentication (passcode / biometrics) for setup and visibility changes
- device-protected storage, with separate public and private payloads
- validation on real devices. iOS offers no public callback for failed system-lock attempts. Android's `DeviceAdminReceiver` failed-password event needs testing for counts, showing UI over the keyguard, and background-launch limits on specific OS versions (see section 6 of the spec).

It should also be tested with people living with memory difficulties and their care partners before any real rollout.

## Project layout

```
src/
  lib/          session, router, preview, schedule, db, repo, store, seed, media, playback
  app/          navigation context and path helpers
  components/   buttons, tiles, photos, sound, switches, dialogs, form fields
  screens/      LockScreen, locked/, companion/, setup/
  test/         unit and integration tests
public/demo/    sample illustrations, voice clips and songs
sw-template.js  service worker template (precache list injected at build)
```
