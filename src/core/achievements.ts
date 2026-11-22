// Achievements (v1.85.0, owner-requested: "achievements ... compounding, so like a bronze silver and gold each doing the same thing
// but more"). Each achievement counts one thing and has three medals, bronze, silver and gold, at rising counts. Everything is worked
// out from what is already saved (like coins), so nothing new is stored in the synced data and devices agree; the one exception is
// game stars, which live on each device (`settings.gameBest`). A medal, once shown on a device, stays (`settings.seenAchievements`),
// even if its count later drops (a verse deleted or moved down): nothing earned is ever taken away. Pure: no DOM, no clock of its own.
import { totalStars, type Best } from './games.ts';
import { liveVerses, streakInfo, totalReviews } from './schedule.ts';
import type { AppData } from './types.ts';

export const TIERS = ['bronze', 'silver', 'gold'] as const;
export type Tier = (typeof TIERS)[number];
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

export interface AchievementContext {
  data: AppData;
  now: number;
  /** This device's personal bests in the games (`settings.gameBest`), for the stars. */
  gameBest?: Record<string, Best>;
}

export interface Achievement {
  id: string;
  name: string;
  /** What is counted, for "12 days" and the like (singular, plural). */
  unit: [string, string];
  /** One line saying what a medal asks for, given its count: "Keep a 7-day streak". */
  ask: (n: number) => string;
  /** The counts for bronze, silver and gold. */
  at: readonly [number, number, number];
  count: (c: AchievementContext) => number;
  /** A line pictogram from ui/marks.tsx, drawn on the medal. */
  mark: 'flame' | 'book' | 'cards' | 'sprout' | 'tree' | 'burst' | 'piles' | 'pair' | 'leaf';
}

const everReached = (data: AppData, piles: readonly string[]) => {
  const ids = new Set(data.levelUps.filter((l) => piles.includes(l.to)).map((l) => l.verseId));
  for (const v of liveVerses(data)) if (piles.includes(v.pile)) ids.add(v.id);
  return ids.size;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'faithful',
    name: 'Faithful',
    unit: ['day', 'days'],
    ask: (n) => `Keep a ${n}-day streak`,
    at: [7, 30, 100],
    count: ({ data, now }) => Math.max(data.longestStreak, streakInfo(data, now).count),
    mark: 'flame',
  },
  {
    id: 'treasured',
    name: 'Hidden in my heart',
    unit: ['verse', 'verses'],
    ask: (n) => `Add ${n} verses`,
    at: [5, 20, 50],
    count: ({ data }) => liveVerses(data).length,
    mark: 'book',
  },
  {
    id: 'steady',
    name: 'Steady hand',
    unit: ['review', 'reviews'],
    ask: (n) => `Complete ${n.toLocaleString()} reviews`,
    at: [50, 500, 2500],
    count: ({ data }) => totalReviews(data),
    mark: 'cards',
  },
  {
    id: 'rooted',
    name: 'Taking root',
    unit: ['verse', 'verses'],
    ask: (n) => `Move ${n} ${n === 1 ? 'verse' : 'verses'} up to Weekly or beyond`,
    at: [1, 10, 30],
    count: ({ data }) => everReached(data, ['weekly', 'monthly', 'yearly']),
    mark: 'sprout',
  },
  {
    id: 'forlife',
    name: 'For life',
    unit: ['verse', 'verses'],
    ask: (n) => `Keep ${n} ${n === 1 ? 'verse' : 'verses'} in Yearly`,
    at: [1, 5, 20],
    count: ({ data }) => everReached(data, ['yearly']),
    mark: 'tree',
  },
  {
    id: 'everyword',
    name: 'Every word',
    unit: ['full day', 'full days'],
    ask: (n) => `Finish ${n} full days (every review of the day done)`,
    at: [7, 30, 100],
    count: ({ data }) => Object.values(data.ledger).filter((e) => e.f).length,
    mark: 'burst',
  },
  {
    id: 'wholecounsel',
    name: 'The whole counsel',
    unit: ['book', 'books'],
    ask: (n) => `Learn verses from ${n} books of the Bible`,
    at: [5, 15, 30],
    count: ({ data }) => new Set(liveVerses(data).map((v) => v.book)).size,
    mark: 'piles',
  },
  {
    id: 'champion',
    name: 'Champion',
    unit: ['star', 'stars'],
    ask: (n) => `Win ${n} stars in the games`,
    at: [10, 60, 200],
    count: ({ gameBest }) => totalStars(gameBest ?? {}),
    mark: 'leaf',
  },
  {
    id: 'fellowship',
    name: 'Fellowship',
    unit: ['goal', 'goals'],
    ask: (n) => `Reach your group's weekly goal ${n === 1 ? 'once' : `${n} times`}`,
    at: [1, 5, 20],
    count: ({ data }) => data.guildWins?.length ?? 0,
    mark: 'pair',
  },
];

/** A medal's id: `<achievement>:<tier>`, e.g. "faithful:silver". */
export const medalId = (id: string, tier: Tier) => `${id}:${tier}`;

export interface AchievementState {
  achievement: Achievement;
  count: number;
  /** The best medal held: earned by the count now, or already shown on this device. */
  tier: Tier | null;
  /** The next medal and what it needs, or null when gold is held. */
  next: { tier: Tier; at: number } | null;
  /** 0 to 1 toward the next medal (1 when gold is held). */
  progress: number;
}

/** Every achievement with its count, medal and the way to the next one. `seen` are medal ids already shown on this device (kept). */
export function achievementStates(c: AchievementContext, seen: readonly string[] = []): AchievementState[] {
  const kept = new Set([...seen, ...(c.data.medals ?? [])]); // recorded (synced) or shown here: kept
  return ACHIEVEMENTS.map((a) => {
    const count = a.count(c);
    let held = -1;
    TIERS.forEach((t, i) => {
      if (count >= a.at[i] || kept.has(medalId(a.id, t))) held = i;
    });
    const nextIdx = held + 1 < TIERS.length ? held + 1 : -1;
    const from = held >= 0 ? a.at[held] : 0;
    const next = nextIdx >= 0 ? { tier: TIERS[nextIdx], at: a.at[nextIdx] } : null;
    const progress = next ? Math.max(0, Math.min(1, (count - from) / (next.at - from))) : 1;
    return { achievement: a, count, tier: held >= 0 ? TIERS[held] : null, next, progress };
  });
}

/** The medal ids the counts earn right now (every tier reached, not just the best). */
export function earnedMedals(c: AchievementContext): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    const n = a.count(c);
    TIERS.forEach((t, i) => {
      if (n >= a.at[i]) out.push(medalId(a.id, t));
    });
  }
  return out;
}

/**
 * Medals earned but not yet shown on this device, in the order to show them (bronze before silver before gold). `seen` null means
 * this device has never looked: then nothing is announced, and what is already earned is only remembered (so an update does not
 * open with a pile of pop-ups for things done long ago).
 */
export function freshMedals(earned: readonly string[], seen: readonly string[] | null): string[] {
  if (seen === null) return [];
  const s = new Set(seen);
  const order = (id: string) => TIERS.indexOf(id.split(':')[1] as Tier);
  return earned.filter((id) => !s.has(id)).sort((a, b) => order(a) - order(b));
}

/**
 * Record the medals the counts have earned and that are not recorded yet, in `data.medals` (grow-only; each pays `MEDAL_COINS`
 * once). Returns the ones just recorded. Called when the data changes, never in the tour's sandbox.
 */
export function recordMedals(c: AchievementContext): string[] {
  const have = new Set(c.data.medals ?? []);
  const fresh = earnedMedals(c).filter((id) => !have.has(id));
  if (fresh.length) c.data.medals = [...have, ...fresh].sort();
  return fresh;
}

/**
 * Medals waiting to be shown, one entry per achievement with the best new tier (bronze and silver for the same streak show as
 * silver), in the order of `ACHIEVEMENTS`, so several at once (a restored backup, a sync) are one card, not a chain of pop-ups.
 */
export function newMedalGroups(fresh: readonly string[]): { achievement: Achievement; tier: Tier; ids: string[] }[] {
  const out: { achievement: Achievement; tier: Tier; ids: string[] }[] = [];
  for (const a of ACHIEVEMENTS) {
    const ids = fresh.filter((id) => id.split(':')[0] === a.id);
    const tiers = ids.map((id) => TIERS.indexOf(id.split(':')[1] as Tier)).filter((i) => i >= 0);
    if (tiers.length) out.push({ achievement: a, tier: TIERS[Math.max(...tiers)], ids });
  }
  return out;
}

/** How many medals there are, and how many are held. */
export function medalTally(states: readonly AchievementState[]): { held: number; total: number } {
  return { held: states.reduce((n, s) => n + (s.tier ? TIERS.indexOf(s.tier) + 1 : 0), 0), total: states.length * TIERS.length };
}

/**
 * Knightly ranks (v1.87.0, owner-requested "more medieval/knight game themed ... training and fighting and rewards"), earned by the
 * medals held: bronze, silver and gold each count one (gold in an achievement is three). Worked out from the medals, so nothing new
 * is stored, devices agree, and a rank once held stays, as the medals do. Legend is every medal there is.
 */
export const RANKS: readonly { name: string; at: number }[] = [
  { name: 'Page', at: 0 },
  { name: 'Squire', at: 2 },
  { name: 'Knight', at: 5 },
  { name: 'Captain', at: 9 },
  { name: 'Champion', at: 14 },
  { name: 'Paladin', at: 20 },
  { name: 'Legend', at: ACHIEVEMENTS.length * TIERS.length },
];

/** The rank for a number of medals held, and the next one with how many medals it needs (null at Legend). */
export function rankFor(held: number): { name: string; index: number; next: { name: string; at: number } | null } {
  let index = 0;
  RANKS.forEach((r, i) => {
    if (held >= r.at) index = i;
  });
  const next = RANKS[index + 1] ?? null;
  return { name: RANKS[index].name, index, next };
}

/** How many medals a list of medal ids holds: per achievement, its best tier counts with the ones below it (silver is two). */
export function heldMedals(ids: readonly string[]): number {
  const best = new Map<string, number>();
  for (const id of ids) {
    const [a, t] = id.split(':');
    const i = TIERS.indexOf(t as Tier);
    if (i < 0 || !achievementById(a)) continue;
    best.set(a, Math.max(best.get(a) ?? -1, i));
  }
  let n = 0;
  for (const i of best.values()) n += i + 1;
  return n;
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
