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
  deletedAt?: number;
}

/** Outcome of a settled day: c = all due reviews done, m = some due review missed, n = nothing was due. */
export type DayOutcome = 'c' | 'm' | 'n';

export interface LedgerDay {
  /** 1 when any review (counted or extra practice) happened that day. */
  r?: 1;
  o?: DayOutcome;
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
}

export const TRANSLATIONS = ['ESV', 'NIV', 'NLT', 'NASB', 'NKJV', 'CSB', 'KJV', 'WEB'] as const;

export const DEFAULT_PREFS: SyncedPrefs = { defaultTranslation: 'ESV', spacingHours: 2 };
