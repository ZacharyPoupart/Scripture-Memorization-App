// Sword Dance (v1.77.0, owner-requested; from the game-design research). The verse comes a phrase at a time: its words appear on
// goblin shields scattered over the field, and the knight cuts through them IN ORDER before the fuse burns out. Each right cut
// adds time to the fuse. Trains the order of words inside a phrase. Pure and seeded.
import { points } from './games.ts';
import { makeRng, shuffle } from './quiz.ts';
import { tokenize, type Word } from './text.ts';

export const DANCE_HEARTS = 3;
export const DANCE_SLOTS = 6;
const PHRASE = 5; // words a phrase
const FUSE_PER_WORD = 1600; // ms of fuse each word of a phrase starts with
const FUSE_BONUS = 1000; // ms added for each right cut
const BREATH = 550; // ms between phrases

export interface Shield {
  slot: number;
  word: Word;
  label: string;
  broken: boolean;
}

export interface DanceState {
  words: Word[];
  /** The phrases, as [first word index, last word index + 1]. */
  phrases: [number, number][];
  phrase: number;
  /** The next word to cut (its index in the whole verse). */
  next: number;
  shields: Shield[];
  fuse: number;
  fuseMax: number;
  wait: number; // ms of breath left before the next phrase's shields come
  hearts: number;
  slips: number;
  combo: number;
  score: number;
  over: 'won' | 'lost' | null;
  rng: () => number;
}

export type DanceEvent =
  | { type: 'phrase' }
  | { type: 'cut'; shield: Shield; points: number; combo: number; last: boolean }
  | { type: 'wrong'; shield: Shield }
  | { type: 'fizzle'; words: Word[] }; // the fuse ran out: a heart, and the rest of the phrase is shown

const label = (w: Word) => w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w.raw;

/** Phrases of about five words; a lone word at the end joins the phrase before it. */
export function phrasesOf(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i += PHRASE) {
    const end = Math.min(n, i + PHRASE);
    if (end - i === 1 && out.length) out[out.length - 1][1] = end;
    else out.push([i, end]);
  }
  return out;
}

function deal(s: DanceState) {
  const [a, b] = s.phrases[s.phrase];
  const slots = shuffle(Array.from({ length: DANCE_SLOTS }, (_, i) => i), s.rng);
  s.shields = s.words.slice(a, b).map((word, i) => ({ slot: slots[i], word, label: label(word), broken: false }));
  s.next = a;
  s.fuseMax = FUSE_PER_WORD * (b - a);
  s.fuse = s.fuseMax;
}

export function newDance(text: string, seed = 1): DanceState {
  const words = tokenize(text);
  const s: DanceState = { words, phrases: phrasesOf(words.length), phrase: 0, next: 0, shields: [], fuse: 0, fuseMax: 1, wait: 300, hearts: DANCE_HEARTS, slips: 0, combo: 0, score: 0, over: words.length ? null : 'won', rng: makeRng(seed) };
  return s;
}

function endPhrase(s: DanceState) {
  s.phrase++;
  s.shields = [];
  if (s.phrase >= s.phrases.length) s.over = 'won';
  else s.wait = BREATH;
}

function hurt(s: DanceState) {
  s.hearts--;
  s.slips++;
  s.combo = 0;
  if (s.hearts <= 0) s.over = 'lost';
}

export function danceStep(s: DanceState, dt: number): DanceEvent[] {
  if (s.over) return [];
  if (s.wait > 0) {
    s.wait -= dt;
    if (s.wait <= 0) {
      deal(s);
      return [{ type: 'phrase' }];
    }
    return [];
  }
  s.fuse -= dt;
  if (s.fuse > 0) return [];
  const [, b] = s.phrases[s.phrase];
  const words = s.words.slice(s.next, b);
  hurt(s);
  s.next = b; // the rest of the phrase is shown, and on we go
  if (!s.over) endPhrase(s);
  return [{ type: 'fizzle', words }];
}

/** The shield in `slot` is cut. Right when it holds the next word (or a word that reads the same). */
export function danceTap(s: DanceState, slot: number): DanceEvent[] {
  if (s.over || s.wait > 0) return [];
  const sh = s.shields.find((x) => x.slot === slot && !x.broken);
  if (!sh) return [];
  const need = s.words[s.next];
  if (sh.word.key !== need.key) {
    hurt(s);
    return [{ type: 'wrong', shield: sh }];
  }
  // a repeated word may be cut in either place: swap so the shield cut stands for the word needed now
  if (sh.word.index !== need.index) {
    const other = s.shields.find((x) => x.word.index === need.index);
    if (other) [other.word, sh.word] = [sh.word, other.word];
  }
  sh.broken = true;
  s.combo++;
  const p = points(s.combo, s.fuse / s.fuseMax);
  s.score += p;
  s.next++;
  s.fuse = Math.min(s.fuseMax, s.fuse + FUSE_BONUS);
  const last = s.next >= s.phrases[s.phrase][1];
  if (last) endPhrase(s);
  return [{ type: 'cut', shield: sh, points: p, combo: s.combo, last }];
}
