// Multiple-choice questions for "where is it found?" (book, chapter, verse) and "what is its topic?".
import { describe, expect, it } from 'vitest';
import { BOOKS, versesInChapter } from '../../src/core/books.ts';
import { LEVELS, makeReferenceSteps, makeRng, makeTopicStep } from '../../src/core/quiz.ts';

const john316 = { book: 43, chapter: 3, start: 16, end: 16 };

describe('makeReferenceSteps', () => {
  it('asks book, chapter and verse in that order; the right answer is always among unique options', () => {
    const steps = makeReferenceSteps(john316, 'hard', makeRng(1));
    expect(steps.map((s) => s.kind)).toEqual(['book', 'chapter', 'verse']);
    expect(steps.map((s) => s.answer)).toEqual(['John', '3', '16']);
    for (const s of steps) {
      expect(s.options).toContain(s.answer);
      expect(new Set(s.options).size).toBe(s.options.length);
    }
  });

  it('uses as many options as the difficulty does', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const steps = makeReferenceSteps(john316, level, makeRng(7));
      for (const s of steps) expect(s.options).toHaveLength(LEVELS[level].options);
    }
  });

  it('chapter and verse distractors are real places: inside the book and the chapter', () => {
    for (let seed = 0; seed < 40; seed++) {
      const steps = makeReferenceSteps({ book: 19, chapter: 117, start: 1, end: 2 }, 'hard', makeRng(seed));
      const chapter = steps.find((s) => s.kind === 'chapter')!;
      for (const o of chapter.options) {
        expect(Number(o)).toBeGreaterThanOrEqual(1);
        expect(Number(o)).toBeLessThanOrEqual(BOOKS[18].chapters);
      }
      const verse = steps.find((s) => s.kind === 'verse')!;
      const max = versesInChapter(19, 117)!;
      for (const o of verse.options) for (const n of o.split('–').map(Number)) expect(n >= 1 && n <= max).toBe(true);
    }
  });

  it('a range is answered as one blank ("16–18") and distractors look like ranges or single verses', () => {
    const steps = makeReferenceSteps({ book: 43, chapter: 3, start: 16, end: 18 }, 'hard', makeRng(3));
    const verse = steps.find((s) => s.kind === 'verse')!;
    expect(verse.answer).toBe('16–18');
    expect(verse.options).toContain('16–18');
  });

  it('a one-chapter book (Jude) has no chapter question to answer, and tiny chapters still give valid options', () => {
    const steps = makeReferenceSteps({ book: 65, chapter: 1, start: 3, end: 3 }, 'hard', makeRng(2));
    expect(steps.find((s) => s.kind === 'chapter')).toBeUndefined();
    const verse = steps.find((s) => s.kind === 'verse')!;
    expect(verse.options).toContain('3');
    expect(verse.options.length).toBeGreaterThanOrEqual(2);
  });

  it('is deterministic for a seed', () => {
    expect(makeReferenceSteps(john316, 'medium', makeRng(5))).toEqual(makeReferenceSteps(john316, 'medium', makeRng(5)));
  });
});

describe('makeTopicStep', () => {
  it('offers the real topic among your other topics (case-insensitive, no duplicates) and fills with common ones', () => {
    const s = makeTopicStep('Faith', ['hope', 'Hope', 'faith', 'Gospel'], 'hard', makeRng(4));
    expect(s.kind).toBe('topic');
    expect(s.options).toContain('Faith');
    expect(s.options).toHaveLength(LEVELS.hard.options);
    expect(new Set(s.options.map((o) => o.toLowerCase())).size).toBe(s.options.length);
    expect(s.options.filter((o) => o.toLowerCase() === 'hope')).toHaveLength(1);
  });
  it('works with no other topics at all', () => {
    const s = makeTopicStep('Anxiety', [], 'easy', makeRng(1));
    expect(s.options).toContain('Anxiety');
    expect(s.options).toHaveLength(LEVELS.easy.options);
  });
});
