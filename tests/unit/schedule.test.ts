import { describe, expect, it } from 'vitest';
import { dayKeyOf } from '../../src/core/dates.ts';
import {
  daysInPile,
  dueDay,
  easierPile,
  previousPile,
  periodEnd,
  periodStart,
  movePile,
  pileVerses,
  progressDays,
  recordReview,
  restorePile,
  settle,
  streakInfo,
  todaySummary,
  verseStatus,
  deleteVerse,
} from '../../src/core/schedule.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

const hour = 3_600_000;

describe('Daily pile: 3 reviews a day with spacing', () => {
  it('a new verse starts in Daily, is ready, and is not required today', () => {
    const data = newData();
    const v = john316(data, at(D0, '09:00'));
    expect(v.pile).toBe('daily');
    const s = verseStatus(data, v, at(D0, '09:01'));
    expect(s.state).toBe('ready');
    expect(s.required).toBe(false);
    expect(todaySummary(data, at(D0, '09:01')).total).toBe(0);
  });

  it('requires spacing between counted reviews and stops at three', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const d1 = day(1);
    expect(recordReview(data, v.id, at(d1, '08:00'), DEVICE).counted).toBe(true);

    let s = verseStatus(data, v, at(d1, '09:00'));
    expect(s.state).toBe('waiting');
    expect(s.waitMs).toBe(1 * hour);
    expect(s.countedToday).toBe(1);

    // 59 minutes later is still too early; exactly 2h is fine.
    expect(verseStatus(data, v, at(d1, '09:59')).state).toBe('waiting');
    expect(verseStatus(data, v, at(d1, '10:00')).state).toBe('ready');

    recordReview(data, v.id, at(d1, '10:00'), DEVICE);
    expect(verseStatus(data, v, at(d1, '11:00')).state).toBe('waiting');
    recordReview(data, v.id, at(d1, '12:00'), DEVICE);
    s = verseStatus(data, v, at(d1, '20:00'));
    expect(s.state).toBe('done');
    expect(s.countedToday).toBe(3);
  });

  it('extra practice is allowed but never counted', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const d1 = day(1);
    recordReview(data, v.id, at(d1, '08:00'), DEVICE);
    const r = recordReview(data, v.id, at(d1, '08:30'), DEVICE); // too soon
    expect(r.counted).toBe(false);
    expect(v.reviews).toHaveLength(1);
    expect(verseStatus(data, v, at(d1, '09:00')).countedToday).toBe(1);
    // and practising a finished verse changes nothing either
    recordReview(data, v.id, at(d1, '10:00'), DEVICE);
    recordReview(data, v.id, at(d1, '12:00'), DEVICE);
    expect(recordReview(data, v.id, at(d1, '13:00'), DEVICE).counted).toBe(false);
    expect(v.reviews).toHaveLength(3);
  });

  it('the spacing setting is respected', () => {
    const data = newData();
    data.prefs.value.spacingHours = 4;
    const v = john316(data, at(D0, '07:00'));
    recordReview(data, v.id, at(day(1), '08:00'), DEVICE);
    expect(verseStatus(data, v, at(day(1), '11:59')).state).toBe('waiting');
    expect(verseStatus(data, v, at(day(1), '12:00')).state).toBe('ready');
  });

  it('supports no wait, 30 minutes and custom minute values', () => {
    const none = newData();
    none.prefs.value.spacingHours = 0;
    const a = john316(none, at(D0, '07:00'));
    expect(recordReview(none, a.id, at(day(1), '08:00'), DEVICE).counted).toBe(true);
    expect(verseStatus(none, a, at(day(1), '08:00')).state).toBe('ready');
    expect(recordReview(none, a.id, at(day(1), '08:00'), DEVICE).counted).toBe(true);

    const half = newData();
    half.prefs.value.spacingHours = 0.5;
    const b = john316(half, at(D0, '07:00'));
    recordReview(half, b.id, at(day(1), '08:00'), DEVICE);
    expect(verseStatus(half, b, at(day(1), '08:29')).state).toBe('waiting');
    expect(verseStatus(half, b, at(day(1), '08:30')).state).toBe('ready');

    const custom = newData();
    custom.prefs.value.spacingHours = 45 / 60;
    const c = john316(custom, at(D0, '07:00'));
    recordReview(custom, c.id, at(day(1), '08:00'), DEVICE);
    expect(verseStatus(custom, c, at(day(1), '08:44')).state).toBe('waiting');
    expect(verseStatus(custom, c, at(day(1), '08:45')).state).toBe('ready');
  });

  it('counts reset at local midnight (reviews at 23:59 and 00:01 are different days)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const d1 = day(1);
    recordReview(data, v.id, at(d1, '23:59'), DEVICE);
    const s = verseStatus(data, v, at(day(2), '00:01'));
    expect(s.countedToday).toBe(0);
    expect(s.state).toBe('ready'); // no waiting across midnight
  });
});

describe('Weekly / Monthly / Yearly due dates', () => {
  it('weekly follows the calendar week (Sunday to Saturday); the week it arrives in is free', () => {
    const data = newData();
    // D0 is a Saturday: that week is a free pass, the first full week starts on Sunday (day 1)
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    expect(dueDay(v, D0)).toBe(day(1));
    expect(verseStatus(data, v, at(D0)).state).toBe('notdue');
    expect(verseStatus(data, v, at(D0)).daysUntilDue).toBe(1);
    expect(verseStatus(data, v, at(day(1))).state).toBe('ready');
    expect(verseStatus(data, v, at(day(7))).periodEnd).toBe(day(7)); // due by Saturday
    // reviewing any day that week covers it until the next Sunday
    recordReview(data, v.id, at(day(3)), DEVICE);
    expect(dueDay(v, day(3))).toBe(day(8));
    expect(verseStatus(data, v, at(day(7))).state).toBe('notdue');
    expect(verseStatus(data, v, at(day(8))).state).toBe('ready');
  });

  it('monthly and yearly use the calendar month and year', () => {
    const data = newData('2026-01-31');
    const m = john316(data, at('2026-01-31'), { pile: 'monthly', pileSince: '2026-01-31' });
    expect(dueDay(m, '2026-01-31')).toBe('2026-02-01'); // moved up that day: tomorrow at the earliest
    expect(dueDay(m, '2026-02-10')).toBe('2026-02-01'); // then due any time in the month
    expect(periodEnd('monthly', '2026-02-10')).toBe('2026-02-28');
    const y = john316(data, at('2028-02-29'), { pile: 'yearly', pileSince: '2028-02-29' });
    expect(dueDay(y, '2028-02-29')).toBe('2028-03-01');
    expect(dueDay(y, '2028-08-01')).toBe('2028-01-01'); // there is no free year: it is due this year
    expect(periodStart('weekly', '2026-02-07')).toBe('2026-02-01');
    expect(periodEnd('yearly', '2026-06-01')).toBe('2026-12-31');
  });

  it('only one counted review per due period; later practice is uncounted', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    expect(recordReview(data, v.id, at(day(7), '09:00'), DEVICE).counted).toBe(true);
    expect(recordReview(data, v.id, at(day(7), '15:00'), DEVICE).counted).toBe(false);
    expect(v.reviews).toHaveLength(1);
  });
});

describe('Graduation', () => {
  it('Daily -> Weekly on the review that earns the 90th day, with a level-up event', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 89; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(89), '23:00'));
    expect(v.pile).toBe('daily');
    expect(progressDays(data, v, at(day(89), '23:00'))).toBe(89);

    // day 90 only counts once the verse has been reviewed that day
    expect(settle(data, at(day(90), '00:05')).levelUps).toEqual([]);
    expect(v.pile).toBe('daily');
    const result = recordReview(data, v.id, at(day(90), '08:00'), DEVICE);
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(day(90));
    expect(result.levelUps).toEqual([{ id: `${v.id}:weekly:${day(90)}`, verseId: v.id, from: 'daily', to: 'weekly', day: day(90) }]);
    expect(daysInPile(v, at(day(90), '09:00'))).toBe(0);
  });

  it('Weekly -> Monthly after 15 reviewed weeks, Monthly -> Yearly after 6 reviewed months, Yearly stays', () => {
    const data = newData();
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    const m = john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 });
    // review something every day
    const keep = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 366; i++) {
      reviewEverythingDue(data, day(i));
      // weeks start on Sundays (day 1, 8, ...): the 15th reviewed week starts on day 99
      if (i === 98) {
        settle(data, at(day(i), '23:30'));
        expect(w.pile).toBe('weekly');
      }
      if (i === 99) expect(w.pile).toBe('monthly');
      // January (reviewed from Jan 11) to June 2026 is six months; June is reviewed on June 1 (day 142)
      if (i === 141) expect(m.pile).toBe('monthly');
      if (i === 142) expect(m.pile).toBe('yearly');
    }
    settle(data, at(day(366), '12:00'));
    expect(m.pile).toBe('yearly');
    expect(keep.id).toBeTruthy();
  });

  it('cascades through several piles in one go (e.g. reviews synced from another device)', () => {
    const data = newData();
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    for (let i = 7; i < 456; i += 7) w.reviews.push(at(day(i), '09:00'));
    const result = settle(data, at(day(460), '12:00'));
    expect(w.pile).toBe('yearly');
    expect(w.pileSince).toBe(day(266)); // 15 weeks (Saturday day 105), then May to October 2026 (April was over before its first review)
    expect(result.levelUps.map((l) => `${l.from}>${l.to}@${l.day}`)).toEqual([
      `weekly>monthly@${day(105)}`,
      `monthly>yearly@${day(266)}`,
    ]);
  });

  it('manual moves restart the clock and can be undone', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 20; i++) reviewEverythingDue(data, day(i));
    const snap = movePile(data, v.id, 'monthly', at(day(20), '15:00'));
    expect(v.pile).toBe('monthly');
    expect(v.pileSince).toBe(day(20));
    expect(dueDay(v, day(20))).toBe(day(21)); // moved today: tomorrow at the earliest, and it must be reviewed in January
    restorePile(data, v.id, snap, at(day(20), '15:01'));
    expect(v.pile).toBe('daily');
    expect(v.pileSince).toBe(D0);
    expect(progressDays(data, v, at(day(20), '16:00'))).toBe(20);
  });

  it('keeps the longest-in-pile verse at the top', () => {
    const data = newData();
    const a = john316(data, at(D0, '07:00'));
    const b = john316(data, at(day(5), '07:00'));
    const c = john316(data, at(day(2), '07:00'));
    expect(pileVerses(data, 'daily').map((v) => v.id)).toEqual([a.id, c.id, b.id]);
  });
});

describe('Streak', () => {
  it('grows by one for each day all due reviews are finished', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    expect(streakInfo(data, at(D0, '09:00')).count).toBe(0); // brand-new verse doesn't count
    for (let i = 1; i <= 4; i++) {
      reviewEverythingDue(data, day(i));
      expect(streakInfo(data, at(day(i), '20:00')).count).toBe(i);
    }
  });

  it('is at risk, not yet extended, until the first review of the day (one review is enough)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    const now = at(day(2), '08:00');
    settle(data, now);
    let s = streakInfo(data, at(day(2), '07:30'));
    expect(s.count).toBe(1);
    expect(s.atRisk).toBe(true);
    recordReview(data, v.id, now, DEVICE); // just 1 of the 3 recommended
    s = streakInfo(data, at(day(2), '09:00'));
    expect(s.count).toBe(2);
    expect(s.atRisk).toBe(false);
    expect(s.todayDone).toBe(true);
  });

  it('resets when a day is missed, and remembers the longest streak', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 5; i++) reviewEverythingDue(data, day(i));
    expect(streakInfo(data, at(day(5), '20:00')).count).toBe(5);
    // miss day 6 entirely, come back on day 7
    reviewEverythingDue(data, day(7));
    const s = streakInfo(data, at(day(7), '20:00'));
    expect(s.count).toBe(1);
    expect(s.longest).toBe(5);
  });

  it('a day with only one of three Daily reviews still keeps the streak', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    settle(data, at(day(2), '08:00'));
    recordReview(data, v.id, at(day(2), '08:00'), DEVICE); // only 1 of 3
    settle(data, at(day(3), '08:00'));
    expect(data.ledger[day(2)].o).toBe('c');
    expect(streakInfo(data, at(day(3), '08:00')).count).toBe(2);
  });

  it('a day where a due verse got no review at all breaks the streak', () => {
    const data = newData();
    const a = john316(data, at(D0, '07:00'));
    const b = john316(data, at(D0, '07:05'));
    reviewEverythingDue(data, day(1));
    settle(data, at(day(2), '08:00'));
    recordReview(data, a.id, at(day(2), '08:00'), DEVICE); // b untouched
    expect(todaySummary(data, at(day(2), '09:00')).outcome).toBe('pending');
    settle(data, at(day(3), '08:00'));
    expect(data.ledger[day(2)].o).toBe('m');
    expect(streakInfo(data, at(day(3), '08:00')).count).toBe(0);
    expect(b.id).not.toBe(a.id);
  });

  it('practising on the very first day earns a flame (new verses never count against you)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    expect(streakInfo(data, at(D0, '07:30')).count).toBe(0);
    recordReview(data, v.id, at(D0, '08:00'), DEVICE);
    const s = streakInfo(data, at(D0, '08:30'));
    expect(s.count).toBe(1);
    expect(s.todayDone).toBe(true);
    settle(data, at(day(1), '08:00'));
    expect(data.ledger[D0].o).toBe('c');
    // and a first day with no practice is still neutral
    const other = newData();
    john316(other, at(D0, '07:00'));
    settle(other, at(day(1), '08:00'));
    expect(other.ledger[D0].o).toBe('n');
  });

  it('days with nothing due are neutral: they neither add nor break', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    // day 7 is due: do it. days 1..6 had nothing due.
    for (let i = 1; i <= 6; i++) settle(data, at(day(i), '09:00'));
    expect(streakInfo(data, at(day(6), '09:00')).count).toBe(0);
    settle(data, at(day(7), '09:00'));
    recordReview(data, v.id, at(day(7), '09:00'), DEVICE);
    expect(streakInfo(data, at(day(7), '10:00')).count).toBe(1);
    settle(data, at(day(12), '09:00')); // nothing due for 5 days -> streak survives
    expect(streakInfo(data, at(day(12), '09:00')).count).toBe(1);
    // due on day 14 but skipped through day 15: broken
    settle(data, at(day(15), '09:00'));
    expect(streakInfo(data, at(day(15), '09:00')).count).toBe(0);
    expect(streakInfo(data, at(day(15), '09:00')).longest).toBe(1);
  });

  it('verses added today never count against you', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    john316(data, at(day(2), '09:00')); // second verse added on day 2
    const v1 = Object.values(data.verses)[0];
    settle(data, at(day(2), '09:00'));
    for (const hm of ['09:00', '11:00', '13:00']) recordReview(data, v1.id, at(day(2), hm), DEVICE);
    expect(todaySummary(data, at(day(2), '13:30')).outcome).toBe('c'); // new verse not required
    expect(streakInfo(data, at(day(2), '13:30')).count).toBe(2);
  });

  it('a deleted verse no longer creates obligations', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    deleteVerse(data, v.id, at(day(1), '08:00'));
    settle(data, at(day(3), '09:00'));
    expect(todaySummary(data, at(day(3), '09:00')).total).toBe(0);
    expect(dayKeyOf(at(day(3)))).toBe(day(3));
  });
});

describe('offering more frequent practice', () => {
  it('a verse in Weekly or Monthly or Yearly that needed two restarts is offered the pile below; Daily is not offered anything', () => {
    expect(easierPile('weekly', 2)).toBe('daily');
    expect(easierPile('monthly', 3)).toBe('weekly');
    expect(easierPile('yearly', 2)).toBe('monthly');
    expect(easierPile('weekly', 1)).toBeNull();
    expect(easierPile('daily', 5)).toBeNull();
    expect(previousPile('daily')).toBeNull();
  });
});
