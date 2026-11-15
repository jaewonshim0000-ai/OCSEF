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
| `npm run dev:phone` | Serves the app over https on your home network, so a phone can open it (port 5174) |

### Try it on a phone

Calling, recording and the camera need a real phone, and phones only allow the microphone and PIN encryption on an https address. Some desktop preview panes block the microphone too, so a computer won't show everything.

1. Create a local certificate once (in Git Bash; it stays in `.cert/`, which git ignores):

   ```bash
   mkdir -p .cert && MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -keyout .cert/key.pem -out .cert/cert.pem -days 365 -subj "/CN=Familiar Place dev"
   ```

2. Start the phone server:

   ```bash
   npm run dev:phone
   ```

3. With the phone on the same Wi-Fi, open the `https://192.168.…:5174` address it prints. The certificate is self-signed, so the phone warns once: choose **Advanced → Proceed**. If the phone can't connect, Windows Firewall may be blocking Node; allow it on private networks.

Data on the phone is separate from the computer's. Set up again there, or restore a backup.

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
