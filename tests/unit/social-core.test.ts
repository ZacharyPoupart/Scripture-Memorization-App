import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview } from '../../src/core/schedule.ts';
import { cleanName, codeFrom, formatCode, guildLink, initialOf, inviteLink, inviteMessage, newIdentity, sameSnapshot, socialSnapshot } from '../../src/core/social.ts';
import { cleanSnap } from '../../functions/_lib/social.js';
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
