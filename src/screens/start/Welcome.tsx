import { useState } from 'react';
import { Upload, UserPlus, Users } from 'lucide-react';
import { useNav } from '../../app/nav';
import { RestoreDialog } from '../../components/RestoreDialog';
import { Button, Heading, Notice, Screen, Stack } from '../../components/ui';
import { useStore } from '../../lib/store';

/** The first screen on a new install, and after Erase everything. */
export function Welcome() {
  const { startSample } = useStore();
  const { navigate, restart } = useNav();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const sample = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await startSample();
      restart();
    } catch {
      setProblem("The sample family couldn't be loaded. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Screen label="Welcome">
      <Heading sub="Familiar Place helps someone get their bearings and reach a person they trust. Set it up together.">
        Welcome to Familiar Place
      </Heading>
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <Stack>
        <Button variant="primary" size="xl" icon={UserPlus} onClick={() => navigate('/start')}>
          Set up for someone
        </Button>
        <Button icon={Users} onClick={sample} disabled={busy}>
          {busy ? 'Loading the sample family…' : 'Look around with a sample family'}
        </Button>
        <Button icon={Upload} onClick={() => setRestoring(true)}>
          Restore from a backup
        </Button>
      </Stack>
      <p className="muted">Everything stays on this phone. Nothing is uploaded.</p>
      {restoring ? <RestoreDialog confirmReplace={false} onClose={() => setRestoring(false)} onRestored={() => restart()} /> : null}
    </Screen>
  );
}
