import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/core/text.ts';

import { revealGroups } from '../../src/core/text.ts';

describe('revealGroups (tap-to-reveal flashcards)', () => {
  const words = tokenize('For God so loved the world, that he gave his one and only Son, that whoever believes in him shall not perish');
  it('word mode is one group per word', () => {
    expect(revealGroups(words, 'word')).toEqual(words.map(() => 1));
  });
  it('phrase mode ends groups at punctuation or after 6 words, and covers every word exactly once', () => {
    const g = revealGroups(words, 'phrase');
    expect(g.reduce((a, b) => a + b, 0)).toBe(words.length);
    expect(g[0]).toBe(6); // "For God so loved the world,"
    expect(Math.max(...g)).toBeLessThanOrEqual(6);
    expect(g.every((n) => n >= 1)).toBe(true);
  });
  it('handles empty text', () => {
    expect(revealGroups([], 'phrase')).toEqual([]);
  });
});
