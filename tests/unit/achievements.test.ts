import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, achievementStates, earnedMedals, freshMedals, medalId, medalTally, recordMedals, TIERS } from '../../src/core/achievements.ts';
import { seedsEarned } from '../../src/core/avatar.ts';
import { normalizeData } from '../../src/core/backup.ts';
import { medalCoins } from '../../src/core/coins.ts';
import { mergeData } from '../../src/core/merge.ts';
import { addVerse } from '../../src/core/schedule.ts';
import { at, D0, day, john316, newData, reviewEverythingDue } from './helpers.ts';

const state = (states: ReturnType<typeof achievementStates>, id: string) => states.find((s) => s.achievement.id === id)!;

describe('achievements: bronze, silver and gold for the same thing, more each time (v1.85.0)', () => {
  it('every achievement has three rising counts and a distinct id', () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS) {
      expect(a.at).toHaveLength(TIERS.length);
      expect(a.at[0]).toBeLessThan(a.at[1]);
      expect(a.at[1]).toBeLessThan(a.at[2]);
    }
  });

  it('a new start has no medals, and shows the way to bronze', () => {
    const d = newData();
    const s = achievementStates({ data: d, now: at(D0) });
    expect(s.every((x) => x.tier === null)).toBe(true);
    expect(state(s, 'faithful').next).toEqual({ tier: 'bronze', at: 7 });
    expect(earnedMedals({ data: d, now: at(D0) })).toEqual([]);
    expect(medalTally(s)).toEqual({ held: 0, total: ACHIEVEMENTS.length * 3 });
  });

  it('a 7-day streak earns bronze Faithful, and the progress bar measures toward silver from there', () => {
    const d = newData();
    john316(d, at(D0, '07:00'));
    for (let i = 1; i <= 10; i++) reviewEverythingDue(d, day(i));
    const s = state(achievementStates({ data: d, now: at(day(10), '20:00') }), 'faithful');
    expect(s.tier).toBe('bronze');
    expect(s.next).toEqual({ tier: 'silver', at: 30 });
    expect(s.progress).toBeCloseTo((s.count - 7) / (30 - 7));
    expect(earnedMedals({ data: d, now: at(day(10), '20:00') })).toContain('faithful:bronze');
  });

  it('counts verses, books and game stars', () => {
    const d = newData();
    for (let i = 0; i < 5; i++) addVerse(d, { book: 1 + i, chapter: 1, start: i + 1, end: i + 1, translation: 'ESV', text: `Verse number ${i}.` }, at(D0));
    const gameBest = { 'gate:a': { stars: 3, score: 100 }, 'duel:a': { stars: 3, score: 90 }, 'bridge:a': { stars: 3, score: 80 }, 'burrows:a': { stars: 1, score: 10 } };
    const s = achievementStates({ data: d, now: at(D0), gameBest });
    expect(state(s, 'treasured').tier).toBe('bronze'); // 5 verses
    expect(state(s, 'wholecounsel').tier).toBe('bronze'); // 5 books
    expect(state(s, 'champion').tier).toBe('bronze'); // 10 stars
  });

  it('a medal already shown on this device stays, even if its count drops (nothing earned is taken away)', () => {
    const d = newData();
    const s = state(achievementStates({ data: d, now: at(D0) }, [medalId('treasured', 'silver')]), 'treasured');
    expect(s.tier).toBe('silver');
    expect(s.next).toEqual({ tier: 'gold', at: 50 });
  });

  it('a verse that moved up still counts for Taking root after it is moved back down', () => {
    const d = newData();
    const v = john316(d, at(D0));
    d.levelUps.push({ id: `${v.id}:weekly:${day(90)}`, verseId: v.id, from: 'daily', to: 'weekly', day: day(90) });
    expect(state(achievementStates({ data: d, now: at(D0) }), 'rooted').tier).toBe('bronze');
  });

  it('new medals are announced lowest first, and never on a device that has not looked before', () => {
    expect(freshMedals(['faithful:silver', 'treasured:bronze', 'faithful:bronze'], ['faithful:bronze'])).toEqual(['treasured:bronze', 'faithful:silver']);
    expect(freshMedals(['faithful:bronze'], null)).toEqual([]);
    expect(freshMedals(['faithful:bronze'], ['faithful:bronze'])).toEqual([]);
  });
});

describe('medals pay coins, recorded once (v1.85.0)', () => {
  it('bronze 50, silver 100, gold 250, for medals recorded in the data', () => {
    const d = newData();
    const before = seedsEarned(d);
    d.medals = ['faithful:bronze', 'faithful:silver', 'treasured:gold'];
    expect(medalCoins(d)).toBe(50 + 100 + 250);
    expect(seedsEarned(d) - before).toBe(400);
  });

  it('records each earned medal once, and keeps it (and its coins) when the count drops', () => {
    const d = newData();
    for (let i = 0; i < 5; i++) addVerse(d, { book: 1 + i, chapter: 1, start: 1, end: 1, translation: 'ESV', text: `Verse ${i}.` }, at(D0));
    expect(recordMedals({ data: d, now: at(D0) })).toEqual(['treasured:bronze', 'wholecounsel:bronze']);
    expect(recordMedals({ data: d, now: at(D0) })).toEqual([]); // once
    const coins = seedsEarned(d);
    for (const v of Object.values(d.verses)) v.deletedAt = at(D0);
    expect(seedsEarned(d)).toBe(coins);
    expect(state(achievementStates({ data: d, now: at(D0) }), 'treasured').tier).toBe('bronze');
  });

  it('merges by union, in any order', () => {
    const a = newData();
    const b = newData();
    a.medals = ['faithful:bronze'];
    b.medals = ['treasured:bronze', 'faithful:bronze'];
    expect(mergeData(a, b).medals).toEqual(['faithful:bronze', 'treasured:bronze']);
    expect(mergeData(b, a).medals).toEqual(mergeData(a, b).medals);
  });

  it('a backup drops anything that is not a medal id', () => {
    const d = normalizeData({ ...newData(), medals: ['faithful:gold', 'nonsense', 42, 'x:platinum'] });
    expect(d.medals).toEqual(['faithful:gold']);
  });
});
