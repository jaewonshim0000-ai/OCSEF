import { useEffect, useRef, useState } from 'react';
import { Delete, KeyRound, LifeBuoy } from 'lucide-react';
import { useNav } from '../app/nav';
import { formatClock, formatDate } from '../lib/schedule';
import { DEMO_PIN, PIN_LENGTH } from '../lib/session';
import { useNow } from '../lib/useNow';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const WRONG = "That PIN didn't match. Try again, or tap Get help.";
const INCOMPLETE = `Enter all ${PIN_LENGTH} numbers.`;

/**
 * The simulated phone lock screen. It is clearly labelled as a demo, never
 * asks for a real passcode, and never stores or logs the digits typed.
 */
export function LockScreen() {
  const { submitPin, navigate } = useNav();
  const now = useNow();
  const entryRef = useRef('');
  const [length, setLength] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [shake, setShake] = useState(0);
  const toggle = useRef(false);

  const say = (text: string) => {
    // Alternate an invisible character so a repeated prompt is announced again.
    toggle.current = !toggle.current;
    setPrompt(text + (toggle.current ? '​' : ''));
  };

  const setEntry = (value: string) => {
    entryRef.current = value;
    setLength(value.length);
  };

  const submit = (value: string) => {
    setEntry('');
    const outcome = submitPin(value);
    if (outcome === 'invalid') {
      say(WRONG);
      setShake((n) => n + 1);
    }
  };

  const press = (digit: string) => {
    if (entryRef.current.length >= PIN_LENGTH) return;
    const next = entryRef.current + digit;
    if (next.length === PIN_LENGTH) {
      submit(next);
    } else {
      setEntry(next);
    }
  };

  const erase = () => setEntry(entryRef.current.slice(0, -1));

  const enterPressed = () => {
    // Only a complete entry is submitted; a partial one is never counted.
    if (entryRef.current.length < PIN_LENGTH) say(INCOMPLETE);
  };

  const handlers = useRef({ press, erase, enterPressed });
  handlers.current = { press, erase, enterPressed };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [role="dialog"]') || target.isContentEditable)) return;
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

  return (
    <div className="screen lock">
      <main className="screen-scroll">
        <div className="lock-body">
          <div className="lock-banner" role="note">
            <strong>Demo phone lock screen</strong>
            <span>A pretend lock screen for this demo. Never type your real passcode here.</span>
          </div>

          <div className="lock-clock" aria-label={`It is ${formatClock(now)} on ${formatDate(now)}`}>
            <span className="lock-time">{formatClock(now)}</span>
            <span className="lock-date">{formatDate(now)}</span>
          </div>

          <h1 className="lock-title" tabIndex={-1} data-screen-heading>
            Enter PIN
          </h1>

          <div
            key={shake}
            className={`pin-dots${shake ? ' is-shaking' : ''}`}
            role="img"
            aria-label={`${length} of ${PIN_LENGTH} numbers entered`}
          >
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span key={i} className={`pin-dot${i < length ? ' is-filled' : ''}`} />
            ))}
          </div>

          <p className="pin-prompt" role="status" aria-live="polite">
            {prompt}
          </p>

          <div className="keypad" role="group" aria-label="Number keypad">
            {KEYS.map((k) => (
              <button key={k} type="button" className="key" onClick={() => press(k)}>
                {k}
              </button>
            ))}
            <span className="key key-spacer" aria-hidden />
            <button type="button" className="key" onClick={() => press('0')}>
              0
            </button>
            <button type="button" className="key key-delete" onClick={erase} aria-label="Delete last number" disabled={length === 0}>
              <Delete size={30} strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          <button type="button" className="btn btn-help btn-xl btn-block" onClick={() => navigate('/help')}>
            <LifeBuoy size={30} strokeWidth={2.5} aria-hidden />
            <span>Get help</span>
          </button>

          <button type="button" className="lock-demo-pin" onClick={() => submit(DEMO_PIN)}>
            <KeyRound size={20} strokeWidth={2.5} aria-hidden />
            <span>
              Use demo PIN <span className="lock-demo-digits">({DEMO_PIN.split('').join(' ')})</span>
            </span>
          </button>
        </div>
      </main>
    </div>
  );
}
