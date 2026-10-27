import type { PracticeOrder } from './practice.ts';
import type { DayKey } from './dates.ts';

export type Pile = 'daily' | 'weekly' | 'monthly' | 'yearly';
export const PILES: Pile[] = ['daily', 'weekly', 'monthly', 'yearly'];

export interface Verse {
  id: string;
  book: number; // 1..66
  chapter: number;
  start: number;
  end: number; // === start for a single verse
  translation: string;
  text: string;
  topic: string; // '' when none
  /** Last-writer-wins timestamp for the content fields above. */
  contentAt: number;
  pile: Pile;
  /** Local day the verse entered its current pile. */
  pileSince: DayKey;
  /** Last-writer-wins timestamp for pile + pileSince. */
  pileAt: number;
  addedDay: DayKey;
  createdAt: number;
  /** Timestamps of *counted* reviews (extra practice is not stored). Pruned to ~60 days + latest. */
  reviews: number[];
  /**
   * The days that have counted as progress toward the next pile, as offsets (1 = the day after `pileSince`), sorted. Together with
   * pile + pileSince it moves as a group when the pile changes. Absent on verses saved by older versions: settle() fills it in once
   * from the ledger so nothing already earned is lost.
   */
  prog?: number[];
  deletedAt?: number;
}

/** Outcome of a settled day: c = all due reviews done, m = some due review missed, n = nothing was due. */
export type DayOutcome = 'c' | 'm' | 'n';

export interface LedgerDay {
  /** 1 when any review (counted or extra practice) happened that day. */
  r?: 1;
  o?: DayOutcome;
  /** 1 when the day fell inside a "break" (pause): nothing was due, nothing was missed, no progress was earned. */
  p?: 1;
}

export interface LevelUp {
  /** Deterministic: `${verseId}:${to}:${day}` so every device derives the same id. */
  id: string;
  verseId: string;
  from: Pile;
  to: Pile;
  day: DayKey;
}

export interface SyncedPrefs {
  defaultTranslation: string;
  /** Minimum hours between counted reviews of a Daily verse. */
  spacingHours: number;
}

export interface AppData {
  schema: 1;
  createdDay: DayKey;
  verses: Record<string, Verse>;
  ledger: Record<DayKey, LedgerDay>;
  /** Last day (inclusive) whose outcome has been written to the ledger. */
  settledThrough: DayKey;
  levelUps: LevelUp[];
  longestStreak: number;
  /** Grow-only per-device counters of counted reviews (merge = max per device). */
  reviewsByDevice: Record<string, number>;
  prefs: { value: SyncedPrefs; at: number };
  /** An optional "break": days from..until (inclusive) are paused. The later decision (`at`) wins when devices sync. */
  pause?: { from: DayKey; until: DayKey; at: number };
  /** Optional avatar: items bought (grow-only, merged by union) and what is being worn (last decision `lookAt` wins). */
  avatar?: { owned: string[]; look: Partial<Record<string, string>>; lookAt: number };
  /** When the guided tour was finished (ms). Grow-only: merged with the latest. Unlocks the shield. */
  tourAt?: number;
  /** Who this person is for friends and guilds: a private random id and secret that never leave the synced, encrypted data (and your own backups). The earliest one wins when devices meet. */
  social?: { id: string; secret: string; at: number };
  /** What is shared with friends: the name they see and whether sharing is on. The later decision wins. */
  sharing?: { name: string; on: boolean; at: number };
  /** Extra coins earned by the streak multiplier, per device (each only grows; merged by taking the larger). Whole coins are summed. */
  coinBonus?: Record<string, number>;
  /** Weeks in which a guild this person is in reached its weekly goal (`<guild id>:<week start>`). Grow-only, merged by union; each is worth coins. */
  guildWins?: string[];
  /** Extra-practice reviews (ones that did not count for the schedule) done this week, per device, so they can count toward a guild's goal. Only the current week matters: a newer week replaces an older one, the same week keeps the larger count. Never earns coins. */
  extraWeek?: Record<string, { w: string; n: number }>;
}

export type ReviewMode = 'flashcard' | 'blanks' | 'type' | 'speak';
export type FillDifficulty = 'easy' | 'medium' | 'hard';
export type ThemePref = 'system' | 'light' | 'dark';

/** Device-local settings (not synced). */
export interface Settings {
  deviceId: string;
  theme: ThemePref;
  defaultMode: ReviewMode;
  fillDifficulty: FillDifficulty;
  onboarded: boolean;
  syncCode: string; // '' when sync is off
  lastExportAt: number;
  lastSyncAt: number;
  seenLevelUps: string[];
  /** Quiet sound on correct answers / completed reviews. Off by default. */
  soundOn: boolean;
  /** Milestone ids already celebrated on this device (e.g. "streak:7:2026-03-01"). */
  seenMilestones: string[];
  /** Last time the "back up your verses" nudge was dismissed (ms). */
  nudgeDismissedAt: number;
  /** Speak it: show the verse's words while you speak (read along), or keep them hidden until you finish (from memory). */
  speakWords: boolean;
  /** Visit the verses of a review session in a random order instead of longest-in-pile first. Off by default. */
  shuffle: boolean;
  /** What is asked before and after the verse in Fill in the blank, Type it out and Speak it (the topic and the citation). */
  practice: PracticeOrder;
  /** Show the avatar and seeds on Today. On by default; switching off only hides them. */
  avatarOn: boolean;
  /** Achievement items (sword, shield) already shown in the "new item" popup on this device; `null` until first looked at (then everything already earned is just remembered). */
  seenUnlocks: string[] | null;
  /** The latest streak-saved day this device has already shown the "we saved your streak" popup for (empty until one is shown). */
  seenSaved: string;
  /** How the verse lists are sorted (Piles and each pile page). Remembered between visits and launches, so it is not chosen again every time. */
  listSort: 'longest' | 'reference' | 'added' | 'due';
  /** The guided tour: lesson ids this device has finished (so the menu can tick them). */
  tour: { done: string[] };
}

export const TRANSLATIONS = ['ESV', 'NIV', 'NLT', 'NASB', 'NKJV', 'CSB', 'KJV', 'WEB'] as const;

export const DEFAULT_PREFS: SyncedPrefs = { defaultTranslation: 'ESV', spacingHours: 2 };
