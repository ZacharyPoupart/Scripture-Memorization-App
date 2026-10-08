import { describe, expect, it } from 'vitest';
import { buildTodayQueue, nextReviewInfo, progressRing } from '../../src/core/today.ts';
import { recordReview, settle, todaySummary, streakInfo } from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData } from './helpers.ts';

describe('buildTodayQueue', () => {
  it('lists every ready verse across piles, Daily first, longest in pile first', () => {
    const data = newData();
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0, });
    const d1 = john316(data, at(D0, '07:00'));
    const d2 = john316(data, at(D0, '07:05'));
    const queue = buildTodayQueue(data, at(day(7), '09:00'));
    expect(queue).toEqual([d1.id, d2.id, w.id]);
  });

  it('respects the cooldown and the 3-a-day limit', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const d1 = day(1);
    recordReview(data, v.id, at(d1, '08:00'), DEVICE);
    expect(buildTodayQueue(data, at(d1, '09:00'))).toEqual([]); // 2h spacing not yet over
    expect(buildTodayQueue(data, at(d1, '10:00'))).toEqual([v.id]);
    recordReview(data, v.id, at(d1, '10:00'), DEVICE);
    recordReview(data, v.id, at(d1, '12:00'), DEVICE);
    expect(buildTodayQueue(data, at(d1, '20:00'))).toEqual([]); // three done
  });

  it('reviewing through the queue counts exactly like reviewing each verse on its own', () => {
    const make = () => {
      const data = newData();
      john316(data, at(D0, '07:00'));
      john316(data, at(D0, '07:01'));
      john316(data, at(D0, '07:02'), { pile: 'weekly', pileSince: D0 });
      john316(data, at(D0, '07:03'), { pile: 'monthly', pileSince: D0 });
      return data;
    };
    const now = at(day(40), '08:00');
    const viaQueue = make();
    settle(viaQueue, now);
    for (const id of buildTodayQueue(viaQueue, now)) recordReview(viaQueue, id, now, DEVICE);

    const single = make();
    settle(single, now);
    const ids = buildTodayQueue(single, now).reverse(); // a different order, one verse at a time
    for (const id of ids) recordReview(single, id, now, DEVICE);

    const strip = (d: typeof viaQueue) => ({
      reviews: Object.values(d.verses).map((v) => [v.pile, v.reviews]).sort(),
      ledger: d.ledger,
      per: d.reviewsByDevice,
    });
    expect(strip(viaQueue)).toEqual(strip(single));
    expect(todaySummary(viaQueue, now).outcome).toBe(todaySummary(single, now).outcome);
    expect(streakInfo(viaQueue, now).count).toBe(streakInfo(single, now).count);
  });
});

describe('nextReviewInfo', () => {
  it('says when a waiting Daily verse unlocks, otherwise tomorrow or the next due day', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(day(1), '08:00'), DEVICE);
    expect(nextReviewInfo(data, at(day(1), '09:00'))).toEqual({ kind: 'soon', waitMs: 3_600_000 });
    recordReview(data, v.id, at(day(1), '10:00'), DEVICE);
    recordReview(data, v.id, at(day(1), '12:00'), DEVICE);
    expect(nextReviewInfo(data, at(day(1), '13:00'))).toEqual({ kind: 'day', day: day(2), daysAway: 1 });
  });

  it('uses the due day of periodic piles and "none" when there are no verses', () => {
    expect(nextReviewInfo(newData(), at(D0))).toEqual({ kind: 'none' });
    const data = newData();
    john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    expect(nextReviewInfo(data, at(day(2), '09:00'))).toEqual({ kind: 'day', day: day(7), daysAway: 5 });
  });
});

describe('progressRing', () => {
  it('Daily, Weekly and Monthly show days earned toward the next pile', () => {
    const data = newData();
    const d = john316(data, at(D0, '07:00'));
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    const m = john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 });
    for (let i = 1; i <= 10; i++) { settle(data, at(day(i), '09:00')); recordReview(data, d.id, at(day(i), '09:00'), DEVICE); recordReview(data, w.id, at(day(i), '09:00'), DEVICE); }
    const now = at(day(10), '12:00');
    const rd = progressRing(data, d, now);
    expect(rd).toMatchObject({ state: 'progress', earned: 10, target: 90 });
    expect(rd.fraction).toBeCloseTo(10 / 90);
    expect(rd.label).toBe('Day 10 of 90 toward Weekly');
    expect(progressRing(data, w, now).target).toBe(90);
    expect(progressRing(data, m, now).target).toBe(365);
    expect(progressRing(data, m, now).label).toContain('toward Yearly');
  });

  it('Yearly is a finished, full ring with no target', () => {
    const data = newData();
    const y = john316(data, at(D0, '07:00'), { pile: 'yearly', pileSince: D0 });
    const r = progressRing(data, y, at(day(30)));
    expect(r).toMatchObject({ state: 'yearly', target: null, fraction: 1 });
  });

  it('a frozen day shows a calm paused ring that keeps the earned days', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(day(1), '09:00'), DEVICE); // one real progress day
    for (let i = 2; i <= 5; i++) settle(data, at(day(i), '09:00')); // days 2-4 lapse, day 5 frozen
    const r = progressRing(data, v, at(day(5), '09:00'));
    expect(r.state).toBe('frozen');
    expect(r.label).toMatch(/\(paused\)$/);
    expect(r.earned).toBeGreaterThan(0);
    // reviewing unfreezes
    recordReview(data, v.id, at(day(5), '09:30'), DEVICE);
    expect(progressRing(data, v, at(day(5), '10:00')).state).toBe('progress');
  });
});
