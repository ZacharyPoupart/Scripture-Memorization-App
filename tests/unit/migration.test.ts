import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import { liveVerses, progressDays, settle, streakInfo, totalReviews } from '../../src/core/schedule.ts';
import { Storage } from '../../src/services/storage.ts';
import { at } from './helpers.ts';

// Fixtures are real exports/settings written by version 1.1.0. They must keep loading, forever,
// with nothing lost. When the stored shape ever changes, add a migration AND keep these tests green.
const read = (f: string) => readFileSync(new URL(`../fixtures/${f}`, import.meta.url), 'utf8');
const BACKUP = read('backup-v1.1.0.json');
const SETTINGS = read('settings-v1.1.0.json');
const old = JSON.parse(BACKUP).data;

type Backend = NonNullable<ConstructorParameters<typeof Storage>[0]>;

function memBackend(initial: Record<string, string>): { backend: Backend; mem: Map<string, string> } {
  const mem = new Map(Object.entries(initial));
  return {
    mem,
    backend: {
      get: async (k: string) => mem.get(k),
      set: async (k: string, v: string) => void mem.set(k, v),
      setMany: async (es: [string, string][]) => void es.forEach(([k, v]) => mem.set(k, v)),
      del: async (k: string) => void mem.delete(k),
      keys: async () => [...mem.keys()],
    } as unknown as Backend,
  };
}

describe('data written by v1.1.0 still loads with nothing lost', () => {
  it('normalizing the old data changes nothing (all fields, tombstones, level-ups, counters kept)', () => {
    expect(normalizeData(old)).toEqual(old);
  });

  it('is safe to run more than once', () => {
    const once = normalizeData(old);
    expect(normalizeData(once)).toEqual(once);
    expect(normalizeData(normalizeData(once))).toEqual(old);
  });

  it('export then import round-trips exactly, and importing into the same data is a no-op merge', () => {
    const data = parseBackup(BACKUP);
    const again = parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')));
    expect(again).toEqual(data);
    expect(mergeData(data, again)).toEqual(data);
  });

  it('old data still schedules sensibly after settling (no verse vanishes, streak and counters intact)', () => {
    const data = parseBackup(BACKUP);
    const before = Object.keys(data.verses).sort();
    settle(data, at('2026-03-15', '09:00'));
    expect(Object.keys(data.verses).sort()).toEqual(before);
    expect(liveVerses(data)).toHaveLength(4);
    expect(data.verses['00000000-dead-4000-8000-000000000001'].deletedAt).toBeTruthy();
    expect(data.longestStreak).toBeGreaterThanOrEqual(37);
    expect(totalReviews(data)).toBe(old.reviewsByDevice['fixture-device']);
    expect(streakInfo(data, at('2026-03-15', '09:00')).longest).toBeGreaterThanOrEqual(37);
  });

  it('loads from local storage exactly as an installed phone would, then saves back losslessly', async () => {
    const { backend, mem } = memBackend({ data: JSON.stringify(old), settings: SETTINGS });
    const s = new Storage(backend);
    const loaded = await s.loadData(at('2026-03-15'));
    expect(loaded.recoveredFrom).toBeUndefined();
    expect(loaded.data).toEqual(old);
    await s.saveData(loaded.data, '2026-03-15');
    expect(JSON.parse(mem.get('data')!)).toEqual(old); // unchanged => nothing rewritten
    const next = structuredClone(loaded.data);
    settle(next, at('2026-03-15', '09:00'));
    await s.saveData(next, '2026-03-15');
    expect(JSON.parse(mem.get('data.prev')!)).toEqual(old); // the old copy is always kept
  });

  it('old device settings load with their values intact and any new settings default in', async () => {
    const { backend } = memBackend({ settings: SETTINGS });
    const st = await new Storage(backend).loadSettings();
    const fixture = JSON.parse(SETTINGS);
    for (const [k, v] of Object.entries(fixture)) expect(st[k as keyof typeof st]).toEqual(v);
    expect(st.deviceId).toBe('fixture-device');
    expect(st.theme).toBe('dark');
  });
});

describe('v1.9 data with a break (pause) in it', () => {
  const text = read('backup-v1.9.0-pause.json');
  it('loads, keeps the pause and the paused days, and survives a round trip and settling', () => {
    const data = parseBackup(text);
    expect(data.pause).toBeDefined();
    expect(Object.values(data.ledger).some((e) => e.p === 1)).toBe(true);
    expect(parseBackup(exportBackup(data, '9.9.9', 0))).toEqual(data);
    expect(normalizeData(JSON.parse(JSON.stringify(data)))).toEqual(data);
    const before = structuredClone(data);
    settle(data, Date.parse('2026-02-20T09:00:00'));
    expect(Object.keys(data.verses)).toEqual(Object.keys(before.verses));
    for (const [d, e] of Object.entries(before.ledger)) expect(data.ledger[d]).toEqual(e); // settled days are never rewritten
  });
  it('an app that does not know about breaks (older data) still loads cleanly with no pause', () => {
    const old = parseBackup(read('backup-v1.1.0.json'));
    expect(old.pause).toBeUndefined();
  });
});

describe('data written by v1.13.0 (avatar) keeps its avatar', () => {
  const av = JSON.parse(read('backup-v1.13.0-avatar.json')).data;
  it('normalizing changes nothing and the avatar survives an export/import round trip', () => {
    expect(normalizeData(av)).toEqual(av);
    const back = parseBackup(exportBackup(av, '1.13.0', 0));
    expect(back.avatar).toEqual(av.avatar);
  });
  it('older data without an avatar stays without one, and merging keeps the owned items', () => {
    expect(normalizeData(old).avatar).toBeUndefined();
    const merged = mergeData(old, av);
    expect(merged.avatar?.owned).toEqual(['hair-bun', 'out-hoodie-sky']);
  });
});

describe('progress days (v1.33.0): what older versions had earned is kept', () => {
  it('filling in each verse’s own list from the ledger keeps the progress the old rule showed (only today, which now counts once reviewed, can differ)', () => {
    const data = parseBackup(BACKUP);
    const now = at('2026-03-15', '09:00');
    const before = Object.fromEntries(liveVerses(data).map((v) => [v.id, progressDays(data, v, now)]));
    expect(Object.values(before).some((n) => n > 0)).toBe(true);
    settle(data, now);
    for (const v of liveVerses(data)) {
      expect(v.prog, v.id).toBeDefined();
      if (v.pile !== 'yearly') expect(progressDays(data, v, now), v.id).toBeGreaterThanOrEqual(before[v.id] - 1);
    }
  });

  it('a backup that carries the progress lists loads unchanged and merges into itself as a no-op', () => {
    const file = read('backup-v1.33.0-progress.json');
    const data = parseBackup(file);
    expect(liveVerses(data).every((v) => Array.isArray(v.prog))).toBe(true);
    expect(parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')))).toEqual(data);
    expect(mergeData(data, data)).toEqual(data);
  });
});

describe('the guided tour (v1.34.0): finishing it is remembered with the data', () => {
  it('older backups have no tour and still load; a backup that carries it loads unchanged and merges into itself as a no-op', () => {
    expect(parseBackup(BACKUP).tourAt).toBeUndefined();
    const data = parseBackup(read('backup-v1.34.0-tour.json'));
    expect(data.tourAt).toBe(1773583200000);
    expect(parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')))).toEqual(data);
    expect(mergeData(data, data)).toEqual(data);
    expect(mergeData(parseBackup(BACKUP), data).tourAt).toBe(1773583200000);
  });
});

describe('friends (v1.37.0): the private identity and sharing choice travel with the data', () => {
  it('older backups have neither; a backup that carries them loads unchanged and merges into itself as a no-op', () => {
    const old = parseBackup(BACKUP);
    expect(old.social).toBeUndefined();
    expect(old.sharing).toBeUndefined();
    const data = parseBackup(read('backup-v1.37.0-social.json'));
    expect(data.social?.id).toBe('0123456789abcdef0123456789abcdef');
    expect(data.sharing).toEqual({ name: 'Sam L.', on: true, at: 1773583300000 });
    expect(parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')))).toEqual(data);
    expect(mergeData(data, data)).toEqual(data);
    expect(mergeData(old, data).social).toEqual(data.social);
  });

  it('opens a backup that records guild goals reached (v1.48.0) and older ones without them', () => {
    expect(parseBackup(BACKUP).guildWins).toBeUndefined();
    const data = parseBackup(read('backup-v1.48.0-guildwins.json'));
    expect(data.guildWins).toEqual(['9f2c41aa7b:2026-03-08', '9f2c41aa7b:2026-03-15']);
    expect(parseBackup(exportBackup(data, '9.9.9', at('2026-03-15')))).toEqual(data);
    expect(mergeData(data, data)).toEqual(data);
    expect(mergeData(parseBackup(BACKUP), data).guildWins).toEqual(data.guildWins);
  });
});
