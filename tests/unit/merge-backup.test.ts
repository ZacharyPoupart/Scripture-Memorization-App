import { describe, expect, it } from 'vitest';
import { exportBackup, parseBackup, BackupError, normalizeData } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import { addVerse, deleteVerse, editVerse, movePile, recordReview, settle, streakInfo } from '../../src/core/schedule.ts';
import type { AppData } from '../../src/core/types.ts';
import { at, D0, day, john316, newData, reviewEverythingDue } from './helpers.ts';

function clone(d: AppData): AppData {
  return structuredClone(d);
}

/** Two devices that start from the same data and then diverge. */
function twoDevices() {
  const base = newData();
  const v = john316(base, at(D0, '07:00'));
  return { a: clone(base), b: clone(base), id: v.id };
}

describe('merge', () => {
  it('is idempotent, commutative and keeps everything', () => {
    const { a, b } = twoDevices();
    addVerse(a, { book: 19, chapter: 23, start: 1, end: 3, translation: 'KJV', text: 'The LORD is my shepherd; I shall not want.' }, at(day(1), '09:00'));
    addVerse(b, { book: 45, chapter: 8, start: 28, end: 28, translation: 'ESV', text: 'And we know that for those who love God all things work together for good.' }, at(day(1), '10:00'));
    reviewEverythingDue(a, day(1), 'dev-A');
    reviewEverythingDue(b, day(1), 'dev-B');

    const ab = mergeData(a, b);
    const ba = mergeData(b, a);
    expect(ab).toEqual(ba);
    expect(mergeData(ab, ab)).toEqual(ab);
    expect(mergeData(ab, a)).toEqual(ab);
    expect(Object.keys(ab.verses)).toHaveLength(3);
    expect(ab.reviewsByDevice['dev-A']).toBeGreaterThan(0);
    expect(ab.reviewsByDevice['dev-B']).toBeGreaterThan(0);
  });

  it('is associative across three copies', () => {
    const { a, b, id } = twoDevices();
    const c = clone(a);
    editVerse(a, id, { topic: 'Gospel' }, at(day(1), '09:00'));
    editVerse(b, id, { translation: 'NIV' }, at(day(1), '10:00'));
    addVerse(c, { book: 1, chapter: 1, start: 1, end: 1, translation: 'KJV', text: 'In the beginning God created the heaven and the earth.' }, at(day(1)));
    expect(mergeData(mergeData(a, b), c)).toEqual(mergeData(a, mergeData(b, c)));
  });

  it('last writer wins on content; both devices adding reviews are unioned', () => {
    const { a, b, id } = twoDevices();
    editVerse(a, id, { topic: 'Love' }, at(day(1), '09:00'));
    editVerse(b, id, { topic: 'Salvation' }, at(day(1), '10:00'));
    recordReview(a, id, at(day(1), '08:00'), 'dev-A');
    recordReview(b, id, at(day(1), '09:00'), 'dev-B');
    const m = mergeData(a, b);
    expect(m.verses[id].topic).toBe('Salvation');
    expect(m.verses[id].reviews).toEqual([at(day(1), '08:00'), at(day(1), '09:00')]);
  });

  it('a manual move on one device and edits on another both survive', () => {
    const { a, b, id } = twoDevices();
    movePile(a, id, 'weekly', at(day(2), '09:00'));
    editVerse(b, id, { text: 'For God so loved the world.' }, at(day(2), '10:00'));
    const m = mergeData(a, b);
    expect(m.verses[id].pile).toBe('weekly');
    expect(m.verses[id].text).toBe('For God so loved the world.');
  });

  it('deleting on one device deletes everywhere (and does not resurrect)', () => {
    const { a, b, id } = twoDevices();
    deleteVerse(a, id, at(day(1), '09:00'));
    editVerse(b, id, { topic: 'x' }, at(day(1), '10:00'));
    const m = mergeData(a, b);
    expect(m.verses[id].deletedAt).toBe(at(day(1), '09:00'));
  });

  it('a day finished on one device is not lost to a device that missed it', () => {
    const { a, b } = twoDevices();
    reviewEverythingDue(a, day(1), 'dev-A'); // phone: did everything
    settle(b, at(day(2), '08:00')); // computer: unaware, settles day 1 as missed
    expect(b.ledger[day(1)].o).toBe('m');
    const m = mergeData(a, b);
    expect(m.ledger[day(1)].o).toBe('c');
    expect(m.ledger[day(1)].r).toBe(1);
    expect(streakInfo(m, at(day(2), '08:00')).count).toBe(1);
  });

  it('keeps the longest streak and the first created day', () => {
    const { a, b } = twoDevices();
    a.longestStreak = 9;
    b.longestStreak = 4;
    b.createdDay = '2025-12-01';
    const m = mergeData(a, b);
    expect(m.longestStreak).toBe(9);
    expect(m.createdDay).toBe('2025-12-01');
  });

  it('level-ups are unioned without duplicates', () => {
    const { a, b } = twoDevices();
    const lu = { id: 'x:weekly:2026-04-10', verseId: 'x', from: 'daily' as const, to: 'weekly' as const, day: '2026-04-10' };
    a.levelUps.push(lu);
    b.levelUps.push({ ...lu });
    expect(mergeData(a, b).levelUps).toHaveLength(1);
  });
});

describe('export / import', () => {
  it('round-trips every field exactly', () => {
    const data = newData();
    john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 5; i++) reviewEverythingDue(data, day(i));
    editVerse(data, Object.keys(data.verses)[0], { topic: 'Gospel' }, at(day(5), '20:00'));
    const text = exportBackup(data, '1.0.0', at(day(5), '21:00'));
    expect(JSON.parse(text).app).toBe('memorize-for-life');
    expect(parseBackup(text)).toEqual(data);
  });

  it('importing into existing data merges instead of overwriting', () => {
    const { a, b } = twoDevices();
    addVerse(b, { book: 1, chapter: 1, start: 1, end: 1, translation: 'KJV', text: 'In the beginning God created the heaven and the earth.' }, at(day(1)));
    const restored = parseBackup(exportBackup(b, '1.0.0', at(day(1))));
    const merged = mergeData(a, restored);
    expect(Object.keys(merged.verses)).toHaveLength(2);
  });

  it('rejects things that are not backups, with a clear message', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Memorize For Life backup/);
    expect(() => parseBackup(JSON.stringify({ app: 'memorize-for-life', format: 99, data: {} }))).toThrow(/newer version/);
    expect(() => parseBackup(JSON.stringify({ app: 'memorize-for-life', format: 1, data: { schema: 1 } }))).toThrow(BackupError);
  });

  it('rejects corrupt verses instead of importing garbage', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const bad = clone(data);
    bad.verses[v.id].chapter = 999;
    expect(() => normalizeData(bad)).toThrow(/chapter/);
    const bad2 = clone(data);
    bad2.verses[v.id].text = '   ';
    expect(() => normalizeData(bad2)).toThrow(/no text/);
    const bad3 = clone(data) as unknown as { verses: Record<string, { pile: string }> };
    bad3.verses[v.id].pile = 'hourly';
    expect(() => normalizeData(bad3)).toThrow(/pile/);
  });

  it('tolerates and cleans minor oddities (missing optional fields, duplicate reviews)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    v.reviews = [5, 3, 3];
    const raw = JSON.parse(JSON.stringify(data));
    delete raw.levelUps;
    delete raw.reviewsByDevice;
    delete raw.prefs;
    const n = normalizeData(raw);
    expect(n.verses[v.id].reviews).toEqual([3, 5]);
    expect(n.prefs.value.spacingHours).toBe(2);
    expect(n.levelUps).toEqual([]);
  });
});
