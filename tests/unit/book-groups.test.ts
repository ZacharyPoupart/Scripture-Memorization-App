import { describe, expect, it } from 'vitest';
import { BOOK_GROUPS, BOOKS, booksInGroup } from '../../src/core/books.ts';

describe('book groups for the picker', () => {
  it('cover all 66 books exactly once, in order, with no gaps', () => {
    const all = BOOK_GROUPS.flatMap((g) => booksInGroup(g.id).map((b) => b.n));
    expect(all).toEqual(BOOKS.map((b) => b.n));
    expect(new Set(all).size).toBe(66);
  });
  it('are small enough to be quick to scan', () => {
    for (const g of BOOK_GROUPS) expect(booksInGroup(g.id).length).toBeLessThanOrEqual(22);
    expect(booksInGroup('gospels').map((b) => b.name)).toEqual(['Matthew', 'Mark', 'Luke', 'John', 'Acts']);
    expect(booksInGroup('law')).toHaveLength(5);
    expect(booksInGroup('nope')).toHaveLength(66); // unknown id = everything
  });
});
