import { describe, expect, it } from 'vitest';
import { DUEL_CHOICES, duelChargeMs, gameCounts, duelRight, duelRounds, plankFits, planks, scatter, stars } from '../../src/core/games.ts';
import { tokenize } from '../../src/core/text.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

describe('Dragon Duel', () => {
  it('asks every word in order, with the answer among distinct choices', () => {
    const rounds = duelRounds(JOHN, 7);
    expect(rounds.map((r) => r.word.key)).toEqual(tokenize(JOHN).map((w) => w.key));
    for (const r of rounds) {
      expect(r.choices).toHaveLength(DUEL_CHOICES);
      expect(new Set(r.choices.map((c) => c.toLowerCase())).size).toBe(DUEL_CHOICES);
      expect(r.choices.filter((c) => duelRight(r, c))).toHaveLength(1);
      for (const c of r.choices) expect(c).not.toMatch(/[,.;]/); // punctuation would give the place away
    }
  });

  it('is the same for the same seed, and copes with a very short verse', () => {
    expect(duelRounds(JOHN, 3)).toEqual(duelRounds(JOHN, 3));
    const short = duelRounds('Jesus wept.', 1);
    expect(short).toHaveLength(2);
    expect(short[0].choices.sort()).toEqual(['Jesus', 'wept']);
    expect(duelRounds('', 1)).toEqual([]);
  });
});

describe('Bridge of the Word', () => {
  it('cuts the verse into phrases that join back into it, with no lone last word', () => {
    const p = planks(JOHN);
    expect(p.map((x) => x.text).join(' ')).toBe(JOHN);
    expect(p.map((x) => x.order)).toEqual(p.map((_, i) => i));
    expect(planks('one two three four').map((x) => x.text)).toEqual(['one two three four']);
    expect(planks('one two three four five').map((x) => x.text)).toEqual(['one two three', 'four five']);
  });

  it('scatters them (never already in order) and keeps every plank', () => {
    const p = planks(JOHN);
    for (const seed of [1, 2, 3, 4, 5, 99]) {
      const s = scatter(p, seed);
      expect(s.slice().sort((a, b) => a.order - b.order)).toEqual(p);
      expect(s.some((x, i) => x.order !== i)).toBe(true);
    }
    expect(scatter(planks('Jesus wept.'), 1)).toHaveLength(1);
  });

  it('accepts the next plank, or one that reads the same', () => {
    const p = planks('holy holy holy is the Lord', 1);
    expect(plankFits(p, 0, p[0])).toBe(true);
    expect(plankFits(p, 0, p[2])).toBe(true); // another "holy"
    expect(plankFits(p, 0, p[3])).toBe(false);
  });

  it('gives stars for a clean run', () => {
    expect([stars(0), stars(1), stars(2), stars(3), stars(9)]).toEqual([3, 2, 2, 1, 1]);
  });
});

describe('what counts', () => {
  it('only a win within the pile’s usual mistake allowance is a review', () => {
    expect(gameCounts('daily', true, 0)).toBe(true);
    expect(gameCounts('daily', true, 3)).toBe(true);
    expect(gameCounts('daily', true, 4)).toBe(false);
    expect(gameCounts('daily', false, 0)).toBe(false);
    for (const pile of ['weekly', 'monthly', 'yearly'] as const) {
      expect(gameCounts(pile, true, 0)).toBe(true);
      expect(gameCounts(pile, true, 1)).toBe(false);
    }
  });

  it('the dragon draws breath faster as the verse goes on', () => {
    expect(duelChargeMs(0)).toBeGreaterThan(duelChargeMs(1));
    expect(duelChargeMs(1)).toBeGreaterThan(3000);
    expect(duelChargeMs(-5)).toBe(duelChargeMs(0));
  });
});
