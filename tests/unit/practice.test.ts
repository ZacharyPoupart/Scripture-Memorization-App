import { describe, expect, it } from 'vitest';
import { CLASSIC_ORDER, cueFor, describeOrder, firstWords, normalizeOrder, planFor, PRESETS, presetOf, sequenceOf } from '../../src/core/practice.ts';

describe('practice order', () => {
  it('the classic order is what the app always did: citation, then topic, after the verse', () => {
    expect(CLASSIC_ORDER).toEqual({ before: [], after: ['citation', 'topic'] });
    expect(describeOrder(CLASSIC_ORDER)).toBe('Verse → Citation → Topic');
  });

  it('the Navigators sandwich is topic, citation, verse, citation', () => {
    const sandwich = PRESETS.find((p) => p.id === 'sandwich')!;
    expect(sequenceOf(sandwich.order)).toEqual(['topic', 'citation', 'verse', 'citation']);
    expect(describeOrder(sandwich.order)).toBe('Topic → Citation → Verse → Citation');
  });

  it('every preset is valid, distinct and found again by presetOf', () => {
    expect(new Set(PRESETS.map((p) => JSON.stringify(p.order))).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(normalizeOrder(p.order)).toEqual(p.order);
      expect(presetOf(p.order)?.id).toBe(p.id);
    }
    expect(presetOf({ before: ['citation', 'topic'], after: [] })).toBeUndefined(); // a custom order
  });

  it('a topic is only asked when the verse has one', () => {
    const sandwich = PRESETS.find((p) => p.id === 'sandwich')!.order;
    expect(planFor(sandwich, { topic: 'Christ the Center' })).toEqual({ before: ['topic', 'citation'], after: ['citation'] });
    expect(planFor(sandwich, { topic: '' })).toEqual({ before: ['citation'], after: ['citation'] });
    expect(planFor(CLASSIC_ORDER, { topic: '' })).toEqual({ before: [], after: ['citation'] });
  });

  it('anything unreadable falls back to a valid order, never a crash', () => {
    for (const bad of [undefined, null, 5, 'x', [], {}, { before: 'a', after: 'b' }, { before: [1], after: null }]) {
      expect(normalizeOrder(bad)).toEqual(CLASSIC_ORDER);
    }
    // unknown parts are dropped, repeats collapse, and after the verse the order is always citation then topic
    expect(normalizeOrder({ before: ['citation', 'verse', 'citation', 'topic', 7], after: ['topic', 'citation', 'junk'] })).toEqual({
      before: ['citation', 'topic'],
      after: ['citation', 'topic'],
    });
    // the result is a copy, so changing it never changes the shared classic order
    normalizeOrder(undefined).after.push('topic');
    expect(CLASSIC_ORDER.after).toEqual(['citation', 'topic']);
  });

  it('the cue is the other one of the pair: ask for the topic and you see the citation, ask for the citation and you see the topic', () => {
    expect(cueFor([], { topic: 'Gospel' })).toBeNull();
    expect(cueFor(['topic', 'citation'], { topic: 'Gospel' })).toBe('citation');
    expect(cueFor(['topic'], { topic: 'Gospel' })).toBe('citation');
    expect(cueFor(['citation', 'topic'], { topic: 'Gospel' })).toBe('topic');
    expect(cueFor(['citation'], { topic: 'Gospel' })).toBe('topic');
    expect(cueFor(['citation'], { topic: '' })).toBe('words'); // no topic to show, so the first words of the verse
  });

  it('the first words of a verse', () => {
    expect(firstWords('For God so loved the world, that he gave his only Son.')).toBe('For God so loved the…');
    expect(firstWords('Jesus wept.')).toBe('Jesus wept.');
    expect(firstWords('  one two three four five  ')).toBe('one two three four five');
    expect(firstWords('')).toBe('');
  });
});
