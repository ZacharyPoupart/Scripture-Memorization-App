// The little schedule simulator inside the tour ("Watch it happen"). It runs the REAL schedule functions on throw-away data
// at a pretend date, so what it shows can never disagree with the app. Nothing here touches the owner's data or the clock.
import { addDays, dayKeyOf, startOfLocalDay, type DayKey } from './dates.ts';
import {
  GRADUATION_DAYS,
  PROGRESS_UNIT,
  addVerse,
  createData,
  progressDays,
  recordReview,
  settle,
  streakInfo,
  verseStatus,
} from './schedule.ts';
import type { AppData, Pile } from './types.ts';

const HOUR = 3_600_000;
const START_DAY: DayKey = '2026-03-02';
const DEVICE = 'tour-sim';

export interface Sim {
  data: AppData;
  id: string;
  /** The pretend moment. */
  now: number;
  log: string[];
}

export interface SimView {
  pile: Pile;
  /** e.g. "Day 84 of 90". Empty once the verse is in Yearly. */
  progress: string;
  /** What the verse wants now: a short, plain sentence. */
  status: string;
  streak: number;
  canReview: boolean;
  /** The pretend date, e.g. "Mon, Mar 2". */
  date: string;
}

const clone = (s: Sim): Sim => ({ ...s, data: structuredClone(s.data), log: [...s.log] });
const at8 = (day: DayKey) => startOfLocalDay(day) + 8 * HOUR;

/** A verse already 84 days into Daily, so a few reviewed days show it moving up. */
export function newSim(): Sim {
  const now = at8(START_DAY);
  const data = createData(now);
  const v = addVerse(data, { book: 19, chapter: 23, start: 1, end: 1, translation: 'KJV', text: 'The LORD is my shepherd; I shall not want.', daysInPile: 84 }, now);
  return { data, id: v.id, now, log: [] };
}

export function simView(sim: Sim): SimView {
  const v = sim.data.verses[sim.id];
  const status = verseStatus(sim.data, v, sim.now);
  const target = v.pile === 'yearly' ? null : GRADUATION_DAYS[v.pile];
  const unit = v.pile === 'yearly' ? '' : PROGRESS_UNIT[v.pile as keyof typeof PROGRESS_UNIT];
  const earned = progressDays(sim.data, v, sim.now);
  let text: string;
  if (v.pile === 'daily') text = status.state === 'ready' ? 'Ready for a review today' : status.state === 'waiting' ? 'Done for now; another later today' : 'All done for today';
  else if (status.state === 'ready') text = v.pile === 'weekly' ? 'Ready any day this week' : v.pile === 'monthly' ? 'Ready any day this month' : 'Ready any day this year';
  else text = 'Covered until the next ' + (v.pile === 'weekly' ? 'week' : v.pile === 'monthly' ? 'month' : 'year');
  return {
    pile: v.pile,
    progress: target ? `${unit} ${earned} of ${target}` : 'Kept for life',
    status: text,
    streak: streakInfo(sim.data, sim.now).count,
    canReview: status.state === 'ready',
    date: new Date(sim.now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}

/** One review now, if the verse is ready; moves the pretend clock on a little so a Daily verse can be reviewed again later. */
export function simReview(sim: Sim): Sim {
  const next = clone(sim);
  const v = next.data.verses[next.id];
  if (verseStatus(next.data, v, next.now).state !== 'ready') return next;
  const before = v.pile;
  const r = recordReview(next.data, next.id, next.now, DEVICE);
  const after = next.data.verses[next.id].pile;
  next.log.push(r.counted ? `${label(next.now)}: reviewed` : `${label(next.now)}: extra practice`);
  if (after !== before) next.log.push(`Moved up to ${after[0].toUpperCase()}${after.slice(1)}!`);
  if (dayKeyOf(next.now + 2 * HOUR) === dayKeyOf(next.now)) next.now += 2 * HOUR;
  return next;
}

/** Move to the morning of a later day. With `review`, the verse is reviewed (if ready) on every day passed through, including the last. */
export function simAdvance(sim: Sim, days: number, review: boolean): Sim {
  let next = clone(sim);
  for (let i = 0; i < days; i++) {
    if (review) next = simReview(next);
    next.now = at8(addDays(dayKeyOf(next.now), 1));
    settle(next.data, next.now);
  }
  if (review) next = simReview(next);
  else next.log.push(`${days === 1 ? 'A day' : `${days} days`} passed with no review`);
  return next;
}

function label(now: number): string {
  return new Date(now).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
