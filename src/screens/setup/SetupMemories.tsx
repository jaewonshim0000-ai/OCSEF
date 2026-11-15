import { useState } from 'react';
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNav } from '../../app/nav';
import { AudioField, PhotoField, TextArea, TextField } from '../../components/fields';
import { ConfirmDialog } from '../../components/Modal';
import { Photo } from '../../components/Photo';
import { Button, Card, Notice } from '../../components/ui';
import { newId } from '../../lib/defaults';
import { useStore } from '../../lib/store';
import type { Memory } from '../../lib/types';
import { SetupPage, useDraft } from './common';

export function SetupMemories() {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const [problem, setProblem] = useState<string | null>(null);
  const memories = data.memories;

  const move = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= memories.length) return;
    const next = [...memories];
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await save({ memories: next.map((m, i) => ({ ...m, order: i })) });
      setProblem(null);
    } catch {
      setProblem("The order couldn't be saved. Please try again.");
    }
  };

  return (
    <SetupPage title="Memories" sub="Photos for enjoyment and conversation. No quizzes, no scores.">
      <p className="field-hint">
        <Lock size={16} strokeWidth={2.5} aria-hidden /> Memories are only shown after unlock. Changes here save straight away.
      </p>
      {memories.length === 0 ? <Notice>No photos yet.</Notice> : null}
      {problem ? <Notice tone="warn">{problem}</Notice> : null}
      <ul className="memory-setup-list">
        {memories.map((m, i) => (
          <li key={m.id} className="memory-setup-row">
            <Photo photo={m.photo} className="photo-thumb-sm" />
            <span className="memory-setup-title">{m.title || 'Untitled'}</span>
            <div className="memory-setup-tools">
              <button type="button" className="icon-btn" aria-label={`Move ${m.title || 'photo'} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={22} strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${m.title || 'photo'} down`}
                disabled={i === memories.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={22} strokeWidth={2.5} aria-hidden />
              </button>
              <button type="button" className="icon-btn" aria-label={`Edit ${m.title || 'photo'}`} onClick={() => navigate(`/setup/memories/${m.id}`)}>
                <Pencil size={22} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="primary" icon={Plus} onClick={() => navigate('/setup/memories/new')}>
        Add a memory
      </Button>
    </SetupPage>
  );
}

export function SetupMemoryEdit({ memoryId }: { memoryId: string }) {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Memory>(
    () =>
      data.memories.find((m) => m.id === memoryId) ?? {
        id: newId('memory'),
        title: '',
        photo: null,
        caption: '',
        audio: null,
        order: data.memories.reduce((max, m) => Math.max(max, m.order + 1), 0),
      },
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isNew = !data.memories.some((m) => m.id === draft.id);
  const set = (patch: Partial<Memory>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <SetupPage
      title={isNew ? 'Add a memory' : draft.title || 'Memory'}
      dirty={dirty}
      backPath="/setup/memories"
      backLabel="Back to Memories setup"
      onSave={async () => {
        const memory: Memory = { ...draft, title: draft.title.trim(), caption: draft.caption.trim() };
        const memories = data.memories.some((m) => m.id === memory.id)
          ? data.memories.map((m) => (m.id === memory.id ? memory : m))
          : [...data.memories, memory];
        await save({ memories });
        markSaved(memory);
      }}
    >
      <Card>
        <PhotoField label="Photo" value={draft.photo} defaultAlt={draft.title.trim() || 'A family photo'} onChange={(photo) => set({ photo })} />
        <TextField label="Title" hint='For example: "Whitby beach, 1978".' value={draft.title} onChange={(v) => set({ title: v })} maxLength={80} />
        <TextArea label="Caption (optional)" value={draft.caption} onChange={(v) => set({ caption: v })} rows={2} maxLength={300} />
      </Card>
      <Card>
        <AudioField label="A short recording (optional)" value={draft.audio} onChange={(audio) => set({ audio })} />
        <p className="field-hint">A story told by the person or someone they love. It only plays when someone taps Play.</p>
      </Card>
      {!isNew ? (
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove this memory
        </Button>
      ) : null}
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove this memory?"
          body={<p>The photo, caption and recording will be removed from this phone.</p>}
          confirmLabel="Remove memory"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            await save({ memories: data.memories.filter((m) => m.id !== draft.id) });
            markSaved(draft);
            navigate('/setup/memories', { replace: true });
          }}
        />
      ) : null}
    </SetupPage>
  );
}
