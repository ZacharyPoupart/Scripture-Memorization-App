// The heart of the app: piles, due dates, daily spacing, graduation (progress days) and streak.
// Everything here is a pure function of (data, now). Functions that change data mutate the
// object they are given; the app store clones before calling them (tests just call them).
//
// RULES (keep in sync with CLAUDE.md and the About screen):
//  * Days are local calendar days; they roll over at local midnight.
//  * Daily: 3 counted reviews per day, at least `spacingHours` apart. Weekly/Monthly/Yearly follow the
//    calendar: one counted review in each week (Sunday to Saturday) / calendar month / calendar year.
//    Reviewed any time in the period = good until the next one starts; everything is due on the period's
//    last day (that is when a miss breaks the streak). Only the week a verse arrives in (from Daily) is a
//    free pass: a verse that moves up to Monthly or Yearly must be reviewed in that month / year.
//  * Extra practice is always allowed but never counted (and never stored).
//  * Graduation: Daily->Weekly after 90 progress days, Weekly->Monthly after 15 reviewed weeks,
//    Monthly->Yearly after 6 reviewed months. A "progress day" is a day after entering the pile on which the verse was up to date:
//    Daily, it got a counted review that day; Weekly/Monthly, it was reviewed in that week/month (the
//    whole period counts at once; a missed period never counts). Each verse keeps its own list of those days. There is no freeze: a day that does not count
//    just does not count, and nothing already earned is ever lost.
//  * Streak: +1 for each day on which every due verse got at least ONE counted review (three a day is
//    the goal for Daily, one keeps the flame). Practising on a day when nothing was due (e.g. the very
//    first day) also earns it. Days with nothing due and no practice are neutral. A due verse with no
//    review breaks the streak. Verses added/moved today are exempt for today.
//  * Break (pause): on paused days nothing is due and nothing can be missed (the streak waits, no lapse),
//    but no progress day is earned either - unless the user reviews anyway, which counts as a normal day.
//    Due dates of Weekly/Monthly/Yearly verses are not moved.
import {
  addDays,
  addMonths,
  dayKeyOf,
  daysBetween,
  startOfLocalDay,
  type DayKey,
} from './dates.ts';
import { uid } from './ids.ts';
import {
  DEFAULT_PREFS,
  type AppData,
  type DayOutcome,
  type LedgerDay,
  type LevelUp,
  type Pile,
  type Verse,
} from './types.ts';

/** What a verse has to earn to move up: Daily needs 90 days, Weekly 15 reviewed weeks, Monthly 6 reviewed months. */
export const GRADUATION_DAYS = { daily: 90, weekly: 15, monthly: 6 } as const;
/** The unit each pile counts its progress in. */
export const PROGRESS_UNIT = { daily: 'Day', weekly: 'Week', monthly: 'Month' } as const;
export const DAILY_REVIEWS = 3;
const HOUR = 3_600_000;
const KEEP_REVIEWS_MS = 60 * 24 * HOUR;

export function nextPile(p: Pile): Pile | null {
  return p === 'daily' ? 'weekly' : p === 'weekly' ? 'monthly' : p === 'monthly' ? 'yearly' : null;
}

export function previousPile(p: Pile): Pile | null {
  return p === 'yearly' ? 'monthly' : p === 'monthly' ? 'weekly' : p === 'weekly' ? 'daily' : null;
}

/** Restarts (wrong answers in a review that allows none) after which a Weekly/Monthly/Yearly verse is gently offered more frequent practice. */
export const STRUGGLE_RESTARTS = 2;

/** The pile to offer for a verse that took many tries, or null (Daily has nowhere lower, and a verse that just moved up is not offered anything). */
export function easierPile(pile: Pile, restarts: number): Pile | null {
  return restarts >= STRUGGLE_RESTARTS ? previousPile(pile) : null;
}

/** A verse moved back to Daily from the "needed a few tries" offer keeps all but this many days of Daily's progress. */
export const MOVE_DOWN_DAYS_LEFT = 7;

/** Days of credit to give a verse the owner moves down from the offer: back in Daily it only has a week to go (the other piles start fresh). */
export function moveDownDaysIn(to: Pile): number {
  return to === 'daily' ? GRADUATION_DAYS.daily - MOVE_DOWN_DAYS_LEFT : 0;
}

export function createData(now: number): AppData {
  const today = dayKeyOf(now);
  return {
    schema: 1,
    createdDay: today,
    verses: {},
    ledger: {},
    settledThrough: addDays(today, -1),
    levelUps: [],
    longestStreak: 0,
    reviewsByDevice: {},
    prefs: { value: { ...DEFAULT_PREFS }, at: 0 },
  };
}

export const liveVerses = (data: AppData): Verse[] => Object.values(data.verses).filter((v) => !v.deletedAt);

// ---------------------------------------------------------------- ledger helpers

const OUTCOME_RANK: Record<DayOutcome, number> = { n: 0, m: 1, c: 2 };

/** Merge two ledger entries for the same day: reviewed = OR, outcome precedence c > m > n. */
export function mergeLedgerDay(a: LedgerDay | undefined, b: LedgerDay | undefined): LedgerDay {
  const out: LedgerDay = {};
  if (a?.r || b?.r) out.r = 1;
  if (a?.p || b?.p) out.p = 1;
  const oa = a?.o;
  const ob = b?.o;
  if (oa && ob) out.o = OUTCOME_RANK[oa] >= OUTCOME_RANK[ob] ? oa : ob;
  else if (oa || ob) out.o = (oa ?? ob) as DayOutcome;
  return out;
}

/** Is `day` inside the user's current "break"? */
export function isPaused(data: AppData, day: DayKey): boolean {
  const p = data.pause;
  return !!p && day >= p.from && day <= p.until;
}

/** Start (or change) a break covering from..until inclusive. */
export function setPause(data: AppData, from: DayKey, until: DayKey, now: number): void {
  data.pause = { from, until, at: now };
}

/** End the break today: today is a normal day again; days already paused stay paused. */
export function endPause(data: AppData, now: number): void {
  if (!data.pause) return;
  const lastPausedDay = addDays(dayKeyOf(now), -1);
  data.pause = { from: data.pause.from, until: data.pause.until < lastPausedDay ? data.pause.until : lastPausedDay, at: now };
}

const isLapse = (data: AppData, day: DayKey) => {
  const e = data.ledger[day];
  return e?.o === 'm' && !e.r;
};

/** After a run of this many lapse days the OLD rule stopped counting days. Only used to carry over what verses had already earned. */
const LEGACY_FREEZE_AFTER_DAYS = 3;

/** The rule before v1.33.0: every day counted unless the 3 days before were all lapse days and nothing was reviewed that day. */
function legacyDayGains(data: AppData, day: DayKey): boolean {
  if (data.ledger[day]?.r) return true;
  if (data.ledger[day]?.p || isPaused(data, day)) return false;
  return !(
    isLapse(data, addDays(day, -1)) &&
    isLapse(data, addDays(day, -2)) &&
    isLapse(data, addDays(day, -LEGACY_FREEZE_AFTER_DAYS))
  );
}

/** What an older version had earned: the offsets of its progress days up to and including `through`. */
function legacyOffsets(data: AppData, v: Verse, through: DayKey): number[] {
  const out: number[] = [];
  const span = daysBetween(v.pileSince, through);
  for (let i = 1; i <= span; i++) if (legacyDayGains(data, addDays(v.pileSince, i))) out.push(i);
  return out;
}

// ---------------------------------------------------------------- calendar periods

/** Weeks run Sunday to Saturday, months and years are the calendar ones. */
export function periodStart(pile: Pile, day: DayKey): DayKey {
  if (pile === 'weekly') return addDays(day, -new Date(`${day}T00:00:00Z`).getUTCDay());
  if (pile === 'monthly') return `${day.slice(0, 7)}-01`;
  if (pile === 'yearly') return `${day.slice(0, 4)}-01-01`;
  return day;
}

/** Last day of the period holding `day`. */
export function periodEnd(pile: Pile, day: DayKey): DayKey {
  const start = periodStart(pile, day);
  if (pile === 'weekly') return addDays(start, 6);
  if (pile === 'monthly') return addDays(addMonths(start, 1), -1);
  if (pile === 'yearly') return `${day.slice(0, 4)}-12-31`;
  return day;
}

/** Was the verse counted-reviewed anywhere in the period holding `day` (up to and including `through`, default the period's end)? */
function reviewedInPeriod(v: Verse, day: DayKey, through?: DayKey): boolean {
  const start = periodStart(v.pile, day);
  const end = through && through < periodEnd(v.pile, day) ? through : periodEnd(v.pile, day);
  return v.reviews.some((t) => {
    const d = dayKeyOf(t);
    return d >= start && d <= end && d > v.pileSince; // the review that earned the move belongs to the old pile
  });
}

/** The week a verse arrives in from Daily is a free pass; its first requirement is the next week. Monthly and Yearly have no free pass. */
const inArrivalPeriod = (v: Verse, day: DayKey): boolean =>
  v.pile === 'weekly' && periodStart(v.pile, v.pileSince) === periodStart(v.pile, day);

/** Distinct reviewed periods among progress offsets (the free week never counts). */
function periodCount(v: Verse, offsets: number[]): number {
  return countedPeriods(v, offsets).length;
}
function countedPeriods(v: Verse, offsets: number[]): { start: DayKey; last: number }[] {
  const out: { start: DayKey; last: number }[] = [];
  for (const off of offsets) {
    const d = addDays(v.pileSince, off);
    const start = periodStart(v.pile, d);
    if (inArrivalPeriod(v, d)) continue;
    const prev = out[out.length - 1];
    if (prev && prev.start === start) prev.last = off;
    else out.push({ start, last: off });
  }
  return out;
}

/**
 * Does `day` count as a progress day for this verse in its current pile? Daily: a counted review that day. Weekly/Monthly: the
 * whole period counts once the verse was reviewed anywhere in it (never the period it arrived in). Yearly earns nothing.
 */
function dayCounts(_data: AppData, v: Verse, day: DayKey): boolean {
  if (v.pile === 'yearly' || day <= v.pileSince) return false;
  if (v.pile === 'daily') return reviewsOn(v, day) > 0;
  return !inArrivalPeriod(v, day) && reviewedInPeriod(v, day);
}

const range = (from: number, to: number): number[] => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Offsets of the days a review today earns: just today for Daily, the whole week/month for Weekly/Monthly (days still ahead included). */
function periodOffsets(v: Verse, today: DayKey): number[] {
  const first = v.pile === 'daily' ? today : periodStart(v.pile, today);
  const last = v.pile === 'daily' ? today : periodEnd(v.pile, today);
  return range(daysBetween(v.pileSince, first), daysBetween(v.pileSince, last)).filter((n) => n > 0);
}

/** Saved days plus today, if today already counts (so the ring moves the moment you review). Sorted. */
function offsetsWithToday(data: AppData, v: Verse, today: DayKey): number[] {
  if (v.pile === 'yearly') return [];
  const saved = v.prog ?? legacyOffsets(data, v, addDays(today, -1));
  if (!dayCounts(data, v, today)) return saved;
  const extra = periodOffsets(v, today);
  return unionSorted(saved, extra);
}

/** Days (offsets) from `from` to `to` that count for the verse as it is now. */
function recordDays(data: AppData, v: Verse, from: DayKey, to: DayKey): number[] {
  const out: number[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (dayCounts(data, v, d)) out.push(daysBetween(v.pileSince, d));
  return out;
}

const unionSorted = (a: number[], b: number[]): number[] => [...new Set([...a, ...b])].sort((x, y) => x - y);

// ---------------------------------------------------------------- verse timing

export function reviewsOn(v: Verse, day: DayKey): number {
  let n = 0;
  for (const t of v.reviews) if (dayKeyOf(t) === day) n++;
  return n;
}

/** Latest counted-review day strictly before `before` (or any day when omitted). */
export function lastReviewDay(v: Verse, before?: DayKey): DayKey | undefined {
  let best: DayKey | undefined;
  for (const t of v.reviews) {
    const d = dayKeyOf(t);
    if (before && d >= before) continue;
    if (!best || d > best) best = d;
  }
  return best;
}

/** Day a Weekly/Monthly/Yearly verse is (or became) due as of `day`: the start of this period, or of the next one when it is already covered. */
export function dueDay(v: Verse, day: DayKey): DayKey {
  if (v.pile === 'daily') return v.pileSince;
  if (inArrivalPeriod(v, day) || reviewedInPeriod(v, day, day)) return addDays(periodEnd(v.pile, day), 1);
  if (day <= v.pileSince) return addDays(v.pileSince, 1); // moved up today: the next review is tomorrow at the earliest
  return periodStart(v.pile, day);
}

export interface VerseStatus {
  /** ready: a counted review is available now. waiting: Daily, next review needs more spacing.
   *  done: Daily, all of today's reviews finished. notdue: Weekly/Monthly/Yearly, not due yet. */
  state: 'ready' | 'waiting' | 'done' | 'notdue';
  /** Does this verse have an unmet obligation today (or one already met)? Excludes verses added/moved today. */
  required: boolean;
  countedToday: number;
  waitMs?: number;
  /** Periodic piles: due day, and days until due (negative = overdue). */
  due?: DayKey;
  daysUntilDue?: number;
  /** Periodic piles: the last day of the week/month/year it belongs to (the day it must be done by). */
  periodEnd?: DayKey;
  period?: 'week' | 'month' | 'year';
}

export function verseStatus(data: AppData, v: Verse, now: number): VerseStatus {
  const today = dayKeyOf(now);
  const countedToday = reviewsOn(v, today);
  const required = v.pileSince < today && (v.pile === 'daily' || !inArrivalPeriod(v, today));
  if (v.pile === 'daily') {
    if (countedToday >= DAILY_REVIEWS) return { state: 'done', required, countedToday };
    if (countedToday > 0) {
      const last = Math.max(...v.reviews.filter((t) => dayKeyOf(t) === today));
      const wait = last + data.prefs.value.spacingHours * HOUR - now;
      if (wait > 0) return { state: 'waiting', required, countedToday, waitMs: wait };
    }
    return { state: 'ready', required, countedToday };
  }
  const due = dueDay(v, today);
  const daysUntilDue = daysBetween(today, due);
  return { state: daysUntilDue <= 0 ? 'ready' : 'notdue', required, countedToday, due, daysUntilDue, periodEnd: periodEnd(v.pile, today), period: v.pile === 'weekly' ? 'week' : v.pile === 'monthly' ? 'month' : 'year' };
}

export function daysInPile(v: Verse, now: number): number {
  return Math.max(0, daysBetween(v.pileSince, dayKeyOf(now)));
}

/** Progress earned toward graduation (0 for Yearly), including today once it counts: days for Daily, reviewed weeks / months for Weekly / Monthly. */
export function progressDays(data: AppData, v: Verse, now: number): number {
  const offsets = offsetsWithToday(data, v, dayKeyOf(now));
  return v.pile === 'daily' ? offsets.length : periodCount(v, offsets);
}

export function graduationTarget(p: Pile): number | null {
  return p === 'yearly' ? null : GRADUATION_DAYS[p];
}

/** Verses in a pile, longest-in-pile first. */
export function pileVerses(data: AppData, pile: Pile): Verse[] {
  return liveVerses(data)
    .filter((v) => v.pile === pile)
    .sort(
      (a, b) =>
        a.pileSince.localeCompare(b.pileSince) ||
        a.addedDay.localeCompare(b.addedDay) ||
        a.createdAt - b.createdAt ||
        a.id.localeCompare(b.id),
    );
}

// ---------------------------------------------------------------- today's obligations & streak

export interface TodaySummary {
  total: number;
  met: number;
  remaining: number;
  /** Required verses that can be reviewed right now. */
  readyNow: number;
  outcome: DayOutcome | 'pending';
}

export function todaySummary(data: AppData, now: number): TodaySummary {
  let total = 0;
  let met = 0;
  let readyNow = 0;
  // For the streak a Daily verse only needs ONE counted review today (aim for 3, but one keeps the flame).
  let streakMet = 0;
  let streakUnmet = 0;
  const onBreak = isPaused(data, dayKeyOf(now));
  for (const v of liveVerses(data)) {
    const s = verseStatus(data, v, now);
    if (!s.required || onBreak) continue;
    if (v.pile === 'daily') {
      total++;
      if (s.state === 'done') met++;
      else if (s.state === 'ready') readyNow++;
      if (s.countedToday >= 1) streakMet++;
      else streakUnmet++;
    } else if (s.state === 'ready') {
      total++;
      readyNow++;
      if (s.periodEnd === dayKeyOf(now)) streakUnmet++; // everything is due on the period's last day
    } else if (s.countedToday > 0) {
      // periodic verse reviewed today: obligation met
      total++;
      met++;
      streakMet++;
    }
  }
  const remaining = total - met;
  const today = dayKeyOf(now);
  const practiced = !!data.ledger[today]?.r;
  let outcome: TodaySummary['outcome'];
  if (data.ledger[today]?.o === 'c' || (streakUnmet === 0 && (streakMet > 0 || practiced))) outcome = 'c';
  else if (streakUnmet === 0) outcome = 'n';
  else outcome = 'pending';
  return { total, met, remaining, readyNow, outcome };
}

export interface StreakInfo {
  count: number;
  todayDone: boolean;
  /** Streak is alive but today's reviews are not finished yet. */
  atRisk: boolean;
  longest: number;
}

export function streakInfo(data: AppData, now: number): StreakInfo {
  const today = dayKeyOf(now);
  let count = 0;
  for (let d = addDays(today, -1); d >= data.createdDay; d = addDays(d, -1)) {
    const o = data.ledger[d]?.o;
    if (o === 'c') count++;
    else if (o === 'n') continue;
    else break;
  }
  const summary = todaySummary(data, now);
  const todayDone = summary.outcome === 'c';
  if (todayDone) count++;
  return {
    count,
    todayDone,
    atRisk: !todayDone && summary.outcome === 'pending' && count > 0,
    longest: Math.max(data.longestStreak, count),
  };
}

// ---------------------------------------------------------------- settling days & graduation

function computeDay(data: AppData, day: DayKey): { outcome: DayOutcome; reviewed: boolean; paused: boolean } {
  let met = 0;
  let unmet = 0;
  let reviewed = false;
  for (const v of liveVerses(data)) {
    const n = reviewsOn(v, day);
    if (n > 0) reviewed = true;
    if (v.pileSince >= day) continue; // added / moved that day: exempt
    if (v.pile === 'daily') {
      if (n >= 1) met++; // one counted review keeps the streak; three is the goal
      else unmet++;
    } else if (!inArrivalPeriod(v, day)) {
      if (n > 0) met++;
      else if (day === periodEnd(v.pile, day) && !reviewedInPeriod(v, day)) unmet++; // due on the period's last day
    }
  }
  const paused = isPaused(data, day);
  // On a break nothing can be missed: a day is either completed anyway ('c') or simply neutral ('n').
  const outcome: DayOutcome = unmet > 0 ? (paused ? 'n' : 'm') : met > 0 || reviewed ? 'c' : 'n';
  return { outcome, reviewed, paused };
}

export interface SettleResult {
  levelUps: LevelUp[];
}

/**
 * Bring the ledger up to date (writes an outcome for every finished day), then promote any
 * verse that has earned it. Safe to call as often as you like (idempotent for a given `now`).
 */
export function settle(data: AppData, now: number): SettleResult {
  const today = dayKeyOf(now);
  const yesterday = addDays(today, -1);
  const out: SettleResult = { levelUps: [] };

  // Verses saved by an older version carry what they had earned over, read once from the ledger with the old rule.
  for (const v of liveVerses(data)) if (v.prog === undefined) v.prog = v.pile === 'yearly' ? [] : legacyOffsets(data, v, data.settledThrough);

  let start = addDays(data.settledThrough, 1);
  if (start < data.createdDay) start = data.createdDay;
  for (let d = start; d <= yesterday; d = addDays(d, 1)) {
    const { outcome, reviewed, paused } = computeDay(data, d);
    const computed: LedgerDay = { o: outcome };
    if (reviewed) computed.r = 1;
    if (paused) computed.p = 1;
    data.ledger[d] = mergeLedgerDay(data.ledger[d], computed);
    // each verse keeps the days it was up to date
    for (const v of liveVerses(data)) if (dayCounts(data, v, d)) v.prog = unionSorted(v.prog ?? [], [daysBetween(v.pileSince, d)]);
  }
  if (data.settledThrough < yesterday) data.settledThrough = yesterday;

  // Graduation (oldest-in-pile first so ordering of level-up events is stable).
  for (const v of pileOrder(data)) graduate(data, v, today, out);

  // Housekeeping: prune old review timestamps, track the longest streak.
  for (const v of liveVerses(data)) pruneReviews(v, now);
  data.longestStreak = Math.max(data.longestStreak, streakInfo(data, now).count);
  return out;
}

function pileOrder(data: AppData): Verse[] {
  return liveVerses(data).sort((a, b) => a.pileSince.localeCompare(b.pileSince) || a.id.localeCompare(b.id));
}

function graduate(data: AppData, v: Verse, today: DayKey, out: SettleResult) {
  for (let guard = 0; guard < 4; guard++) {
    const to = nextPile(v.pile);
    if (!to) return;
    const need = GRADUATION_DAYS[v.pile as keyof typeof GRADUATION_DAYS];
    const days = offsetsWithToday(data, v, today);
    let reachedOffset: number;
    if (v.pile === 'daily') {
      if (days.length < need) return;
      reachedOffset = days[need - 1];
    } else {
      const periods = countedPeriods(v, days);
      if (periods.length < need) return;
      reachedOffset = periods[need - 1].last;
    }
    const hit = promotionDay(v, addDays(v.pileSince, reachedOffset), today);
    const lu: LevelUp = { id: `${v.id}:${to}:${hit}`, verseId: v.id, from: v.pile, to, day: hit };
    v.pile = to;
    v.pileSince = hit;
    v.pileAt = startOfLocalDay(hit);
    // the days since then are worked out again under the new pile's rule
    v.prog = to === 'yearly' ? [] : recordDays(data, v, addDays(hit, 1), data.settledThrough);
    if (!data.levelUps.some((x) => x.id === lu.id)) {
      data.levelUps.push(lu);
      out.levelUps.push(lu);
    }
  }
}

/** The day the promotion was earned: for Daily the day itself; for Weekly/Monthly the first review of the period that reached the target. */
function promotionDay(v: Verse, reached: DayKey, today: DayKey): DayKey {
  let hit = reached;
  if (v.pile !== 'daily') {
    const start = periodStart(v.pile, reached);
    const end = periodEnd(v.pile, reached);
    const firstReview = v.reviews.map(dayKeyOf).filter((d) => d >= start && d <= end).sort()[0];
    if (firstReview) hit = firstReview;
  }
  return hit > today ? today : hit;
}

function pruneReviews(v: Verse, now: number) {
  if (v.reviews.length <= 1) return;
  const cutoff = now - KEEP_REVIEWS_MS;
  const last = v.reviews[v.reviews.length - 1];
  v.reviews = v.reviews.filter((t) => t >= cutoff || t === last);
}

// ---------------------------------------------------------------- mutations

export interface NewVerse {
  book: number;
  chapter: number;
  start: number;
  end: number;
  translation: string;
  text: string;
  topic?: string;
  /** Optional: the verse is already part of your routine; start this many days into Daily (0 = brand new). */
  daysInPile?: number;
}

export function addVerse(data: AppData, input: NewVerse, now: number): Verse {
  const today = dayKeyOf(now);
  const v: Verse = {
    id: uid(),
    book: input.book,
    chapter: input.chapter,
    start: input.start,
    end: input.end,
    translation: input.translation,
    text: input.text.trim(),
    topic: (input.topic ?? '').trim(),
    contentAt: now,
    pile: 'daily',
    pileSince: addDays(today, -safeDaysIn('daily', input.daysInPile)),
    pileAt: now,
    addedDay: today,
    createdAt: now,
    reviews: [],
  };
  v.prog = range(1, safeDaysIn('daily', input.daysInPile)); // days claimed at the start are credited at once
  data.verses[v.id] = v;
  return v;
}

export function editVerse(data: AppData, id: string, patch: Partial<NewVerse>, now: number): Verse {
  const v = data.verses[id];
  if (!v || v.deletedAt) throw new Error('Verse not found');
  Object.assign(v, patch);
  v.text = v.text.trim();
  v.topic = (v.topic ?? '').trim();
  v.contentAt = now;
  return v;
}

export function deleteVerse(data: AppData, id: string, now: number): void {
  const v = data.verses[id];
  if (v) v.deletedAt = now;
}

export function restoreVerse(data: AppData, id: string, now: number): void {
  const v = data.verses[id];
  if (!v) return;
  delete v.deletedAt;
  v.contentAt = now;
}

export interface PileSnapshot {
  pile: Pile;
  pileSince: DayKey;
  prog?: number[];
}

/** Manually move a verse. Returns what's needed to undo it. Progress restarts in the new pile. */
/** Most days a verse may be told it has already spent in a pile: just under the graduation target. */
export function maxDaysIn(pile: Pile): number {
  // a little under what it takes to move up: 89 days, 13 weeks, 4 months
  return pile === 'daily' ? 89 : pile === 'weekly' ? 91 : pile === 'monthly' ? 120 : 366;
}

/** Whole days in [0, max for that pile]; anything else (negative, NaN, huge) is made safe. */
function safeDaysIn(pile: Pile, n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(maxDaysIn(pile), Math.max(0, Math.floor(n)));
}

/**
 * Move a verse to another pile. Progress restarts (pileSince = today) unless `daysIn` says the verse has
 * already been in that pile for a while ("start partway"): then pileSince is back-dated by that many days.
 */
export function movePile(data: AppData, id: string, to: Pile, now: number, daysIn = 0): PileSnapshot {
  const v = data.verses[id];
  if (!v || v.deletedAt) throw new Error('Verse not found');
  const prev: PileSnapshot = { pile: v.pile, pileSince: v.pileSince, prog: v.prog ? [...v.prog] : undefined };
  const claimed = safeDaysIn(to, daysIn);
  v.pile = to;
  v.pileSince = addDays(dayKeyOf(now), -claimed);
  v.pileAt = now;
  v.prog = to === 'yearly' ? [] : range(1, claimed); // a plain move restarts at zero; days claimed are credited at once
  return prev;
}

export function restorePile(data: AppData, id: string, snap: PileSnapshot, now: number): void {
  const v = data.verses[id];
  if (!v) return;
  v.pile = snap.pile;
  v.pileSince = snap.pileSince;
  if (snap.prog) v.prog = [...snap.prog];
  else delete v.prog;
  v.pileAt = Math.max(now, v.pileAt + 1);
}

/**
 * Record a finished review. It *counts* only when the verse is ready (see verseStatus);
 * otherwise it is extra practice: it doesn't touch the schedule.
 */
export function recordReview(
  data: AppData,
  verseId: string,
  now: number,
  deviceId: string,
): { counted: boolean; levelUps: LevelUp[]; todayComplete: boolean } {
  const settled = settle(data, now);
  const v = data.verses[verseId];
  if (!v || v.deletedAt) throw new Error('Verse not found');
  const today = dayKeyOf(now);
  const status = verseStatus(data, v, now);
  const counted = status.state === 'ready';
  data.ledger[today] = mergeLedgerDay(data.ledger[today], { r: 1 });
  if (counted) {
    if (!v.reviews.includes(now)) {
      v.reviews.push(now);
      v.reviews.sort((a, b) => a - b);
    }
    data.reviewsByDevice[deviceId] = (data.reviewsByDevice[deviceId] ?? 0) + 1;
  }
  if (counted && v.pile !== 'daily' && v.pile !== 'yearly' && !inArrivalPeriod(v, today)) v.prog = unionSorted(v.prog ?? [], periodOffsets(v, today));
  // a counted review can be the day that earns the promotion: it happens right now, not at midnight
  const levelUps = [...settled.levelUps];
  if (counted) graduate(data, v, today, { levelUps });
  const summary = todaySummary(data, now);
  if (summary.outcome === 'c') {
    data.ledger[today] = mergeLedgerDay(data.ledger[today], { o: 'c' });
  }
  data.longestStreak = Math.max(data.longestStreak, streakInfo(data, now).count);
  return { counted, levelUps, todayComplete: summary.total > 0 && summary.remaining === 0 };
}

export function totalReviews(data: AppData): number {
  return Object.values(data.reviewsByDevice).reduce((a, b) => a + b, 0);
}
