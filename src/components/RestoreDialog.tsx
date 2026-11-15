import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { BackupError, decodeBackup, type BackupContents } from '../lib/backup';
import { persistStorage } from '../lib/db';
import { useStore } from '../lib/store';
import { TextField } from './fields';
import { ConfirmDialog, Modal } from './Modal';
import { Button, Notice } from './ui';

/**
 * Choose a backup file and its password. The whole file is checked before
 * anything on the phone changes.
 */
export function RestoreDialog({
  confirmReplace,
  onClose,
  onRestored,
}: {
  /** Ask before replacing existing data. False on Welcome, where nothing exists yet. */
  confirmReplace: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const { applyBackup } = useStore();
  const fileId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<BackupContents | null>(null);

  const apply = async (contents: BackupContents) => {
    setBusy(true);
    try {
      await applyBackup(contents);
      void persistStorage();
      onRestored();
    } catch {
      setReady(null);
      setError("The backup couldn't be restored. Please try again.");
      setBusy(false);
    }
  };

  const open = async () => {
    if (!file) {
      setError('Choose a backup file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const contents = await decodeBackup(file, password);
      setBusy(false);
      if (confirmReplace) setReady(contents);
      else await apply(contents);
    } catch (e) {
      setError(e instanceof BackupError ? e.message : "This backup couldn't be opened.");
      setBusy(false);
    }
  };

  if (ready) {
    return (
      <ConfirmDialog
        title="Replace everything on this phone?"
        body={<p>Everything in Familiar Place on this phone will be replaced with this backup. This can't be undone.</p>}
        confirmLabel="Replace with backup"
        danger
        onCancel={onClose}
        onConfirm={() => void apply(ready)}
      />
    );
  }

  return (
    <Modal title="Restore from a backup" onClose={onClose}>
      <div className="modal-body stack stack-sm">
        <div className="field">
          <label className="field-label" htmlFor={fileId}>
            Backup file
          </label>
          <input id={fileId} type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <TextField label="Backup password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {error ? (
          <div role="alert">
            <Notice tone="warn">{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className="modal-actions">
        <Button variant="primary" icon={Upload} onClick={() => void open()} disabled={busy}>
          {busy ? 'Opening…' : 'Restore'}
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </div>
    </Modal>
  );
}
