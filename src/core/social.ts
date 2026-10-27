// Friends and guilds, the parts that need no network: who you are to friends, what you share, and the invite links.
// What is shared is small on purpose: a name, how the knight looks, the streak, how many verses are in each pile and how many
// reviews were done this week. Never the verses themselves. Presentation only: nothing here touches scheduling.
import { isInappropriate } from '../../functions/_lib/moderation.js';
import { currentLook } from './avatar.ts';
import { addDays, dayKeyOf, type DayKey } from './dates.ts';
import { liveVerses, periodEnd, periodStart, streakInfo } from './schedule.ts';
import type { AppData, Pile } from './types.ts';

export interface Snapshot {
  look: Record<string, string>;
  streak: number;
  longest: number;
  counts: Record<Pile, number>;
  /** Counted reviews done this week (Sunday to Saturday). */
  week: number;
  weekStart: DayKey;
  /** Reviews that are due of this person this week (what their share of a guild's goal is made of). Absent from older versions. */
  due?: number;
  /** Extra-practice reviews this week (they count toward a guild's goal but not for the schedule). Absent from older versions. */
  extra?: number;
}

export interface FriendCard {
  id: string;
  name: string;
  snap: Snapshot;
  at: number;
}

export interface Cheer {
  id: string;
  name: string;
  at: number;
}

export interface GuildView {
  id: string;
  name: string;
  owner: string;
  /** The banner its leader designed (`design-field-pattern`); absent until they do, then the app shows a default. */
  banner?: string;
  members: FriendCard[];
  weekStart: DayKey;
  goal: number;
  progress: number;
}

export const MAX_NAME = 40;
export const MAX_GUILD_NAME = 30;

/** The same rules the server applies: one line of plain text, no invisible characters. */
export function cleanName(raw: string, max = MAX_NAME): string {
  return raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A fresh private identity: a random id (shared with friends' devices) and a random secret (never shown, never shared). */
export function newIdentity(now: number, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): NonNullable<AppData['social']> {
  return { id: hex(random(16)), secret: base64url(random(32)), at: now };
}

/**
 * How many reviews are due of this person in the week of `now` (Sunday to Saturday): a Daily verse is due 3 times on each
 * day after the one it arrived, a Weekly verse once (Saturday), a Monthly or Yearly verse once in the week its month or year
 * ends. A guild's weekly goal is every member's number added up. Read-only: it never affects scheduling.
 */
export function weeklyDue(data: AppData, now: number): number {
  const weekStart = periodStart('weekly', dayKeyOf(now));
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  let n = 0;
  for (const v of liveVerses(data)) {
    for (const d of days) {
      if (d <= v.pileSince) continue; // added or moved that day: nothing is due yet
      if (v.pile === 'daily') n += 3;
      else if (periodEnd(v.pile, d) === d) n += 1;
    }
  }
  return n;
}

/**
 * The guild goals that have been reached this week and not yet paid out to this person. A goal pays once per guild per week,
 * only for a group of at least two, and only to someone who did a counted review of their own that week.
 */
export function guildWinsToClaim(data: AppData, guilds: GuildView[], meId: string, now: number): string[] {
  const thisWeek = periodStart('weekly', dayKeyOf(now));
  const have = new Set(data.guildWins ?? []);
  const out: string[] = [];
  for (const g of guilds) {
    const id = `${g.id}:${g.weekStart}`;
    if (g.weekStart !== thisWeek || g.members.length < 2 || g.goal <= 0 || g.progress < g.goal || have.has(id)) continue;
    const mine = g.members.find((m) => m.id === meId);
    if (!mine || mine.snap.weekStart !== g.weekStart || mine.snap.week + (mine.snap.extra ?? 0) < 1) continue;
    out.push(id);
  }
  return out;
}

/** Is this name fit to show other people? The server checks the same rule and has the last word. */
export const nameAllowed = (name: string): boolean => !isInappropriate(name);

/** What the group's reward chest looks like: locked for a group of one (the reward is for two or more), open once the goal is reached. */
export function chestState(g: { members: unknown[]; progress: number; goal: number }): 'locked' | 'closed' | 'open' {
  if (g.members.length < 2) return 'locked';
  return g.goal > 0 && g.progress >= g.goal ? 'open' : 'closed';
}

/** The moment a group's week is over: local midnight after its Saturday (so the new goal starts at Saturday midnight). */
export function weekEndsAt(weekStart: DayKey): number {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(y, m - 1, d + 7).getTime();
}

/** How long is left in the week: whole days until the last day, then hours and minutes, then minutes. */
export function countdownText(ms: number): string {
  if (ms <= 0) return 'A new week is starting';
  const mins = Math.ceil(ms / 60000);
  if (ms > 24 * 3600000) {
    const days = Math.ceil(ms / (24 * 3600000));
    return `${days} days left`; // always 2 or more here
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 1) return m ? `${h} h ${m} min left` : `${h} h left`;
  return `${m} min left`;
}

/** What a friend can see about you right now. */
export function socialSnapshot(data: AppData, now: number): Snapshot {
  const today = dayKeyOf(now);
  const weekStart = periodStart('weekly', today);
  const counts: Record<Pile, number> = { daily: 0, weekly: 0, monthly: 0, yearly: 0 };
  let week = 0;
  for (const v of liveVerses(data)) {
    counts[v.pile]++;
    for (const t of v.reviews) {
      const d = dayKeyOf(t);
      if (d >= weekStart && d <= today) week++;
    }
  }
  const streak = streakInfo(data, now);
  const extra = Object.values(data.extraWeek ?? {}).reduce((n, e) => (e.w === weekStart ? n + e.n : n), 0);
  return { look: { ...currentLook(data) }, streak: streak.count, longest: streak.longest, counts, week: Math.min(week, 99999), weekStart, due: Math.min(weeklyDue(data, now), 99999), extra: Math.min(extra, 99999) };
}

export const sameSnapshot = (a: Snapshot | null, b: Snapshot | null): boolean => !!a && !!b && JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- invite codes and links

export const CODE_PATTERN = /[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}/;

/** "ABCDEFGH" -> "ABCD-EFGH" (easier to read out loud). */
export const formatCode = (code: string): string => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Finds an invite code in whatever was pasted or typed: the bare code, with or without a dash or spaces, or a whole link. */
export function codeFrom(text: string): string | null {
  const link = /#\/join\/([A-Za-z0-9-]+)/.exec(text);
  const raw = (link ? link[1] : text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = CODE_PATTERN.exec(raw);
  return m && raw.length === 8 ? m[0] : null;
}

export const inviteLink = (origin: string, code: string): string => `${origin}/#/join/${code}`;
export const guildLink = (origin: string, code: string): string => `${origin}/#/guild/${code}`;

export function inviteMessage(link: string, name: string): string {
  return `${name ? `${name} here. ` : ''}Join me on Memorize For Life, an app to learn Bible verses together: ${link}`;
}

/** "Zach P." -> "Z", for a small round avatar when there is no picture. */
export const initialOf = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();

/** "Sam L. cheered you!", "Sam L. and Ana B. cheered you!", "Sam L., Ana B. and 2 others cheered you!" */
export function cheerLine(names: string[]): string {
  const uniq = [...new Set(names)];
  if (uniq.length === 1) return `${uniq[0]} cheered you!`;
  if (uniq.length === 2) return `${uniq[0]} and ${uniq[1]} cheered you!`;
  return `${uniq[0]}, ${uniq[1]} and ${uniq.length - 2} other${uniq.length === 3 ? '' : 's'} cheered you!`;
}
