import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock, ListChecks, Pause, Play, RotateCcw } from 'lucide-react';
import { useNav } from '../../app/nav';
import { backTarget, withFrom } from '../../app/paths';
import { Photo } from '../../components/Photo';
import { AudioButton, ReadAloudButton } from '../../components/Sound';
import { Button, Card, Heading, Notice, Screen, Stack, TopBar } from '../../components/ui';
import { formatDate, formatTime, minutesOf, nextUp, todayEntries } from '../../lib/schedule';
import { useStore } from '../../lib/store';
import type { Routine } from '../../lib/types';
import { useNow } from '../../lib/useNow';
import { NextUpCard } from './Today';

export function RoutineFull() {
  const { data } = useStore();
  const { route, navigate } = useNav();
  const now = useNow();
  const back = backTarget(route);
  const entries = todayEntries(data.schedule, data.routines);
  const next = nextUp(entries, now);
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return (
    <Screen
      tone="routine"
      top={<TopBar back={{ label: back.label, onClick: () => navigate(back.path) }} getHelp={() => navigate('/help')} />}
    >
      <Heading sub={formatDate(now)}>Routine</Heading>
      <Stack>
        <NextUpCard
          entry={next}
          hasEntries={entries.length > 0}
          onStart={(id) => navigate(withFrom(`/routine/${id}`, route))}
        />

        <Card>
          <h2 className="card-title">
            <Clock size={24} strokeWidth={2.5} aria-hidden /> Today
          </h2>
          {entries.length ? (
            <ol className="schedule">
              {entries.map((e) => {
                const isNext = next?.key === e.key;
                const earlier = minutesOf(e.time) < nowMins;
                return (
                  <li key={e.key} className={`schedule-row${isNext ? ' is-next' : ''}${earlier ? ' is-earlier' : ''}`}>
                    <span className="schedule-time">{formatTime(e.time)}</span>
                    <span className="schedule-label">
                      {e.label}
                      {isNext ? <span className="badge">Next</span> : null}
                    </span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p>A helper can plan the day in Helper setup.</p>
          )}
        </Card>

        <Card>
          <h2 className="card-title">
            <ListChecks size={24} strokeWidth={2.5} aria-hidden /> Step by step
          </h2>
          {data.routines.length ? (
            <div className="stack stack-sm">
              {data.routines.map((r) => (
                <RoutineStartRow key={r.id} routine={r} onOpen={() => navigate(withFrom(`/routine/${r.id}`, route))} />
              ))}
            </div>
          ) : (
            <p>No step-by-step routines yet. A helper can add them in Helper setup.</p>
          )}
        </Card>
      </Stack>
    </Screen>
  );
}

function RoutineStartRow({ routine, onOpen }: { routine: Routine; onOpen: () => void }) {
  const total = routine.steps.length;
  const resume = routine.progress && routine.progress.stepIndex > 0 && routine.progress.stepIndex < total;
  return (
    <button type="button" className="list-button routine-row" onClick={onOpen}>
      {resume ? <Pause size={26} strokeWidth={2.5} aria-hidden /> : <Play size={26} strokeWidth={2.5} aria-hidden />}
      <span className="list-button-text">
        <span>{routine.title || 'Untitled routine'}</span>
        <span className="list-button-sub">
          {resume
            ? `Paused at step ${(routine.progress?.stepIndex ?? 0) + 1} of ${total}`
            : `${total} ${total === 1 ? 'step' : 'steps'}${routine.scheduleTime ? ` · ${formatTime(routine.scheduleTime)}` : ''}`}
        </span>
      </span>
    </button>
  );
}

type Phase = 'resume-choice' | 'step' | 'done';

/**
 * One step per screen, with Back, Next step, Read aloud and Finish for now.
 * Progress is saved on every step so the person can pick up later.
 */
export function RoutinePlayer() {
  const { data, save } = useStore();
  const { route, navigate } = useNav();
  const routine = data.routines.find((r) => r.id === route.id);
  const total = routine?.steps.length ?? 0;
  const saved = routine?.progress?.stepIndex ?? 0;
  const canResume = !!routine?.progress && saved > 0 && saved < total;
  const [phase, setPhase] = useState<Phase>(canResume ? 'resume-choice' : 'step');
  const [index, setIndex] = useState(canResume ? saved : 0);
  const [saveProblem, setSaveProblem] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backPath = withFrom('/routine', route);

  // Move focus to the step text when the step changes, for screen readers.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, [index, phase]);

  if (!routine) {
    return (
      <Screen tone="routine" top={<TopBar back={{ label: 'Back to Routine', onClick: () => navigate(backPath) }} />}>
        <Heading>Not found</Heading>
        <Stack>
          <Notice>This routine is no longer here.</Notice>
          <Button variant="primary" onClick={() => navigate(backPath)}>
            Go to Routine
          </Button>
        </Stack>
      </Screen>
    );
  }

  const writeProgress = (stepIndex: number | null) => {
    const routines = data.routines.map((r) =>
      r.id === routine.id ? { ...r, progress: stepIndex === null ? null : { stepIndex, updatedAt: Date.now() } } : r,
    );
    save({ routines }).then(
      () => setSaveProblem(false),
      () => setSaveProblem(true),
    );
  };

  const goTo = (next: number) => {
    setIndex(next);
    writeProgress(next);
  };

  const top = (
    <TopBar
      back={{
        label: 'Finish for now',
        onClick: () => {
          if (phase === 'step') writeProgress(index);
          navigate(backPath);
        },
      }}
      getHelp={() => {
        if (phase === 'step') writeProgress(index);
        navigate('/help');
      }}
    />
  );

  if (total === 0) {
    return (
      <Screen tone="routine" top={top}>
        <Heading>{routine.title || 'Routine'}</Heading>
        <Notice>This routine has no steps yet. A helper can add them in Helper setup.</Notice>
      </Screen>
    );
  }

  if (phase === 'resume-choice') {
    return (
      <Screen tone="routine" top={top}>
        <h1 className="heading-plain" tabIndex={-1} data-screen-heading ref={headingRef}>
          {routine.title}
        </h1>
        <Stack>
          <p className="big-text">
            Welcome back. You stopped at step {saved + 1} of {total}.
          </p>
          <Button variant="primary" size="xl" icon={Play} onClick={() => setPhase('step')}>
            Carry on from step {saved + 1}
          </Button>
          <Button
            icon={RotateCcw}
            onClick={() => {
              setPhase('step');
              goTo(0);
            }}
          >
            Start from the beginning
          </Button>
        </Stack>
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen tone="routine" top={<TopBar back={{ label: 'Back to Routine', onClick: () => navigate(backPath) }} getHelp={() => navigate('/help')} />}>
        <div className="done-mark" aria-hidden>
          <Check size={64} strokeWidth={3} />
        </div>
        <h1 className="heading-plain center" tabIndex={-1} data-screen-heading ref={headingRef}>
          All done
        </h1>
        <Stack>
          <p className="big-text center">You finished “{routine.title}”.</p>
          <Button variant="primary" size="xl" onClick={() => navigate(backPath)}>
            Back to Routine
          </Button>
        </Stack>
      </Screen>
    );
  }

  const step = routine.steps[Math.min(index, total - 1)];
  const isLast = index >= total - 1;

  return (
    <Screen
      tone="routine"
      top={top}
      footer={
        <div className="player-controls">
          <Button icon={ArrowLeft} onClick={() => goTo(index - 1)} disabled={index === 0} block={false} className="grow">
            Back
          </Button>
          {isLast ? (
            <Button
              variant="primary"
              icon={Check}
              block={false}
              className="grow-2"
              onClick={() => {
                writeProgress(null);
                setPhase('done');
              }}
            >
              All done
            </Button>
          ) : (
            <Button variant="primary" icon={ArrowRight} block={false} className="grow-2" onClick={() => goTo(index + 1)}>
              Next step
            </Button>
          )}
        </div>
      }
    >
      <p className="step-count">
        {routine.title} · Step {index + 1} of {total}
      </p>
      <div className="step-progress" aria-hidden>
        {routine.steps.map((s, i) => (
          <span key={s.id} className={i <= index ? 'is-done' : ''} />
        ))}
      </div>
      <Stack>
        {step.photo ? <Photo photo={step.photo} className="photo-wide" /> : null}
        <h1 className="step-text" tabIndex={-1} data-screen-heading ref={headingRef}>
          {step.text || 'This step has no words yet.'}
        </h1>
        {step.audio ? <AudioButton audio={step.audio} showTranscript={step.audio.transcript.trim() !== step.text.trim()} /> : null}
        <ReadAloudButton text={step.text} />
        {saveProblem ? (
          <Notice tone="warn">Your place couldn't be saved on this device, but you can keep going.</Notice>
        ) : null}
      </Stack>
    </Screen>
  );
}
