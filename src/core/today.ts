// Read-only helpers for the Today screen and verse cards. Nothing here changes scheduling:
// the queue is exactly "every verse that is ready right now" (verseStatus decides), and the ring is
// a view of progressDays / graduationTarget / isFrozen.
import { addDays, dayKeyOf, daysBetween } from './dates.ts';
import type { DayKey } from './dates.ts';
import { graduationTarget, isFrozen, pileVerses, progressDays, verseStatus } from './schedule.ts';
import { PILES } from './types.ts';
import type { AppData, Verse } from './types.ts';

/** Everything that can earn a counted review right now: Daily, then Weekly, Monthly, Yearly, longest-in-pile first. */
export function buildTodayQueue(data: AppData, now: number): string[] {
  return PILES.flatMap((p) => pileVerses(data, p).filter((v) => verseStatus(data, v, now).state === 'ready')).map((v) => v.id);
}

export type NextReview =
  | { kind: 'none' }
  | { kind: 'soon'; waitMs: number } // a Daily verse unlocks later today
  | { kind: 'day'; day: DayKey; daysAway: number }; // next due day (tomorrow for finished Daily verses)

/** When the next counted review becomes available, assuming nothing is ready now. */
export function nextReviewInfo(data: AppData, now: number): NextReview {
  const today = dayKeyOf(now);
  let soon = Infinity;
  let day: DayKey | null = null;
  const consider = (d: DayKey) => {
    if (day === null || d < day) day = d;
  };
  for (const p of PILES) {
    for (const v of pileVerses(data, p)) {
      const s = verseStatus(data, v, now);
      if (s.state === 'waiting') soon = Math.min(soon, s.waitMs ?? 0);
      else if (s.state === 'done') consider(addDays(today, 1));
      else if (s.state === 'notdue' && s.due) consider(s.due);
    }
  }
  if (soon !== Infinity) return { kind: 'soon', waitMs: soon };
  if (day) return { kind: 'day', day, daysAway: daysBetween(today, day) };
  return { kind: 'none' };
}

export type RingState = 'progress' | 'frozen' | 'yearly';

export interface Ring {
  state: RingState;
  earned: number;
  target: number | null;
  /** 0..1 of the way to the next pile (1 for Yearly). */
  fraction: number;
  /** Screen-reader / tooltip text, e.g. "Day 47 of 90 toward Weekly". */
  label: string;
}

const NEXT_NAME = { daily: 'Weekly', weekly: 'Monthly', monthly: 'Yearly' } as const;

export function progressRing(data: AppData, v: Verse, now: number): Ring {
  const target = graduationTarget(v.pile);
  if (target === null) return { state: 'yearly', earned: 0, target: null, fraction: 1, label: 'Yearly: in your permanent collection' };
  const earned = progressDays(data, v, now);
  const fraction = Math.min(1, earned / target);
  const frozen = isFrozen(data, now);
  const base = `Day ${earned} of ${target} toward ${NEXT_NAME[v.pile as keyof typeof NEXT_NAME]}`;
  return { state: frozen ? 'frozen' : 'progress', earned, target, fraction, label: frozen ? `${base} (paused)` : base };
}
