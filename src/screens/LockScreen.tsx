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
