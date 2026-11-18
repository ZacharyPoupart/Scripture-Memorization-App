import { describe, expect, it } from 'vitest';
import { comboMultiplier, isComboTier, points, recordBest, totalStars, verseStars, bestKey } from '../../src/core/games.ts';
import { GATE_HEARTS, GATE_KEYS, firstLetter, gateStep, gateTap, newGate } from '../../src/core/gate.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

describe('score and combo', () => {
  it('steps up at 5, 10 and 20 in a row', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 99].map(comboMultiplier)).toEqual([1, 1, 1.5, 1.5, 2, 2, 3, 3]);
    expect([4, 5, 10, 20, 21].map(isComboTier)).toEqual([false, true, true, true, false]);
    expect(points(1)).toBe(10);
    expect(points(10, 1)).toBe(25);
    expect(points(1, 9)).toBe(15); // speed is capped
  });

  it('keeps the best of each game and verse, only for wins, and says what is new', () => {
    const k = bestKey('gate', 'v1');
    const a = recordBest({}, k, { won: true, stars: 2, score: 120 });
    expect(a).toMatchObject({ newStars: true, newScore: false }); // a first win is not called a new best score
    expect(a.table[k]).toEqual({ stars: 2, score: 120 });
    const b = recordBest(a.table, k, { won: true, stars: 1, score: 200 });
    expect(b).toMatchObject({ newScore: true, newStars: false });
    expect(b.table[k]).toEqual({ stars: 2, score: 200 }); // the best of each is kept
    const c = recordBest(b.table, k, { won: false, stars: 3, score: 999 });
    expect(c.table).toBe(b.table);
    expect(verseStars({ ...b.table, [bestKey('duel', 'v1')]: { stars: 3, score: 1 }, [bestKey('duel', 'v2')]: { stars: 1, score: 1 } }, 'v1')).toBe(5);
    expect(totalStars({ 'gate:a': { stars: 3, score: 0 }, 'duel:b': { stars: 1, score: 0 }, 'parry:c': { stars: 3, score: 0 } })).toBe(4); // a retired game no longer counts
  });
});

describe('Hold the Gate', () => {
  it('offers six distinct keys, one of them the next first letter', () => {
    const s = newGate(JOHN, 3);
    while (!s.over) {
      expect(s.keys).toHaveLength(GATE_KEYS);
      expect(new Set(s.keys).size).toBe(GATE_KEYS);
      expect(s.keys).toContain(firstLetter(s.words[s.next]));
      gateTap(s, firstLetter(s.words[s.next]));
    }
    expect(s.over).toBe('won');
    expect(s.slips).toBe(0);
    expect(s.score).toBeGreaterThan(s.words.length * 10);
  });

  it('a wrong key is a slip that sends the goblin forward; five right in a row charge a shield that blocks the next slip', () => {
    const s = newGate(JOHN, 1);
    const wrong = s.keys.find((k) => k !== firstLetter(s.words[0]))!;
    const ev = gateTap(s, wrong);
    expect(ev[0].type).toBe('miss');
    expect([s.slips, s.hearts, s.next]).toEqual([1, GATE_HEARTS - 1, 0]);
    expect(s.x).toBeCloseTo(0.15);
    for (let i = 0; i < 5; i++) gateTap(s, firstLetter(s.words[s.next]));
    expect(s.shield).toBe(true);
    const w = s.keys.find((k) => k !== firstLetter(s.words[s.next]))!;
    expect(gateTap(s, w).map((e) => e.type)).toEqual(['miss', 'block']);
    expect([s.slips, s.hearts, s.shield]).toEqual([2, GATE_HEARTS - 1, false]);
  });

  it('a goblin that reaches the gate costs a heart and shows the word; three of them end it', () => {
    const s = newGate(JOHN, 2);
    const seen: string[] = [];
    for (let t = 0; t < 60_000 && !s.over; t += 50) for (const e of gateStep(s, 50)) seen.push(e.type);
    expect(s.over).toBe('lost');
    expect(seen.filter((x) => x === 'breach')).toHaveLength(GATE_HEARTS);
    expect(s.next).toBe(GATE_HEARTS - 1); // two words were shown and passed on before the last heart went
  });
});
