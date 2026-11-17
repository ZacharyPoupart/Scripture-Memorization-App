import { describe, expect, it } from 'vitest';
import { VOLLEY_HEARTS, VOLLEY_LANES, newVolley, volleyStep, volleyTap } from '../../src/core/volley.ts';

const JOHN = 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';

/** Play with perfect taps: cut the needed word as soon as it is flying. */
function playPerfectly(seed: number) {
  const s = newVolley(JOHN, seed);
  let ms = 0;
  while (!s.over && ms < 600_000) {
    volleyStep(s, 50);
    ms += 50;
    const need = s.words[s.next];
    const hit = s.shots.find((sh) => sh.key === need.key);
    if (hit) volleyTap(s, hit.id);
  }
  return { s, ms };
}

describe('Arrow Volley', () => {
  it('can always be won: the needed word keeps coming, in order, to the end', () => {
    for (const seed of [1, 2, 3, 42]) {
      const { s, ms } = playPerfectly(seed);
      expect(s.over).toBe('won');
      expect(s.hearts).toBe(VOLLEY_HEARTS);
      expect(s.slips).toBe(0);
      expect(ms).toBeLessThan(120_000); // a 25-word verse takes well under two minutes
    }
  });

  it('never has two arrows on top of each other, and never punctuation on one', () => {
    const s = newVolley(JOHN, 5);
    for (let t = 0; t < 30_000 && !s.over; t += 50) {
      for (const e of volleyStep(s, 50)) if (e.type === 'spawn') expect(e.shot.word).not.toMatch(/[,.;]/);
      for (let lane = 0; lane < VOLLEY_LANES; lane++) {
        const xs = s.shots.filter((sh) => sh.lane === lane).map((sh) => sh.x).sort();
        for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(0.2);
      }
      // keep it going without ever winning or losing: cut the needed word only when it is about to land
      const need = s.words[s.next];
      const near = s.shots.find((sh) => sh.key === need.key && sh.x > 0.9);
      if (near) volleyTap(s, near.id);
    }
  });

  it('letting the needed word land costs a heart, and decoys pass harmlessly', () => {
    const s = newVolley(JOHN, 9);
    const seen: string[] = [];
    for (let t = 0; t < 120_000 && !s.over; t += 50) for (const e of volleyStep(s, 50)) seen.push(e.type);
    expect(s.over).toBe('lost');
    expect(s.hearts).toBe(0);
    expect(s.next).toBe(0); // nothing was cut, so the verse did not move on
    expect(seen.filter((x) => x === 'struck')).toHaveLength(VOLLEY_HEARTS);
    expect(seen).toContain('passed');
  });

  it('a wrong tap costs a heart and breaks the combo; the right one moves the verse on', () => {
    const s = newVolley(JOHN, 3);
    let wrong, right;
    for (let t = 0; t < 20_000 && !(wrong && right); t += 50) {
      volleyStep(s, 50);
      wrong ??= s.shots.find((sh) => sh.key !== s.words[s.next].key);
      right ??= s.shots.find((sh) => sh.key === s.words[s.next].key);
    }
    expect(volleyTap(s, right!.id)[0].type).toBe('cut');
    expect([s.next, s.combo, s.hearts]).toEqual([1, 1, VOLLEY_HEARTS]);
    if (s.shots.includes(wrong!) && wrong!.key !== s.words[s.next].key) {
      expect(volleyTap(s, wrong!.id)[0].type).toBe('wrong');
      expect([s.next, s.combo, s.hearts, s.slips]).toEqual([1, 0, VOLLEY_HEARTS - 1, 1]);
    }
    expect(volleyTap(s, 99999)).toEqual([]); // an arrow that is already gone
  });

  it('is the same game for the same seed, and an empty verse is simply over', () => {
    const a = playPerfectly(7);
    const b = playPerfectly(7);
    expect(a.ms).toBe(b.ms);
    expect(newVolley('', 1).over).toBe('won');
  });
});
