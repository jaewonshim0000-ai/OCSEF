import { useState } from 'react';
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import { useNav } from '../../app/nav';
import { ConfirmDialog } from '../../components/Modal';
import { Photo } from '../../components/Photo';
import { AudioButton, ReadAloudButton } from '../../components/Sound';
import { Button, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { useStore } from '../../lib/store';

/**
 * One familiar photo at a time, for enjoyment and conversation. There are no
 * quizzes or scores, and any memory can be skipped or removed.
 */
export function MemoriesView() {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const memories = data.memories;
  const [index, setIndex] = useState(0);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const safeIndex = Math.min(index, Math.max(0, memories.length - 1));
  const memory = memories[safeIndex];

  const top = <TopBar back={{ label: 'Back to Today', onClick: () => navigate('/today') }} getHelp={() => navigate('/help')} />;

  if (!memory) {
    return (
      <Screen top={top}>
        <Heading>Memories</Heading>
        <Notice>There are no photos here yet. A helper can add them in Helper setup.</Notice>
      </Screen>
    );
  }

  const remove = async () => {
    setConfirmRemove(false);
    try {
      await save({ memories: memories.filter((m) => m.id !== memory.id) });
      setIndex(Math.max(0, safeIndex - (safeIndex === memories.length - 1 ? 1 : 0)));
      setProblem(null);
    } catch {
      setProblem("That photo couldn't be removed. Please try again.");
    }
  };

  const spoken = [memory.title, memory.caption].map((s) => s.trim()).filter(Boolean).join('. ');

  return (
    <Screen
      top={top}
      footer={
        memories.length > 1 ? (
          <div className="player-controls">
            <Button icon={ArrowLeft} block={false} className="grow" onClick={() => setIndex((safeIndex - 1 + memories.length) % memories.length)}>
              Previous
            </Button>
            <Button variant="primary" icon={ArrowRight} block={false} className="grow" onClick={() => setIndex((safeIndex + 1) % memories.length)}>
              Next
            </Button>
          </div>
        ) : undefined
      }
    >
      <Heading sub={`${safeIndex + 1} of ${memories.length}`}>Memories</Heading>
      <Stack>
        <article className="memory" aria-label={memory.title || 'Memory'} aria-live="polite">
          <Photo photo={memory.photo} className="photo-memory" />
          {memory.title ? <h2 className="memory-title">{memory.title}</h2> : null}
          {memory.caption ? <p className="big-text">{memory.caption}</p> : null}
        </article>
        {memory.audio ? <AudioButton audio={memory.audio} label="Play" variant="primary" /> : null}
        {spoken ? <ReadAloudButton text={spoken} /> : null}
        {problem ? <Notice tone="warn">{problem}</Notice> : null}
        <Button variant="quiet" size="md" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove this photo
        </Button>
      </Stack>
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove this photo?"
          body={<p>“{memory.title || 'This memory'}” will be taken out of Memories on this phone.</p>}
          confirmLabel="Remove it"
          cancelLabel="Keep it"
          danger
          onConfirm={remove}
          onCancel={() => setConfirmRemove(false)}
        />
      ) : null}
    </Screen>
  );
}
