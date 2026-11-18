// Goblin Burrows (v1.76.0, owner-requested games). Whack-a-mole: three goblins pop up from six burrows, one holding the next
// word of the verse; bonk that one before they duck. Daily verses show the words; Weekly, Monthly and Yearly verses show only
// first letters (the same "harder in the later piles" rule as Fill in the blank). Pure and seeded.
import { points } from './games.ts';
import { makeRng, shuffle } from './quiz.ts';
import { tokenize, type Word } from './text.ts';
import type { Pile } from './types.ts';

export const BURROWS = 6;
export const BURROW_HEARTS = 3;
const UP = 3; // goblins up at once
const GAP_MS = 260; // a breath between rounds

export interface Mole {
  hole: number;
  key: string;
  label: string;
}

export interface BurrowsState {
  words: Word[];
  letters: boolean; // show first letters only
  next: number;
  hearts: number;
  slips: number;
  combo: number;
  score: number;
  moles: Mole[];
  /** How long the goblins have been up (ms), and how long they stay. Below 0 they are still waiting to come up. */
  upFor: number;
  stay: number;
  over: 'won' | 'lost' | null;
  rng: () => number;
}

export type BurrowsEvent =
  | { type: 'rise' }
  | { type: 'bonk'; mole: Mole; points: number; combo: number }
  | { type: 'wrong'; mole: Mole }
  | { type: 'escape'; word: Word };

const label = (w: Word, letters: boolean) => (letters ? w.key[0].toUpperCase() : w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w.raw);
/** Goblins stay up 2.2 s at the start and 1.5 s by the end. */
export const stayMs = (next: number, total: number) => 2200 - 700 * (total ? next / total : 0);

function rise(s: BurrowsState) {
  const need = s.words[s.next];
  const shown = new Set([label(need, s.letters).toLowerCase()]);
  const picks: Word[] = [need];
  const near = s.words.filter((w) => Math.abs(w.index - need.index) <= 5 && w.index !== need.index);
  for (const w of [...shuffle(near, s.rng), ...shuffle(s.words, s.rng)]) {
    if (picks.length >= UP) break;
    const l = label(w, s.letters).toLowerCase();
    if (w.key === need.key || shown.has(l)) continue;
    shown.add(l);
    picks.push(w);
  }
  if (s.letters) for (const l of shuffle([...'ABCDEFGHIJKLMNOPRSTUWY'], s.rng)) {
    if (picks.length >= UP) break;
    if (shown.has(l.toLowerCase())) continue;
    shown.add(l.toLowerCase());
    picks.push({ index: -1, raw: l, key: l.toLowerCase(), first: l.toLowerCase() });
  }
  const holes = shuffle(Array.from({ length: BURROWS }, (_, i) => i), s.rng);
  s.moles = picks.map((w, i) => ({ hole: holes[i], key: w.key, label: label(w, s.letters) }));
  s.upFor = 0;
  s.stay = stayMs(s.next, s.words.length);
}

export function newBurrows(text: string, pile: Pile, seed = 1): BurrowsState {
  const words = tokenize(text);
  const s: BurrowsState = { words, letters: pile !== 'daily', next: 0, hearts: BURROW_HEARTS, slips: 0, combo: 0, score: 0, moles: [], upFor: -400, stay: 0, over: words.length ? null : 'won', rng: makeRng(seed) };
  return s;
}

const isNeed = (s: BurrowsState, m: Mole) => m.key === s.words[s.next]?.key || (s.letters && m.label === label(s.words[s.next], true));

function hurt(s: BurrowsState) {
  s.slips++;
  s.combo = 0;
  s.hearts--;
  if (s.hearts <= 0) s.over = 'lost';
}

function after(s: BurrowsState) {
  s.moles = [];
  s.upFor = -GAP_MS;
  if (s.next >= s.words.length) s.over = 'won';
}

export function burrowsStep(s: BurrowsState, dt: number): BurrowsEvent[] {
  if (s.over) return [];
  const was = s.upFor;
  s.upFor += dt;
  if (was < 0 && s.upFor >= 0) {
    rise(s);
    return [{ type: 'rise' }];
  }
  if (s.moles.length && s.upFor >= s.stay) {
    const word = s.words[s.next];
    hurt(s);
    s.next++; // the word is shown and the verse moves on
    after(s);
    return [{ type: 'escape', word }];
  }
  return [];
}

export function burrowsTap(s: BurrowsState, hole: number): BurrowsEvent[] {
  if (s.over) return [];
  const mole = s.moles.find((m) => m.hole === hole);
  if (!mole) return [];
  if (isNeed(s, mole)) {
    s.combo++;
    const p = points(s.combo, Math.max(0, 1 - s.upFor / s.stay));
    s.score += p;
    s.next++;
    after(s);
    return [{ type: 'bonk', mole, points: p, combo: s.combo }];
  }
  s.moles = s.moles.filter((m) => m !== mole); // that one ducks; the right one is still up
  hurt(s);
  return [{ type: 'wrong', mole }];
}

export const burrowsNeeds = isNeed;
