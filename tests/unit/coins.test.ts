import { describe, expect, it } from 'vitest';
import { normalizeData } from '../../src/core/backup.ts';
import { seedsEarned } from '../../src/core/avatar.ts';
import { STREAK_MULTIPLIERS, streakMultiplier } from '../../src/core/coins.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview, settle } from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

describe('the streak multiplier', () => {
  it('grows with the streak: 1x to 2 days, 1.2x from 3, 1.5x from 7, 2x from 14, 2.5x from 30, 3x from 100', () => {
    const at_ = (n: number) => streakMultiplier(n);
    expect([0, 1, 2].map(at_)).toEqual([1, 1, 1]);
    expect([3, 6].map(at_)).toEqual([1.2, 1.2]);
    expect([7, 13].map(at_)).toEqual([1.5, 1.5]);
    expect([14, 29].map(at_)).toEqual([2, 2]);
    expect([30, 99].map(at_)).toEqual([2.5, 2.5]);
    expect([100, 365, 5000].map(at_)).toEqual([3, 3, 3]);
    expect(STREAK_MULTIPLIERS.map((m) => m.days)).toEqual([...STREAK_MULTIPLIERS.map((m) => m.days)].sort((a, b) => a - b));
  });
});

describe('coins earned with a streak', () => {
  function withStreak(days: number) {
    const d = newData();
    john316(d, at(D0, '07:00'));
    for (let i = 1; i <= days; i++) reviewEverythingDue(d, day(i));
    return d;
  }

  it('a review on a 7-day streak earns the extra half on its coin and on the finished day', () => {
    const d = withStreak(7);
    const bonusBefore = Object.values(d.coinBonus ?? {}).reduce((a, b) => a + b, 0);
    settle(d, at(day(8), '08:00'));
    recordReview(d, Object.keys(d.verses)[0], at(day(8), '08:00'), DEVICE);
    const bonus = Object.values(d.coinBonus ?? {}).reduce((a, b) => a + b, 0) - bonusBefore;
    expect(bonus).toBeCloseTo(3, 5); // 1 coin for the review + 5 for the finished day, 0.5 more on each
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
