import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { TextField } from '../../components/fields';
import { Modal } from '../../components/Modal';
import { Switch } from '../../components/Switch';
import { Button, Notice } from '../../components/ui';
import { MIN_PASSWORD_LENGTH, backupFilename, formatBytes, saveBackupFile } from '../../lib/backup';
import { useStore } from '../../lib/store';

export function SaveBackupDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { createBackup, estimateBackupBytes, save, snapshot } = useStore();
  const [size, setSize] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    estimateBackupBytes().then(setSize, () => setSize(null));
  }, [estimateBackupBytes]);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const blob = await createBackup(password);
      if (!(await saveBackupFile(blob, backupFilename()))) {
        // The share sheet was closed without saving: nothing to record.
        setBusy(false);
        return;
      }
      const d = snapshot();
      await save({ setup: { ...d.setup, lastBackupAt: Date.now() } });
      onSaved();
    } catch {
      setError("The backup couldn't be made. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Save a backup" onClose={onClose}>
      <div className="modal-body stack stack-sm">
        <p>
          A backup file holds everything in Familiar Place{size !== null ? `, about ${formatBytes(size)}` : ''}. It is
          locked with a password.
        </p>
        <TextField label="Password" type={show ? 'text' : 'password'} value={password} onChange={setPassword} autoComplete="new-password" />
        <TextField label="Type it again" type={show ? 'text' : 'password'} value={again} onChange={setAgain} autoComplete="new-password" />
        <Switch label="Show password" checked={show} onChange={setShow} />
        <Notice tone="warn">You'll need this password to restore. It can't be recovered.</Notice>
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="modal-actions">
        <Button variant="primary" icon={Download} onClick={() => void submit()} disabled={busy}>
          {busy ? 'Making the backup…' : 'Save backup'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
