import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { seedsEarned } from '../../src/core/avatar.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview } from '../../src/core/schedule.ts';
import { cheerLine, cleanName, codeFrom, formatCode, guildLink, initialOf, inviteLink, inviteMessage, newIdentity, sameSnapshot, socialSnapshot, weeklyDue, weekEndsAt, countdownText, chestState, guildWinsToClaim, type GuildView } from '../../src/core/social.ts';
import { cleanSnap, guildGoal } from '../../functions/_lib/social.js';
import { at, D0, day, DEVICE, john316, newData } from './helpers.ts';

describe('your private identity', () => {
  it('is random, the right shape, and different every time', () => {
    const a = newIdentity(5);
    const b = newIdentity(5);
    expect(a.id).toMatch(/^[a-f0-9]{32}$/);
    expect(a.secret).toMatch(/^[A-Za-z0-9_-]{32,64}$/);
    expect(a.at).toBe(5);
    expect(a.id).not.toBe(b.id);
    expect(a.secret).not.toBe(b.secret);
  });
});

describe('what friends can see', () => {
  it('is only the knight, streak, pile counts and this week’s reviews, and the server accepts exactly that', () => {
    const d = newData();
    const v = john316(d, at(D0, '07:00'));
    john316(d, at(D0, '07:00'), { pile: 'weekly', pileSince: D0 });
    recordReview(d, v.id, at(day(1), '09:00'), DEVICE);
    const snap = socialSnapshot(d, at(day(1), '12:00'));
    expect(snap.counts).toEqual({ daily: 1, weekly: 1, monthly: 0, yearly: 0 });
    expect(snap.week).toBe(1);
    expect(snap.weekStart).toBe('2026-01-11'); // a Sunday
    expect(snap.look.helmet).toBe('helmet-iron-bulwark');
    expect(JSON.stringify(snap)).not.toContain('For God'); // never the verses
    expect(cleanSnap(snap)).toEqual(snap); // the server takes it as it is
  });

  it('reviews from before this week are not counted, and an unchanged snapshot compares equal', () => {
    const d = newData();
    const v = john316(d, at(D0, '07:00'));
    recordReview(d, v.id, at(day(0), '09:00'), DEVICE); // D0 is a Saturday: the week before
    const next = socialSnapshot(d, at(day(2), '09:00'));
    expect(next.week).toBe(0);
    expect(sameSnapshot(next, socialSnapshot(d, at(day(2), '10:00')))).toBe(true);
    expect(sameSnapshot(null, next)).toBe(false);
  });
});

describe('names and invite codes', () => {
  it('clean names the same way the server does', () => {
    expect(cleanName('  Zach   P.​ ')).toBe('Zach P.');
    expect(cleanName('x'.repeat(80))).toHaveLength(40);
    expect(initialOf('  sam')).toBe('S');
    expect(initialOf('')).toBe('?');
  });
  it('find a code in whatever was typed or pasted', () => {
    expect(codeFrom('ABCD-EFGH')).toBe('ABCDEFGH');
    expect(codeFrom('  abcd efgh ')).toBe('ABCDEFGH');
    expect(codeFrom('https://memorize.example/#/join/ABCDEFGH')).toBe('ABCDEFGH');
    expect(codeFrom('Join me: https://x.app/#/join/abcdefgh thanks')).toBe('ABCDEFGH');
    expect(codeFrom('ABCDEFG')).toBeNull(); // too short
    expect(codeFrom('ABCDEFGHJ')).toBeNull(); // too long
    expect(codeFrom('ILO01234')).toBeNull(); // the letters and digits that look alike are not used
    expect(codeFrom('')).toBeNull();
  });
  it('make links and messages people can send', () => {
    expect(formatCode('ABCDEFGH')).toBe('ABCD-EFGH');
    expect(inviteLink('https://x.app', 'ABCDEFGH')).toBe('https://x.app/#/join/ABCDEFGH');
    expect(guildLink('https://x.app', 'ABCDEFGH')).toBe('https://x.app/#/guild/ABCDEFGH');
    expect(inviteMessage('https://x.app/#/join/ABCDEFGH', 'Zach')).toContain('Zach here.');
    expect(inviteMessage('https://x.app/#/join/ABCDEFGH', '')).not.toContain('here.');
  });
});

describe('the identity travels with your data', () => {
  const idA = { id: 'a'.repeat(32), secret: 'x'.repeat(40), at: 100 };
  const idB = { id: 'b'.repeat(32), secret: 'y'.repeat(40), at: 50 };

  it('the earliest identity wins on every device, whichever order they meet in', () => {
    const a = newData();
    const b = newData();
    a.social = idA;
    b.social = idB;
    expect(mergeData(a, b).social).toEqual(idB);
    expect(mergeData(b, a).social).toEqual(idB);
    expect(mergeData(a, newData()).social).toEqual(idA);
    expect(mergeData(a, a)).toEqual(a);
  });

  it('the later sharing choice wins, and merging stays commutative and idempotent', () => {
    const a = newData();
    const b = newData();
    a.sharing = { name: 'Zach P.', on: true, at: 10 };
    b.sharing = { name: 'Zach P.', on: false, at: 20 };
    expect(mergeData(a, b).sharing?.on).toBe(false);
    expect(mergeData(a, b)).toEqual(mergeData(b, a));
    expect(mergeData(mergeData(a, b), b)).toEqual(mergeData(a, b));
  });

  it('survives a backup, and bad values are dropped', () => {
    const d = newData();
    d.social = idA;
    d.sharing = { name: '  Zach   P. ', on: true, at: 7 };
    const back = parseBackup(exportBackup(d, '1.0.0', 1));
    expect(back.social).toEqual(idA);
    expect(back.sharing).toEqual({ name: 'Zach P.', on: true, at: 7 });
    const raw = JSON.parse(JSON.stringify(d));
    raw.social = { id: 'nope', secret: 'short', at: 1 };
    raw.sharing = { name: 5, on: 'yes', at: 1 };
    const clean = normalizeData(raw);
    expect(clean.social).toBeUndefined();
    expect(clean.sharing).toBeUndefined();
  });
});

describe('the cheer message', () => {
  it('reads naturally for one, two, three and more people, without repeats', () => {
    expect(cheerLine(['Sam L.'])).toBe('Sam L. cheered you!');
    expect(cheerLine(['Sam L.', 'Sam L.'])).toBe('Sam L. cheered you!');
    expect(cheerLine(['Sam L.', 'Ana B.'])).toBe('Sam L. and Ana B. cheered you!');
    expect(cheerLine(['Sam L.', 'Ana B.', 'Joe'])).toBe('Sam L., Ana B. and 1 other cheered you!');
    expect(cheerLine(['A', 'B', 'C', 'D'])).toBe('A, B and 2 others cheered you!');
  });
});

describe('the guild goal', () => {
  // the week of Sunday 2026-01-11 to Saturday 2026-01-17
  const week = at('2026-01-14', '12:00');

  it('a Daily verse is due three times on each day of the week (21), but not before the day after it was added', () => {
    const d = newData();
    john316(d, at(D0, '07:00')); // added the Saturday before
    expect(weeklyDue(d, week)).toBe(21);
    const e = newData('2026-01-14');
    john316(e, at('2026-01-14', '07:00')); // added on the Wednesday: Thursday to Saturday are due
    expect(weeklyDue(e, week)).toBe(9);
  });

  it('a Weekly verse is due once a week, a Monthly one in the week its month ends, a Yearly one in the week its year ends', () => {
    const d = newData();
    john316(d, at(D0, '07:00'), { pile: 'weekly', pileSince: '2026-01-01' });
    john316(d, at(D0, '07:00'), { pile: 'monthly', pileSince: '2026-01-01' });
    john316(d, at(D0, '07:00'), { pile: 'yearly', pileSince: '2026-01-01' });
    expect(weeklyDue(d, week)).toBe(1); // only the Weekly one this week
    expect(weeklyDue(d, at('2026-01-28', '12:00'))).toBe(2); // the week of January 25-31: Weekly + Monthly
    expect(weeklyDue(d, at('2026-12-30', '12:00'))).toBe(3); // the week of December 27 to January 2: all three
  });

  it('is shared as part of what friends see', () => {
    const d = newData();
    john316(d, at(D0, '07:00'));
    expect(socialSnapshot(d, week).due).toBe(21);
    expect(cleanSnap({ ...socialSnapshot(d, week) })).toMatchObject({ due: 21 });
  });

  it('is 90% of the members\' totals added up, rounded to the nearest 5 (never below 5)', () => {
    expect(guildGoal([21, 21])).toBe(40); // 42 -> 37.8
    expect(guildGoal([21, 22])).toBe(40); // 43 -> 38.7
    expect(guildGoal([44, 44, 44])).toBe(120); // 132 -> 118.8
    expect(guildGoal([50, 50])).toBe(90); // 100 -> 90 exactly
    expect(guildGoal([2])).toBe(5);
    expect(guildGoal([0, 0])).toBe(5);
    expect(guildGoal([])).toBe(5);
  });
});

describe('extra practice counts toward the guild goal', () => {
  const week = at('2026-01-14', '12:00'); // the week of Sunday 2026-01-11
  const setup = () => {
    const d = newData();
    const id = john316(d, at(D0, '07:00')).id;
    return { d, id };
  };

  it('a review that is not due is tallied for this week and shared, but earns no coin and no progress', () => {
    const { d, id } = setup();
    expect(recordReview(d, id, week, DEVICE).counted).toBe(true);
    const coinsBefore = seedsEarned(d);
    expect(recordReview(d, id, week + 60_000, DEVICE).counted).toBe(false); // spacing: not ready again yet
    expect(d.extraWeek).toEqual({ [DEVICE]: { w: '2026-01-11', n: 1 } });
    expect(seedsEarned(d)).toBe(coinsBefore);
    expect(d.verses[id].reviews).toHaveLength(1); // nothing stored for the schedule
    const snap = socialSnapshot(d, week + 60_000);
    expect(snap.week).toBe(1);
    expect(snap.extra).toBe(1);
    expect(cleanSnap({ ...snap })).toMatchObject({ week: 1, extra: 1 });
  });

  it('starts again each week and ignores last week\u2019s tally', () => {
    const { d, id } = setup();
    recordReview(d, id, week, DEVICE);
    recordReview(d, id, week + 60_000, DEVICE);
    const next = at('2026-01-19', '12:00'); // the following week
    recordReview(d, id, next, DEVICE);
    recordReview(d, id, next + 60_000, DEVICE);
    expect(d.extraWeek?.[DEVICE]).toEqual({ w: '2026-01-18', n: 1 });
    expect(socialSnapshot(d, week).extra).toBe(0); // the old week no longer matches
  });

  it('merges per device: a newer week wins, the same week keeps the larger count', () => {
    const a = newData();
    const b = newData();
    a.extraWeek = { x: { w: '2026-01-11', n: 3 }, y: { w: '2026-01-04', n: 9 } };
    b.extraWeek = { x: { w: '2026-01-11', n: 5 }, y: { w: '2026-01-11', n: 1 }, z: { w: '2026-01-11', n: 2 } };
    const m = mergeData(a, b);
    expect(m.extraWeek).toEqual({ x: { w: '2026-01-11', n: 5 }, y: { w: '2026-01-11', n: 1 }, z: { w: '2026-01-11', n: 2 } });
    expect(mergeData(b, a).extraWeek).toEqual(m.extraWeek);
    expect(mergeData(m, m)).toEqual(m);
  });

  it('bad values in a backup are dropped', () => {
    const d = normalizeData({ ...newData(), extraWeek: { ok: { w: '2026-01-11', n: 2 }, bad1: { w: 'x', n: 2 }, bad2: { w: '2026-01-11', n: -1 }, bad3: { w: '2026-01-11', n: 1.5 }, __proto__: { w: '2026-01-11', n: 1 } } });
    expect(d.extraWeek).toEqual({ ok: { w: '2026-01-11', n: 2 } });
  });

  it('someone who only did extra practice can still claim the coins', () => {
    const now = at('2026-01-14', '12:00');
    const me = 'a'.repeat(32);
    const card = (id: string, week: number, extra: number) => ({ id, name: id.slice(0, 1), at: 0, snap: { look: {}, streak: 0, longest: 0, counts: { daily: 0, weekly: 0, monthly: 0, yearly: 0 }, week, extra, weekStart: '2026-01-11' } });
    const g = { id: 'g1', name: 'G', owner: me, weekStart: '2026-01-11', goal: 10, progress: 12, members: [card(me, 0, 6), card('b'.repeat(32), 6, 0)] } as GuildView;
    expect(guildWinsToClaim(newData(), [g], me, now)).toEqual(['g1:2026-01-11']);
  });
});

describe('claiming the coins for a guild goal', () => {
  const now = at('2026-01-14', '12:00'); // the week starting Sunday 2026-01-11
  const me = 'a'.repeat(32);
  const member = (id: string, week: number, weekStart = '2026-01-11') => ({ id, name: id.slice(0, 1), at: 0, snap: { look: {}, streak: 0, longest: 0, counts: { daily: 0, weekly: 0, monthly: 0, yearly: 0 }, week, weekStart } });
  const guild = (over: Partial<GuildView> = {}): GuildView => ({
    id: 'g1', name: 'Group', owner: me, weekStart: '2026-01-11', goal: 40, progress: 40,
    members: [member(me, 20), member('b'.repeat(32), 20)], ...over,
  });

  it('is earned once, for this week, when the goal is reached by at least two people including you', () => {
    const d = newData();
    expect(guildWinsToClaim(d, [guild()], me, now)).toEqual(['g1:2026-01-11']);
    d.guildWins = ['g1:2026-01-11'];
    expect(guildWinsToClaim(d, [guild()], me, now)).toEqual([]); // already claimed
  });

  it('is not earned when the goal is not reached, for a group of one, for last week, or without a review of your own this week', () => {
    const d = newData();
    expect(guildWinsToClaim(d, [guild({ progress: 39 })], me, now)).toEqual([]);
    expect(guildWinsToClaim(d, [guild({ members: [member(me, 40)] })], me, now)).toEqual([]);
    expect(guildWinsToClaim(d, [guild({ weekStart: '2026-01-04' })], me, now)).toEqual([]);
    expect(guildWinsToClaim(d, [guild({ members: [member(me, 0), member('b'.repeat(32), 40)] })], me, now)).toEqual([]);
    expect(guildWinsToClaim(d, [guild({ members: [member(me, 20, '2026-01-04'), member('b'.repeat(32), 20)] })], me, now)).toEqual([]);
  });
});

describe('the weekly countdown', () => {
  const ends = weekEndsAt('2026-10-18'); // the week Sunday 18 Oct to Saturday 24 Oct ends at local midnight after the 24th
  it('ends at local midnight after Saturday', () => {
    expect(ends).toBe(new Date(2026, 9, 25).getTime());
  });
  it('counts whole days, then gets precise on the last day', () => {
    const h = 3600000;
    expect(countdownText(ends - new Date(2026, 9, 18).getTime())).toBe('7 days left');
    expect(countdownText(ends - new Date(2026, 9, 23, 12).getTime())).toBe('2 days left'); // Friday noon: a day and a half to go
    expect(countdownText(24 * h)).toBe('24 h left');
    expect(countdownText(5 * h + 20 * 60000)).toBe('5 h 20 min left');
    expect(countdownText(12 * 60000)).toBe('12 min left');
    expect(countdownText(0)).toBe('A new week is starting');
  });
});

describe('the reward chest', () => {
  it('is locked for a group of one, closed until the goal, open at the goal', () => {
    expect(chestState({ members: [1], progress: 99, goal: 5 })).toBe('locked');
    expect(chestState({ members: [1, 2], progress: 4, goal: 5 })).toBe('closed');
    expect(chestState({ members: [1, 2], progress: 5, goal: 5 })).toBe('open');
    expect(chestState({ members: [1, 2], progress: 12, goal: 5 })).toBe('open');
    expect(chestState({ members: [1, 2], progress: 0, goal: 0 })).toBe('closed'); // no goal worked out yet
  });
});
