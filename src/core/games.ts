// Minigames with the knight (v1.75.0, owner-requested: real-time games as the focal point). Pure logic only: what is asked and
// what counts as right (the real-time games' simulations are in gate.ts and burrows.ts). A game that is WON within the pile's mistake allowance is
// recorded through the same `completeReview` as any other review type (see ui/games/Play.tsx); nothing else is saved.
import { makeRng, mistakesAllowed, shuffle } from './quiz.ts';
import type { Pile } from './types.ts';
import { tokenize, type Word } from './text.ts';

export type GameId = 'gate' | 'burrows' | 'duel' | 'bridge';
/**
 * Coin bonus for a game won with stars (v1.81.0, owner-requested "a bonus 2x multiplier if they 3 star"): the coins a counted
 * win earns are multiplied by this, on top of the streak multiplier. Stars not listed earn the usual coins.
 */
export const STAR_BONUS: Readonly<Record<number, number>> = { 3: 2 };
export function starBonus(stars: number): number {
  return STAR_BONUS[stars] ?? 1;
}

/** The pause before a game starts, showing which verse it is (v1.81.0, owner-requested); a tap starts it sooner. */
export const INTRO_MS = 3000;

export const GAMES: { id: GameId; name: string; blurb: string }[] = [
  { id: 'gate', name: 'Hold the Gate', blurb: 'Tap the first letter of the next word before the goblin reaches the gate.' },
  { id: 'burrows', name: 'Goblin Burrows', blurb: 'Bonk the goblin holding the next word.' },
  { id: 'duel', name: 'Dragon Duel', blurb: 'Strike with the next word before the fire comes.' },
  { id: 'bridge', name: 'Bridge Run', blurb: 'Lay each word in order before the knight reaches the edge.' },
];

/** "Play today's reviews" (v1.79.0): a random game for each verse, never the same one twice in a row. */
export function runGames(n: number, random: () => number = Math.random): GameId[] {
  const out: GameId[] = [];
  for (let i = 0; i < n; i++) {
    const pool = GAMES.map((g) => g.id).filter((id) => id !== out[i - 1]);
    out.push(pool[Math.floor(random() * pool.length)]);
  }
  return out;
}

// ---------------------------------------------------------------- score, combo and personal bests (shared by every game)

/** Right answers in a row make each one worth more: x1.5 from 5, x2 from 10, x3 from 20. A slip starts it again. */
export function comboMultiplier(combo: number): number {
  return combo >= 20 ? 3 : combo >= 10 ? 2 : combo >= 5 ? 1.5 : 1;
}
/** The combo counts at which the multiplier steps up (a bigger celebration). */
export const COMBO_TIERS = [5, 10, 20] as const;
export const isComboTier = (combo: number) => (COMBO_TIERS as readonly number[]).includes(combo);

/**
 * Points for one right answer: 10 times the combo multiplier (the combo including this answer), plus up to 5 for speed.
 * `quick` is how much of the time was left, 0 to 1.
 */
export function points(combo: number, quick = 0): number {
  return Math.round(10 * comboMultiplier(combo)) + Math.round(5 * Math.max(0, Math.min(1, quick)));
}

export interface Best {
  stars: number;
  score: number;
}
export const bestKey = (game: GameId, verseId: string) => `${game}:${verseId}`;

/**
 * A finished game against what this device has kept (device-only, `settings.gameBest`). Only wins are kept. Returns the new
 * table (unchanged when nothing improved) and what is new, so the result can celebrate it.
 */
export function recordBest(table: Record<string, Best>, key: string, run: Best & { won: boolean }): { table: Record<string, Best>; newScore: boolean; newStars: boolean } {
  const old = table[key];
  if (!run.won) return { table, newScore: false, newStars: false };
  const newScore = !old || run.score > old.score;
  const newStars = !old || run.stars > old.stars;
  if (!newScore && !newStars) return { table, newScore, newStars };
  return { table: { ...table, [key]: { stars: Math.max(run.stars, old?.stars ?? 0), score: Math.max(run.score, old?.score ?? 0) } }, newScore: newScore && !!old, newStars };
}

/** Stars collected for one verse across every game (the best of each), and in all. */
export const verseStars = (table: Record<string, Best>, verseId: string) => GAMES.reduce((n, g) => n + (table[bestKey(g.id, verseId)]?.stars ?? 0), 0);
/** Stars from the games there are now (the games retired in v1.78.0 keep their entries on the device but no longer count). */
export const totalStars = (table: Record<string, Best>) =>
  Object.entries(table).reduce((n, [k, b]) => n + (GAMES.some((g) => k.startsWith(`${g.id}:`)) ? (b?.stars ?? 0) : 0), 0);

/**
 * Does this game count as the verse's review? Only a win, and only within the pile's usual mistake allowance (Daily forgives 3
 * slips, the other piles none), exactly as the other review types. The caller then records it with `completeReview`.
 */
export const gameCounts = (pile: Pile, won: boolean, slips: number): boolean => won && slips <= mistakesAllowed(pile);

/** How long the dragon takes to draw breath (ms): it gets quicker as the verse goes on. `progress` is 0 to 1. */
export const duelChargeMs = (progress: number) => 7000 - 2600 * Math.max(0, Math.min(1, progress));
/** How long the knight takes to walk one plank (ms). */
export const BRIDGE_PLANK_MS = 2600;
/** How many words lie on the bank at once (the next one and a few after it), so a long verse never fills the screen. */
export const BANK_SIZE = 5;
export const BRIDGE_HEARTS = 3;

// ---------------------------------------------------------------- Dragon Duel: recall the next word

export interface DuelRound {
  /** The word being asked (its place in the verse and how it is written). */
  word: Word;
  /** The choices as they are shown (the answer is one of them), cased as in the verse. */
  choices: string[];
}

export const DUEL_HEARTS = 3;
export const DUEL_CHOICES = 4;

const show = (w: Word) => w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w.raw;

/**
 * One round for every word of the verse, in order. The wrong choices are other words of the same verse (the ones nearby first,
 * because those are the ones a memory really confuses), never a word that reads the same as the answer.
 */
export function duelRounds(text: string, seed = 1): DuelRound[] {
  const words = tokenize(text);
  const rng = makeRng(seed);
  return words.map((word, i) => {
    const seen = new Set([word.key]);
    const others: string[] = [];
    // nearest words first: i+1, i-1, i+2, i-2, ...
    for (let d = 1; d < words.length && others.length < DUEL_CHOICES - 1; d++)
      for (const j of [i + d, i - d]) {
        const w = words[j];
        if (!w || seen.has(w.key) || others.length >= DUEL_CHOICES - 1) continue;
        seen.add(w.key);
        others.push(show(w));
      }
    return { word, choices: shuffle([show(word), ...others], rng) };
  });
}

export const duelRight = (round: DuelRound, choice: string) => choice === show(round.word);

// ---------------------------------------------------------------- Bridge of the Word: put the phrases in order

export interface Plank {
  /** Its place in the verse, 0 first. */
  order: number;
  text: string;
}

/** The verse cut into short phrases (about `size` words, never a lone word left at the end). */
export function planks(text: string, size = 3): Plank[] {
  const words = tokenize(text);
  const out: Plank[] = [];
  for (let i = 0; i < words.length; i += size) {
    const part = words.slice(i, i + size);
    if (size > 1 && part.length === 1 && out.length) out[out.length - 1].text += ' ' + part[0].raw;
    else out.push({ order: out.length, text: part.map((w) => w.raw).join(' ') });
  }
  return out;
}

/** The planks as they lie on the bank: mixed, and never already in order when there is more than one. */
export function scatter(list: Plank[], seed = 1): Plank[] {
  if (list.length < 2) return list.slice();
  const rng = makeRng(seed);
  let mixed = shuffle(list, rng);
  for (let tries = 0; tries < 5 && mixed.every((p, i) => p.order === i); tries++) mixed = shuffle(list, rng);
  if (mixed.every((p, i) => p.order === i)) mixed = [...mixed.slice(1), mixed[0]];
  return mixed;
}

/**
 * Bridge Run's bank (v1.78.0, owner-requested single words): the word needed now and the few after it, in a mixed order that
 * stays put as the bank refills (each word keeps its own seeded place), so a laid word is replaced without the rest jumping.
 */
export function bank(all: Plank[], laid: number, seed: number, size = BANK_SIZE): Plank[] {
  const rank = (p: Plank) => makeRng(seed * 7919 + p.order * 104729)();
  return all.slice(laid, laid + size).sort((a, b) => rank(a) - rank(b));
}

/** Right when it is the next plank, or reads exactly the same as it (a repeated phrase may be laid in either place). */
export function plankFits(all: Plank[], laid: number, pick: Plank): boolean {
  return pick.order === laid || all[laid]?.text === pick.text;
}

/** Stars for a finished game: three for a clean run, two for a slip or two, one for getting there. */
export function stars(slips: number): 1 | 2 | 3 {
  return slips === 0 ? 3 : slips <= 2 ? 2 : 1;
}
