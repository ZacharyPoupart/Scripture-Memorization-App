// How coins are worked out, apart from the shop. Coins are derived from what happened (reviews, finished days, level-ups), plus
// one stored extra: the streak multiplier's share, which depends on the streak you had on the day and so cannot be rebuilt later.
import type { AppData } from './types.ts';

export const SEEDS_PER_REVIEW = 1;
export const SEEDS_PER_DAY = 5;
export const SEEDS_PER_LEVELUP = 25;
/** On top of the 5 for a finished day: a full day, when everything due was done all the way (3 reviews of each Daily verse). */
export const SEEDS_PER_FULL_DAY = 10;

/** The longer the streak, the more every coin earned is worth: from `days` in a row, coins from reviews, finished days and level-ups are multiplied by `x`. */
export const STREAK_MULTIPLIERS = [
  { days: 3, x: 1.1 },
  { days: 7, x: 1.25 },
  { days: 14, x: 1.5 },
  { days: 30, x: 1.75 },
  { days: 100, x: 2 },
  { days: 365, x: 3 },
] as const;

export function streakMultiplier(streak: number): number {
  let m = 1;
  for (const t of STREAK_MULTIPLIERS) if (streak >= t.days) m = t.x;
  return m;
}

/** The next step up in the multiplier, if there is one: how many days the streak has to reach and what it will be worth. */
export function nextMultiplier(streak: number): { days: number; x: number } | null {
  return STREAK_MULTIPLIERS.find((t) => streak < t.days) ?? null;
}

/**
 * The extra coins a multiplier earned on one review (`extra` may be 1.5, 0.3, ...): the whole coins always, and the part left over as
 * that chance of one more (0.3 left over is a 30% chance of a coin, otherwise nothing), so over many reviews it pays out the same
 * as the fraction would. `random` returns a number in [0, 1).
 */
export function rollBonus(extra: number, random: () => number = Math.random): number {
  const e = Math.round(Math.max(0, extra) * 1e6) / 1e6; // 0.30000000000000004 is 0.3
  const whole = Math.floor(e);
  const left = e - whole;
  return whole + (left > 0 && random() < left ? 1 : 0);
}

/** Coins from counted reviews, finished days and level-ups, before any multiplier. */
export function baseCoins(data: AppData): number {
  const reviews = Object.values(data.reviewsByDevice).reduce((a, b) => a + b, 0);
  const finished = Object.values(data.ledger).filter((e) => e.o === 'c');
  const full = finished.filter((e) => e.f).length;
  return reviews * SEEDS_PER_REVIEW + finished.length * SEEDS_PER_DAY + full * SEEDS_PER_FULL_DAY + data.levelUps.length * SEEDS_PER_LEVELUP;
}

/** The extra coins the streak multiplier has earned so far (whole coins). */
export function coinBonusTotal(data: AppData): number {
  return Math.floor(Object.values(data.coinBonus ?? {}).reduce((a, b) => a + b, 0) + 1e-9);
}
