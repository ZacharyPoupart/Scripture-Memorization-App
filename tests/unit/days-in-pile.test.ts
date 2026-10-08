// "Start partway": a verse you already know can enter (or move to) a pile with N days of history,
// instead of starting at day 0. It only back-dates the pile start; every other rule is unchanged.
import { describe, expect, it } from 'vitest';
import {
  addVerse,
  maxDaysIn,
  movePile,
  progressDays,
  recordReview,
  restorePile,
  settle,
  todaySummary,
  verseStatus,
} from '../../src/core/schedule.ts';
import { dayKeyOf, addDays } from '../../src/core/dates.ts';
import { at, D0, day, DEVICE, newData, john316, reviewEverythingDue } from './helpers.ts';

const input = { book: 43, chapter: 3, start: 16, end: 16, translation: 'ESV', text: 'For God so loved the world, that he gave his only Son.' };

describe('days already in the pile', () => {
  it('limits: just under the graduation target (so nothing jumps a pile on save); 364 for Monthly, a year and a day for Yearly (so it can be due now)', () => {
    expect([maxDaysIn('daily'), maxDaysIn('weekly'), maxDaysIn('monthly'), maxDaysIn('yearly')]).toEqual([89, 89, 364, 366]);
  });

  it('a new verse can start partway through Daily', () => {
    const data = newData();
    const now = at(D0, '08:00');
    const v = addVerse(data, { ...input, daysInPile: 60 }, now);
    expect(v.pileSince).toBe(addDays(dayKeyOf(now), -60));
    expect(v.addedDay).toBe(D0); // it was still added today
    expect(progressDays(data, v, now)).toBe(60);
    expect(addVerse(data, input, now).pileSince).toBe(D0); // default is unchanged
  });

  it('is clamped to the allowed range (and ignores nonsense)', () => {
    const data = newData();
    const now = at(D0, '08:00');
    expect(addVerse(data, { ...input, daysInPile: 500 }, now).pileSince).toBe(addDays(D0, -89));
    expect(addVerse(data, { ...input, daysInPile: -5 }, now).pileSince).toBe(D0);
    expect(addVerse(data, { ...input, daysInPile: Number.NaN }, now).pileSince).toBe(D0);
    expect(addVerse(data, { ...input, daysInPile: 12.9 }, now).pileSince).toBe(addDays(D0, -12));
  });

  it('moving a verse can carry days with it, and undo restores the exact previous state', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    const now = at(day(10), '09:00');
    const snap = movePile(data, v.id, 'weekly', now, 45);
    expect(v.pile).toBe('weekly');
    expect(v.pileSince).toBe(addDays(day(10), -45));
    expect(progressDays(data, v, now)).toBe(45);
    restorePile(data, v.id, snap, now + 1000);
    expect(v.pile).toBe('daily');
    expect(v.pileSince).toBe(D0);
  });

  it('moving without days still restarts progress (the documented manual-move rule)', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    movePile(data, v.id, 'weekly', at(day(10), '09:00'));
    expect(v.pileSince).toBe(day(10));
  });

  it('a Weekly verse started partway is due straight away; Yearly likewise once a year has passed', () => {
    const data = newData();
    const now = at(D0, '09:00');
    const v = john316(data, now);
    movePile(data, v.id, 'weekly', now, 30);
    expect(verseStatus(data, v, now).state).toBe('ready');
    movePile(data, v.id, 'yearly', now, 366);
    expect(verseStatus(data, v, now).state).toBe('ready');
    movePile(data, v.id, 'yearly', now, 10);
    expect(verseStatus(data, v, now).state).toBe('notdue');
  });

  it('it graduates by the normal rule: 89 days in means about a day of practice from the next pile', () => {
    const data = newData();
    const v = addVerse(data, { ...input, daysInPile: 89 }, at(D0, '07:00'));
    settle(data, at(D0, '07:00'));
    expect(v.pile).toBe('daily'); // 89 days earned: one more normal day is still needed
    reviewEverythingDue(data, day(1));
    settle(data, at(day(2), '08:00'));
    expect(v.pile).toBe('weekly');
  });

  it('a verse added with history is an obligation today (it is part of your routine), a fresh one is not', () => {
    const data = newData();
    const now = at(D0, '08:00');
    addVerse(data, { ...input, daysInPile: 20 }, now);
    expect(todaySummary(data, now).total).toBe(1);
    const fresh = newData();
    addVerse(fresh, input, now);
    expect(todaySummary(fresh, now).total).toBe(0);
  });

  it('settled history and the ledger are not touched by back-dating', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 3; i++) reviewEverythingDue(data, day(i));
    const ledger = structuredClone(data.ledger);
    movePile(data, v.id, 'weekly', at(day(4), '09:00'), 30);
    expect(data.ledger).toEqual(ledger);
    recordReview(data, v.id, at(day(4), '10:00'), DEVICE);
  });
});
