// Daily reminders via a calendar file (.ics).
// Why not push notifications: an installed iPhone web app can only receive push messages from a server
// (a push service with keys), which would break "static files, no accounts". A calendar event with an alert
// needs nothing from us: the Calendar app delivers it, works offline, and the user stays in control.
import { dayKeyOf } from './dates.ts';

export const DEFAULT_REMINDER_TIMES = ['08:00', '13:00', '19:00'];
export const MAX_REMINDERS = 3;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Valid, unique, sorted "HH:MM" times (at most 3). Falls back to the defaults when nothing valid remains. */
export function cleanReminderTimes(times: unknown): string[] {
  const list = Array.isArray(times) ? times : [];
  const ok = [...new Set(list.filter((t): t is string => typeof t === 'string' && TIME.test(t)))].sort().slice(0, MAX_REMINDERS);
  return ok.length ? ok : [...DEFAULT_REMINDER_TIMES];
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const pad = (n: number) => String(n).padStart(2, '0');

function utcStamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/**
 * An iCalendar file with one repeating daily event (with an alert at the event time) per reminder.
 * Times are "floating" local times, so they follow the phone's time zone. Stable UIDs mean importing the file
 * again updates the same events instead of piling up duplicates.
 */
export function buildReminderIcs(times: string[], now: number): string {
  const start = dayKeyOf(now).replace(/-/g, '');
  const stamp = utcStamp(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Memorize For Life//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const t of cleanReminderTimes(times)) {
    const [h, m] = t.split(':');
    lines.push(
      'BEGIN:VEVENT',
      `UID:mfl-reminder-${h}${m}@memorize-for-life`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}T${h}${m}00`,
      'DURATION:PT10M',
      'RRULE:FREQ=DAILY',
      `SUMMARY:${esc('Memorize For Life: time to review')}`,
      `DESCRIPTION:${esc('Open Memorize For Life and do your verse reviews.')}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc('Time to review your verses')}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
