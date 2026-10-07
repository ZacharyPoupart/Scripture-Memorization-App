// Read-only statistics derived from the ledger and verses. Never changes data, never affects scheduling.
import { addDays, dayKeyOf, daysBetween, type DayKey } from './dates.ts';
import { graduationTarget, liveVerses, progressDays, totalReviews } from './schedule.ts';
import { PILES, type AppData, type Pile, type Verse } from './types.ts';

export type CellKind = 'none' | 'practiced' | 'complete';

export interface HeatCell {
  day: DayKey;
  kind: CellKind;
  /** Day is after today (padding at the end of the last week). */
  future: boolean;
}

/** What happened on a day: complete = every due review done, practiced = some review, none = nothing recorded. */
export function dayKind(data: AppData, day: DayKey): CellKind {
  const e = data.ledger[day];
  if (!e) return 'none';
  if (e.o === 'c') return 'complete';
  if (e.r) return 'practiced';
  return 'none';
}

/**
 * Calendar heatmap: `weeks` columns of 7 days (Sunday first), the last column containing today.
 * Missed days are deliberately shown the same as days with no activity (no red, no blame).
 */
export function heatmap(data: AppData, now: number, weeks = 26): HeatCell[][] {
  const today = dayKeyOf(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const lastSunday = addDays(today, -dow);
  const first = addDays(lastSunday, -(weeks - 1) * 7);
  const cols: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d);
      const future = day > today;
      col.push({ day, future, kind: future ? 'none' : dayKind(data, day) });
    }
    cols.push(col);
  }
  return cols;
}

export interface StreakRun {
  start: DayKey;
  end: DayKey;
  length: number;
}

/**
 * Past and current streak runs, by the same rule as the live streak: complete days add one, days with
 * nothing due are skipped (neutral), a missed day ends the run. `today` counts only once it is complete.
 */
export function streakRuns(data: AppData, now: number): StreakRun[] {
  const today = dayKeyOf(now);
  const runs: StreakRun[] = [];
  let cur = null as StreakRun | null;
  for (let d = data.createdDay; d <= today; d = addDays(d, 1)) {
    const o = data.ledger[d]?.o;
    if (o === 'c') {
      cur = cur ? { ...cur, end: d, length: cur.length + 1 } : { start: d, end: d, length: 1 };
    } else if (o === 'n') {
      continue;
    } else if (d === today) {
      continue; // today is still open
    } else {
      if (cur) runs.push(cur);
      cur = null;
    }
  }
  if (cur) runs.push(cur);
  return runs;
}

export function bestRuns(data: AppData, now: number, n = 5): StreakRun[] {
  return streakRuns(data, now)
    .filter((r) => r.length >= 2)
    .sort((a, b) => b.length - a.length || b.end.localeCompare(a.end))
    .slice(0, n);
}

export interface PileStat {
  pile: Pile;
  count: number;
}

export function pileCounts(data: AppData): PileStat[] {
  const vs = liveVerses(data);
  return PILES.map((pile) => ({ pile, count: vs.filter((v) => v.pile === pile).length }));
}

export interface Approaching {
  verse: Verse;
  to: Pile;
  earned: number;
  target: number;
  remaining: number;
}

/** Verses closest to their next pile (goal-gradient: show what's nearly there). */
export function nextGraduations(data: AppData, now: number, n = 3): Approaching[] {
  const out: Approaching[] = [];
  for (const v of liveVerses(data)) {
    const target = graduationTarget(v.pile);
    if (!target) continue;
    const earned = progressDays(data, v, now);
    const to = v.pile === 'daily' ? 'weekly' : v.pile === 'weekly' ? 'monthly' : 'yearly';
    out.push({ verse: v, to, earned, target, remaining: Math.max(0, target - earned) });
  }
  return out.sort((a, b) => a.remaining - b.remaining || a.verse.id.localeCompare(b.verse.id)).slice(0, n);
}

export interface Totals {
  verses: number;
  reviews: number;
  daysPracticed: number;
  completeDays: number;
  memorizedYearly: number;
}

export function totals(data: AppData): Totals {
  const days = Object.values(data.ledger);
  return {
    verses: liveVerses(data).length,
    reviews: totalReviews(data),
    daysPracticed: days.filter((e) => e.r).length,
    completeDays: days.filter((e) => e.o === 'c').length,
    memorizedYearly: liveVerses(data).filter((v) => v.pile === 'yearly').length,
  };
}

/** "Day 23 of 90" style helper used by several screens. */
export function daysSince(a: DayKey, now: number): number {
  return Math.max(0, daysBetween(a, dayKeyOf(now)));
}
