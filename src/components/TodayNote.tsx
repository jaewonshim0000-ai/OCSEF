import { StickyNote } from 'lucide-react';
import type { TodayNote } from '../lib/types';
import { useNow } from '../lib/useNow';
import { ReadAloudButton } from './Sound';

/** Today's note ("You're at the dentist…"). Shows nothing once the note has ended. */
export function TodayNoteCard({ note }: { note: TodayNote | null }) {
  const now = useNow();
  if (!note || !note.text.trim() || now.getTime() >= note.until) return null;
  return (
    <section className="today-note" aria-label="A note for today">
      <p className="today-note-kicker">
        <StickyNote size={22} strokeWidth={2.5} aria-hidden /> A note for today
      </p>
      <p className="today-note-text">{note.text}</p>
      <ReadAloudButton text={note.text} />
    </section>
  );
}
