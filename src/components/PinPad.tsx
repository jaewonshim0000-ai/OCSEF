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
