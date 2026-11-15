import { useEffect, useState, type ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { PinPad, type PinResult } from '../../components/PinPad';
import { Button, Heading, Notice, Screen, TopBar } from '../../components/ui';
import { HELPER_PIN_LENGTH } from '../../lib/session';
import { useStore } from '../../lib/store';

type Forgot = null | 'menu' | 'erase1' | 'erase2';

/** Shown in place of any Helper setup screen until the helper PIN is entered. */
export function HelperGate({ extraForgotActions }: { extraForgotActions?: (close: () => void) => ReactNode }) {
  const { navigate, checkHelperPin, helperWaitUntil, restart } = useNav();
  const { data, eraseEverything } = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [forgot, setForgot] = useState<Forgot>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const waiting = now < helperWaitUntil;
  const secondsLeft = Math.max(0, Math.ceil((helperWaitUntil - now) / 1000));
  const name = data.profile.preferredName.trim() || 'them';

  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [waiting]);

  const submit = async (entry: string): Promise<PinResult | void> => {
    const result = await checkHelperPin(entry);
    setNow(Date.now());
    if (result === 'wrong') return { message: "That isn't the helper PIN.", shake: true };
  };

  const erase = async () => {
    setForgot(null);
    try {
      await eraseEverything();
      restart();
    } catch {
      setProblem("Erasing didn't finish. Please try again.");
    }
  };

  return (
    <Screen top={<TopBar back={{ label: 'Cancel', onClick: () => navigate('/today') }} />} label="Helper PIN">
      <Heading sub="Helper setup changes what Familiar Place shows and who it calls.">Enter the helper PIN</Heading>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      {waiting ? (
        <Notice tone="warn">
          Too many tries. Try again in {secondsLeft} {secondsLeft === 1 ? 'second' : 'seconds'}.
        </Notice>
      ) : null}
      <PinPad length={HELPER_PIN_LENGTH} onSubmit={submit} disabled={waiting} tone="light" />
      <Button variant="quiet" size="md" icon={HelpCircle} onClick={() => setForgot('menu')}>
        Forgot the helper PIN?
      </Button>

      {forgot === 'menu' ? (
        <Modal title="Forgot the helper PIN?" onClose={() => setForgot(null)}>
          <div className="modal-body">
            <p>
              The helper PIN can't be recovered. You can restore a backup, which has its own helper PIN, or erase
              everything and set up again.
            </p>
          </div>
          <div className="modal-actions">
            {extraForgotActions?.(() => setForgot(null))}
            <Button variant="danger" onClick={() => setForgot('erase1')}>
              Erase everything
            </Button>
            <Button onClick={() => setForgot(null)} data-autofocus>
              Cancel
            </Button>
          </div>
        </Modal>
      ) : null}
      {forgot === 'erase1' ? (
        <ConfirmDialog
          title="Erase everything?"
          body={<p>This deletes everything saved in Familiar Place on this phone, including photos and recordings.</p>}
          confirmLabel="Erase everything"
          danger
          onCancel={() => setForgot(null)}
          onConfirm={() => setForgot('erase2')}
        />
      ) : null}
      {forgot === 'erase2' ? (
        <ConfirmDialog
          title="Are you sure?"
          body={<p>Everything about {name} will be gone from this phone. This can't be undone.</p>}
          confirmLabel="Yes, erase everything"
          danger
          onCancel={() => setForgot(null)}
          onConfirm={() => void erase()}
        />
      ) : null}
    </Screen>
  );
}
