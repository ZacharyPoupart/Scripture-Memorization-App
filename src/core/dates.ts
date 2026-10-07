// Day arithmetic on *local calendar days*. A "day key" is "YYYY-MM-DD" in the device's
// local time zone, so the day rolls over at local midnight. Differences are computed on
// UTC day numbers so DST shifts (23/25-hour days) never produce off-by-one errors.

export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKeyOf(ts: number): DayKey {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Days since 1970-01-01 for a day key (timezone independent). */
export function dayNumber(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function keyFromDayNumber(n: number): DayKey {
  const d = new Date(n * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(key: DayKey, n: number): DayKey {
  return keyFromDayNumber(dayNumber(key) + n);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return dayNumber(b) - dayNumber(a);
}

function daysInMonth(y: number, m1: number): number {
  return new Date(Date.UTC(y, m1, 0)).getUTCDate();
}

/** Calendar-month addition, clamping to the end of shorter months (Jan 31 + 1mo = Feb 28/29). */
export function addMonths(key: DayKey, n: number): DayKey {
  const [y, m, d] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, daysInMonth(ny, nm)))}`;
}

export function addYears(key: DayKey, n: number): DayKey {
  return addMonths(key, n * 12);
}

/** Timestamp of the next local midnight after `ts`. */
export function nextLocalMidnight(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
}

export function startOfLocalDay(key: DayKey): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

export function formatDuration(ms: number): string {
  const mins = Math.max(1, Math.ceil(ms / 60_000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function formatDays(n: number): string {
  if (n < 1) return 'today';
  if (n === 1) return '1 day';
  if (n < 14) return `${n} days`;
  if (n < 60) return `${Math.round(n / 7)} weeks`;
  if (n < 730) return `${Math.round(n / 30.4)} months`;
  return `${(n / 365).toFixed(1)} years`;
}
