import { describe, expect, it } from 'vitest';
import { addToTally, campaignVerses, emptyTally, nextGame, shuffle } from '../../src/core/campaign.ts';
import { GAMES } from '../../src/core/games.ts';

const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('campaign mode (v1.82.0)', () => {
  it('shuffles without losing or repeating anything', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(ids, Math.random);
    expect([...out].sort()).toEqual(ids);
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e']); // the input is left alone
  });

  it('puts the due verses first, then every other verse, each verse once', () => {
    const order = campaignVerses(['c', 'a'], ['a', 'b', 'c', 'd'], null, Math.random);
    expect(order).toHaveLength(4);
    expect(new Set(order.slice(0, 2))).toEqual(new Set(['a', 'c']));
    expect(new Set(order.slice(2))).toEqual(new Set(['b', 'd']));
  });

  it('ignores a due id that is not a live verse', () => {
    expect(campaignVerses(['gone'], ['a'], null, Math.random)).toEqual(['a']);
  });

  it('never brings back the verse just played straight away, unless it is the only one', () => {
    for (let i = 0; i < 50; i++) expect(campaignVerses([], ['a', 'b', 'c'], 'a', Math.random)[0]).not.toBe('a');
    expect(campaignVerses([], ['a'], 'a', Math.random)).toEqual(['a']);
  });

  it('never picks the same game twice in a row', () => {
    let prev = nextGame(null, Math.random);
    for (let i = 0; i < 100; i++) {
      const g = nextGame(prev, Math.random);
      expect(g).not.toBe(prev);
      expect(GAMES.map((x) => x.id)).toContain(g);
      prev = g;
    }
    expect(nextGame('gate', seq(0))).not.toBe('gate');
  });

  it('adds up the pot: only wins score, only counted reviews pay, and the biggest multiplier is kept', () => {
    let t = emptyTally();
    t = addToTally(t, { won: true, stars: 3, score: 300 }, { counted: true, seeds: 12, base: 6, multiplier: 2 });
    t = addToTally(t, { won: false, stars: 0, score: 80 }, null);
    t = addToTally(t, { won: true, stars: 2, score: 150 }, { counted: false, seeds: 0, base: 0, multiplier: 1 });
    expect(t).toEqual({ played: 3, won: 2, counted: 1, stars: 5, score: 450, seeds: 12, base: 6, multiplier: 2 });
  });
});
