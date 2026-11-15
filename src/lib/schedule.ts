import type { Routine, Schedule } from './types';

/**
 * The interface is written in English, so dates and times use the reader's
 * English locale when they have one, and British English otherwise. This
 * avoids mixing languages on one screen.
 */
export const LOCALE: string =
  typeof navigator !== 'undefined' && /^en(-|$)/i.test(navigator.language ?? '') ? navigator.language : 'en-GB';

export interface TodayEntry {
  key: string;
  time: string;
  label: string;
  routineId: string | null;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(time: string): boolean {
  return TIME_RE.test(time);
}

export function minutesOf(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) return Number.NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Today's schedule: plain items plus routines that have a scheduled time. */
export function todayEntries(schedule: Schedule, routines: Routine[]): TodayEntry[] {
  const entries: TodayEntry[] = [
    ...schedule.items
      .filter((i) => isValidTime(i.time) && i.label.trim())
      .map((i) => ({ key: `item-${i.id}`, time: i.time, label: i.label.trim(), routineId: null })),
    ...routines
      .filter((r) => r.scheduleTime && isValidTime(r.scheduleTime) && r.title.trim())
      .map((r) => ({
        key: `routine-${r.id}`,
        time: r.scheduleTime as string,
        label: r.title.trim(),
        routineId: r.id,
      })),
  ];
  return entries.sort((x, y) => minutesOf(x.time) - minutesOf(y.time) || x.label.localeCompare(y.label));
}

/**
 * The next entry at or after the current minute. Returns null when the day's
 * entries have all passed.
 */
export function nextUp(entries: TodayEntry[], now: Date): TodayEntry | null {
  const current = now.getHours() * 60 + now.getMinutes();
  return entries.find((e) => minutesOf(e.time) >= current) ?? null;
}

/** Formats "HH:MM" in the reader's locale, e.g. "12:00 pm" or "12:00". */
export function formatTime(time: string): string {
  const mins = minutesOf(time);
  if (Number.isNaN(mins)) return time;
  const d = new Date(2000, 0, 1, Math.floor(mins / 60), mins % 60);
  return d.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
}

export function formatClock(now: Date): string {
  return now.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit' });
}

export function formatDate(now: Date): string {
  return now.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}

export function partOfDay(now: Date): 'morning' | 'afternoon' | 'evening' {
  const h = now.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
