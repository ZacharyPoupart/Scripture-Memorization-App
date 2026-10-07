import { describe, expect, it } from 'vitest';
import { addDays, addMonths, addYears, dayKeyOf, daysBetween, nextLocalMidnight } from '../../src/core/dates.ts';
import { at } from './helpers.ts';

describe('timezone', () => {
  it('is pinned to America/New_York for deterministic tests', () => {
    expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(300);
  });
});

describe('day keys and rollover at local midnight', () => {
  it('belongs to the same day until local midnight', () => {
    expect(dayKeyOf(at('2026-01-10', '23:59'))).toBe('2026-01-10');
    expect(dayKeyOf(at('2026-01-11', '00:00'))).toBe('2026-01-11');
    expect(dayKeyOf(at('2026-01-11', '00:01'))).toBe('2026-01-11');
  });

  it('nextLocalMidnight lands on the next day start, including across DST changes', () => {
    expect(dayKeyOf(nextLocalMidnight(at('2026-01-10', '23:59')))).toBe('2026-01-11');
    expect(new Date(nextLocalMidnight(at('2026-03-08', '09:00'))).getHours()).toBe(0); // spring forward day
    expect(new Date(nextLocalMidnight(at('2026-11-01', '09:00'))).getHours()).toBe(0); // fall back day
  });

  it('counts whole days correctly over DST transitions', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('calendar month/year math', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30');
  });
  it('handles leap day for yearly intervals', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
    expect(addYears('2026-05-05', 1)).toBe('2027-05-05');
  });
});
