// Read-only helpers for the Today screen and verse cards. Nothing here changes scheduling:
// the queue is exactly "every verse that is ready right now" (verseStatus decides), and the ring is
// a view of progressDays / graduationTarget.
import { addDays, dayKeyOf, daysBetween } from './dates.ts';
import type { DayKey } from './dates.ts';
import { PROGRESS_UNIT, graduationTarget, pileVerses, progressDays, reviewsOn, verseStatus } from './schedule.ts';
import { PILES } from './types.ts';
import type { AppData, Verse } from './types.ts';

/**
 * Everything that can earn a counted review right now: Daily, then Weekly, Monthly, Yearly; inside a pile the verses reviewed the fewest
 * times today first (a Daily verse at 1 of 3 before one at 2 of 3), and among equals longest-in-pile first.
 */
export function buildTodayQueue(data: AppData, now: number): string[] {
  return PILES.flatMap((p) =>
    fewestFirst(
      data,
      pileVerses(data, p).filter((v) => verseStatus(data, v, now).state === 'ready').map((v) => v.id),
      now,
    ),
  );
}

/**
 * The verses reviewed the fewest times today first (0, then 1, then 2 ...), each group keeping the order it came in. Pass `random` to
 * shuffle inside each group, so the least-reviewed still come first. Only the order a session visits them in: what is due and what
 * counts never looks at it.
 */
export function fewestFirst(data: AppData, ids: readonly string[], now: number, random?: () => number): string[] {
  const today = dayKeyOf(now);
  const groups = new Map<number, string[]>();
  for (const id of ids) {
    const n = data.verses[id] ? reviewsOn(data.verses[id], today) : 0;
    groups.set(n, [...(groups.get(n) ?? []), id]);
  }
  return [...groups.keys()].sort((a, b) => a - b).flatMap((n) => (random ? shuffled(groups.get(n)!, random) : groups.get(n)!));
}

/**
 * The same items in a random order (Fisher–Yates). `random` returns a number in [0, 1). Only the order a session visits the verses
 * in changes: what is due, what counts and everything else about the schedule is decided elsewhere and never looks at this.
 */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * "Review all" visits the verses with no counted review yet today first, then the ones that already have one. Pass `random` to shuffle
 * (inside each of the two groups, so the unreviewed ones still come first); without it each group keeps the order it came in.
 * Only the order a session visits them in: what is due and what counts never looks at it.
 */
export function reviewAllOrder(data: AppData, ids: readonly string[], now: number, random?: () => number): string[] {
  const today = dayKeyOf(now);
  const fresh: string[] = [];
  const again: string[] = [];
  for (const id of ids) (data.verses[id] && reviewsOn(data.verses[id], today) > 0 ? again : fresh).push(id);
  return random ? [...shuffled(fresh, random), ...shuffled(again, random)] : [...fresh, ...again];
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

export type RingState = 'progress' | 'yearly';

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
  return { state: 'progress', earned, target, fraction, label: `${PROGRESS_UNIT[v.pile as keyof typeof PROGRESS_UNIT]} ${earned} of ${target} toward ${NEXT_NAME[v.pile as keyof typeof NEXT_NAME]}` };
}
