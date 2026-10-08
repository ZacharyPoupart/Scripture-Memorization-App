// Data-safety audit: randomised (but seeded, so reproducible) tests for the things that must never lose data:
// sync merge, backup export/import, and validation of damaged input.
import { describe, expect, it } from 'vitest';
import { BackupError, exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import {
  addVerse,
  deleteVerse,
  editVerse,
  liveVerses,
  movePile,
  recordReview,
  restoreVerse,
  settle,
  streakInfo,
  todaySummary,
  verseStatus,
} from '../../src/core/schedule.ts';
import { PILES, type AppData } from '../../src/core/types.ts';
import { at, day, newData } from './helpers.ts';

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T,>(xs: readonly T[]): T => xs[int(xs.length)];
  return { next, int, pick };
}

const TEXTS = [
  'For God so loved the world, that he gave his only Son.',
  'The LORD is my shepherd; I shall not want.',
  'Trust in the LORD with all your heart.',
  'I can do all things through him who strengthens me.',
];

const DAYS = 30;

/** A random but valid history: adds, reviews, edits, moves, deletes/restores over ~60 days on one device. */
function randomData(seed: number, device: string, base?: AppData): AppData {
  const r = rng(seed);
  const data = base ? structuredClone(base) : newData();
  for (let d = 1; d <= DAYS; d++) {
    for (const hm of ['08:00', '11:30', '15:00']) {
      const now = at(day(d), hm);
      settle(data, now);
      if (r.next() < 0.12) {
        const book = 1 + r.int(60);
        const start = 1 + r.int(5);
        addVerse(data, { book, chapter: 1, start, end: start, translation: r.pick(['ESV', 'KJV', 'NIV']), text: r.pick(TEXTS) }, now);
      }
      const live = liveVerses(data);
      for (const v of live) {
        if (r.next() < 0.5 && verseStatus(data, v, now).state === 'ready') recordReview(data, v.id, now, device);
      }
      if (live.length && r.next() < 0.08) editVerse(data, r.pick(live).id, { topic: r.pick(['', 'Gospel', 'Hope']) }, now);
      if (live.length && r.next() < 0.05) movePile(data, r.pick(live).id, r.pick(PILES), now);
      if (live.length && r.next() < 0.04) deleteVerse(data, r.pick(live).id, now);
      const all = Object.values(data.verses).filter((v) => v.deletedAt !== undefined);
      if (all.length && r.next() < 0.03) restoreVerse(data, r.pick(all).id, now);
    }
  }
  return data;
}

const SEEDS = Array.from({ length: 6 }, (_, i) => 1000 + i * 37);

/** Generating histories is the slow part, so build each once and share it. */
const cache = new Map<string, AppData>();
function triple(seed: number) {
  const key = `t${seed}`;
  if (!cache.has(key)) {
    const origin = randomData(seed, 'origin');
    cache.set(key, origin);
    cache.set(`${key}a`, randomData(seed + 1, 'dev-A', origin));
    cache.set(`${key}b`, randomData(seed + 2, 'dev-B', origin));
    cache.set(`${key}c`, randomData(seed + 3, 'dev-C', origin));
  }
  return { origin: cache.get(key)!, a: cache.get(`${key}a`)!, b: cache.get(`${key}b`)!, c: cache.get(`${key}c`)! };
}

describe('sync merge on random histories', { timeout: 120_000 }, () => {
  it('is commutative, associative and idempotent (random device pairs / triples)', () => {
    for (const seed of SEEDS) {
      const { a, b, c } = triple(seed);
      const ab = mergeData(a, b);
      expect(mergeData(b, a), `commutative, seed ${seed}`).toEqual(ab);
      expect(mergeData(ab, ab), `idempotent, seed ${seed}`).toEqual(ab);
      expect(mergeData(ab, a), `absorbs inputs, seed ${seed}`).toEqual(ab);
      expect(mergeData(mergeData(a, b), c), `associative, seed ${seed}`).toEqual(mergeData(a, mergeData(b, c)));
    }
  });

  it('never loses a review or a verse, and deletes win', () => {
    for (const seed of SEEDS) {
      const { a, b } = triple(seed);
      const m = mergeData(a, b);
      for (const src of [a, b]) {
        for (const [id, v] of Object.entries(src.verses)) {
          const mv = m.verses[id];
          expect(mv, `verse ${id} kept (seed ${seed})`).toBeDefined();
          for (const t of v.reviews) expect(mv.reviews, `review kept (seed ${seed})`).toContain(t);
          if (v.deletedAt !== undefined) expect(mv.deletedAt, `delete wins (seed ${seed})`).toBeDefined();
        }
        for (const [d, e] of Object.entries(src.ledger)) {
          if (e.r) expect(m.ledger[d]?.r, `reviewed day kept (seed ${seed})`).toBe(1);
        }
        expect(m.longestStreak).toBeGreaterThanOrEqual(src.longestStreak);
      }
    }
  });

  it('a merged result can always be settled, summarised and re-merged without throwing', () => {
    for (const seed of SEEDS) {
      const { a, b } = triple(seed);
      const m = mergeData(a, b);
      const now = at(day(70), '09:00');
      expect(() => {
        settle(m, now);
        todaySummary(m, now);
        streakInfo(m, now);
        mergeData(m, a);
      }, `seed ${seed}`).not.toThrow();
    }
  });
});

describe('export → import round trip', { timeout: 120_000 }, () => {
  it('a full backup of a random history comes back identical, and merging it into itself changes nothing', () => {
    for (const seed of SEEDS) {
      const data = triple(seed).a;
      const text = exportBackup(data, '9.9.9', at(day(61)));
      const back = parseBackup(text);
      expect(back, `seed ${seed}`).toEqual(data);
      expect(mergeData(data, back), `self-merge, seed ${seed}`).toEqual(data);
      // importing is idempotent and normalising twice is stable
      expect(normalizeData(JSON.parse(JSON.stringify(back)))).toEqual(back);
    }
  });

  it('importing a backup into different existing data (merge mode) keeps both sides', () => {
    const mine = triple(SEEDS[0]).a;
    const theirs = triple(SEEDS[1]).b;
    const merged = mergeData(mine, parseBackup(exportBackup(theirs, '1.0.0', at(day(61)))));
    for (const id of Object.keys(mine.verses)) expect(merged.verses[id]).toBeDefined();
    for (const id of Object.keys(theirs.verses)) expect(merged.verses[id]).toBeDefined();
  });
});

describe('damaged input is rejected or cleaned, never crashes the app', { timeout: 120_000 }, () => {
  /** Randomly damage a JSON value in place. */
  function damage(x: unknown, r: ReturnType<typeof rng>, depth = 0): unknown {
    if (depth > 6) return x;
    if (r.next() < 0.03) return r.pick([null, undefined, 'x', 7, -1, NaN, [], {}, true, 1e308]);
    if (Array.isArray(x)) {
      const out = x.map((v) => damage(v, r, depth + 1));
      if (r.next() < 0.05) out.pop();
      return out;
    }
    if (x && typeof x === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(x)) {
        if (r.next() < 0.03) continue; // drop a field
        out[k] = damage(v, r, depth + 1);
      }
      return out;
    }
    return x;
  }

  it('random corruption of valid data either throws a BackupError or yields data the app can use', () => {
    let rejected = 0;
    let accepted = 0;
    for (let i = 0; i < 300; i++) {
      const r = rng(5000 + i);
      const data = triple(SEEDS[i % SEEDS.length]).a;
      const bad = damage(JSON.parse(JSON.stringify(data)), r);
      let out: AppData | undefined;
      try {
        out = normalizeData(bad);
        accepted++;
      } catch (e) {
        expect(e, `only BackupError may escape (case ${i})`).toBeInstanceOf(BackupError);
        rejected++;
      }
      if (out) {
        const now = at(day(65), '09:00');
        expect(() => {
          settle(out!, now);
          todaySummary(out!, now);
          streakInfo(out!, now);
          for (const v of liveVerses(out!)) verseStatus(out!, v, now);
          mergeData(out!, out!);
        }, `usable (case ${i})`).not.toThrow();
      }
    }
    expect(rejected + accepted).toBe(300);
  });

  it('hostile keys cannot poison the data object', () => {
    const base = JSON.parse(JSON.stringify(triple(SEEDS[0]).a));
    const someVerse = Object.values<Record<string, unknown>>(base.verses)[0];
    const evil = JSON.parse(JSON.stringify(base));
    evil.verses = JSON.parse(`{"__proto__": ${JSON.stringify({ ...someVerse, id: '__proto__' })}}`);
    let out: AppData | undefined;
    try {
      out = normalizeData(evil);
    } catch (e) {
      expect(e).toBeInstanceOf(BackupError);
    }
    if (out) {
      // whatever happens, ordinary lookups must not return inherited verse objects
      expect(Object.getPrototypeOf(out.verses) === Object.prototype || Object.getPrototypeOf(out.verses) === null).toBe(true);
      expect(out.verses['text']).toBeUndefined();
      expect(out.verses['reviews']).toBeUndefined();
    }
  });
});
