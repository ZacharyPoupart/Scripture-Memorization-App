// Fill-in-the-blank generation, mistake policy and reference checking.
import type { Ref } from './reference.ts';
import { tokenize, type Word } from './text.ts';
import type { FillDifficulty, Pile } from './types.ts';

/** Small seeded PRNG so tests (and restarts) are reproducible. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------- mistakes

/** Daily verses forgive a few slips; everything later must be perfect. */
export const DAILY_MISTAKES_ALLOWED = 3;

export function mistakesAllowed(pile: Pile): number {
  return pile === 'daily' ? DAILY_MISTAKES_ALLOWED : 0;
}

/** True when the attempt must restart (same verse, same mode). */
export function tooManyMistakes(mistakes: number, pile: Pile): boolean {
  return mistakes > mistakesAllowed(pile);
}

// ------------------------------------------------------------- fill in the blank

interface Level {
  ratio: number;
  options: number;
  minLen: number;
}

export const LEVELS: Record<FillDifficulty, Level> = {
  easy: { ratio: 0.2, options: 3, minLen: 4 },
  medium: { ratio: 0.4, options: 4, minLen: 3 },
  hard: { ratio: 0.75, options: 5, minLen: 1 },
};

/** Established verses (anything past Daily) always get the hardest version. */
export function difficultyFor(pile: Pile, chosen: FillDifficulty): FillDifficulty {
  return pile === 'daily' ? chosen : 'hard';
}

export interface Blank {
  /** Index into the verse's words. */
  index: number;
  answer: string; // displayed form of the word, without surrounding punctuation
  options: string[]; // shuffled, includes the answer
}

const FILLER = [
  'and', 'the', 'but', 'for', 'not', 'his', 'her', 'who', 'all', 'you', 'from', 'with', 'will', 'have', 'that',
  'this', 'shall', 'unto', 'they', 'were', 'which', 'when', 'then', 'there', 'their', 'them', 'your', 'into',
  'love', 'lord', 'God', 'Spirit', 'heart', 'faith', 'world', 'grace', 'peace', 'light', 'truth', 'life', 'word',
  'power', 'mercy', 'hope', 'joy', 'strength', 'wisdom', 'kingdom', 'glory', 'goodness', 'righteous', 'forever',
];

const core = (raw: string) => raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

export function makeBlanks(text: string, level: FillDifficulty, rng: () => number): { words: Word[]; blanks: Blank[] } {
  const words = tokenize(text);
  const cfg = LEVELS[level];
  const candidates = words.filter((w) => w.key.length >= cfg.minLen);
  const pool = candidates.length ? candidates : words;
  const want = Math.max(1, Math.min(pool.length, Math.round(words.length * cfg.ratio)));
  const chosen = shuffle(pool, rng).slice(0, want).sort((a, b) => a.index - b.index);

  const verseWords = [...new Set(words.map((w) => core(w.raw)).filter(Boolean))];
  const blanks: Blank[] = chosen.map((w) => {
    const answer = core(w.raw);
    const answerLower = answer.toLowerCase();
    const capital = /^\p{Lu}/u.test(answer);
    // Distractors: prefer other words from this very verse (plausible), padded from common words.
    const fromVerse = shuffle(
      verseWords.filter((x) => x.toLowerCase() !== answerLower),
      rng,
    ).sort((x, y) => Math.abs(x.length - answer.length) - Math.abs(y.length - answer.length) + (rng() - 0.5) * 2.5);
    const extras = shuffle(FILLER, rng).filter((x) => x.toLowerCase() !== answerLower && !fromVerse.some((f) => f.toLowerCase() === x.toLowerCase()));
    const distractors: string[] = [];
    for (const cand of [...fromVerse, ...extras]) {
      if (distractors.length >= cfg.options - 1) break;
      distractors.push(capital ? cand.charAt(0).toUpperCase() + cand.slice(1) : cand.charAt(0).toLowerCase() + cand.slice(1));
    }
    return { index: w.index, answer, options: shuffle([answer, ...distractors], rng) };
  });
  return { words, blanks };
}

export function isCorrectChoice(blank: Blank, choice: string): boolean {
  return choice.toLowerCase() === blank.answer.toLowerCase();
}

// ------------------------------------------------------------- reference recall

export interface RefAnswer {
  book: number | null;
  chapter: number | null;
  start: number | null;
  end: number | null;
}

export interface RefCheck {
  ok: boolean;
  wrong: Array<'book' | 'chapter' | 'verse'>;
}

/** Compare the user's answer with the truth. For a single verse `end` may be left blank. */
export function checkReference(answer: RefAnswer, truth: Ref): RefCheck {
  const wrong: RefCheck['wrong'] = [];
  if (answer.book !== truth.book) wrong.push('book');
  if (answer.chapter !== truth.chapter) wrong.push('chapter');
  const end = answer.end ?? answer.start;
  if (answer.start !== truth.start || end !== truth.end) wrong.push('verse');
  return { ok: wrong.length === 0, wrong };
}
