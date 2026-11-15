/**
 * The simulated lock-screen session.
 *
 * This state is held in memory only. Refreshing the page creates a fresh
 * session, which returns to the keypad with zero failures. Entered digits are
 * never stored here or logged anywhere.
 */

export const DEMO_PIN = '2580';
export const PIN_LENGTH = 4;
/** The consecutive invalid submission that opens Get help automatically. */
export const AUTO_HELP_AFTER = 4;

export interface DemoSession {
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

export function initialSession(): DemoSession {
  return { view: '/lock', consecutiveInvalid: 0, autoHelpShown: false, unlocked: false };
}

export function isCompleteEntry(entry: string): boolean {
  return entry.length === PIN_LENGTH && /^\d+$/.test(entry);
}

export function submitPin(
  session: DemoSession,
  entry: string,
  pin: string = DEMO_PIN,
): { session: DemoSession; outcome: PinOutcome } {
  if (!isCompleteEntry(entry)) {
    return { session, outcome: 'incomplete' };
  }
  if (entry === pin) {
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
export function relock(): DemoSession {
  return initialSession();
}
