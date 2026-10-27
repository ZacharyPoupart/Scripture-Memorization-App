import { describe, expect, it } from 'vitest';
import { daysBetween } from '../../src/core/dates.ts';
import { forgivenDays, FORGIVENESS_START, progressDays, settle, streakInfo } from '../../src/core/schedule.ts';
import { dayKind, heatmap, streakRuns } from '../../src/core/stats.ts';
import type { AppData, LedgerDay } from '../../src/core/types.ts';
import { at, john316, newData, reviewEverythingDue } from './helpers.ts';

/** A fresh account whose ledger is written by hand: 'c' complete, 'm' missed, 'n' nothing due. */
function withLedger(start: string, days: Record<string, 'c' | 'm' | 'n'>): AppData {
  const data = newData(start);
  john316(data, at(start, '09:00'));
  for (const [d, o] of Object.entries(days)) data.ledger[d] = { o } as LedgerDay;
  return data;
}

describe('streak forgiveness: one saved day a month', () => {
  it('starts on the day it shipped, and not before', () => {
    expect(FORGIVENESS_START).toBe('2026-10-28');
    const before = withLedger('2026-10-01', { '2026-10-20': 'c', '2026-10-21': 'c', '2026-10-22': 'm', '2026-10-23': 'c' });
    expect(forgivenDays(before, at('2026-10-24'))).toEqual([]);
    expect(streakInfo(before, at('2026-10-24')).count).toBe(1); // the old rule: the miss broke it
    const onTheDay = withLedger('2026-10-01', { '2026-10-26': 'c', '2026-10-27': 'c', '2026-10-28': 'm', '2026-10-29': 'c' });
    expect(forgivenDays(onTheDay, at('2026-10-30'))).toEqual(['2026-10-28']);
  });

  it('a missed day inside a live streak is saved: the streak carries on, and the saved day adds nothing', () => {
    const data = withLedger('2026-11-01', { '2026-11-02': 'c', '2026-11-03': 'c', '2026-11-04': 'm', '2026-11-05': 'c' });
    const now = at('2026-11-06', '12:00');
    expect(forgivenDays(data, now)).toEqual(['2026-11-04']);
    expect(streakInfo(data, now).count).toBe(3); // 2nd, 3rd and 5th: the saved day is not counted
    expect(data.ledger['2026-11-04'].o).toBe('m'); // the record itself is untouched: it is worked out, never stored
  });

  it('only the first miss each month is saved; a second one breaks the streak', () => {
    const data = withLedger('2026-11-01', {
      '2026-11-02': 'c', '2026-11-03': 'c', '2026-11-04': 'm', '2026-11-05': 'c', '2026-11-06': 'c', '2026-11-07': 'm', '2026-11-08': 'c',
    });
    const now = at('2026-11-09', '12:00');
    expect(forgivenDays(data, now)).toEqual(['2026-11-04']);
    expect(streakInfo(data, now).count).toBe(1);
  });

  it('a new month brings a new save', () => {
    const data = withLedger('2026-11-01', {
      '2026-11-28': 'c', '2026-11-29': 'c', '2026-11-30': 'm', '2026-12-01': 'c', '2026-12-02': 'm', '2026-12-03': 'c',
    });
    const now = at('2026-12-04', '12:00');
    expect(forgivenDays(data, now)).toEqual(['2026-11-30', '2026-12-02']);
    expect(streakInfo(data, now).count).toBe(4);
  });

  it('there has to be a streak to save: a miss with nothing behind it is not forgiven and the month’s save stays', () => {
    const data = withLedger('2026-11-01', { '2026-11-02': 'm', '2026-11-03': 'c', '2026-11-04': 'c', '2026-11-05': 'm', '2026-11-06': 'c' });
    const now = at('2026-11-07', '12:00');
    expect(forgivenDays(data, now)).toEqual(['2026-11-05']);
    expect(streakInfo(data, now).count).toBe(3);
  });

  it('days with nothing due are skipped as before, and a saved day does not lengthen the gap', () => {
    const data = withLedger('2026-11-01', { '2026-11-02': 'c', '2026-11-03': 'n', '2026-11-04': 'm', '2026-11-05': 'n', '2026-11-06': 'c' });
    expect(streakInfo(data, at('2026-11-07', '12:00')).count).toBe(2);
  });

  it('a real week: the saved day earns no progress day and no streak day, and the verse keeps its other days', () => {
    const data = newData('2026-11-01');
    const v = john316(data, at('2026-11-01', '07:00'));
    reviewEverythingDue(data, '2026-11-02');
    reviewEverythingDue(data, '2026-11-03');
    // nothing on the 4th
    reviewEverythingDue(data, '2026-11-05');
    const now = at('2026-11-06', '09:00');
    settle(data, now);
    expect(data.ledger['2026-11-04'].o).toBe('m');
    expect(forgivenDays(data, now)).toEqual(['2026-11-04']);
    expect(v.prog).not.toContain(daysBetween(v.pileSince, '2026-11-04'));
    expect(progressDays(data, v, now)).toBe(3);
    expect(streakInfo(data, now).count).toBe(3);
    expect(data.longestStreak).toBe(3);
  });

  it('shows up on the stats page as its own kind of day, and does not split the streak run', () => {
    const data = withLedger('2026-11-01', { '2026-11-02': 'c', '2026-11-03': 'c', '2026-11-04': 'm', '2026-11-05': 'c' });
    const now = at('2026-11-06', '12:00');
    expect(dayKind(data, '2026-11-04', new Set(forgivenDays(data, now)))).toBe('saved');
    expect(dayKind(data, '2026-11-04')).toBe('none'); // unchanged when nobody asks about saves
    expect(heatmap(data, now, 4).flat().find((c) => c.day === '2026-11-04')!.kind).toBe('saved');
    expect(streakRuns(data, now)).toEqual([{ start: '2026-11-02', end: '2026-11-05', length: 3 }]);
  });
});
