import { addDays } from '../../src/core/dates.ts';
import {
  addVerse,
  createData,
  liveVerses,
  recordReview,
  settle,
  verseStatus,
} from '../../src/core/schedule.ts';
import type { AppData, Verse } from '../../src/core/types.ts';

/** Local timestamp for a day key + "HH:MM". */
export const at = (day: string, hm = '12:00'): number => new Date(`${day}T${hm}:00`).getTime();

export const DEVICE = 'dev-A';
export const D0 = '2026-01-10';
export const day = (n: number, from = D0) => addDays(from, n);

export function newData(start = D0): AppData {
  return createData(at(start, '08:00'));
}

export function john316(data: AppData, now: number, extra: Partial<Verse> = {}): Verse {
  const v = addVerse(
    data,
    { book: 43, chapter: 3, start: 16, end: 16, translation: 'ESV', text: 'For God so loved the world, that he gave his only Son.' },
    now,
  );
  Object.assign(v, extra);
  return v;
}

/** Complete every review that is currently available on `dayKey`, at spaced-out times. */
export function reviewEverythingDue(data: AppData, dayKey: string, device = DEVICE): void {
  for (const hm of ['08:00', '11:00', '14:00']) {
    const now = at(dayKey, hm);
    settle(data, now);
    for (const v of liveVerses(data)) {
      if (verseStatus(data, v, now).state === 'ready') recordReview(data, v.id, now, device);
    }
  }
}
