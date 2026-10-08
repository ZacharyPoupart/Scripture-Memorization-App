import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/core/dates.ts';
import { doneLine, isStreakMilestone, STREAK_MILESTONES, streakMilestoneId, streakMilestoneSize } from '../../src/core/milestones.ts';
import { settle, streakInfo } from '../../src/core/schedule.ts';
import { bestRuns, dayKind, heatmap, nextGraduations, pileCounts, streakRuns, totals } from '../../src/core/stats.ts';
import { at, D0, day, john316, newData, reviewEverythingDue } from './helpers.ts';

function dataWithHistory() {
  const data = newData();
  john316(data, at(D0, '07:00'));
  // days 1-5 complete, 6 missed, 7-9 complete
  for (const n of [1, 2, 3, 4, 5, 7, 8, 9]) reviewEverythingDue(data, day(n));
  settle(data, at(day(10), '09:00'));
  return data;
}

describe('streak history', () => {
  it('lists runs by the same rule as the live streak, and a missed day ends a run', () => {
    const data = dataWithHistory();
    const runs = streakRuns(data, at(day(10), '09:00'));
    expect(runs.map((r) => r.length)).toEqual([5, 3]);
    expect(runs[0]).toMatchObject({ start: day(1), end: day(5) });
    expect(runs[1]).toMatchObject({ start: day(7), end: day(9) });
    // consistent with the live number, which is the last run when it is still alive
    expect(streakInfo(data, at(day(10), '09:00')).count).toBe(3);
  });

  it('today counts only once it is complete; neutral days neither add nor end a run', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    settle(data, at(day(7), '09:00'));
    expect(streakRuns(data, at(day(7), '09:00'))).toEqual([]); // days 1-6 neutral, day 7 still open
    reviewEverythingDue(data, day(7));
    expect(v.reviews.length).toBe(1);
    const runs = streakRuns(data, at(day(7), '20:00'));
    expect(runs).toEqual([{ start: day(7), end: day(7), length: 1 }]);
  });

  it('bestRuns sorts longest first and ignores one-day runs', () => {
    const data = dataWithHistory();
    expect(bestRuns(data, at(day(10), '09:00')).map((r) => r.length)).toEqual([5, 3]);
    expect(bestRuns(data, at(day(10), '09:00'), 1)).toHaveLength(1);
  });
});

describe('calendar heatmap', () => {
  it('has the right shape: Sunday-first weeks ending with the week containing today', () => {
    const data = dataWithHistory();
    const now = at(day(10), '09:00'); // 2026-01-20, a Tuesday
    const cols = heatmap(data, now, 8);
    expect(cols).toHaveLength(8);
    expect(cols.every((c) => c.length === 7)).toBe(true);
    const last = cols[7];
    expect(new Date(`${last[0].day}T12:00:00Z`).getUTCDay()).toBe(0);
    expect(last.find((c) => c.day === day(10))).toBeTruthy();
    expect(last.filter((c) => c.future).map((c) => c.day)).toEqual([day(11), day(12), day(13), day(14)].filter((d) => d > day(10)));
  });

  it('shows complete and practiced days, and never marks a missed day differently from an empty one', () => {
    const data = dataWithHistory();
    expect(dayKind(data, day(2))).toBe('complete');
    expect(dayKind(data, day(6))).toBe('none'); // missed: no blame, same as nothing
    expect(dayKind(data, day(-30))).toBe('none');
    data.ledger[day(6)] = { r: 1, o: 'm' };
    expect(dayKind(data, day(6))).toBe('practiced');
    const cells = heatmap(data, at(day(10)), 4).flat();
    expect(cells.find((c) => c.day === day(3))!.kind).toBe('complete');
  });
});

describe('piles, totals and what is nearly there', () => {
  it('counts verses per pile and totals', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    john316(data, at(D0, '07:01'), { pile: 'weekly', pileSince: D0 });
    john316(data, at(D0, '07:02'), { pile: 'yearly', pileSince: D0 });
    expect(pileCounts(data).map((p) => `${p.pile}:${p.count}`)).toEqual(['daily:1', 'weekly:1', 'monthly:0', 'yearly:1']);
    for (const n of [1, 2]) reviewEverythingDue(data, day(n));
    const t = totals(data);
    expect(t.verses).toBe(3);
    expect(t.memorizedYearly).toBe(1);
    expect(t.daysPracticed).toBe(2);
    expect(t.completeDays).toBe(2);
    expect(t.reviews).toBeGreaterThan(0);
  });

  it('orders verses by how close they are to the next pile and skips Yearly', () => {
    const data = newData();
    const a = john316(data, at(D0, '07:00'));
    const b = john316(data, at(D0, '07:01'), { pileSince: addDays(D0, -50) });
    john316(data, at(D0, '07:02'), { pile: 'yearly', pileSince: D0 });
    for (let i = 1; i <= 5; i++) reviewEverythingDue(data, day(i));
    const list = nextGraduations(data, at(day(5), '20:00'));
    expect(list).toHaveLength(2);
    expect(list[0].verse.id).toBe(b.id);
    expect(list[0]).toMatchObject({ to: 'weekly', target: 90 });
    expect(list[0].remaining).toBeLessThan(list[1].remaining);
    expect(list[1].verse.id).toBe(a.id);
  });
});

describe('milestones', () => {
  it('are celebrated by size and have stable ids', () => {
    expect(STREAK_MILESTONES).toContain(7);
    expect(isStreakMilestone(1)).toBe(true); // day one gets a small celebration
    expect(streakMilestoneSize(1)).toBe('small');
    expect(isStreakMilestone(2)).toBe(false);
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(8)).toBe(false);
    expect(streakMilestoneSize(7)).toBe('small');
    expect(streakMilestoneSize(30)).toBe('medium');
    expect(streakMilestoneSize(365)).toBe('large');
    expect(streakMilestoneId(7, at(D0))).toBe(`streak:7:${D0}`);
  });
  it('encouraging copy rotates and never uses guilt', () => {
    const lines = new Set(Array.from({ length: 10 }, (_, i) => doneLine(i)));
    expect(lines.size).toBeGreaterThan(2);
    for (const l of lines) expect(l).not.toMatch(/miss|lose|lost|fail|behind|don't|streak at risk/i);
  });
});
