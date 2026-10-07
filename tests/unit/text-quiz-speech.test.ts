import { describe, expect, it } from 'vitest';
import { checkReference, difficultyFor, isCorrectChoice, LEVELS, makeBlanks, makeRng, mistakesAllowed, tooManyMistakes } from '../../src/core/quiz.ts';
import { alignSpeech, tokenizeSpeech, wordsMatch } from '../../src/core/speech.ts';
import { cleanVerseText, matchesFirstLetter, tokenize } from '../../src/core/text.ts';
import { findBook, searchBooks, BOOKS } from '../../src/core/books.ts';
import { formatRef, parseRef, refWarning, validateRef } from '../../src/core/reference.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

describe('tokenize', () => {
  it('keeps punctuation for display and normalizes keys', () => {
    const w = tokenize('“Blessed are the poor in spirit,” — for theirs is the kingdom.');
    expect(w[0].raw).toBe('“Blessed');
    expect(w[0].key).toBe('blessed');
    expect(w[0].first).toBe('b');
    expect(w.find((x) => x.key === 'spirit')?.raw).toContain('—'); // dash attached to previous word
    expect(w.map((x) => x.key).join(' ')).toBe('blessed are the poor in spirit for theirs is the kingdom');
  });
  it('first-letter matching ignores case, accents and punctuation', () => {
    const [w] = tokenize('“Éden”');
    expect(matchesFirstLetter(w, 'e')).toBe(true);
    expect(matchesFirstLetter(w, 'E')).toBe(true);
    expect(matchesFirstLetter(w, 'x')).toBe(false);
    expect(matchesFirstLetter(w, ' ')).toBe(false);
  });
  it('cleans API text', () => {
    expect(cleanVerseText('In the <i>beginning</i> God<S>430</S> created&nbsp;the [1]heaven<br/>and &amp; earth. ')).toBe('In the beginning God created the heaven and & earth.');
  });
});

describe('fill in the blank', () => {
  it('makes more blanks and more options on harder levels', () => {
    const easy = makeBlanks(JOHN, 'easy', makeRng(1));
    const hard = makeBlanks(JOHN, 'hard', makeRng(1));
    expect(hard.blanks.length).toBeGreaterThan(easy.blanks.length);
    expect(easy.blanks[0].options).toHaveLength(LEVELS.easy.options);
    expect(hard.blanks[0].options).toHaveLength(LEVELS.hard.options);
  });
  it('every blank has the answer exactly once among unique options', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      for (let seed = 0; seed < 25; seed++) {
        const { blanks } = makeBlanks(JOHN, level, makeRng(seed));
        for (const b of blanks) {
          const lower = b.options.map((o) => o.toLowerCase());
          expect(new Set(lower).size).toBe(lower.length);
          expect(lower.filter((o) => o === b.answer.toLowerCase())).toHaveLength(1);
          expect(isCorrectChoice(b, b.answer)).toBe(true);
        }
      }
    }
  });
  it('blanks are in verse order and reproducible from the seed', () => {
    const a = makeBlanks(JOHN, 'medium', makeRng(7));
    const b = makeBlanks(JOHN, 'medium', makeRng(7));
    expect(a).toEqual(b);
    const idx = a.blanks.map((x) => x.index);
    expect([...idx].sort((x, y) => x - y)).toEqual(idx);
  });
  it('works on very short verses', () => {
    const { blanks } = makeBlanks('Jesus wept.', 'easy', makeRng(3));
    expect(blanks.length).toBeGreaterThanOrEqual(1);
  });
  it('established verses always get the hardest version', () => {
    expect(difficultyFor('daily', 'easy')).toBe('easy');
    expect(difficultyFor('weekly', 'easy')).toBe('hard');
    expect(difficultyFor('monthly', 'medium')).toBe('hard');
    expect(difficultyFor('yearly', 'easy')).toBe('hard');
  });
});

describe('mistake policy', () => {
  it('daily forgives 3 mistakes; everything else must be perfect', () => {
    expect(mistakesAllowed('daily')).toBe(3);
    expect(tooManyMistakes(3, 'daily')).toBe(false);
    expect(tooManyMistakes(4, 'daily')).toBe(true);
    for (const p of ['weekly', 'monthly', 'yearly'] as const) {
      expect(tooManyMistakes(0, p)).toBe(false);
      expect(tooManyMistakes(1, p)).toBe(true);
    }
  });
});

describe('reference recall', () => {
  const truth = { book: 43, chapter: 3, start: 16, end: 16 };
  it('accepts the right answer (end optional for single verses)', () => {
    expect(checkReference({ book: 43, chapter: 3, start: 16, end: null }, truth).ok).toBe(true);
    expect(checkReference({ book: 43, chapter: 3, start: 16, end: 16 }, truth).ok).toBe(true);
  });
  it('reports which parts are wrong', () => {
    expect(checkReference({ book: 44, chapter: 3, start: 16, end: null }, truth).wrong).toEqual(['book']);
    expect(checkReference({ book: 43, chapter: 4, start: 17, end: null }, truth).wrong).toEqual(['chapter', 'verse']);
  });
  it('requires the whole range for ranges', () => {
    const range = { book: 46, chapter: 13, start: 4, end: 7 };
    expect(checkReference({ book: 46, chapter: 13, start: 4, end: 7 }, range).ok).toBe(true);
    expect(checkReference({ book: 46, chapter: 13, start: 4, end: null }, range).ok).toBe(false);
  });
});

describe('speech alignment', () => {
  const expected = tokenize(JOHN).map((w) => w.key);
  it('marks a perfect recital all ok', () => {
    const r = alignSpeech(expected, tokenizeSpeech(JOHN), true);
    expect(r.mistakes).toBe(0);
    expect(r.results.every((x) => x === 'ok')).toBe(true);
  });
  it('flags dropped, wrong and mis-recognised words', () => {
    const spoken = 'for god so loved the world that he gave his only sun that whoever believes in him should perish but have eternal life';
    const r = alignSpeech(expected, tokenizeSpeech(spoken), true);
    expect(r.results[expected.indexOf('not')]).toBe('missed');
    expect(r.mistakes).toBe(2); // "sun" (wrong) + "not" (missed)
    expect(r.results[expected.indexOf('son')]).toBe('wrong');
  });
  it('extra words are tolerated; stumbles in the middle do not derail the rest', () => {
    const r = alignSpeech(expected, tokenizeSpeech('um for god so uh loved the world that he gave his only son that whoever believes in him should not perish but have eternal life'), true);
    expect(r.mistakes).toBe(0);
  });
  it('live mode leaves unreached words pending, final mode counts them missed', () => {
    const live = alignSpeech(expected, tokenizeSpeech('for god so loved the'), false);
    expect(live.progress).toBe(5);
    expect(live.results.slice(0, 5).every((x) => x === 'ok')).toBe(true);
    expect(live.results.slice(5).every((x) => x === 'pending')).toBe(true);
    expect(alignSpeech(expected, tokenizeSpeech('for god so loved the'), true).mistakes).toBe(expected.length - 5);
  });
  it('allows small recognition slips only on longer words', () => {
    expect(wordsMatch('believes', 'believe')).toBe(true);
    expect(wordsMatch('son', 'sun')).toBe(false);
    expect(wordsMatch('loved', 'lived')).toBe(true);
  });
});

describe('books and references', () => {
  it('has all 66 books with sensible chapter counts', () => {
    expect(BOOKS).toHaveLength(66);
    const by = (n: string) => BOOKS.find((b) => b.name === n)!;
    expect(by('Psalms').chapters).toBe(150);
    expect(by('Genesis').chapters).toBe(50);
    expect(by('Jude').chapters).toBe(1);
    expect(by('Revelation').chapters).toBe(22);
    expect(BOOKS.reduce((a, b) => a + b.chapters, 0)).toBe(1189);
  });
  it('finds books by common names and abbreviations', () => {
    expect(findBook('1 Cor')).toBe(46);
    expect(findBook('Psalm')).toBe(19);
    expect(findBook('song of songs')).toBe(22);
    expect(findBook('Revelation')).toBe(66);
    expect(findBook('nonsense')).toBeUndefined();
  });
  it('book search shows all books for empty input (no hints)', () => {
    expect(searchBooks('')).toHaveLength(66);
    expect(searchBooks('jo').map((b) => b.name)).toEqual(expect.arrayContaining(['John', 'Job', 'Joel', 'Jonah', 'Joshua']));
  });
  it('parses, formats and validates', () => {
    const r = parseRef('1 Cor 13:4-7')!;
    expect(r).toEqual({ book: 46, chapter: 13, start: 4, end: 7 });
    expect(formatRef(r)).toBe('1 Corinthians 13:4-7');
    expect(formatRef({ book: 43, chapter: 3, start: 16, end: 16 })).toBe('John 3:16');
    expect(parseRef('John 99:1')).toBeNull();
    expect(validateRef({ book: 43, chapter: 3, start: 16, end: 15 })?.field).toBe('end');
    expect(validateRef({ book: 57, chapter: 2, start: 1, end: 1 })?.field).toBe('chapter');
    expect(refWarning({ book: 43, chapter: 3, start: 16, end: 99 })).toMatch(/36 verses/);
    expect(refWarning({ book: 43, chapter: 3, start: 16, end: 16 })).toBeNull();
  });
});
