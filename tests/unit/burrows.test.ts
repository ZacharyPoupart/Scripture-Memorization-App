import { describe, expect, it } from 'vitest';
import { BURROWS, BURROW_HEARTS, burrowsNeeds, burrowsStep, burrowsTap, newBurrows } from '../../src/core/burrows.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

describe('Goblin Burrows', () => {
  const up = (s: ReturnType<typeof newBurrows>) => {
    for (let i = 0; i < 40 && !s.moles.length && !s.over; i++) burrowsStep(s, 50);
  };

  it('three goblins in different burrows, one holding the next word, with no two labels alike', () => {
    const s = newBurrows(JOHN, 'daily', 4);
    while (!s.over) {
      up(s);
      expect(s.moles).toHaveLength(3);
      expect(new Set(s.moles.map((m) => m.hole)).size).toBe(3);
      expect(s.moles.every((m) => m.hole >= 0 && m.hole < BURROWS)).toBe(true);
      expect(new Set(s.moles.map((m) => m.label.toLowerCase())).size).toBe(3);
      const need = s.moles.filter((m) => burrowsNeeds(s, m));
      expect(need).toHaveLength(1);
      expect(burrowsTap(s, need[0].hole)[0].type).toBe('bonk');
    }
    expect([s.over, s.slips]).toEqual(['won', 0]);
  });

  it('every pile shows whole words, never first letters (v1.82.0)', () => {
    for (const pile of ['daily', 'weekly', 'monthly', 'yearly'] as const) {
      const s = newBurrows(JOHN, pile, 5);
      up(s);
      expect(s.moles.some((m) => m.label.length > 1)).toBe(true);
      const need = s.moles.filter((m) => burrowsNeeds(s, m));
      expect(need).toHaveLength(1);
      expect(need[0].label).toBe('For');
    }
  });

  it('a wrong bonk costs a heart and that goblin ducks; one that gets away costs a heart and the verse moves on', () => {
    const s = newBurrows(JOHN, 'daily', 6);
    up(s);
    const wrong = s.moles.find((m) => !burrowsNeeds(s, m))!;
    expect(burrowsTap(s, wrong.hole)[0].type).toBe('wrong');
    expect([s.hearts, s.moles.length, s.next]).toEqual([BURROW_HEARTS - 1, 2, 0]);
    expect(burrowsTap(s, wrong.hole)).toEqual([]); // already gone
    let escaped = false;
    for (let t = 0; t < 5000 && !escaped; t += 50) escaped = burrowsStep(s, 50).some((e) => e.type === 'escape');
    expect(escaped).toBe(true);
    expect([s.hearts, s.next]).toEqual([BURROW_HEARTS - 2, 1]);
  });
});
