// "Type it out" asks for the reference too: the first letter of the book, then chapter:verse (or chapter:verse-verse).
import { describe, expect, it } from 'vitest';
import { advanceRef, referenceTokens, skipRef } from '../../src/core/quiz.ts';

const john316 = { book: 43, chapter: 3, start: 16, end: 16 };

const typeAll = (ref: Parameters<typeof referenceTokens>[0], chars: string) => {
  const tokens = referenceTokens(ref);
  let pos = 0;
  let wrong = 0;
  for (const ch of chars) {
    if (pos >= tokens.length) break;
    const r = advanceRef(tokens, pos, ch);
    if (r.ok) pos = r.pos;
    else (wrong++, (pos = skipRef(tokens, pos)));
  }
  return { pos, done: pos >= tokens.length, wrong };
};

describe('referenceTokens', () => {
  it('John 3:16 = first letter, chapter digit, colon, verse digits', () => {
    const t = referenceTokens(john316);
    expect(t.map((x) => x.expect)).toEqual(['j', '3', ':', '1', '6']);
    expect(t.map((x) => x.kind)).toEqual(['book', 'digit', 'sep', 'digit', 'digit']);
    expect(t.map((x) => x.show).join('')).toBe('John 3:16');
  });
  it('a range adds -end; numbered books need the number and the letter; multi-word names need just the first letter', () => {
    expect(referenceTokens({ book: 43, chapter: 3, start: 16, end: 18 }).map((x) => x.show).join('')).toBe('John 3:16-18');
    const oneJohn = referenceTokens({ book: 62, chapter: 4, start: 8, end: 8 });
    expect(oneJohn.slice(0, 2).map((x) => x.expect)).toEqual(['1', 'j']);
    expect(oneJohn.map((x) => x.show).join('')).toBe('1 John 4:8');
    const song = referenceTokens({ book: 22, chapter: 2, start: 4, end: 4 });
    expect(song.filter((x) => x.kind === 'book')).toHaveLength(1);
    expect(song[0].expect).toBe('s');
  });
});

describe('advanceRef (typing it)', () => {
  it('accepts "J3:16" exactly, in either case', () => {
    expect(typeAll(john316, 'J3:16')).toMatchObject({ done: true, wrong: 0 });
    expect(typeAll(john316, 'j3:16')).toMatchObject({ done: true, wrong: 0 });
  });
  it('colon and dash are optional: "j316" and "j3 16" work, and "-" or an en dash both count', () => {
    expect(typeAll(john316, 'j316')).toMatchObject({ done: true, wrong: 0 });
    expect(typeAll({ ...john316, end: 18 }, 'j3:16-18')).toMatchObject({ done: true, wrong: 0 });
    expect(typeAll({ ...john316, end: 18 }, 'j3:16–18')).toMatchObject({ done: true, wrong: 0 });
    expect(typeAll({ ...john316, end: 18 }, 'j31618')).toMatchObject({ done: true, wrong: 0 });
  });
  it('any book that starts with the same letter is accepted (it is only the first letter)', () => {
    expect(typeAll(john316, 'j3:16').wrong).toBe(0);
  });
  it('a wrong character is counted, and the missed character is skipped so the player carries on', () => {
    const r = typeAll(john316, 'j3:17'); // 7 instead of 6 in the last digit
    expect(r.wrong).toBe(1);
    expect(r.done).toBe(true);
    expect(typeAll(john316, 'x3:16').wrong).toBe(1);
  });
  it('a wrong digit before a separator also skips the separator (never leaves you stuck on ":")', () => {
    const r = typeAll(john316, 'j9:16');
    expect(r.wrong).toBe(1);
    expect(r.done).toBe(true);
  });
  it('skipRef moves past a separator together with the character after it, and stops at the end', () => {
    const t = referenceTokens(john316);
    expect(skipRef(t, 1)).toBe(2); // chapter digit
    expect(skipRef(t, 2)).toBe(4); // ':' and the next digit
    expect(skipRef(t, 4)).toBe(5);
    expect(skipRef(t, 5)).toBe(5);
  });
});
