import { describe, expect, it } from 'vitest';
import { buildReminderIcs, cleanReminderTimes, DEFAULT_REMINDER_TIMES } from '../../src/core/reminders.ts';
import { at, D0 } from './helpers.ts';

describe('reminder times', () => {
  it('keeps valid unique times sorted, at most three', () => {
    expect(cleanReminderTimes(['19:30', '08:00', '08:00', '13:15', '21:00'])).toEqual(['08:00', '13:15', '19:30']);
  });
  it('drops junk and falls back to sensible defaults', () => {
    expect(cleanReminderTimes(['25:00', '8:00', 'noon', 7, null])).toEqual(DEFAULT_REMINDER_TIMES);
    expect(cleanReminderTimes(undefined)).toEqual(DEFAULT_REMINDER_TIMES);
    expect(cleanReminderTimes([])).toEqual(DEFAULT_REMINDER_TIMES);
  });
});

describe('calendar file', () => {
  const ics = buildReminderIcs(['08:00', '20:30'], at(D0, '15:04'));
  it('is a well-formed iCalendar document with CRLF line endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // every newline is CRLF
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/END:VEVENT/g)).toHaveLength(2);
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
  it('repeats daily at the chosen local times, starting today, with an alert at the event time', () => {
    expect(ics).toContain('DTSTART:20260110T080000');
    expect(ics).toContain('DTSTART:20260110T203000');
    expect(ics.match(/RRULE:FREQ=DAILY/g)).toHaveLength(2);
    expect(ics.match(/TRIGGER:PT0M/g)).toHaveLength(2);
    expect(ics).not.toMatch(/DTSTART[^:]*Z/); // floating local time, follows the phone's time zone
  });
  it('uses stable ids so re-importing updates instead of duplicating', () => {
    expect(ics).toContain('UID:mfl-reminder-0800@memorize-for-life');
    expect(buildReminderIcs(['08:00'], at('2026-02-01'))).toContain('UID:mfl-reminder-0800@memorize-for-life');
  });
  it('escapes text and never contains verse or personal data', () => {
    expect(ics).not.toMatch(/John|Psalm|@gmail/);
  });
});
