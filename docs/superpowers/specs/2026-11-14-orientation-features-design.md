# Today's note, "I need…" board, and help card — design

**Date:** 2026-11-14
**Status:** Decided by Claude at the user's request ("stop asking questions and just decide on your own"). The user chose these features from their list of ten: #1 + #3 (one feature), #2, and #6.

## Why these three

Each one serves the app's promise ("If you can't unlock, you still have a way to get your bearings and reach someone you trust"). All three work on the phone alone, with no server, and they build on pieces that already exist: the before-unlock switches, Read aloud, Today's "Next up", and calling.

## Global rules (unchanged, restated)

- Anything personal shown before unlock has its own switch, **off by default**. `buildLockedPreview` stays the only source for locked screens and never reads `security` or `setup`.
- Plain British English. Large touch targets. Every control has a label. Screens keep `data-screen-heading` on their `h1`.
- No new dependencies. Old saved data and old backups load with the new fields at their defaults.

## Feature A — Today's note ("Why am I here?" / "What changed?")

A short note the helper writes for today. It shows at the top of Today and ends at a time the helper picks.

- **Data:** `Schedule.note: { text: string; until: number } | null` (default `null`). `until` is in ms since the epoch.
- **Setup:** Helper setup → Routine gains a **"A note for today"** card:
  - a text box (hint: "For example: You're at the dentist. Maya is in the waiting room and will drive you home.")
  - **Show until**, a time picker. Empty means the end of today. A time earlier than now means that time tomorrow.
  - the switch **"Show before unlock"** → `approvals.note` (default off)
  - **Save note** and **Remove note** buttons
  - An ended note says "This note ended at 3:30 pm." and can be removed.
- **Shown:**
  - **Today:** a card above "Next up" (sticky-note icon, large text, Read aloud).
  - **Help screen (locked and unlocked):** the same card at the top, while it hasn't ended. On the locked screen it appears only when `approvals.note` is on.
  - The note disappears at `until`. The screens re-check the time with `useNow`.
- **Preview:** `LockedPreview.note: { text: string; until: number } | null`. It is set only when the switch is on and the text isn't blank. Locked screens hide it once it has ended.

## Feature B — "I need…" board

Large picture buttons for saying a need when words are hard to find. Nothing personal, so it needs no switch and works locked or unlocked.

- **Route:** `/needs` (new route name `needs`, allowed while locked). Back goes to help when locked, otherwise to wherever it was opened from (`from=help|today`).
- **Needs** (fixed list, in this order):

  | Label | Icon |
  |---|---|
  | I'm cold | Snowflake |
  | I'm too hot | Sun |
  | It's too loud | VolumeX |
  | I need the toilet | Toilet |
  | I'm thirsty | GlassWater |
  | I'm hungry | Utensils |
  | I'm tired | Bed |
  | I'm in pain | Bandage |
  | I feel worried | CloudRain |
  | Please help me | HandHelping |

  Custom needs are out of scope (YAGNI). The list can grow later.
- **Tapping a need** shows it full screen: the big icon plus the words in very large text, so it can be shown to someone. When Read aloud is on and speech is available, it's also spoken once. The buttons are **Say it again** (when speech is available) and **Back to the list**.
- **Opened from:** a full-width **"I need…"** button under the tiles on Today, on the unlocked help screen and on the locked help screen.

## Feature C — "Help me tell someone" card

A full-screen card to show a nearby person when the person is lost or stuck. The helper chooses what it shares.

- **Data:** `Approvals.helpCard: { message: string; name: boolean; contact: boolean; address: boolean }`, default `{ message: '', name: false, contact: false, address: false }`. It lives in `approvals` because every part of it is about what a stranger may see. Old data gets the default field by field, like `approvals.contact`.
- **Default message** (used when `message` is blank): "I'm having trouble finding my way. Could you please help me?"
- **Setup:** a new Helper setup section **"Help card"** (`/setup/card`, hub hint "What to show someone nearby"). It has:
  - the message box
  - three switches, all off by default:
    - **Their name**: "My name is Ada."
    - **Who to call**: "Please call Maya." plus a Call button
    - **Home address**: "I live at 14 Elm Street…"
  - a **Preview card** button
  - The person to call is the one chosen for before unlock in Family (`approvals.contact.id`), falling back to the primary contact, then the first contact.
- **Preview:** `LockedPreview.helpCard: { message: string; name: string | null; contact: { name: string; call: LockedCall | null } | null; address: string | null }`.
  - It's always present, and `message` falls back to the default.
  - The name, the contact and the address are included only when their switch is on and the value isn't blank.
  - The call follows the existing rule: phone mode passes the number, and the sample family's demo mode doesn't.
- **Route:** `/card` (new route name `card`, allowed while locked). The card is built from the preview on **both** locked and unlocked screens, so a stranger sees the same thing either way.
- **Screen:** high contrast and large text, with Read aloud of the whole card and a **Close** button. Call uses `PhoneCallButton`, which shows the number to dial if the device can't call.
- **Opened from:** a prominent **"Show someone a message"** button under the tiles on the locked and unlocked help screens.
- **Before unlock (the review page):** lists what the help card shares, with "Stop showing" for each switched-on item.

## Sample family

The sample family gets `helpCard: { message: '', name: true, contact: true, address: false }`, so the card has something to show. There's no sample note, because it would be dated to the day of seeding.

## Errors

- A save fails: the existing "couldn't be saved" notice shows.
- No speech: the board and the card show the words only.
- A note with blank text: Save stays disabled.

## Testing

- **Preview unit tests:**
  - The note appears only when approved and non-blank.
  - The card's parts appear only when switched on.
  - The default message is used when the box is blank.
  - The contact is picked as described above.
  - The address appears only with its switch.
- **Repo:** old data without `schedule.note` or `approvals.helpCard` loads the defaults.
- **App:**
  - A note written in setup shows on Today and, once approved, on the locked help screen. It disappears at its time (fake clock).
  - The "I need…" board opens from Today and from the locked help screen, and a tapped need shows full screen.
  - The help card shows only the default message until switches are turned on, works locked, and its Call link dials the chosen contact.
