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
