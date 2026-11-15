import { describe, expect, it } from 'vitest';
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

const WRONG = '1111';

function submitMany(start: LockSession, entries: string[]) {
  let session = start;
  const outcomes: string[] = [];
  for (const e of entries) {
    const r = submitPin(session, e, matches(e));
    session = r.session;
    outcomes.push(r.outcome);
  }
  return { session, outcomes };
}

describe('lock session', () => {
  it('starts on the keypad with zero consecutive failures', () => {
    const s = initialSession();
    expect(s).toEqual({ view: '/lock', consecutiveInvalid: 0, autoHelpShown: false, unlocked: false });
  });

  it('does not count incomplete entries', () => {
    const s = initialSession();
    for (const entry of ['', '1', '12', '123']) {
      const r = submitPin(s, entry, matches(entry));
      expect(r.outcome).toBe('incomplete');
      expect(r.session).toBe(s);
    }
  });

  it('does not count non-digit or over-long entries', () => {
    const s = initialSession();
    expect(submitPin(s, '12a4', matches('12a4')).outcome).toBe('incomplete');
    expect(submitPin(s, '12345', matches('12345')).outcome).toBe('incomplete');
  });

  it('counts each complete wrong PIN once', () => {
    const r = submitPin(initialSession(), WRONG, matches(WRONG));
    expect(r.outcome).toBe('invalid');
    expect(r.session.consecutiveInvalid).toBe(1);
  });

  it('three wrong PINs do not open help', () => {
    const { session, outcomes } = submitMany(initialSession(), [WRONG, WRONG, WRONG]);
    expect(outcomes).toEqual(['invalid', 'invalid', 'invalid']);
    expect(session.autoHelpShown).toBe(false);
    expect(session.view).toBe('/lock');
  });

  it('the fourth consecutive wrong PIN opens help', () => {
    expect(AUTO_HELP_AFTER).toBe(4);
    const { session, outcomes } = submitMany(initialSession(), [WRONG, WRONG, WRONG, WRONG]);
    expect(outcomes[3]).toBe('invalid-open-help');
    expect(session.consecutiveInvalid).toBe(4);
    expect(session.autoHelpShown).toBe(true);
    expect(session.view).toBe('/help');
  });

  it('opens help automatically only once per failed-attempt sequence', () => {
    const { session, outcomes } = submitMany(initialSession(), Array(7).fill(WRONG));
    expect(outcomes.filter((o) => o === 'invalid-open-help')).toHaveLength(1);
    expect(outcomes.slice(4)).toEqual(['invalid', 'invalid', 'invalid']);
    expect(session.consecutiveInvalid).toBe(7);
  });

  it('a correct PIN resets the count and unlocks', () => {
    const { session } = submitMany(initialSession(), [WRONG, WRONG, WRONG, WRONG, WRONG]);
    const r = submitPin(session, RIGHT, matches(RIGHT));
    expect(r.outcome).toBe('unlocked');
    expect(r.session).toEqual({ view: '/today', consecutiveInvalid: 0, autoHelpShown: false, unlocked: true });
  });

  it('a correct PIN between failures starts a new sequence', () => {
    const first = submitMany(initialSession(), [WRONG, WRONG, WRONG]).session;
    const unlocked = submitPin(first, RIGHT, matches(RIGHT)).session;
    const relocked = relock();
    expect(unlocked.consecutiveInvalid).toBe(0);
    const again = submitMany(relocked, [WRONG, WRONG, WRONG]);
    expect(again.outcomes).toEqual(['invalid', 'invalid', 'invalid']);
  });

  it('explicitly relocking starts a fresh sequence', () => {
    expect(relock()).toEqual(initialSession());
  });
});

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
