// Minigames with the knight (v1.75.0, owner-requested: real-time games as the focal point). Pure logic only: what is asked and
// what counts as right (Arrow Volley's simulation is in volley.ts). A game that is WON within the pile's mistake allowance is
// recorded through the same `completeReview` as any other review type (see ui/games/Play.tsx); nothing else is saved.
import { makeRng, mistakesAllowed, shuffle } from './quiz.ts';
import type { Pile } from './types.ts';
import { tokenize, type Word } from './text.ts';

export type GameId = 'volley' | 'duel' | 'bridge';
export const GAMES: { id: GameId; name: string; blurb: string }[] = [
  { id: 'volley', name: 'Arrow Volley', blurb: 'Cut down the arrow carrying the next word.' },
  { id: 'duel', name: 'Dragon Duel', blurb: 'Strike with the next word before the fire comes.' },
  { id: 'bridge', name: 'Bridge Run', blurb: 'Lay each phrase before the knight reaches the edge.' },
];

/**
 * Does this game count as the verse's review? Only a win, and only within the pile's usual mistake allowance (Daily forgives 3
 * slips, the other piles none), exactly as the other review types. The caller then records it with `completeReview`.
 */
export const gameCounts = (pile: Pile, won: boolean, slips: number): boolean => won && slips <= mistakesAllowed(pile);

/** How long the dragon takes to draw breath (ms): it gets quicker as the verse goes on. `progress` is 0 to 1. */
export const duelChargeMs = (progress: number) => 7000 - 2600 * Math.max(0, Math.min(1, progress));
/** How long the knight takes to walk one plank (ms). */
export const BRIDGE_PLANK_MS = 4400;
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

/** Right when it is the next plank, or reads exactly the same as it (a repeated phrase may be laid in either place). */
export function plankFits(all: Plank[], laid: number, pick: Plank): boolean {
  return pick.order === laid || all[laid]?.text === pick.text;
}

/** Stars for a finished game: three for a clean run, two for a slip or two, one for getting there. */
export function stars(slips: number): 1 | 2 | 3 {
  return slips === 0 ? 3 : slips <= 2 ? 2 : 1;
}
