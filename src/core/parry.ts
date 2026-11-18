// Parry (v1.77.0, owner-requested; from the game-design research). Runes fly at the knight one at a time, each carrying a word.
// If it is the NEXT word of the verse, strike it (the verse moves on); if not, block it. A wrong call, or a rune that arrives
// unanswered, costs a heart. It is the quickest of the games and a check of "is this the next word?". Pure and seeded.
import { points } from './games.ts';
import { makeRng } from './quiz.ts';
import { tokenize, type Word } from './text.ts';

export const PARRY_HEARTS = 3;

export interface Rune {
  id: number;
  word: string;
  key: string;
  /** Is this the word needed now? */
  right: boolean;
  /** 0 where it appears, 1 at the knight. */
  x: number;
}

export interface ParryState {
  words: Word[];
  next: number;
  rune: Rune | null;
  wait: number;
  sinceRight: number;
  hearts: number;
  slips: number;
  combo: number;
  score: number;
  over: 'won' | 'lost' | null;
  nextId: number;
  rng: () => number;
}

export type ParryEvent =
  | { type: 'rune'; rune: Rune }
  | { type: 'strike'; rune: Rune; points: number; combo: number }
  | { type: 'block'; rune: Rune; points: number; combo: number }
  | { type: 'wrong'; rune: Rune; action: 'strike' | 'block' }
  | { type: 'hit'; rune: Rune }; // it arrived unanswered

const shown = (w: Word) => w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w.raw;
/** A rune takes 2.6 s to arrive at the start and 1.7 s by the end. */
export const runeMs = (s: ParryState) => 2600 - 900 * (s.words.length ? s.next / s.words.length : 0);
const GAP = 280;

export function newParry(text: string, seed = 1): ParryState {
  const words = tokenize(text);
  return { words, next: 0, rune: null, wait: 400, sinceRight: 0, hearts: PARRY_HEARTS, slips: 0, combo: 0, score: 0, over: words.length ? null : 'won', nextId: 1, rng: makeRng(seed) };
}

function launch(s: ParryState): Rune {
  const need = s.words[s.next];
  // the right word comes about half the time, and never more than two decoys in a row
  const decoys = s.words.filter((w) => w.key !== need.key && Math.abs(w.index - need.index) <= 5);
  const pool = decoys.length ? decoys : s.words.filter((w) => w.key !== need.key);
  const right = !pool.length || s.sinceRight >= 2 || s.rng() < 0.5;
  const w = right ? need : pool[Math.floor(s.rng() * pool.length)];
  s.sinceRight = right ? 0 : s.sinceRight + 1;
  return { id: s.nextId++, word: shown(w), key: w.key, right, x: 0 };
}

function hurt(s: ParryState) {
  s.hearts--;
  s.slips++;
  s.combo = 0;
  if (s.hearts <= 0) s.over = 'lost';
}

function clear(s: ParryState) {
  s.rune = null;
  s.wait = GAP;
  if (s.next >= s.words.length) s.over = 'won';
}

export function parryStep(s: ParryState, dt: number): ParryEvent[] {
  if (s.over) return [];
  if (!s.rune) {
    s.wait -= dt;
    if (s.wait > 0) return [];
    s.rune = launch(s);
    return [{ type: 'rune', rune: s.rune }];
  }
  s.rune.x += dt / runeMs(s);
  if (s.rune.x < 1) return [];
  const rune = s.rune;
  hurt(s);
  if (rune.right) s.next++; // the word is shown and the verse moves on
  if (!s.over) clear(s);
  else s.rune = null;
  return [{ type: 'hit', rune }];
}

export function parryAct(s: ParryState, action: 'strike' | 'block'): ParryEvent[] {
  const rune = s.rune;
  if (s.over || !rune) return [];
  const ok = (action === 'strike') === rune.right;
  if (!ok) {
    hurt(s);
    if (rune.right) s.next++; // a right word blocked is still shown, so the verse moves on
    if (!s.over) clear(s);
    else s.rune = null;
    return [{ type: 'wrong', rune, action }];
  }
  s.combo++;
  const p = action === 'strike' ? points(s.combo, 1 - rune.x) : Math.round(points(s.combo, 1 - rune.x) / 2);
  s.score += p;
  if (action === 'strike') s.next++;
  clear(s);
  return [{ type: action, rune, points: p, combo: s.combo }];
}
