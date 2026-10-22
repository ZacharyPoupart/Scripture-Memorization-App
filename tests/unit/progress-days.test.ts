// Progress toward the next pile (v1.33.0, owner-requested): a verse only earns a progress day when it is up to date that day.
// Daily: it got a counted review that day. Weekly / Monthly: it is not overdue (or was reviewed that day). There is no freeze.
// What a verse had already earned under the old rule is kept.
import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import { addDays } from '../../src/core/dates.ts';
import {
  addVerse,
  dueDay,
  movePile,
  progressDays,
  recordReview,
  restorePile,
  setPause,
  settle,
  streakInfo,
  todaySummary,
} from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

const input = { book: 43, chapter: 3, start: 16, end: 16, translation: 'ESV', text: 'For God so loved the world, that he gave his only Son.' };

describe('progress days: a day counts when the verse is up to date', () => {
  it('Daily: only days with a counted review count, and missed days simply do not (no freeze, nothing is lost)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 10; i++) if (i !== 4 && i !== 5) reviewEverythingDue(data, day(i));
    expect(progressDays(data, v, at(day(10), '20:00'))).toBe(8);
  });

  it('a long silence earns nothing, loses nothing, and the next review simply counts again', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 20; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(80), '09:00')); // 59 quiet days
    expect(progressDays(data, v, at(day(80), '09:00'))).toBe(20);
    expect(v.pile).toBe('daily');
    reviewEverythingDue(data, day(80));
    expect(progressDays(data, v, at(day(80), '20:00'))).toBe(21);
    reviewEverythingDue(data, day(81));
    expect(progressDays(data, v, at(day(81), '20:00'))).toBe(22);
  });

  it('one counted review is enough for a Daily day; extra practice does not count', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(day(1), '08:00'), DEVICE); // one of three
    expect(progressDays(data, v, at(day(1), '20:00'))).toBe(1);
    const w = john316(data, at(D0, '07:00'));
    for (let i = 0; i < 3; i++) recordReview(data, w.id, at(day(1), `1${i}:00`), DEVICE); // three counted
    for (let i = 0; i < 2; i++) recordReview(data, w.id, at(day(2), `1${i}:00`), DEVICE);
    expect(progressDays(data, w, at(day(2), '20:00'))).toBe(2);
    // a fresh verse that was only practised extra (not yet ready) earns nothing: nothing was counted that day
    const p = john316(data, at(day(5), '07:00'));
    expect(progressDays(data, p, at(day(5), '20:00'))).toBe(0); // added today: day 0 of its pile
  });

  it('Weekly: a review any day of the week (Sunday to Saturday) earns the whole week; a missed week earns nothing', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    reviewEverythingDue(data, day(3)); // week 1 (days 1-7), reviewed midweek
    settle(data, at(day(20), '09:00')); // week 2 (days 8-14) was never reviewed; today (day 20) is in week 3
    expect(progressDays(data, v, at(day(20), '09:00'))).toBe(7);
    reviewEverythingDue(data, day(20)); // week 3 is days 15-21: all seven count at once
    expect(progressDays(data, v, at(day(20), '20:00'))).toBe(14);
    expect(dueDay(v, day(20))).toBe(day(22)); // good until next Sunday
  });

  it('Weekly on schedule earns 7 days a week, so the 13th week reaches 90', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    for (let i = 1; i <= 84; i++) reviewEverythingDue(data, day(i));
    expect(v.pile).toBe('weekly');
    expect(progressDays(data, v, at(day(84), '23:00'))).toBe(84);
    reviewEverythingDue(data, day(85)); // Sunday of week 13
    expect(v.pile).toBe('monthly');
    expect(v.pileSince).toBe(day(85));
  });

  it('Monthly: a review any day of the calendar month earns the whole month; the month it arrived in is free', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 });
    settle(data, at(day(40), '09:00')); // January was the arrival month and nothing was reviewed in February yet
    expect(progressDays(data, v, at(day(40), '09:00'))).toBe(0);
    reviewEverythingDue(data, day(40)); // Feb 19: all 28 days of February
    expect(progressDays(data, v, at(day(40), '20:00'))).toBe(28);
  });
});

describe('graduation under the new rule', () => {
  it('a Daily verse graduates on the review that earns its 90th day, with the level-up reported right then', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 89; i++) reviewEverythingDue(data, day(i));
    expect(v.pile).toBe('daily');
    settle(data, at(day(90), '00:05')); // day 90 has not been reviewed yet: it cannot have counted
    expect(v.pile).toBe('daily');
    const r = recordReview(data, v.id, at(day(90), '09:00'), DEVICE);
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(day(90));
    expect(r.levelUps).toEqual([{ id: `${v.id}:weekly:${day(90)}`, verseId: v.id, from: 'daily', to: 'weekly', day: day(90) }]);
  });

  it('missed days push graduation later: 89 earned days, a skipped day, graduates on the next review', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 89; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(91), '08:00')); // day 90 passed with no review
    expect(v.pile).toBe('daily');
    expect(progressDays(data, v, at(day(91), '08:00'))).toBe(89);
    recordReview(data, v.id, at(day(91), '09:00'), DEVICE);
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(day(91));
  });

  it('a level-up is only ever reported once, however often the days are settled', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 90; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(95), '09:00'));
    settle(data, at(day(95), '09:00'));
    expect(data.levelUps.filter((l) => l.verseId === v.id)).toHaveLength(1);
  });
});

describe('a break earns nothing unless you review anyway', () => {
  it('paused days add no progress for Daily or Weekly, and nothing is lost', () => {
    const data = newData();
    const d = john316(data, at(D0, '07:00'));
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    for (let i = 1; i <= 10; i++) reviewEverythingDue(data, day(i));
    setPause(data, day(11), day(20), at(day(11), '08:00'));
    settle(data, at(day(21), '09:00'));
    expect(progressDays(data, d, at(day(21), '09:00'))).toBe(10);
    expect(progressDays(data, w, at(day(21), '09:00'))).toBe(14); // weeks 1 and 2 were reviewed before the break; week 3 was all break
    reviewEverythingDue(data, day(21));
    expect(progressDays(data, w, at(day(21), '20:00'))).toBe(21); // reviewing anyway earns its week
    expect(progressDays(data, d, at(day(21), '20:00'))).toBe(11);
  });

  it('reviewing on a paused day counts as a normal day', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 3; i++) reviewEverythingDue(data, day(i));
    setPause(data, day(4), day(6), at(day(4), '08:00'));
    reviewEverythingDue(data, day(5)); // reviewed anyway
    settle(data, at(day(7), '09:00'));
    expect(progressDays(data, v, at(day(7), '09:00'))).toBe(4);
  });
});

describe('start partway and moves', () => {
  it('days claimed when adding or moving are credited at once; after that each day has to be earned', () => {
    const data = newData();
    const v = addVerse(data, { ...input, daysInPile: 60 }, at(D0, '08:00'));
    expect(progressDays(data, v, at(D0, '09:00'))).toBe(60);
    settle(data, at(day(1), '09:00'));
    expect(progressDays(data, v, at(day(1), '09:00'))).toBe(60); // day 1 not reviewed yet
    reviewEverythingDue(data, day(1));
    expect(progressDays(data, v, at(day(1), '20:00'))).toBe(61);
    settle(data, at(day(2), '09:00')); // the app always settles the days before a move
    const m = movePile(data, v.id, 'weekly', at(day(2), '09:00'), 45);
    expect(progressDays(data, v, at(day(2), '09:00'))).toBe(50); // 45 claimed, plus this week (Sunday day 1 was reviewed, so the week counts)
    restorePile(data, v.id, m, at(day(2), '09:01'));
    expect(v.pile).toBe('daily');
    expect(progressDays(data, v, at(day(2), '09:02'))).toBe(61); // undo gives back exactly what it had
  });

  it('a plain move restarts progress at zero', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 10; i++) reviewEverythingDue(data, day(i));
    movePile(data, v.id, 'weekly', at(day(10), '15:00'));
    expect(progressDays(data, v, at(day(10), '16:00'))).toBe(0);
  });
});

describe('progress already earned before this rule is kept', () => {
  it('verses saved by an older version are filled in once from the ledger with the old rule, and then go on from there', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    for (let i = 2; i <= 30; i++) settle(data, at(day(i), '09:00')); // silence: the old rule counted days 1-4, then froze
    delete v.prog; // what an older version saved
    expect(progressDays(data, v, at(day(30), '10:00'))).toBe(4 + (0)); // read straight from the ledger, nothing stored yet
    settle(data, at(day(30), '10:00'));
    expect(v.prog).toEqual([1, 2, 3, 4]);
    expect(progressDays(data, v, at(day(30), '10:00'))).toBe(4);
    reviewEverythingDue(data, day(31));
    expect(progressDays(data, v, at(day(31), '20:00'))).toBe(5);
  });

  it('a verse that had earned 89 days under the old rule is not set back', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 89; i++) reviewEverythingDue(data, day(i));
    delete v.prog;
    settle(data, at(day(89), '23:00'));
    expect(progressDays(data, v, at(day(89), '23:30'))).toBe(89);
  });
});

describe('merging progress between devices', () => {
  const base = () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    return { data, v };
  };
  it('in the same pile the earned days are joined, so no device loses a day', () => {
    const { data, v } = base();
    const a = structuredClone(data);
    const b = structuredClone(data);
    a.verses[v.id].prog = [1, 2, 3, 5];
    b.verses[v.id].prog = [2, 3, 4];
    const ab = mergeData(a, b);
    expect(ab.verses[v.id].prog).toEqual([1, 2, 3, 4, 5]);
    expect(mergeData(b, a)).toEqual(ab);
    expect(mergeData(ab, ab)).toEqual(ab);
  });
  it('after a move the newer pile and its own progress win', () => {
    const { data, v } = base();
    const a = structuredClone(data);
    const b = structuredClone(data);
    a.verses[v.id].prog = [1, 2, 3];
    movePile(b, v.id, 'weekly', at(day(5), '09:00'));
    const merged = mergeData(a, b);
    expect(merged.verses[v.id].pile).toBe('weekly');
    expect(merged.verses[v.id].prog).toEqual([]);
    expect(mergeData(b, a)).toEqual(merged);
  });
  it('is associative', () => {
    const { data, v } = base();
    const [a, b, c] = [1, 2, 3].map(() => structuredClone(data));
    a.verses[v.id].prog = [1, 2];
    b.verses[v.id].prog = [2, 3];
    c.verses[v.id].prog = [9];
    expect(mergeData(mergeData(a, b), c)).toEqual(mergeData(a, mergeData(b, c)));
  });
  it('a copy from an older version (no progress list) merges without losing the newer one', () => {
    const { data, v } = base();
    const a = structuredClone(data);
    const b = structuredClone(data);
    a.verses[v.id].prog = [1, 2];
    delete b.verses[v.id].prog;
    expect(mergeData(a, b).verses[v.id].prog).toEqual([1, 2]);
    expect(mergeData(b, a)).toEqual(mergeData(a, b));
  });
});

describe('saving and importing progress', () => {
  it('survives a backup round trip, and bad lists are cleaned instead of crashing', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 5; i++) reviewEverythingDue(data, day(i));
    expect(v.prog).toEqual([1, 2, 3, 4]); // day 5 is only added once it is over
    expect(parseBackup(exportBackup(data, '9.9.9', 0))).toEqual(data);
    const bad = JSON.parse(JSON.stringify(data));
    bad.verses[v.id].prog = [3, 'x', -4, 2.5, 3, 1e9, null, 1];
    expect(normalizeData(bad).verses[v.id].prog).toEqual([1, 3]);
    bad.verses[v.id].prog = 'nope';
    expect(normalizeData(bad).verses[v.id].prog).toBeUndefined();
  });
  it('an old backup with no progress lists still loads', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    delete v.prog;
    expect(normalizeData(JSON.parse(JSON.stringify(data))).verses[v.id].prog).toBeUndefined();
  });
});

describe('the pile start day is never a progress day', () => {
  it('a verse added today has no progress, and tomorrow is the first day that can count', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(D0, '08:00'), DEVICE);
    expect(progressDays(data, v, at(D0, '09:00'))).toBe(0);
    reviewEverythingDue(data, day(1));
    expect(progressDays(data, v, at(day(1), '20:00'))).toBe(1);
    expect(addDays(D0, 1)).toBe(day(1));
  });
});

describe('Weekly and Monthly are due on the last day of the week or month', () => {
  it('an unreviewed Weekly verse only breaks the streak on Saturday, and the week earns nothing', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 }); // D0 is a Saturday: that week is free
    settle(data, at(day(7), '09:00'));
    expect(data.ledger[day(3)]?.o).toBe('n'); // open all week, nothing is missed midweek
    expect(todaySummary(data, at(day(7), '09:00')).outcome).toBe('pending'); // Saturday: it is due today
    expect(todaySummary(data, at(day(3), '09:00')).outcome).toBe('n');
    settle(data, at(day(9), '09:00'));
    expect(data.ledger[day(7)]?.o).toBe('m'); // Saturday midnight passed with it undone
    expect(streakInfo(data, at(day(9), '09:00')).count).toBe(0);
    expect(progressDays(data, v, at(day(9), '09:00'))).toBe(0); // the missed week never counts, even when reviewed later
    reviewEverythingDue(data, day(9));
    expect(progressDays(data, v, at(day(9), '20:00'))).toBe(7); // only the new week (days 8-14)
  });

  it('reviewing any day of the week keeps Saturday clear', () => {
    const data = newData();
    john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    reviewEverythingDue(data, day(3));
    settle(data, at(day(9), '09:00'));
    expect(data.ledger[day(3)]?.o).toBe('c');
    expect(data.ledger[day(7)]?.o).toBe('n');
    expect(streakInfo(data, at(day(9), '09:00')).count).toBe(1);
  });

  it('Monthly is due on the last day of the month', () => {
    const data = newData();
    john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 }); // January is the free month
    settle(data, at(day(60), '09:00')); // Feb 28 is day 49
    expect(data.ledger[day(30)]?.o).toBe('n'); // midway through February
    expect(data.ledger[day(49)]?.o).toBe('m');
  });
});
