import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { handleSync } from '../../functions/_lib/sync.js';
import { mergeData } from '../../src/core/merge.ts';
import { addVerse, editVerse, settle } from '../../src/core/schedule.ts';
import { lookupPassage, LookupError } from '../../src/services/lookup.ts';
import { Storage } from '../../src/services/storage.ts';
import { runSync, SyncError } from '../../src/services/sync.ts';
import { decryptJson, deriveKeys, encryptJson, generateSyncCode, normalizeSyncCode } from '../../src/services/syncCrypto.ts';
import { at, D0, day, john316, newData, reviewEverythingDue } from './helpers.ts';

// ---------------------------------------------------------------- an in-memory "Cloudflare" for sync tests
function fakeServer(opts: { configured?: boolean } = {}) {
  const store = new Map<string, string>();
  const kv = opts.configured === false ? undefined : {
    async get(key: string) {
      const v = store.get(key);
      return v ? JSON.parse(v) : null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
  const calls: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'https://example.test');
    const id = url.pathname.split('/').pop()!;
    calls.push(`${init?.method ?? 'GET'} ${id.slice(0, 4)}`);
    return handleSync(new Request(url, init), kv as never, id);
  }) as typeof fetch;
  return { store, fetchFn, calls };
}

describe('sync codes and crypto', () => {
  it('generates codes in a typeable format and normalizes sloppy input', () => {
    const code = generateSyncCode();
    expect(code).toMatch(/^([0-9A-Z]{5}-){3}[0-9A-Z]{5}$/);
    expect(normalizeSyncCode(code.toLowerCase().replace(/-/g, ' '))).toBe(code);
    expect(normalizeSyncCode('too short')).toBeNull();
    expect(normalizeSyncCode('UUUUU-UUUUU-UUUUU-UUUUU')).toBeNull(); // U isn't in the alphabet
  });
  it('encrypts and decrypts; a different code cannot read it', async () => {
    const a = await deriveKeys('AAAAA-AAAAA-AAAAA-AAAAA');
    const b = await deriveKeys('BBBBB-BBBBB-BBBBB-BBBBB');
    expect(a.id).toMatch(/^[a-f0-9]{32}$/);
    expect(a.id).not.toBe(b.id);
    const blob = await encryptJson(a.key, { hello: 'wörld', n: [1, 2, 3] });
    expect(blob).not.toContain('hello');
    expect(await decryptJson(a.key, blob)).toEqual({ hello: 'wörld', n: [1, 2, 3] });
    await expect(decryptJson(b.key, blob)).rejects.toThrow();
  });
});

describe('sync server function', () => {
  const id = 'a'.repeat(32);
  const kv = () => {
    const m = new Map<string, string>();
    return { get: async (k: string) => (m.has(k) ? JSON.parse(m.get(k)!) : null), put: async (k: string, v: string) => void m.set(k, v) };
  };
  const req = (method: string, body?: unknown) => new Request('https://x.test/api/sync/' + id, { method, body: body ? JSON.stringify(body) : undefined });

  it('stores, returns and version-checks blobs', async () => {
    const store = kv();
    expect((await handleSync(req('GET'), store, id)).status).toBe(404);
    expect((await handleSync(req('PUT', { baseRev: 0, blob: 'one' }), store, id)).status).toBe(200);
    const got = await (await handleSync(req('GET'), store, id)).json();
    expect(got).toMatchObject({ rev: 1, blob: 'one' });
    const stale = await handleSync(req('PUT', { baseRev: 0, blob: 'two' }), store, id);
    expect(stale.status).toBe(409);
    expect((await handleSync(req('PUT', { baseRev: 1, blob: 'two' }), store, id)).status).toBe(200);
  });
  it('validates ids, bodies and configuration', async () => {
    const store = kv();
    expect((await handleSync(req('GET'), store, 'nope')).status).toBe(400);
    expect((await handleSync(req('PUT', { nope: 1 }), store, id)).status).toBe(400);
    expect((await handleSync(req('DELETE'), store, id)).status).toBe(405);
    expect((await handleSync(req('GET'), undefined, id)).status).toBe(501);
  });
});

describe('two devices syncing through the server', () => {
  const CODE = 'ABCDE-FGHJK-MNPQR-STVWX';

  it('converges: both devices end with everything, and the server never sees plaintext', async () => {
    const server = fakeServer();
    const phone = newData();
    const laptop = newData();
    john316(phone, at(D0, '07:00'));
    addVerse(laptop, { book: 19, chapter: 23, start: 1, end: 1, translation: 'KJV', text: 'The LORD is my shepherd; I shall not want.' }, at(D0, '08:00'));
    reviewEverythingDue(phone, day(1), 'phone');

    const r1 = await runSync(CODE, phone, server.fetchFn);
    expect(r1.pushed).toBe(true);
    const r2 = await runSync(CODE, laptop, server.fetchFn);
    expect(r2.pulled).toBe(true);
    expect(Object.keys(r2.merged.verses)).toHaveLength(2);
    const r3 = await runSync(CODE, r1.merged, server.fetchFn);
    expect(Object.keys(r3.merged.verses)).toHaveLength(2);
    expect(r3.merged).toEqual(r2.merged);
    expect([...server.store.values()].join('')).not.toContain('shepherd');
  });

  it('does not write to the server when nothing changed', async () => {
    const server = fakeServer();
    const d = newData();
    john316(d, at(D0, '07:00'));
    const first = await runSync(CODE, d, server.fetchFn);
    server.calls.length = 0;
    const again = await runSync(CODE, first.merged, server.fetchFn);
    expect(again.pushed).toBe(false);
    expect(server.calls.filter((c) => c.startsWith('PUT'))).toHaveLength(0);
  });

  it('survives a write conflict by re-merging', async () => {
    const server = fakeServer();
    const a = newData();
    const v = john316(a, at(D0, '07:00'));
    const b = structuredClone(a);
    await runSync(CODE, a, server.fetchFn);
    editVerse(a, v.id, { topic: 'from A' }, at(day(1), '09:00'));
    addVerse(b, { book: 1, chapter: 1, start: 1, end: 1, translation: 'KJV', text: 'In the beginning God created the heaven and the earth.' }, at(day(1), '10:00'));
    // B syncs between A's GET and PUT
    let first = true;
    const racing: typeof fetch = async (input, init) => {
      if (first && init?.method === 'PUT') {
        first = false;
        await runSync(CODE, b, server.fetchFn);
      }
      return server.fetchFn(input, init);
    };
    const res = await runSync(CODE, a, racing);
    expect(Object.keys(res.merged.verses)).toHaveLength(2);
    expect(res.merged.verses[v.id].topic).toBe('from A');
  });

  it('reports useful errors', async () => {
    const d = newData();
    await expect(runSync(CODE, d, (async () => { throw new TypeError('fetch failed'); }) as typeof fetch)).rejects.toMatchObject({ code: 'offline' });
    await expect(runSync(CODE, d, fakeServer({ configured: false }).fetchFn)).rejects.toMatchObject({ code: 'not-configured' });
    const server = fakeServer();
    await runSync(CODE, d, server.fetchFn);
    await expect(runSync('ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ', d, server.fetchFn)).resolves.toBeTruthy(); // different code = different (empty) slot
    const [key] = server.store.keys();
    server.store.set(key, JSON.stringify({ rev: 1, blob: 'AAAA', updatedAt: 0 }));
    await expect(runSync(CODE, d, server.fetchFn)).rejects.toBeInstanceOf(SyncError);
  });

  it('merged result is what mergeData would produce', async () => {
    const server = fakeServer();
    const a = newData();
    const b = newData();
    john316(a, at(D0, '07:00'));
    settle(b, at(day(3)));
    await runSync(CODE, a, server.fetchFn);
    const res = await runSync(CODE, b, server.fetchFn);
    expect(res.merged).toEqual(mergeData(b, a));
  });
});

describe('verse lookup', () => {
  const ref = { book: 43, chapter: 3, start: 16, end: 17 };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('uses bible-api for KJV and joins the verses of a range', async () => {
    const calls: string[] = [];
    const fetchFn = (async (url: string) => {
      calls.push(url);
      return json({ verses: [{ verse: 16, text: 'For God so loved the world,\n' }, { verse: 17, text: 'For God sent not his Son.\n' }] });
    }) as unknown as typeof fetch;
    const text = await lookupPassage(ref, 'KJV', { fetch: fetchFn });
    expect(text).toBe('For God so loved the world, For God sent not his Son.');
    expect(calls[0]).toContain('bible-api.com/John%203%3A16-17?translation=kjv');
  });

  it('uses bolls for other translations, picks the right verses and strips markup', async () => {
    const fetchFn = (async () =>
      json([
        { verse: 15, text: 'nope' },
        { verse: 16, text: 'For God so loved <i>the</i> world&nbsp;' },
        { verse: 17, text: 'For God did not send his Son' },
        { verse: 18, text: 'nope' },
      ])) as unknown as typeof fetch;
    expect(await lookupPassage(ref, 'ESV', { fetch: fetchFn })).toBe('For God so loved the world For God did not send his Son');
  });

  it('falls back to a second provider for KJV/WEB', async () => {
    let n = 0;
    const fetchFn = (async (url: string) => {
      n++;
      if (String(url).includes('bible-api')) return json({}, 500);
      return json([{ verse: 16, text: 'a' }, { verse: 17, text: 'b' }]);
    }) as unknown as typeof fetch;
    expect(await lookupPassage(ref, 'WEB', { fetch: fetchFn })).toBe('a b');
    expect(n).toBe(2);
  });

  it('reports offline and missing passages distinctly', async () => {
    const offline = (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(lookupPassage(ref, 'ESV', { fetch: offline })).rejects.toMatchObject({ code: 'offline' });
    const missing = (async () => json([{ verse: 16, text: 'x' }])) as unknown as typeof fetch;
    await expect(lookupPassage(ref, 'ESV', { fetch: missing })).rejects.toBeInstanceOf(LookupError);
  });
});

describe('local storage', () => {
  it('saves, reloads, keeps the previous copy and daily snapshots', async () => {
    const s = new Storage();
    const d = newData();
    await s.saveData(d, D0);
    john316(d, at(D0, '07:00'));
    await s.saveData(d, D0);
    const loaded = await s.loadData(at(D0));
    expect(loaded.data).toEqual(d);
    expect((await s.listSnapshots()).map((x) => x.day)).toEqual([D0]);
    const snap = await s.loadSnapshot(`snap:${D0}`);
    expect(Object.keys(snap!.verses)).toHaveLength(0); // snapshot = state before the day's first change
  });

  it('recovers from a corrupt main copy using the previous one', async () => {
    const s = new Storage();
    const d = newData();
    john316(d, at(D0, '07:00'));
    await s.saveData(d, D0);
    const d2 = structuredClone(d);
    john316(d2, at(D0, '08:00'));
    await s.saveData(d2, D0);
    // corrupt the main copy
    await (s as unknown as { backend: { set(k: string, v: string): Promise<void> } }).backend.set('data', '{oops');
    const r = await s.loadData(at(D0));
    expect(r.recoveredFrom).toBe('data.prev');
    expect(Object.keys(r.data.verses)).toHaveLength(1);
  });

  it('keeps only the 7 most recent snapshots and persists settings', async () => {
    const s = new Storage();
    const d = newData();
    await s.saveData(d, '2026-02-01');
    for (let i = 0; i < 10; i++) {
      john316(d, at(D0, '07:00') + i);
      await s.saveData(d, day(i + 30));
    }
    expect((await s.listSnapshots()).length).toBeLessThanOrEqual(7);
    const st = await s.loadSettings();
    st.theme = 'dark';
    await s.saveSettings(st);
    expect((await s.loadSettings()).theme).toBe('dark');
    expect((await s.loadSettings()).deviceId).toBe(st.deviceId);
  });
});
