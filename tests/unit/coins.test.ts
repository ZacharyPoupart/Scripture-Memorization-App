import { describe, expect, it } from 'vitest';
import { normalizeData } from '../../src/core/backup.ts';
import { seedsEarned } from '../../src/core/avatar.ts';
import { nextMultiplier, STREAK_MULTIPLIERS, streakMultiplier } from '../../src/core/coins.ts';
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

describe('coins earned with a streak', () => {
  function withStreak(days: number) {
    const d = newData();
    john316(d, at(D0, '07:00'));
    for (let i = 1; i <= days; i++) reviewEverythingDue(d, day(i));
    return d;
  }

  it('a review on a 7-day streak earns the extra quarter on its coin and on the finished day', () => {
    const d = withStreak(7);
    const bonusBefore = Object.values(d.coinBonus ?? {}).reduce((a, b) => a + b, 0);
    settle(d, at(day(8), '08:00'));
    recordReview(d, Object.keys(d.verses)[0], at(day(8), '08:00'), DEVICE);
    const bonus = Object.values(d.coinBonus ?? {}).reduce((a, b) => a + b, 0) - bonusBefore;
    expect(bonus).toBeCloseTo(1.5, 5); // 1 coin for the review + 5 for the finished day, a quarter more on each
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
