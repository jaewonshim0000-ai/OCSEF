import { useState } from 'react';
import { Database, Phone, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { speechAvailable } from '../../lib/playback';
import { useStore } from '../../lib/store';
import type { CallMode, Prefs, TextSize } from '../../lib/types';
import { SetupPage } from './common';

const SIZES: Array<{ id: TextSize; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

export function SetupSettings() {
  const { data, save, persistent, resetToDemo, eraseEverything } = useStore();
  const [confirm, setConfirm] = useState<null | 'phone' | 'reset' | 'erase'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const prefs = data.prefs;

  const setPrefs = async (patch: Partial<Prefs>) => {
    try {
      await save({ prefs: { ...prefs, ...patch } });
      setMessage(null);
    } catch {
      setMessage("That setting couldn't be saved. Please try again.");
    }
  };

  const chooseCallMode = (mode: CallMode) => {
    if (mode === prefs.callMode) return;
    if (mode === 'phone') setConfirm('phone');
    else setPrefs({ callMode: 'demo' });
  };

  return (
    <SetupPage title="Settings and reset" sub="These settings save straight away.">
      {message ? <Notice tone="warn">{message}</Notice> : null}

      <Card>
        <h2 className="card-title" id="text-size-label">
          Text size
        </h2>
        <div className="segmented" role="radiogroup" aria-labelledby="text-size-label">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={prefs.textSize === s.id}
              className="segment"
              onClick={() => setPrefs({ textSize: s.id })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="field-hint">The phone’s own larger-text setting also works.</p>
      </Card>

      <Card>
        <Switch
          label="Show Read aloud buttons"
          description={
            speechAvailable()
              ? 'Words are only spoken when someone taps Read aloud.'
              : 'This browser cannot read aloud, so the buttons are hidden either way.'
          }
          checked={prefs.readAloud}
          onChange={(v) => setPrefs({ readAloud: v })}
        />
      </Card>

      <Card>
        <h2 className="card-title" id="call-mode-label">
          <Phone size={24} strokeWidth={2.5} aria-hidden /> Calls
        </h2>
        <div className="radio-cards" role="radiogroup" aria-labelledby="call-mode-label">
          <button type="button" role="radio" aria-checked={prefs.callMode === 'demo'} className="radio-card" onClick={() => chooseCallMode('demo')}>
            <span className="radio-card-title">Demo call (recommended for the demo)</span>
            <span className="radio-card-desc">Shows who would be called. Nobody is phoned.</span>
          </button>
          <button type="button" role="radio" aria-checked={prefs.callMode === 'phone'} className="radio-card" onClick={() => chooseCallMode('phone')}>
            <span className="radio-card-title">Use the phone’s dialer</span>
            <span className="radio-card-desc">Opens the phone’s own calling app with the number.</span>
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="card-title">
          <Database size={24} strokeWidth={2.5} aria-hidden /> Your information
        </h2>
        <p>
          {persistent
            ? 'Everything is kept on this device only. Nothing is uploaded, and nothing is sent automatically.'
            : 'This browser is not letting the app save. Changes last until the page is closed. Nothing is uploaded.'}
        </p>
        <Button icon={RotateCcw} onClick={() => setConfirm('reset')}>
          Restore the demo profile
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirm('erase')}>
          Erase everything
        </Button>
      </Card>

      {confirm === 'phone' ? (
        <ConfirmDialog
          title="Use the phone’s dialer?"
          body={
            <>
              <p>Call buttons will open the phone’s calling app with the number, and a real call can be made.</p>
              <p>
                If a call button is shown before unlock, the phone’s dialer may show that person’s number on the lock
                screen.
              </p>
            </>
          }
          confirmLabel="Use the dialer"
          cancelLabel="Keep demo calls"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            setPrefs({ callMode: 'phone' });
          }}
        />
      ) : null}
      {confirm === 'reset' ? (
        <ConfirmDialog
          title="Restore the demo profile?"
          body={<p>This deletes every change, photo and recording saved on this device, and puts back the fictional demo profile.</p>}
          confirmLabel="Delete changes and restore"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await resetToDemo();
              setMessage(null);
            } catch {
              setMessage("The reset didn't finish. Please try again.");
            }
          }}
        />
      ) : null}
      {confirm === 'erase' ? (
        <ConfirmDialog
          title="Erase everything?"
          body={
            <p>
              This deletes everything saved on this device, including photos and recordings. The locked help screen will
              show nothing personal until it is set up again. This can't be undone.
            </p>
          }
          confirmLabel="Erase everything"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await eraseEverything();
              setMessage(null);
            } catch {
              setMessage("Erasing didn't finish. Please try again.");
            }
          }}
        />
      ) : null}
    </SetupPage>
  );
}
