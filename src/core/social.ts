// Friends and guilds, the parts that need no network: who you are to friends, what you share, and the invite links.
// What is shared is small on purpose: a name, how the knight looks, the streak, how many verses are in each pile and how many
// reviews were done this week. Never the verses themselves. Presentation only: nothing here touches scheduling.
import { currentLook } from './avatar.ts';
import { dayKeyOf, type DayKey } from './dates.ts';
import { liveVerses, periodStart, streakInfo } from './schedule.ts';
import type { AppData, Pile } from './types.ts';

export interface Snapshot {
  look: Record<string, string>;
  streak: number;
  longest: number;
  counts: Record<Pile, number>;
  /** Counted reviews done this week (Sunday to Saturday). */
  week: number;
  weekStart: DayKey;
}

export interface FriendCard {
  id: string;
  name: string;
  snap: Snapshot;
  at: number;
}

export interface GuildView {
  id: string;
  name: string;
  owner: string;
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
  return { look: { ...currentLook(data) }, streak: streak.count, longest: streak.longest, counts, week: Math.min(week, 99999), weekStart };
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
