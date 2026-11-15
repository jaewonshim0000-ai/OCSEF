import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useNav } from '../../app/nav';
import { AudioField, PhotoField, TextArea, TextField } from '../../components/fields';
import { ConfirmDialog } from '../../components/Modal';
import { ShowBeforeUnlock } from '../../components/Switch';
import { Button, Card, Notice } from '../../components/ui';
import { newId } from '../../lib/defaults';
import { formatTime, isValidTime, minutesOf } from '../../lib/schedule';
import { useStore } from '../../lib/store';
import type { Approvals, Routine, RoutineStep, Schedule } from '../../lib/types';
import { SectionTitle, SetupPage, useDraft } from './common';

interface Draft {
  schedule: Schedule;
  routineCue: boolean;
}

export function mergeRoutineApprovals(base: Approvals, d: Draft): Approvals {
  return { ...base, routineCue: d.routineCue && !!d.schedule.lockedCue.trim() };
}

export function SetupRoutine() {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Draft>(() => ({
    schedule: data.schedule,
    routineCue: data.approvals.routineCue,
  }));
  const s = draft.schedule;
  const setSchedule = (patch: Partial<Schedule>) => setDraft((d) => ({ ...d, schedule: { ...d.schedule, ...patch } }));
  const invalid = s.items.some((i) => i.label.trim() && !isValidTime(i.time));

  return (
    <SetupPage
      title="Routine"
      dirty={dirty}
      previewSource={{ ...data, schedule: s, approvals: mergeRoutineApprovals(data.approvals, draft) }}
      onSave={async () => {
        if (invalid) throw new Error('invalid time');
        const schedule: Schedule = {
          lockedCue: s.lockedCue.trim(),
          // Today's note is saved on its own card; keep whatever is saved now.
          note: data.schedule.note,
          items: s.items
            .filter((i) => i.label.trim() && isValidTime(i.time))
            .map((i) => ({ ...i, label: i.label.trim() }))
            .sort((a, b) => minutesOf(a.time) - minutesOf(b.time)),
        };
        const approvals = mergeRoutineApprovals(data.approvals, { ...draft, schedule });
        await save({ schedule, approvals });
        markSaved({ schedule, routineCue: approvals.routineCue });
      }}
    >
      <Card>
        <TextField
          label="Reminder for the locked screen"
          hint='One short cue, for example "Lunch at noon".'
          value={s.lockedCue}
          onChange={(v) => setSchedule({ lockedCue: v })}
          maxLength={80}
        />
        <ShowBeforeUnlock
          what="routine reminder"
          checked={draft.routineCue && !!s.lockedCue.trim()}
          disabled={!s.lockedCue.trim()}
          onChange={(v) => setDraft((d) => ({ ...d, routineCue: v }))}
          note={!s.lockedCue.trim() ? 'Write a reminder first.' : undefined}
        />
      </Card>

      <SectionTitle>Today’s plan (only after unlock)</SectionTitle>
      <Card>
        {s.items.length === 0 ? <p className="field-hint">Nothing planned yet.</p> : null}
        {s.items.map((item, i) => (
          <div key={item.id} className="schedule-edit-row">
            <label className="sr-only" htmlFor={`time-${item.id}`}>
              Time for item {i + 1}
            </label>
            <input
              id={`time-${item.id}`}
              className={`input input-time${item.label.trim() && !isValidTime(item.time) ? ' is-invalid' : ''}`}
              type="time"
              value={item.time}
              onChange={(e) => setSchedule({ items: s.items.map((x) => (x.id === item.id ? { ...x, time: e.target.value } : x)) })}
            />
            <label className="sr-only" htmlFor={`label-${item.id}`}>
              What happens at item {i + 1}
            </label>
            <input
              id={`label-${item.id}`}
              className="input"
              value={item.label}
              placeholder="For example: Lunch"
              maxLength={80}
              onChange={(e) => setSchedule({ items: s.items.map((x) => (x.id === item.id ? { ...x, label: e.target.value } : x)) })}
            />
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${item.label || `item ${i + 1}`}`}
              onClick={() => setSchedule({ items: s.items.filter((x) => x.id !== item.id) })}
            >
              <Trash2 size={22} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        ))}
        {invalid ? (
          <p className="field-error" role="alert">
            Please give every item a time.
          </p>
        ) : null}
        <Button size="md" icon={Plus} onClick={() => setSchedule({ items: [...s.items, { id: newId('item'), time: '12:00', label: '' }] })}>
          Add to today’s plan
        </Button>
      </Card>

      <SectionTitle>Step-by-step routines</SectionTitle>
      <Card>
        <p className="field-hint">Saved separately. A routine with a time also appears in today’s plan.</p>
        <div className="stack stack-sm">
          {data.routines.map((r) => (
            <button key={r.id} type="button" className="list-button" onClick={() => navigate(`/setup/routine/${r.id}`)}>
              <span className="list-button-text">
                <span>{r.title || 'Untitled routine'}</span>
                <span className="list-button-sub">
                  {r.steps.length} {r.steps.length === 1 ? 'step' : 'steps'}
                  {r.scheduleTime ? ` · ${formatTime(r.scheduleTime)}` : ' · no set time'}
                </span>
              </span>
              <ChevronRight size={26} strokeWidth={2.5} aria-hidden />
            </button>
          ))}
        </div>
        <Button size="md" icon={Plus} onClick={() => navigate('/setup/routine/new')}>
          New routine
        </Button>
      </Card>
    </SetupPage>
  );
}

function emptyStep(): RoutineStep {
  return { id: newId('step'), text: '', photo: null, audio: null };
}

export function SetupRoutineEdit({ routineId }: { routineId: string }) {
  const { data, save } = useStore();
  const { navigate } = useNav();
  const { draft, setDraft, dirty, markSaved } = useDraft<Routine>(
    () =>
      data.routines.find((r) => r.id === routineId) ?? {
        id: newId('routine'),
        title: '',
        scheduleTime: null,
        steps: [emptyStep()],
        progress: null,
        order: data.routines.reduce((m, r) => Math.max(m, r.order + 1), 0),
      },
  );
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isNew = !data.routines.some((r) => r.id === draft.id);
  const set = (patch: Partial<Routine>) => setDraft((d) => ({ ...d, ...patch }));
  const setStep = (id: string, patch: Partial<RoutineStep>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const move = (index: number, delta: number) =>
    setDraft((d) => {
      const steps = [...d.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return d;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...d, steps, progress: null };
    });
  const badTime = draft.scheduleTime !== null && !isValidTime(draft.scheduleTime);

  return (
    <SetupPage
      title={isNew ? 'New routine' : draft.title || 'Routine'}
      dirty={dirty}
      backPath="/setup/routine"
      backLabel="Back to Routine setup"
      onSave={async () => {
        if (badTime) throw new Error('invalid time');
        const steps = draft.steps.filter((s) => s.text.trim() || s.photo || s.audio).map((s) => ({ ...s, text: s.text.trim() }));
        const progress = draft.progress && draft.progress.stepIndex < steps.length ? draft.progress : null;
        const routine: Routine = { ...draft, title: draft.title.trim() || 'Untitled routine', steps, progress };
        const routines = data.routines.some((r) => r.id === routine.id)
          ? data.routines.map((r) => (r.id === routine.id ? routine : r))
          : [...data.routines, routine];
        await save({ routines });
        markSaved(routine);
      }}
    >
      <Card>
        <TextField label="Name of the routine" hint='For example: "Get ready to go out".' value={draft.title} onChange={(v) => set({ title: v })} maxLength={80} />
        <div className="field">
          <label className="field-label" htmlFor="routine-time">
            Time of day (optional)
          </label>
          <div className="button-row">
            <input
              id="routine-time"
              className={`input input-time${badTime ? ' is-invalid' : ''}`}
              type="time"
              value={draft.scheduleTime ?? ''}
              onChange={(e) => set({ scheduleTime: e.target.value || null })}
            />
            {draft.scheduleTime !== null ? (
              <Button size="md" variant="quiet" block={false} onClick={() => set({ scheduleTime: null })}>
                No set time
              </Button>
            ) : null}
          </div>
        </div>
        {draft.progress ? (
          <Notice icon={RotateCcw}>
            Paused at step {draft.progress.stepIndex + 1}.{' '}
            <button type="button" className="inline-link" onClick={() => set({ progress: null })}>
              Start from the beginning next time
            </button>
          </Notice>
        ) : null}
      </Card>

      <SectionTitle>Steps</SectionTitle>
      {draft.steps.map((step, i) => (
        <Card key={step.id} className="step-editor">
          <div className="step-editor-head">
            <span className="step-editor-num">Step {i + 1}</span>
            <div className="step-editor-tools">
              <button type="button" className="icon-btn" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={22} strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move step ${i + 1} down`}
                disabled={i === draft.steps.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={22} strokeWidth={2.5} aria-hidden />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove step ${i + 1}`}
                onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((s) => s.id !== step.id), progress: null }))}
              >
                <Trash2 size={22} strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          </div>
          <TextArea label="What to do" hint="One small step, in plain words." value={step.text} onChange={(v) => setStep(step.id, { text: v })} rows={2} maxLength={200} />
          <PhotoField label="Photo (optional)" value={step.photo} defaultAlt={step.text.trim() || `Step ${i + 1}`} onChange={(photo) => setStep(step.id, { photo })} />
          <AudioField label="Recording (optional)" value={step.audio} onChange={(audio) => setStep(step.id, { audio })} />
        </Card>
      ))}
      <Button icon={Plus} onClick={() => setDraft((d) => ({ ...d, steps: [...d.steps, emptyStep()] }))}>
        Add a step
      </Button>
      {badTime ? (
        <p className="field-error" role="alert">
          Please choose a full time, or tap “No set time”.
        </p>
      ) : null}

      {!isNew ? (
        <Button variant="danger" size="md" icon={Trash2} onClick={() => setConfirmRemove(true)}>
          Remove this routine
        </Button>
      ) : null}
      {confirmRemove ? (
        <ConfirmDialog
          title="Remove this routine?"
          body={<p>“{draft.title || 'This routine'}” and its photos and recordings will be removed from this phone.</p>}
          confirmLabel="Remove routine"
          danger
          onCancel={() => setConfirmRemove(false)}
          onConfirm={async () => {
            setConfirmRemove(false);
            await save({ routines: data.routines.filter((r) => r.id !== draft.id) });
            markSaved(draft);
            navigate('/setup/routine', { replace: true });
          }}
        />
      ) : null}
      <p className="field-hint">
        <Lock size={16} strokeWidth={2.5} aria-hidden /> Step-by-step routines are only shown after unlock.
      </p>
    </SetupPage>
  );
}
