// "Take a break": while paused, nothing is due, nothing is missed, nothing freezes, the streak waits,
// and no progress days are earned. Reviewing anyway is welcome and counts as a normal day.
import { describe, expect, it } from 'vitest';
import { parseBackup, exportBackup, normalizeData } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import {
  endPause,
  isFrozen,
  isPaused,
  progressDays,
  recordReview,
  setPause,
  settle,
  streakInfo,
  todaySummary,
  verseStatus,
} from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

/** A verse that has a 5-day streak going into day 5. */
function withStreak() {
  const data = newData();
  const v = john316(data, at(D0, '07:00'));
  for (let i = 1; i <= 5; i++) reviewEverythingDue(data, day(i));
  return { data, v };
}

describe('pause: rules', () => {
  it('isPaused covers from..until inclusive and nothing else', () => {
    const data = newData();
    expect(isPaused(data, day(3))).toBe(false);
    setPause(data, day(3), day(5), at(day(3), '08:00'));
    expect([2, 3, 4, 5, 6].map((n) => isPaused(data, day(n)))).toEqual([false, true, true, true, false]);
  });

  it('the streak waits through a pause instead of breaking (and would have broken without one)', () => {
    const a = withStreak();
    settle(a.data, at(day(6), '08:00'));
    setPause(a.data, day(6), day(15), at(day(6), '08:00'));
    settle(a.data, at(day(16), '08:00'));
    expect(streakInfo(a.data, at(day(16), '08:00')).count).toBe(5);
    expect(a.data.ledger[day(10)]).toEqual({ o: 'n', p: 1 });

    const b = withStreak();
    settle(b.data, at(day(16), '08:00'));
    expect(streakInfo(b.data, at(day(16), '08:00')).count).toBe(0);
  });

  it('a pause is not a run of lapse days: no freeze afterwards', () => {
    const { data } = withStreak();
    setPause(data, day(6), day(15), at(day(6), '08:00'));
    settle(data, at(day(16), '08:00'));
    expect(isFrozen(data, at(day(16), '08:00'))).toBe(false);
    // ...whereas the same gap without a pause freezes
    const b = withStreak();
    settle(b.data, at(day(16), '08:00'));
    expect(isFrozen(b.data, at(day(16), '08:00'))).toBe(true);
  });

  it('no progress days are earned while paused, so nothing graduates on holiday', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pileSince: D0 });
    for (let i = 1; i <= 80; i++) reviewEverythingDue(data, day(i));
    expect(progressDays(data, v, at(day(80), '20:00'))).toBe(80);
    setPause(data, day(81), day(120), at(day(81), '08:00'));
    settle(data, at(day(121), '09:00'));
    expect(v.pile).toBe('daily');
    // 40 paused days added nothing; only day 121 (today, a normal day again) counts on top of the earlier 80
    expect(progressDays(data, v, at(day(100), '09:00'))).toBe(80);
    expect(progressDays(data, v, at(day(121), '09:00'))).toBe(81);
    reviewEverythingDue(data, day(122));
    expect(progressDays(data, v, at(day(122), '20:00'))).toBe(82);
  });

  it('today is "nothing due" while paused, but reviewing anyway counts and earns the flame', () => {
    const { data, v } = withStreak();
    const now = at(day(6), '09:00');
    settle(data, now);
    expect(todaySummary(data, now).total).toBe(1);
    setPause(data, day(6), day(10), now);
    expect(todaySummary(data, now).total).toBe(0);
    expect(todaySummary(data, now).outcome).toBe('n');
    expect(streakInfo(data, now).atRisk).toBe(false);
    expect(recordReview(data, v.id, now, DEVICE).counted).toBe(true); // still a normal counted review
    expect(todaySummary(data, now).outcome).toBe('c');
    expect(streakInfo(data, now).count).toBe(6);
  });

  it('a partly-reviewed paused day never breaks the streak', () => {
    const data = newData();
    const a = john316(data, at(D0, '07:00'));
    john316(data, at(D0, '07:01'));
    reviewEverythingDue(data, day(1));
    setPause(data, day(2), day(3), at(day(2), '08:00'));
    recordReview(data, a.id, at(day(2), '09:00'), DEVICE); // only one of two verses
    settle(data, at(day(4), '08:00'));
    expect(data.ledger[day(2)].o).not.toBe('m');
    expect(streakInfo(data, at(day(4), '08:00')).count).toBeGreaterThanOrEqual(1);
  });

  it('ending a pause early restores normal obligations from that day on', () => {
    const { data } = withStreak();
    const now6 = at(day(6), '09:00');
    setPause(data, day(6), day(20), now6);
    settle(data, at(day(8), '09:00'));
    endPause(data, at(day(8), '09:00'));
    expect(isPaused(data, day(8))).toBe(false);
    expect(isPaused(data, day(7))).toBe(true);
    expect(todaySummary(data, at(day(8), '09:00')).total).toBe(1);
    // days 6 and 7 stay neutral, day 8 is a normal day
    settle(data, at(day(9), '09:00'));
    expect(data.ledger[day(8)].o).toBe('m');
  });

  it('verses stay available to review during a pause', () => {
    const { data, v } = withStreak();
    setPause(data, day(6), day(10), at(day(6), '08:00'));
    expect(verseStatus(data, v, at(day(7), '09:00')).state).toBe('ready');
  });
});

describe('pause: sync and backup', () => {
  it('merge keeps the later pause decision and unions paused days; stays commutative/associative/idempotent', () => {
    const base = newData();
    john316(base, at(D0, '07:00'));
    const a = structuredClone(base);
    const b = structuredClone(base);
    const c = structuredClone(base);
    setPause(a, day(1), day(7), at(day(1), '08:00'));
    setPause(b, day(1), day(14), at(day(1), '09:00')); // later decision wins
    a.ledger[day(1)] = { o: 'n', p: 1 };
    const m = mergeData(a, b);
    expect(m.pause?.until).toBe(day(14));
    expect(mergeData(b, a)).toEqual(m);
    expect(mergeData(m, m)).toEqual(m);
    expect(m.ledger[day(1)].p).toBe(1);
    expect(mergeData(mergeData(a, b), c)).toEqual(mergeData(a, mergeData(b, c)));
  });

  it('export → import round trip keeps the pause and paused days; garbage pause values are dropped', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    setPause(data, day(1), day(4), at(day(1), '08:00'));
    settle(data, at(day(6), '08:00'));
    const back = parseBackup(exportBackup(data, '9.9.9', at(day(6))));
    expect(back).toEqual(data);
    expect(back.ledger[day(2)].p).toBe(1);
    const bad = JSON.parse(JSON.stringify(data));
    bad.pause = { from: 'yesterday', until: 5, at: 'x' };
    expect(normalizeData(bad).pause).toBeUndefined();
  });
});
