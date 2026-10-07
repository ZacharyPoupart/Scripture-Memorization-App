import { describe, expect, it } from 'vitest';
import { filterVerses, matchesQuery, renameTopic, restoreTopics, sortVerses, topicsOf } from '../../src/core/organize.ts';
import { mergeData } from '../../src/core/merge.ts';
import { addVerse, pileVerses, recordReview, settle } from '../../src/core/schedule.ts';
import { at, D0, day, newData } from './helpers.ts';

function library() {
  const data = newData();
  const add = (book: number, chapter: number, start: number, end: number, text: string, topic: string, n: number) =>
    addVerse(data, { book, chapter, start, end, translation: 'ESV', text, topic }, at(day(n), '07:00'));
  const john = add(43, 3, 16, 16, 'For God so loved the world, that he gave his only Son.', 'Gospel', 0);
  const ps = add(19, 23, 1, 3, 'The LORD is my shepherd; I shall not want.', 'Trust', 1);
  const rom = add(45, 8, 28, 28, 'And we know that for those who love God all things work together for good.', 'Trust', 2);
  const gen = add(1, 1, 1, 1, 'In the beginning, God created the heavens and the earth.', '', 3);
  return { data, john, ps, rom, gen };
}

describe('search', () => {
  const { john, ps, rom, gen } = library();
  it('finds by words in the text, topic, translation and reference name', () => {
    expect(matchesQuery(john, 'loved world')).toBe(true);
    expect(matchesQuery(john, 'gospel')).toBe(true);
    expect(matchesQuery(john, 'esv')).toBe(true);
    expect(matchesQuery(ps, 'psalms shepherd')).toBe(true);
    expect(matchesQuery(rom, 'shepherd')).toBe(false);
    expect(matchesQuery(gen, '')).toBe(true);
  });
  it('is case, accent and punctuation insensitive', () => {
    expect(matchesQuery(ps, 'LORD,  SHEPHERD!')).toBe(true);
  });
  it('understands references, abbreviations and ranges', () => {
    expect(matchesQuery(john, 'Jn 3:16')).toBe(true);
    expect(matchesQuery(ps, 'ps 23:2')).toBe(true); // inside Psalms 23:1-3
    expect(matchesQuery(ps, 'ps 23:4')).toBe(false);
    expect(matchesQuery(john, 'john 4:16')).toBe(false);
  });
});

describe('filter and sort', () => {
  it('filters by topic, query and ready-now together', () => {
    const { data, john, ps, rom } = library();
    const now = at(day(5), '09:00');
    const all = Object.values(data.verses);
    expect(filterVerses(all, { topic: 'Trust' }, data, now).map((v) => v.id).sort()).toEqual([ps.id, rom.id].sort());
    expect(filterVerses(all, { topic: 'Trust', query: 'shepherd' }, data, now).map((v) => v.id)).toEqual([ps.id]);
    // after reviewing john today he is waiting, so "ready only" drops him
    settle(data, now);
    recordReview(data, john.id, now, 'd');
    const ready = filterVerses(all, { readyOnly: true }, data, at(day(5), '09:30')).map((v) => v.id);
    expect(ready).not.toContain(john.id);
    expect(ready).toContain(ps.id);
  });

  it('sorts: default keeps longest-in-pile first; others reorder a copy', () => {
    const { data, john, ps, rom, gen } = library();
    const now = at(day(5), '09:00');
    const pile = pileVerses(data, 'daily');
    expect(pile.map((v) => v.id)).toEqual([john.id, ps.id, rom.id, gen.id]);
    expect(sortVerses(pile, 'longest', data, now).map((v) => v.id)).toEqual(pile.map((v) => v.id));
    expect(sortVerses(pile, 'reference', data, now).map((v) => v.id)).toEqual([gen.id, ps.id, john.id, rom.id]);
    expect(sortVerses(pile, 'added', data, now).map((v) => v.id)).toEqual([gen.id, rom.id, ps.id, john.id]);
    expect(pile.map((v) => v.id)).toEqual([john.id, ps.id, rom.id, gen.id]); // input untouched
  });

  it('"due soonest" puts what you can review now first and finished ones last', () => {
    const { data, john, ps } = library();
    const t = at(day(5), '09:00');
    settle(data, t);
    for (const h of ['09:00', '11:00', '13:00']) recordReview(data, john.id, at(day(5), h), 'd'); // john done for today
    recordReview(data, ps.id, at(day(5), '09:00'), 'd'); // ps waiting
    const order = sortVerses(pileVerses(data, 'daily'), 'due', data, at(day(5), '13:30')).map((v) => v.id);
    expect(order[0]).not.toBe(john.id);
    expect(order[order.length - 1]).toBe(john.id);
    expect(order.indexOf(ps.id)).toBeGreaterThan(order.indexOf(order.find((id) => id !== john.id && id !== ps.id)!));
  });
});

describe('topics', () => {
  it('lists topics alphabetically without duplicates, ignoring deleted verses', () => {
    const { data, john } = library();
    expect(topicsOf(data)).toEqual(['Gospel', 'Trust']);
    john.deletedAt = 1;
    expect(topicsOf(data)).toEqual(['Trust']);
  });

  it('renames a topic everywhere, merges into an existing one, removes with an empty name, and undoes', () => {
    const { data, john, ps, rom } = library();
    const now = at(day(6), '10:00');
    const before = renameTopic(data, 'Trust', 'Faith', now);
    expect(before.map((b) => b.id).sort()).toEqual([ps.id, rom.id].sort());
    expect(topicsOf(data)).toEqual(['Faith', 'Gospel']);
    renameTopic(data, 'Faith', 'Gospel', now + 1); // merge
    expect(topicsOf(data)).toEqual(['Gospel']);
    expect(john.topic).toBe('Gospel');
    renameTopic(data, 'Gospel', '', now + 2);
    expect(topicsOf(data)).toEqual([]);
    restoreTopics(data, before, now + 3);
    expect(ps.topic).toBe('Trust');
    expect(rom.topic).toBe('Trust');
  });

  it('a rename syncs like any edit: newer wins over an older edit on another device', () => {
    const { data, ps } = library();
    const other = structuredClone(data);
    other.verses[ps.id].topic = 'Shepherd';
    other.verses[ps.id].contentAt = at(day(6), '09:00');
    renameTopic(data, 'Trust', 'Faith', at(day(6), '10:00'));
    expect(mergeData(data, other).verses[ps.id].topic).toBe('Faith');
    expect(mergeData(other, data).verses[ps.id].topic).toBe('Faith');
    void D0;
  });
});
