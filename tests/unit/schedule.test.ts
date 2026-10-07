import { describe, expect, it } from 'vitest';
import { dayKeyOf } from '../../src/core/dates.ts';
import {
  daysInPile,
  daysUntilFreeze,
  dueDay,
  isFrozen,
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
  it('weekly is due 7 days after entering the pile or its last review', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    expect(dueDay(v)).toBe(day(7));
    expect(verseStatus(data, v, at(day(6))).state).toBe('notdue');
    expect(verseStatus(data, v, at(day(6))).daysUntilDue).toBe(1);
    expect(verseStatus(data, v, at(day(7))).state).toBe('ready');
    // reviewing late restarts the clock from the review day
    recordReview(data, v.id, at(day(10)), DEVICE);
    expect(dueDay(v)).toBe(day(17));
    expect(verseStatus(data, v, at(day(10), '20:00')).state).toBe('notdue');
  });

  it('monthly uses calendar months and yearly uses calendar years', () => {
    const data = newData('2026-01-31');
    const m = john316(data, at('2026-01-31'), { pile: 'monthly', pileSince: '2026-01-31' });
    expect(dueDay(m)).toBe('2026-02-28');
    const y = john316(data, at('2028-02-29'), { pile: 'yearly', pileSince: '2028-02-29' });
    expect(dueDay(y)).toBe('2029-02-28');
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
  it('Daily -> Weekly after exactly 90 days, with a level-up event', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 89; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(89), '23:00'));
    expect(v.pile).toBe('daily');
    expect(progressDays(data, v, at(day(89), '23:00'))).toBe(89);

    const result = settle(data, at(day(90), '00:05'));
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(day(90));
    expect(result.levelUps).toEqual([{ id: `${v.id}:weekly:${day(90)}`, verseId: v.id, from: 'daily', to: 'weekly', day: day(90) }]);
    expect(daysInPile(v, at(day(90), '09:00'))).toBe(0);
  });

  it('Weekly -> Monthly after 90 days, Monthly -> Yearly after 365, Yearly stays', () => {
    const data = newData();
    const w = john316(data, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    const m = john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 });
    // keep the user active so nothing freezes: review something every day
    const keep = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 366; i++) {
      reviewEverythingDue(data, day(i));
      if (i === 89) {
        settle(data, at(day(i), '23:30'));
        expect(w.pile).toBe('weekly');
      }
      if (i === 90) expect(w.pile).toBe('monthly');
      if (i === 364) expect(m.pile).toBe('monthly');
      if (i === 365) expect(m.pile).toBe('yearly');
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
    expect(w.pileSince).toBe(day(455)); // 90 days weekly + 365 days monthly
    expect(result.levelUps.map((l) => `${l.from}>${l.to}@${l.day}`)).toEqual([
      `weekly>monthly@${day(90)}`,
      `monthly>yearly@${day(455)}`,
    ]);
  });

  it('manual moves restart the clock and can be undone', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 20; i++) reviewEverythingDue(data, day(i));
    const snap = movePile(data, v.id, 'monthly', at(day(20), '15:00'));
    expect(v.pile).toBe('monthly');
    expect(v.pileSince).toBe(day(20));
    expect(dueDay(v)).toBe('2026-02-28'); // moved Jan 30 -> one calendar month later, clamped to Feb 28
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

describe('Freeze', () => {
  it('stops progress after 3 days with no review, and resumes on the day you review', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 50; i++) reviewEverythingDue(data, day(i));
    // silence for days 51..99
    settle(data, at(day(100), '09:00'));
    // days 51,52,53 still count (3 days of grace); 54..99 frozen; day 100 frozen until you review
    expect(progressDays(data, v, at(day(100), '09:00'))).toBe(53);
    expect(isFrozen(data, at(day(100), '09:00'))).toBe(true);
    expect(v.pile).toBe('daily');

    reviewEverythingDue(data, day(100));
    expect(isFrozen(data, at(day(100), '15:00'))).toBe(false);
    expect(progressDays(data, v, at(day(100), '15:00'))).toBe(54);
    reviewEverythingDue(data, day(101));
    expect(progressDays(data, v, at(day(101), '15:00'))).toBe(55);
  });

  it('a verse that already earned its promotion still moves up while frozen', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 87; i++) reviewEverythingDue(data, day(i));
    // app closed from day 88 on; days 88, 89 and 90 are inside the 3-day grace period
    settle(data, at(day(120), '09:00'));
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(day(90));
  });

  it('does not freeze users who simply have nothing due', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'), { pile: 'monthly', pileSince: D0 });
    settle(data, at(day(20), '09:00'));
    expect(isFrozen(data, at(day(20), '09:00'))).toBe(false);
    expect(progressDays(data, v, at(day(20), '09:00'))).toBe(20);
  });

  it('warns how many days remain before the freeze', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    settle(data, at(day(3), '09:00')); // day 2 lapsed
    expect(daysUntilFreeze(data, at(day(3), '09:00'))).toBe(2);
    settle(data, at(day(5), '09:00')); // days 2,3,4 lapsed
    expect(daysUntilFreeze(data, at(day(5), '09:00'))).toBe(0);
    expect(isFrozen(data, at(day(5), '09:00'))).toBe(true);
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

  it('is at risk, not yet extended, until the last review of the day', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    const now = at(day(2), '08:00');
    settle(data, now);
    recordReview(data, v.id, now, DEVICE);
    let s = streakInfo(data, at(day(2), '09:00'));
    expect(s.count).toBe(1);
    expect(s.atRisk).toBe(true);
    recordReview(data, v.id, at(day(2), '10:00'), DEVICE);
    recordReview(data, v.id, at(day(2), '12:00'), DEVICE);
    s = streakInfo(data, at(day(2), '12:30'));
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

  it('a partly finished day breaks the streak', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    reviewEverythingDue(data, day(1));
    settle(data, at(day(2), '08:00'));
    recordReview(data, v.id, at(day(2), '08:00'), DEVICE); // only 1 of 3
    settle(data, at(day(3), '08:00'));
    expect(streakInfo(data, at(day(3), '08:00')).count).toBe(0);
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
