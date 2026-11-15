import { CalendarClock, House, UserRound, Users } from 'lucide-react';
import type { TileId } from '../lib/types';

export const TILES: ReadonlyArray<{
  id: TileId;
  label: string;
  hint: string;
  Icon: typeof House;
}> = [
  { id: 'home', label: 'Home', hint: 'Where I live', Icon: House },
  { id: 'family', label: 'Family', hint: 'People I trust', Icon: Users },
  { id: 'you', label: 'You', hint: 'About me', Icon: UserRound },
  { id: 'routine', label: 'Routine', hint: "What's next", Icon: CalendarClock },
];

/**
 * The four support buttons. Positions and labels never change between the
 * locked and unlocked experiences.
 */
export function TileGrid({ onOpen, label = 'Four ways to get help' }: { onOpen: (tile: TileId) => void; label?: string }) {
  return (
    <nav className="tile-grid" aria-label={label}>
      {TILES.map(({ id, label: tileLabel, hint, Icon }) => (
        <button key={id} type="button" className={`tile tile-${id}`} onClick={() => onOpen(id)}>
          <span className="tile-icon">
            <Icon size={52} strokeWidth={2.25} aria-hidden />
          </span>
          <span className="tile-label">{tileLabel}</span>
          <span className="tile-hint">{hint}</span>
        </button>
      ))}
    </nav>
  );
}
