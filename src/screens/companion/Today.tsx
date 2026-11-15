import { Check, ChevronRight, Images, Lock, Music, Play, Settings } from 'lucide-react';
import { useNav } from '../../app/nav';
import { TileGrid } from '../../components/TileGrid';
import { Button, Heading, Notice, Screen, TopBar } from '../../components/ui';
import { formatClock, formatDate, formatTime, nextUp, partOfDay, todayEntries, type TodayEntry } from '../../lib/schedule';
import { useStore } from '../../lib/store';
import { useNow } from '../../lib/useNow';
import { TodayNoteCard } from '../../components/TodayNote';

export function NextUpCard({
  entry,
  hasEntries,
  onStart,
  onOpenRoutine,
}: {
  entry: TodayEntry | null;
  hasEntries: boolean;
  onStart: (routineId: string) => void;
  onOpenRoutine?: () => void;
}) {
  return (
    <section className="next-up" aria-label="Next up">
      <span className="next-up-label">Next up</span>
      {entry ? (
        <>
          <p className="next-up-main">
            <span className="next-up-time">{formatTime(entry.time)}</span>
            <span className="next-up-text">{entry.label}</span>
          </p>
          {entry.routineId ? (
            <Button variant="primary" icon={Play} onClick={() => onStart(entry.routineId as string)}>
              Start: {entry.label}
            </Button>
          ) : null}
        </>
      ) : (
        <p className="next-up-main">
          <span className="next-up-text">{hasEntries ? "That's everything for today." : 'Nothing is planned for today.'}</span>
        </p>
      )}
      {onOpenRoutine ? (
        <button type="button" className="next-up-link" onClick={onOpenRoutine}>
          <span>See today's plan</span>
          <ChevronRight size={22} strokeWidth={2.5} aria-hidden />
        </button>
      ) : null}
    </section>
  );
}

/** The daily companion's first screen after unlocking. */
export function Today() {
  const { data } = useStore();
  const { navigate, lock, flash } = useNav();
  const now = useNow();
  const entries = todayEntries(data.schedule, data.routines);
  const next = nextUp(entries, now);
  const name = data.profile.preferredName.trim();

  return (
    <Screen top={<TopBar right={<span className="app-name">Familiar Place</span>} getHelp={() => navigate('/help')} />} label="Today">
      <Heading sub={`${formatDate(now)} · ${formatClock(now)}`}>
        Good {partOfDay(now)}
        {name ? `, ${name}` : ''}
      </Heading>
      {flash === 'setup-done' ? (
        <Notice tone="ok" icon={Check}>
          All set. Add routines, memories and music any time in Helper setup.
        </Notice>
      ) : null}

      <TodayNoteCard note={data.schedule.note} />

      <NextUpCard
        entry={next}
        hasEntries={entries.length > 0}
        onStart={(id) => navigate(`/routine/${id}?from=today`)}
        onOpenRoutine={() => navigate('/routine?from=today')}
      />

      <TileGrid onOpen={(tile) => navigate(`/${tile}?from=today`)} label="Home, Family, You and Routine" />

      <button type="button" className="wide-tile" onClick={() => navigate('/memories')}>
        <Images size={36} strokeWidth={2.25} aria-hidden />
        <span className="wide-tile-text">
          <span className="wide-tile-label">Memories</span>
          <span className="wide-tile-hint">Photos to enjoy</span>
        </span>
        <ChevronRight size={28} strokeWidth={2.5} aria-hidden />
      </button>

      <button type="button" className="wide-tile wide-tile-music" onClick={() => navigate('/music')}>
        <Music size={36} strokeWidth={2.25} aria-hidden />
        <span className="wide-tile-text">
          <span className="wide-tile-label">Music</span>
          <span className="wide-tile-hint">Songs I love</span>
        </span>
        <ChevronRight size={28} strokeWidth={2.5} aria-hidden />
      </button>

      <div className="today-footer">
        {data.security.lockEnabled ? (
          <Button icon={Lock} onClick={lock}>
            Lock
          </Button>
        ) : null}
        <Button variant="quiet" size="md" icon={Settings} onClick={() => navigate('/setup')}>
          Helper setup
        </Button>
      </div>
    </Screen>
  );
}
