// The heart of the app: piles, due dates, daily spacing, graduation, freeze and streak.
// Everything here is a pure function of (data, now). Functions that change data mutate the
// object they are given; the app store clones before calling them (tests just call them).
//
// RULES (keep in sync with CLAUDE.md and the About screen):
//  * Days are local calendar days; they roll over at local midnight.
//  * Daily: 3 counted reviews per day, at least `spacingHours` apart. Weekly/Monthly/Yearly: one
//    counted review once the verse is due (7 days / 1 calendar month / 1 calendar year after the
//    later of its last counted review and the day it entered the pile).
//  * Extra practice is always allowed but never counted (and never stored).
//  * Graduation: Daily->Weekly after 90 progress days, Weekly->Monthly after 90, Monthly->Yearly
//    after 365. A "progress day" is a day after entering the pile that is not frozen.
//  * Freeze: a day is frozen when the 3 days before it were all "lapse days" (obligations existed
//    but nothing at all was reviewed) and nothing has been reviewed yet that day. Frozen days don't
//    add progress. Verses that already earned their promotion still move up.
//  * Streak: +1 for each day on which every due review was completed. Days with nothing due are
//    neutral (don't add, don't break). A day with an unmet obligation breaks the streak.
//    Verses added/moved today are exempt for today.
import {
  addDays,
  addMonths,
  addYears,
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

export const GRADUATION_DAYS = { daily: 90, weekly: 90, monthly: 365 } as const;
export const DAILY_REVIEWS = 3;
export const FREEZE_AFTER_DAYS = 3;
const HOUR = 3_600_000;
const KEEP_REVIEWS_MS = 60 * 24 * HOUR;

export function nextPile(p: Pile): Pile | null {
  return p === 'daily' ? 'weekly' : p === 'weekly' ? 'monthly' : p === 'monthly' ? 'yearly' : null;
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
  const oa = a?.o;
  const ob = b?.o;
  if (oa && ob) out.o = OUTCOME_RANK[oa] >= OUTCOME_RANK[ob] ? oa : ob;
  else if (oa || ob) out.o = (oa ?? ob) as DayOutcome;
  return out;
}

const isLapse = (data: AppData, day: DayKey) => {
  const e = data.ledger[day];
  return e?.o === 'm' && !e.r;
};

/** Does `day` add progress toward graduation? (see Freeze rule at top of file) */
export function dayGains(data: AppData, day: DayKey): boolean {
  if (data.ledger[day]?.r) return true;
  return !(
    isLapse(data, addDays(day, -1)) &&
    isLapse(data, addDays(day, -2)) &&
    isLapse(data, addDays(day, -FREEZE_AFTER_DAYS))
  );
}

export function isFrozen(data: AppData, now: number): boolean {
  return !dayGains(data, dayKeyOf(now));
}

/** How many more consecutive no-review days until progress freezes (0 = already frozen). */
export function daysUntilFreeze(data: AppData, now: number): number | null {
  const today = dayKeyOf(now);
  if (data.ledger[today]?.r) return null;
  let run = 0;
  for (let i = 1; i <= FREEZE_AFTER_DAYS; i++) {
    if (isLapse(data, addDays(today, -i))) run++;
    else break;
  }
  return FREEZE_AFTER_DAYS - run;
}

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

/** Day a Weekly/Monthly/Yearly verse is (or became) due. */
export function dueDay(v: Verse, beforeDay?: DayKey): DayKey {
  const last = lastReviewDay(v, beforeDay);
  const base = last && last > v.pileSince ? last : v.pileSince;
  switch (v.pile) {
    case 'weekly':
      return addDays(base, 7);
    case 'monthly':
      return addMonths(base, 1);
    case 'yearly':
      return addYears(base, 1);
    default:
      return base;
  }
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
}

export function verseStatus(data: AppData, v: Verse, now: number): VerseStatus {
  const today = dayKeyOf(now);
  const countedToday = reviewsOn(v, today);
  const required = v.pileSince < today;
  if (v.pile === 'daily') {
    if (countedToday >= DAILY_REVIEWS) return { state: 'done', required, countedToday };
    if (countedToday > 0) {
      const last = Math.max(...v.reviews.filter((t) => dayKeyOf(t) === today));
      const wait = last + data.prefs.value.spacingHours * HOUR - now;
      if (wait > 0) return { state: 'waiting', required, countedToday, waitMs: wait };
    }
    return { state: 'ready', required, countedToday };
  }
  const due = dueDay(v);
  const daysUntilDue = daysBetween(today, due);
  return { state: daysUntilDue <= 0 ? 'ready' : 'notdue', required, countedToday, due, daysUntilDue };
}

export function daysInPile(v: Verse, now: number): number {
  return Math.max(0, daysBetween(v.pileSince, dayKeyOf(now)));
}

/** Progress days earned toward graduation (0 for Yearly). */
export function progressDays(data: AppData, v: Verse, now: number): number {
  if (v.pile === 'yearly') return 0;
  const today = dayKeyOf(now);
  const span = daysBetween(v.pileSince, today);
  let n = 0;
  for (let i = 1; i <= span; i++) if (dayGains(data, addDays(v.pileSince, i))) n++;
  return n;
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
  for (const v of liveVerses(data)) {
    const s = verseStatus(data, v, now);
    if (!s.required) continue;
    if (v.pile === 'daily') {
      total++;
      if (s.state === 'done') met++;
      else if (s.state === 'ready') readyNow++;
    } else if (s.state === 'ready') {
      total++;
      readyNow++;
    } else if (s.countedToday > 0) {
      // periodic verse reviewed today: obligation met
      total++;
      met++;
    }
  }
  const remaining = total - met;
  const today = dayKeyOf(now);
  let outcome: TodaySummary['outcome'];
  if (data.ledger[today]?.o === 'c' || (total > 0 && remaining === 0)) outcome = 'c';
  else if (total === 0) outcome = 'n';
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

function computeDay(data: AppData, day: DayKey): { outcome: DayOutcome; reviewed: boolean } {
  let met = 0;
  let unmet = 0;
  let reviewed = false;
  for (const v of liveVerses(data)) {
    const n = reviewsOn(v, day);
    if (n > 0) reviewed = true;
    if (v.pileSince >= day) continue; // added / moved that day: exempt
    if (v.pile === 'daily') {
      if (n >= DAILY_REVIEWS) met++;
      else unmet++;
    } else if (dueDay(v, day) <= day) {
      if (n > 0) met++;
      else unmet++;
    }
  }
  return { outcome: unmet > 0 ? 'm' : met > 0 ? 'c' : 'n', reviewed };
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

  let start = addDays(data.settledThrough, 1);
  if (start < data.createdDay) start = data.createdDay;
  for (let d = start; d <= yesterday; d = addDays(d, 1)) {
    const { outcome, reviewed } = computeDay(data, d);
    const computed: LedgerDay = { o: outcome };
    if (reviewed) computed.r = 1;
    data.ledger[d] = mergeLedgerDay(data.ledger[d], computed);
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
    const span = daysBetween(v.pileSince, today);
    let got = 0;
    let hit: DayKey | null = null;
    for (let i = 1; i <= span; i++) {
      const d = addDays(v.pileSince, i);
      if (dayGains(data, d) && ++got === need) {
        hit = d;
        break;
      }
    }
    if (!hit) return;
    const lu: LevelUp = { id: `${v.id}:${to}:${hit}`, verseId: v.id, from: v.pile, to, day: hit };
    v.pile = to;
    v.pileSince = hit;
    v.pileAt = startOfLocalDay(hit);
    if (!data.levelUps.some((x) => x.id === lu.id)) {
      data.levelUps.push(lu);
      out.levelUps.push(lu);
    }
  }
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
    pileSince: today,
    pileAt: now,
    addedDay: today,
    createdAt: now,
    reviews: [],
  };
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
}

/** Manually move a verse. Returns what's needed to undo it. Progress restarts in the new pile. */
export function movePile(data: AppData, id: string, to: Pile, now: number): PileSnapshot {
  const v = data.verses[id];
  if (!v || v.deletedAt) throw new Error('Verse not found');
  const prev = { pile: v.pile, pileSince: v.pileSince };
  v.pile = to;
  v.pileSince = dayKeyOf(now);
  v.pileAt = now;
  return prev;
}

export function restorePile(data: AppData, id: string, snap: PileSnapshot, now: number): void {
  const v = data.verses[id];
  if (!v) return;
  v.pile = snap.pile;
  v.pileSince = snap.pileSince;
  v.pileAt = Math.max(now, v.pileAt + 1);
}

/**
 * Record a finished review. It *counts* only when the verse is ready (see verseStatus);
 * otherwise it is extra practice: it keeps the freeze at bay but doesn't touch the schedule.
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
  const summary = todaySummary(data, now);
  if (summary.total > 0 && summary.remaining === 0) {
    data.ledger[today] = mergeLedgerDay(data.ledger[today], { o: 'c' });
  }
  data.longestStreak = Math.max(data.longestStreak, streakInfo(data, now).count);
  return { counted, levelUps: settled.levelUps, todayComplete: summary.outcome === 'c' };
}

export function totalReviews(data: AppData): number {
  return Object.values(data.reviewsByDevice).reduce((a, b) => a + b, 0);
}
