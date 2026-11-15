import { useRef, useState } from 'react';
import { PinUnavailableError } from '../lib/pin';
import { PinPad, type PinResult } from './PinPad';

export const PIN_UNAVAILABLE =
  "This browser can't keep a PIN safely. Open Familiar Place from its installed app or an https address.";

/** Choose a PIN by entering it twice. The first entry is held in memory only until the second. */
export function ChoosePin({
  length,
  onChosen,
  tone = 'light',
}: {
  length: number;
  onChosen: (pin: string) => Promise<void>;
  tone?: 'light' | 'dark';
}) {
  const first = useRef<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const submit = async (entry: string): Promise<PinResult | void> => {
    if (first.current === null) {
      first.current = entry;
      setConfirming(true);
      return;
    }
    const match = first.current === entry;
    first.current = null;
    setConfirming(false);
    if (!match) return { message: "Those didn't match. Try again.", shake: true };
    try {
      await onChosen(entry);
    } catch (e) {
      return { message: e instanceof PinUnavailableError ? PIN_UNAVAILABLE : "That PIN couldn't be saved. Please try again." };
    }
  };

  return (
    <div className="choose-pin">
      <p className="choose-pin-step">{confirming ? 'Enter the same numbers again.' : `Enter ${length} numbers.`}</p>
      <PinPad length={length} onSubmit={submit} tone={tone} />
    </div>
  );
}
