import { describe, expect, it } from 'vitest';
import { DANCE_HEARTS, DANCE_SLOTS, danceStep, danceTap, newDance, phrasesOf } from '../../src/core/dance.ts';
import { PARRY_HEARTS, newParry, parryAct, parryStep } from '../../src/core/parry.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

describe('Sword Dance', () => {
  const ready = (s: ReturnType<typeof newDance>) => {
    for (let i = 0; i < 40 && !s.shields.length && !s.over; i++) danceStep(s, 50);
  };

  it('splits the verse into phrases of about five, with no lone word at the end', () => {
    expect(phrasesOf(12)).toEqual([[0, 5], [5, 10], [10, 12]]);
    expect(phrasesOf(11)).toEqual([[0, 5], [5, 11]]);
    expect(phrasesOf(3)).toEqual([[0, 3]]);
  });

  it('cut in order, every phrase falls and the game is won clean', () => {
    const s = newDance(JOHN, 3);
    let cuts = 0;
    while (!s.over) {
      ready(s);
      const [a, b] = s.phrases[s.phrase];
      expect(s.shields).toHaveLength(b - a);
      expect(new Set(s.shields.map((x) => x.slot)).size).toBe(b - a);
      expect(s.shields.every((x) => x.slot < DANCE_SLOTS)).toBe(true);
      const need = s.words[s.next];
      const sh = s.shields.find((x) => !x.broken && x.word.key === need.key)!;
      expect(danceTap(s, sh.slot)[0].type).toBe('cut');
      cuts++;
    }
    expect([s.over, s.slips, cuts]).toEqual(['won', 0, s.words.length]);
  });

  it('a word out of order costs a heart; the fuse running out costs one and shows the rest of the phrase', () => {
    const s = newDance(JOHN, 5);
    ready(s);
    const wrong = s.shields.find((x) => x.word.key !== s.words[s.next].key)!;
    expect(danceTap(s, wrong.slot)[0].type).toBe('wrong');
    expect([s.hearts, s.next]).toEqual([DANCE_HEARTS - 1, 0]);
    let fizzled = false;
    for (let t = 0; t < 20_000 && !fizzled; t += 50) fizzled = danceStep(s, 50).some((e) => e.type === 'fizzle');
    expect(fizzled).toBe(true);
    expect([s.hearts, s.next, s.phrase]).toEqual([DANCE_HEARTS - 2, 5, 1]);
  });

  it('a repeated word may be cut in either place', () => {
    const s = newDance('holy holy holy is the Lord', 1);
    ready(s);
    const last = s.shields.filter((x) => x.word.key === 'holy').sort((a, b) => b.word.index - a.word.index)[0];
    expect(danceTap(s, last.slot)[0].type).toBe('cut');
    expect(s.next).toBe(1);
  });
});

describe('Parry', () => {
  it('strike the right word and block the rest, and it is won clean', () => {
    const s = newParry(JOHN, 2);
    let rights = 0;
    let decoys = 0;
    for (let t = 0; t < 300_000 && !s.over; t += 50) {
      parryStep(s, 50);
      if (s.rune && s.rune.x > 0.2) {
        if (s.rune.right) rights++;
        else decoys++;
        expect(s.rune.right).toBe(s.rune.key === s.words[s.next].key);
        expect(s.rune.word).not.toMatch(/[,.;]/);
        parryAct(s, s.rune.right ? 'strike' : 'block');
      }
    }
    expect([s.over, s.slips]).toEqual(['won', 0]);
    expect(rights).toBe(s.words.length);
    expect(decoys).toBeGreaterThan(3);
  });

  it('never more than two decoys in a row', () => {
    const s = newParry(JOHN, 9);
    let run = 0;
    for (let t = 0; t < 60_000 && !s.over; t += 50) {
      for (const e of parryStep(s, 50)) if (e.type === 'rune') run = e.rune.right ? 0 : run + 1;
      expect(run).toBeLessThanOrEqual(2);
      if (s.rune && s.rune.x > 0.3) parryAct(s, s.rune.right ? 'strike' : 'block');
    }
  });

  it('a wrong call or an unanswered rune costs a heart; a right word that gets past is shown and the verse moves on', () => {
    const s = newParry(JOHN, 4);
    let wrongDone = false;
    for (let t = 0; t < 20_000 && !wrongDone; t += 50) {
      parryStep(s, 50);
      if (s.rune && !s.rune.right) {
        expect(parryAct(s, 'strike')[0].type).toBe('wrong');
        wrongDone = true;
      }
    }
    expect([s.hearts, s.slips]).toEqual([PARRY_HEARTS - 1, 1]);
    const seen: string[] = [];
    for (let t = 0; t < 60_000 && !s.over; t += 50) for (const e of parryStep(s, 50)) seen.push(e.type);
    expect(s.over).toBe('lost');
    expect(seen.filter((x) => x === 'hit')).toHaveLength(PARRY_HEARTS - 1);
  });
});
