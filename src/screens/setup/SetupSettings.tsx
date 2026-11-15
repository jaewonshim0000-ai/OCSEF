import { useEffect, useState } from 'react';
import { Archive, Database, Download, KeyRound, Lock, Phone, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ChoosePin } from '../../components/ChoosePin';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { RestoreDialog } from '../../components/RestoreDialog';
import { Switch } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { isStoragePersisted } from '../../lib/db';
import { hashPin } from '../../lib/pin';
import { speechAvailable } from '../../lib/playback';
import { formatDate } from '../../lib/schedule';
import { HELPER_PIN_LENGTH, PIN_LENGTH } from '../../lib/session';
import { useStore } from '../../lib/store';
import type { CallMode, Prefs, Security, TextSize } from '../../lib/types';
import { SetupPage } from './common';
import { SaveBackupDialog } from './SaveBackupDialog';

const SIZES: Array<{ id: TextSize; label: string }> = [
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Large' },
  { id: 'xlarge', label: 'Extra large' },
];

export function SetupSettings() {
  const { data, save, persistent, startSample, eraseEverything } = useStore();
  const { restart } = useNav();
  const [confirm, setConfirm] = useState<null | 'phone' | 'reset' | 'erase' | 'lock-off'>(null);
  const [message, setMessage] = useState<string | null>(null);
  const prefs = data.prefs;
  const sample = data.setup.mode === 'sample';
  const security = data.security;
  const [pinDialog, setPinDialog] = useState<null | 'person' | 'helper'>(null);
  const [done, setDone] = useState<string | null>(null);

  const [backupDialog, setBackupDialog] = useState<null | 'save' | 'restore'>(null);
  const [kept, setKept] = useState(true);
  useEffect(() => {
    isStoragePersisted().then(setKept);
  }, []);
  const last = data.setup.lastBackupAt;

  const saveSecurity = (patch: Partial<Security>) => save({ security: { ...security, ...patch } });

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

      {done ? (
        <div role="status">
          <Notice tone="ok">{done}</Notice>
        </div>
      ) : null}

      <Card>
        <h2 className="card-title">
          <Lock size={24} strokeWidth={2.5} aria-hidden /> Lock
        </h2>
        {sample ? (
          <p>PIN settings appear once Familiar Place is set up for real.</p>
        ) : (
          <>
            <Switch
              label="Ask for a PIN to open Familiar Place"
              description={
                security.lockEnabled
                  ? 'Familiar Place opens at the keypad, and locks again after 5 minutes in the background.'
                  : 'Familiar Place opens straight to Today.'
              }
              checked={security.lockEnabled}
              onChange={(on) => (on ? setPinDialog('person') : setConfirm('lock-off'))}
            />
            {security.lockEnabled ? (
              <Button size="md" icon={KeyRound} onClick={() => setPinDialog('person')}>
                Change their PIN
              </Button>
            ) : null}
          </>
        )}
      </Card>

      {!sample ? (
        <Card>
          <h2 className="card-title">
            <KeyRound size={24} strokeWidth={2.5} aria-hidden /> Helper PIN
          </h2>
          <p>Needed to open Helper setup.</p>
          <Button size="md" icon={KeyRound} onClick={() => setPinDialog('helper')}>
            Change helper PIN
          </Button>
        </Card>
      ) : null}

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

      {!sample ? (
        <Card>
          <h2 className="card-title">
            <Archive size={24} strokeWidth={2.5} aria-hidden /> Back up and restore
          </h2>
          <p>Last backup: {last ? formatDate(new Date(last)) : 'never'}</p>
          <Button icon={Download} onClick={() => setBackupDialog('save')}>
            Save a backup
          </Button>
          <Button icon={Upload} onClick={() => setBackupDialog('restore')}>
            Restore a backup
          </Button>
        </Card>
      ) : null}

      <Card>
        <h2 className="card-title">
          <Database size={24} strokeWidth={2.5} aria-hidden /> Your information
        </h2>
        <p>
          {persistent
            ? 'Everything is kept on this device only. Nothing is uploaded, and nothing is sent automatically.'
            : 'This browser is not letting the app save. Changes last until the page is closed. Nothing is uploaded.'}
        </p>
        {persistent && !kept ? (
          <p>This browser may clear Familiar Place's data if the phone runs low on space. Keep a recent backup.</p>
        ) : null}
        <Button icon={RotateCcw} onClick={() => setConfirm('reset')}>
          Restore the demo profile
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => setConfirm('erase')}>
          Erase everything
        </Button>
      </Card>

      {backupDialog === 'save' ? (
        <SaveBackupDialog
          onClose={() => setBackupDialog(null)}
          onSaved={() => {
            setBackupDialog(null);
            setDone('Backup saved. Keep the file and its password somewhere safe.');
          }}
        />
      ) : null}
      {backupDialog === 'restore' ? (
        <RestoreDialog confirmReplace onClose={() => setBackupDialog(null)} onRestored={() => restart()} />
      ) : null}
      {pinDialog ? (
        <Modal title={pinDialog === 'person' ? 'Choose their PIN' : 'Choose a new helper PIN'} onClose={() => setPinDialog(null)}>
          <ChoosePin
            length={pinDialog === 'person' ? PIN_LENGTH : HELPER_PIN_LENGTH}
            onChosen={async (pin) => {
              const hash = await hashPin(pin);
              await saveSecurity(pinDialog === 'person' ? { personPin: hash, lockEnabled: true } : { helperPin: hash });
              setDone(pinDialog === 'person' ? 'Their PIN is saved.' : 'The helper PIN is saved.');
              setPinDialog(null);
            }}
          />
          <div className="modal-actions">
            <Button onClick={() => setPinDialog(null)}>Cancel</Button>
          </div>
        </Modal>
      ) : null}
      {confirm === 'lock-off' ? (
        <ConfirmDialog
          title="Turn off the PIN?"
          body={<p>Familiar Place will open straight to Today. The Before unlock choices are kept, but won't be used.</p>}
          confirmLabel="Turn off the PIN"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            setConfirm(null);
            try {
              await saveSecurity({ personPin: null, lockEnabled: false });
            } catch {
              setMessage("That setting couldn't be saved. Please try again.");
            }
          }}
        />
      ) : null}
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
              await startSample();
              restart();
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
              restart();
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
