import { describe, expect, it } from 'vitest';
import { buildTodayQueue, nextReviewInfo, progressRing, reviewAllOrder, shuffled } from '../../src/core/today.ts';
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
    const v = Object.values(data.verses)[0];
    recordReview(data, v.id, at(day(2), '08:00'), DEVICE); // this week (Sunday to Saturday) is covered
    expect(nextReviewInfo(data, at(day(2), '09:00'))).toEqual({ kind: 'day', day: day(8), daysAway: 6 });
  });
});

describe('progressRing', () => {
  it('Daily, Weekly and Monthly show progress toward the next pile', () => {
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
    expect(progressRing(data, w, now).target).toBe(15);
    expect(progressRing(data, w, now).label).toBe('Week 2 of 15 toward Monthly'); // weeks 1 and 2 were reviewed
    expect(progressRing(data, m, now).target).toBe(6);
    expect(progressRing(data, m, now).label).toContain('toward Yearly');
  });

  it('Yearly is a finished, full ring with no target', () => {
    const data = newData();
    const y = john316(data, at(D0, '07:00'), { pile: 'yearly', pileSince: D0 });
    const r = progressRing(data, y, at(day(30)));
    expect(r).toMatchObject({ state: 'yearly', target: null, fraction: 1 });
  });

  it('a day without a review keeps the earned days and the ring simply waits (there is no frozen state)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(day(1), '09:00'), DEVICE); // one real progress day
    for (let i = 2; i <= 6; i++) settle(data, at(day(i), '09:00')); // five days with no review
    const r = progressRing(data, v, at(day(6), '09:00'));
    expect(r.state).toBe('progress');
    expect(r.earned).toBe(1);
    expect(r.label).toBe('Day 1 of 90 toward Weekly');
    recordReview(data, v.id, at(day(6), '09:30'), DEVICE); // reviewing adds the day at once
    expect(progressRing(data, v, at(day(6), '10:00')).earned).toBe(2);
  });
});

describe('shuffled (the order a session visits the verses in)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  it('is a permutation: every verse exactly once, nothing added or lost, and the original list is untouched', () => {
    for (const r of [() => 0, () => 0.999999, Math.random, () => 0.5]) {
      const out = shuffled(ids, r);
      expect([...out].sort()).toEqual([...ids].sort());
      expect(out).toHaveLength(ids.length);
    }
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
  it('is deterministic for a given random source, and actually reorders', () => {
    expect(shuffled(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    expect(shuffled(ids, () => 0)).toEqual(shuffled(ids, () => 0));
    let moved = 0;
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 20; k++) if (shuffled(ids, rng).join() !== ids.join()) moved++;
    expect(moved).toBeGreaterThan(15);
  });
  it('copes with nothing and with one verse', () => {
    expect(shuffled([])).toEqual([]);
    expect(shuffled(['only'])).toEqual(['only']);
  });
});

describe('reviewAllOrder (Review all starts with what has not been reviewed today)', () => {
  const setup = () => {
    const data = newData();
    const a = john316(data, at(D0, '07:00'));
    const b = john316(data, at(D0, '07:01'));
    const c = john316(data, at(D0, '07:02'));
    const d = john316(data, at(D0, '07:03'));
    recordReview(data, a.id, at(day(1), '08:00'), DEVICE); // a and c were reviewed today
    recordReview(data, c.id, at(day(1), '08:01'), DEVICE);
    return { data, a, b, c, d, now: at(day(1), '09:00') };
  };

  it('puts the verses not yet reviewed today first, then the ones that were, each keeping the pile order', () => {
    const { data, a, b, c, d, now } = setup();
    expect(reviewAllOrder(data, [a.id, b.id, c.id, d.id], now)).toEqual([b.id, d.id, a.id, c.id]);
  });

  it('shuffles inside each group only, so the unreviewed ones still come first', () => {
    const { data, a, b, c, d, now } = setup();
    const out = reviewAllOrder(data, [a.id, b.id, c.id, d.id], now, () => 0); // a fixed shuffle
    expect(new Set(out.slice(0, 2))).toEqual(new Set([b.id, d.id]));
    expect(new Set(out.slice(2))).toEqual(new Set([a.id, c.id]));
  });

  it('is the same order when nothing, or everything, has been reviewed today', () => {
    const { data, a, b, now } = setup();
    expect(reviewAllOrder(data, [b.id], now)).toEqual([b.id]);
    expect(reviewAllOrder(data, [a.id], now)).toEqual([a.id]);
    expect(reviewAllOrder(data, [], now)).toEqual([]);
  });

  it('counts only today: a review from yesterday does not push a verse back', () => {
    const { data, a, b } = setup();
    expect(reviewAllOrder(data, [a.id, b.id], at(day(2), '09:00'))).toEqual([a.id, b.id]);
  });
});
