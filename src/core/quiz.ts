// Fill-in-the-blank generation, mistake policy and reference checking.
import { BOOKS, bookByNumber, versesInChapter } from './books.ts';
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

// ------------------------------------------------------------- multiple-choice "where is it?" and "what topic?"

export interface ChoiceStep {
  kind: 'book' | 'chapter' | 'verse' | 'topic';
  answer: string;
  /** Shuffled, includes the answer, no duplicates. */
  options: string[];
}

/** Used to pad topic choices when you have few topics of your own. */
export const COMMON_TOPICS = [
  'Faith', 'Hope', 'Love', 'Grace', 'Peace', 'Prayer', 'Wisdom', 'Forgiveness', 'Trust', 'Joy', 'Strength', 'Salvation',
  'Anxiety', 'Obedience', 'Gospel', 'Courage', 'Comfort', 'Patience',
];

/** Up to `count` numbers near `answer` inside [1, max], always including `answer`. */
function nearbyNumbers(answer: number, max: number, count: number, rng: () => number): number[] {
  const pool: number[] = [];
  for (let n = 1; n <= max; n++) if (n !== answer) pool.push(n);
  pool.sort((a, b) => Math.abs(a - answer) + (rng() - 0.5) * 4 - (Math.abs(b - answer) + (rng() - 0.5) * 4));
  return shuffle([answer, ...pool.slice(0, count - 1)], rng);
}

const range = (a: number, b: number) => (b > a ? `${a}–${b}` : `${a}`);

/** Book, chapter and verse questions for a passage (chapter is skipped for one-chapter books). */
export function makeReferenceSteps(truth: Ref, level: FillDifficulty, rng: () => number): ChoiceStep[] {
  const want = LEVELS[level].options;
  const steps: ChoiceStep[] = [];

  // Book: mostly books from the same testament, so the choice is not trivially easy.
  const sameTestament = (n: number) => (n <= 39) === (truth.book <= 39);
  const others = shuffle(
    BOOKS.filter((b) => b.n !== truth.book),
    rng,
  ).sort((a, b) => Number(sameTestament(b.n)) - Number(sameTestament(a.n)) + (rng() - 0.5) * 1.2);
  const bookName = bookByNumber(truth.book).name;
  steps.push({ kind: 'book', answer: bookName, options: shuffle([bookName, ...others.slice(0, want - 1).map((b) => b.name)], rng) });

  const chapters = bookByNumber(truth.book).chapters;
  if (chapters > 1) {
    const options = nearbyNumbers(truth.chapter, chapters, Math.min(want, chapters), rng).map(String);
    steps.push({ kind: 'chapter', answer: String(truth.chapter), options });
  }

  const max = versesInChapter(truth.book, truth.chapter) ?? truth.end;
  const answer = range(truth.start, truth.end);
  const span = truth.end - truth.start;
  const seen = new Set([answer]);
  const verseOptions = [answer];
  const starts = nearbyNumbers(truth.start, Math.max(1, max - span), want * 2, rng);
  for (const s of starts) {
    const opt = range(s, s + span);
    if (!seen.has(opt) && s + span <= max) {
      seen.add(opt);
      verseOptions.push(opt);
    }
    if (verseOptions.length >= Math.min(want, Math.max(2, max))) break;
  }
  // very short chapters: fall back to single verses so there is always a real choice
  for (let n = 1; n <= max && verseOptions.length < Math.min(want, 2); n++) {
    const opt = range(n, n);
    if (!seen.has(opt)) (seen.add(opt), verseOptions.push(opt));
  }
  steps.push({ kind: 'verse', answer, options: shuffle(verseOptions, rng) });
  return steps;
}

/** "What is this verse's topic?" Distractors come from your other topics, padded with common ones. */
export function makeTopicStep(topic: string, otherTopics: string[], level: FillDifficulty, rng: () => number): ChoiceStep {
  const want = LEVELS[level].options;
  const key = topic.trim().toLowerCase();
  const seen = new Set([key]);
  const distractors: string[] = [];
  for (const t of [...shuffle(otherTopics, rng), ...shuffle(COMMON_TOPICS, rng)]) {
    const k = t.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    distractors.push(t.trim());
    if (distractors.length >= want - 1) break;
  }
  return { kind: 'topic', answer: topic.trim(), options: shuffle([topic.trim(), ...distractors], rng) };
}

// ------------------------------------------------------------- typing the reference ("Type it out")

export interface RefToken {
  /** What is revealed on screen once this token is typed. */
  show: string;
  /** The (lower-case) character that is expected. */
  expect: string;
  kind: 'book' | 'digit' | 'sep';
}

/**
 * The reference as typed characters: the first letter of the book (a leading number such as the 1 in
 * "1 John" is typed too), then chapter, ":", verse, and "-" and the last verse for a range.
 */
export function referenceTokens(ref: Ref): RefToken[] {
  const parts = bookByNumber(ref.book).name.split(' ');
  const tokens: RefToken[] = [];
  if (/^\d+$/.test(parts[0]) && parts.length > 1) {
    tokens.push({ show: `${parts[0]} `, expect: parts[0].toLowerCase(), kind: 'book' });
    tokens.push({ show: `${parts.slice(1).join(' ')} `, expect: parts[1][0].toLowerCase(), kind: 'book' });
  } else {
    tokens.push({ show: `${parts.join(' ')} `, expect: parts[0][0].toLowerCase(), kind: 'book' });
  }
  const digits = (n: number, kind: RefToken['kind'] = 'digit') => [...String(n)].map((c) => ({ show: c, expect: c, kind }) as RefToken);
  tokens.push(...digits(ref.chapter));
  tokens.push({ show: ':', expect: ':', kind: 'sep' });
  tokens.push(...digits(ref.start));
  if (ref.end > ref.start) {
    tokens.push({ show: '-', expect: '-', kind: 'sep' });
    tokens.push(...digits(ref.end));
  }
  return tokens;
}

const strip = (c: string) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SEPARATORS = ':.-–—,;';
const matches = (t: RefToken, ch: string) => strip(ch) === t.expect;

/** Feed one typed character. Separators are optional: typing the next digit straight away is fine. */
export function advanceRef(tokens: RefToken[], pos: number, ch: string): { ok: boolean; pos: number } {
  const t = tokens[pos];
  if (!t) return { ok: false, pos };
  if (t.kind === 'sep') {
    if (SEPARATORS.includes(ch)) return { ok: true, pos: pos + 1 };
    const next = tokens[pos + 1];
    if (next && matches(next, ch)) return { ok: true, pos: pos + 2 };
    return { ok: false, pos };
  }
  return matches(t, ch) ? { ok: true, pos: pos + 1 } : { ok: false, pos };
}

/** After a wrong character (or "Reveal"): show the missed character and move on (a separator goes with the character after it). */
export function skipRef(tokens: RefToken[], pos: number): number {
  if (pos >= tokens.length) return pos;
  return Math.min(tokens.length, tokens[pos].kind === 'sep' ? pos + 2 : pos + 1);
}
