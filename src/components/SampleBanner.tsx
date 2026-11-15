import { useState } from 'react';
import { useNav } from '../app/nav';
import { useStore } from '../lib/store';
import { ConfirmDialog } from './Modal';

/** Shown on unlocked screens while the fictional sample family is loaded. */
export function SampleBanner() {
  const { eraseEverything } = useStore();
  const { restart, navigate } = useNav();
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState(false);

  const startForReal = async () => {
    setAsking(false);
    try {
      await eraseEverything();
      restart();
      navigate('/start');
    } catch {
      setProblem(true);
    }
  };

  return (
    <div className="sample-banner" role="note">
      <span>Sample family. Nothing here is real.</span>
      <button type="button" className="link-button" onClick={() => setAsking(true)}>
        Start setting up for real
      </button>
      {problem ? <span role="alert">That didn't work. Please try again.</span> : null}
      {asking ? (
        <ConfirmDialog
          title="Start setting up for real?"
          body={<p>This removes the sample family and anything you changed while trying it. Then you'll set up Familiar Place for someone.</p>}
          confirmLabel="Remove the sample family"
          cancelLabel="Keep looking around"
          danger
          onCancel={() => setAsking(false)}
          onConfirm={() => void startForReal()}
        />
      ) : null}
    </div>
  );
}
