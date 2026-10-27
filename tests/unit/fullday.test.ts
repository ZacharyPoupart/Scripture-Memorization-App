import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup } from '../../src/core/backup.ts';
import { baseCoins, SEEDS_PER_DAY, SEEDS_PER_FULL_DAY } from '../../src/core/coins.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview, settle } from '../../src/core/schedule.ts';
import { dayKind, heatmap } from '../../src/core/stats.ts';
import { at, D0, day, DEVICE, john316, newData } from './helpers.ts';

/** One Daily verse added the day before: day 1 onwards it is due. */
function setup() {
  const data = newData();
  const v = john316(data, at(D0, '07:00'));
  return { data, v };
}

const review = (data: ReturnType<typeof newData>, v: { id: string }, dayKey: string, hm: string) => {
  const now = at(dayKey, hm);
  settle(data, now);
  return recordReview(data, v.id, now, DEVICE);
};

describe('full days: everything done all the way', () => {
  it('one review of everything keeps the streak and is "all done", but it is not a full day', () => {
    const { data, v } = setup();
    review(data, v, day(1), '09:00');
    settle(data, at(day(2), '08:00'));
    expect(data.ledger[day(1)]).toMatchObject({ o: 'c', r: 1 });
    expect(data.ledger[day(1)].f).toBeUndefined();
    expect(dayKind(data, day(1))).toBe('complete');
  });

  it('three reviews of every Daily verse make a full day, marked the moment the third is done', () => {
    const { data, v } = setup();
    review(data, v, day(1), '08:00');
    review(data, v, day(1), '10:30');
    expect(data.ledger[day(1)].f).toBeUndefined(); // two of three
    const r = review(data, v, day(1), '13:00');
    expect(r.todayComplete).toBe(true);
    expect(data.ledger[day(1)]).toMatchObject({ o: 'c', f: 1 }); // latched at once, not at midnight
    settle(data, at(day(2), '08:00'));
    expect(data.ledger[day(1)].f).toBe(1);
    expect(dayKind(data, day(1))).toBe('full');
  });

  it('a day worked out at midnight (nothing latched) is judged the same way', () => {
    const { data, v } = setup();
    for (const hm of ['08:00', '10:30', '13:00']) review(data, v, day(1), hm);
    delete data.ledger[day(1)].f; // as if this device never saw the third review land
    delete data.ledger[day(1)].o;
    data.settledThrough = day(0);
    settle(data, at(day(2), '08:00'));
    expect(data.ledger[day(1)]).toMatchObject({ o: 'c', f: 1 });
  });

  it('a Weekly verse that was ready and not reviewed stops the day from being full', () => {
    const data = newData();
    john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: '2026-01-03' }); // ready all week
    const d = john316(data, at(D0, '07:01'));
    for (const hm of ['08:00', '10:30', '13:00']) review(data, d, day(1), hm);
    settle(data, at(day(2), '08:00'));
    expect(data.ledger[day(1)].o).toBe('c');
    expect(data.ledger[day(1)].f).toBeUndefined();
  });

  it('a day with nothing due, or only extra practice, is never a full day', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    data.verses[v.id].pile = 'yearly'; // nothing due for ages
    settle(data, at(day(3), '08:00'));
    expect(Object.values(data.ledger).some((e) => e.f)).toBe(false);
    expect(dayKind(data, day(1))).toBe('none');
  });

  it('pays a little extra for a full day, once, and nothing for extra practice or an ordinary day', () => {
    expect(SEEDS_PER_FULL_DAY).toBe(10);
    const { data, v } = setup();
    review(data, v, day(1), '09:00');
    settle(data, at(day(2), '08:00'));
    const ordinary = baseCoins(data);
    for (const hm of ['08:00', '10:30', '13:00']) review(data, v, day(2), hm);
    const after = baseCoins(data);
    // day 2: three counted reviews (3) + the finished day (5) + the full day (3)
    expect(after - ordinary).toBe(3 + SEEDS_PER_DAY + SEEDS_PER_FULL_DAY);
    review(data, v, day(2), '16:00'); // extra practice
    expect(baseCoins(data)).toBe(after);
  });

  it('is only ever added: merging keeps a full day from either device, and a backup carries it', () => {
    const a = newData();
    const b = newData();
    a.ledger[day(1)] = { r: 1, o: 'c' };
    b.ledger[day(1)] = { r: 1, o: 'c', f: 1 };
    expect(mergeData(a, b).ledger[day(1)].f).toBe(1);
    expect(mergeData(b, a).ledger[day(1)].f).toBe(1);
    expect(mergeData(mergeData(a, b), b)).toEqual(mergeData(a, b));
    expect(parseBackup(exportBackup(b, '9.9.9', at(day(2)))).ledger[day(1)]).toEqual({ r: 1, o: 'c', f: 1 });
    expect(parseBackup(exportBackup(a, '9.9.9', at(day(2)))).ledger[day(1)].f).toBeUndefined();
  });

  it('shows on the stats page as the third, deepest shade', () => {
    const data = newData();
    data.ledger[day(1)] = { r: 1, o: 'c' };
    data.ledger[day(2)] = { r: 1, o: 'c', f: 1 };
    data.ledger[day(3)] = { r: 1, o: 'm' };
    expect(dayKind(data, day(1))).toBe('complete');
    expect(dayKind(data, day(2))).toBe('full');
    expect(dayKind(data, day(3))).toBe('practiced');
    expect(heatmap(data, at(day(4)), 4).flat().find((c) => c.day === day(2))!.kind).toBe('full');
  });
});

describe('older backups', () => {
  it('open without the flag, and a backup with full days keeps them', async () => {
    const { readFileSync } = await import('node:fs');
    const read = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');
    const old = parseBackup(read('backup-v1.1.0.json'));
    expect(Object.values(old.ledger).some((e) => e.f)).toBe(false);
    const data = parseBackup(read('backup-v1.57.0-fullday.json'));
    expect(data.ledger['2026-01-03'].f).toBe(1);
    expect(data.ledger['2026-01-05'].f).toBe(1);
    expect(data.ledger['2026-01-04'].f).toBeUndefined();
    expect(parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')))).toEqual(data);
  });
});
