import { describe, expect, it } from 'vitest';
import { normalizeData } from '../../src/core/backup.ts';
import { seedsEarned } from '../../src/core/avatar.ts';
import { nextMultiplier, rollBonus, STREAK_MULTIPLIERS, streakMultiplier } from '../../src/core/coins.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview, settle } from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

describe('the streak multiplier', () => {
  it('grows with the streak: 1x to 2 days, 1.1x from 3, 1.25x from 7, 1.5x from 14, 1.75x from 30, 2x from 100, 3x from a year', () => {
    const at_ = (n: number) => streakMultiplier(n);
    expect([0, 1, 2].map(at_)).toEqual([1, 1, 1]);
    expect([3, 6].map(at_)).toEqual([1.1, 1.1]);
    expect([7, 13].map(at_)).toEqual([1.25, 1.25]);
    expect([14, 29].map(at_)).toEqual([1.5, 1.5]);
    expect([30, 99].map(at_)).toEqual([1.75, 1.75]);
    expect([100, 364].map(at_)).toEqual([2, 2]); // never more than 2x until a full year
    expect([365, 5000].map(at_)).toEqual([3, 3]);
    expect(STREAK_MULTIPLIERS.map((m) => m.days)).toEqual([...STREAK_MULTIPLIERS.map((m) => m.days)].sort((a, b) => a - b));
  });
});

describe('the coins guide', () => {
  it('says what the next step of the multiplier is, and when there are no more', () => {
    expect(nextMultiplier(0)).toEqual({ days: 3, x: 1.1 });
    expect(nextMultiplier(3)).toEqual({ days: 7, x: 1.25 });
    expect(nextMultiplier(13)).toEqual({ days: 14, x: 1.5 });
    expect(nextMultiplier(99)).toEqual({ days: 100, x: 2 });
    expect(nextMultiplier(100)).toEqual({ days: 365, x: 3 });
    expect(nextMultiplier(365)).toBeNull();
    expect(nextMultiplier(900)).toBeNull();
  });
});

describe('the left-over part of a coin is a chance, not a fraction', () => {
  it('always gives the whole coins, and the leftover as that chance of one more', () => {
    expect(rollBonus(0.3, () => 0.29)).toBe(1);
    expect(rollBonus(0.3, () => 0.3)).toBe(0);
    expect(rollBonus(1.5, () => 0)).toBe(2);
    expect(rollBonus(1.5, () => 0.999)).toBe(1);
    expect(rollBonus(2, () => 0.999)).toBe(2); // nothing left over, nothing to roll
    expect(rollBonus(0, () => 0)).toBe(0);
    expect(rollBonus(0.1 * 3, () => 0.2999)).toBe(1); // 0.30000000000000004 behaves as 0.3
    expect(rollBonus(0.1 * 3, () => 0.3)).toBe(0);
  });

  it('pays out the fraction on average (30% chance, 20000 tries: about 6000 coins)', () => {
    let seed = 12345;
    const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    let total = 0;
    for (let i = 0; i < 20000; i++) total += rollBonus(0.3, rng);
    expect(total).toBeGreaterThan(5700);
    expect(total).toBeLessThan(6300);
  });
});

describe('coins earned with a streak', () => {
  function withStreak(days: number) {
    const d = newData();
    john316(d, at(D0, '07:00'));
    for (let i = 1; i <= days; i++) reviewEverythingDue(d, day(i));
    return d;
  }

  const bonusOf = (d: ReturnType<typeof newData>) => Object.values(d.coinBonus ?? {}).reduce((a, b) => a + b, 0);

  it('a review on a 7-day streak earns the whole coins of its quarter extra, and a chance at the part left over', () => {
    // 1 coin for the review + 5 for the finished day = 6, a quarter more is 1.5: one coin for sure, the other half a coin is a 50% chance
    for (const [roll, expected] of [[0, 2], [0.49, 2], [0.5, 1], [0.99, 1]] as const) {
      const d = withStreak(7);
      const before = bonusOf(d);
      settle(d, at(day(8), '08:00'));
      const r = recordReview(d, Object.keys(d.verses)[0], at(day(8), '08:00'), DEVICE, () => roll);
      expect(bonusOf(d) - before).toBe(expected);
      expect(r.bonus).toBe(expected);
    }
  });

  it('tells the screen what the review earned before the multiplier and what the multiplier was', () => {
    const d = withStreak(7);
    settle(d, at(day(8), '08:00'));
    const r = recordReview(d, Object.keys(d.verses)[0], at(day(8), '08:00'), DEVICE);
    expect(r.base).toBe(6); // 1 for the review + 5 for the finished day
    expect(r.multiplier).toBe(1.25);
    const none = newData();
    const v = john316(none, at(D0, '07:00'));
    const first = recordReview(none, v.id, at(day(1), '08:00'), DEVICE);
    expect(first.multiplier).toBe(1);
    const extra = recordReview(none, v.id, at(day(1), '08:01'), DEVICE); // too soon: extra practice
    expect(extra.counted).toBe(false);
    expect(extra.base).toBe(0);
    expect(extra.multiplier).toBe(1);
  });

  it('earns nothing extra with no streak yet', () => {
    const d = newData();
    const v = john316(d, at(D0, '07:00'));
    recordReview(d, v.id, at(day(1), '08:00'), DEVICE);
    expect(d.coinBonus ?? {}).toEqual({});
  });

  it('adds whole coins to what you have earned, never taking any away', () => {
    const d = withStreak(7);
    delete d.coinBonus;
    const base = seedsEarned(d);
    d.coinBonus = { 'dev-x': 12.75 };
    expect(seedsEarned(d)).toBe(base + 12);
  });

  it('is kept by merging (largest per device) and by backups, which ignore anything that is not a number', () => {
    const a = newData();
    const b = newData();
    a.coinBonus = { 'dev-a': 3.5, 'dev-b': 1 };
    b.coinBonus = { 'dev-a': 2, 'dev-b': 4, 'dev-c': 0.5 };
    expect(mergeData(a, b).coinBonus).toEqual({ 'dev-a': 3.5, 'dev-b': 4, 'dev-c': 0.5 });
    expect(mergeData(b, a)).toEqual(mergeData(a, b));
    const raw = JSON.parse(JSON.stringify(a));
    raw.coinBonus = { 'dev-a': 3.5, bad: 'x', neg: -2, big: 1e12, __proto__: 5 };
    expect(normalizeData(raw).coinBonus).toEqual({ 'dev-a': 3.5 });
    raw.coinBonus = 'nope';
    expect(normalizeData(raw).coinBonus).toBeUndefined();
  });
});
