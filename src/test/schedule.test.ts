import { describe, expect, it } from 'vitest';
import { isValidTime, nextUp, todayEntries } from '../lib/schedule';
import { demoAppData } from '../lib/seed';

describe('schedule', () => {
  const data = demoAppData();
  const entries = todayEntries(data.schedule, data.routines);

  it('merges plain items and timed routines in time order', () => {
    expect(entries.map((e) => e.time)).toEqual(['08:00', '08:30', '10:00', '10:30', '12:00', '15:00', '18:00', '21:30']);
    expect(entries.find((e) => e.time === '10:00')).toMatchObject({ label: 'Get ready to go out', routineId: 'routine-go-out' });
  });

  it('finds the next entry at or after now', () => {
    expect(nextUp(entries, new Date(2026, 10, 15, 11, 59))?.label).toBe('Lunch');
    expect(nextUp(entries, new Date(2026, 10, 15, 12, 0))?.label).toBe('Lunch');
    expect(nextUp(entries, new Date(2026, 10, 15, 7, 0))?.label).toBe('Breakfast');
  });

  it('returns null once everything has passed', () => {
    expect(nextUp(entries, new Date(2026, 10, 15, 23, 0))).toBeNull();
  });

  it('ignores invalid times and blank labels', () => {
    const list = todayEntries(
      { lockedCue: '', items: [{ id: 'a', time: '25:00', label: 'Bad' }, { id: 'b', time: '09:00', label: '  ' }, { id: 'c', time: '09:00', label: 'Ok' }] },
      [],
    );
    expect(list.map((e) => e.label)).toEqual(['Ok']);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('09:00')).toBe(true);
  });
});
