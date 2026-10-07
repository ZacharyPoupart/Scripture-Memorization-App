import { describe, expect, it, beforeEach } from 'vitest';
import { clearBibleIdCache, handleVerse, USFM } from '../../functions/_lib/verse.js';
import { BOOKS } from '../../src/core/books.ts';
import { lookupPassage } from '../../src/services/lookup.ts';

// The function is a thin, key-holding proxy to API.Bible. These tests use a fake API.Bible.

const get = (qs: string) => new Request(`https://app.test/api/verse?${qs}`);
const ENV = { API_BIBLE_KEY: 'test-key-not-real' };

function fakeApiBible(opts: { bibles?: unknown[]; passage?: unknown; status?: number } = {}) {
  const calls: { url: string; key: string | null }[] = [];
  const fetchFn = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, key: new Headers(init?.headers).get('api-key') });
    if (opts.status && url.includes('/passages/')) return new Response('{}', { status: opts.status });
    if (url.includes('/v1/bibles?')) return Response.json({ data: opts.bibles ?? [{ id: 'bible-niv-id', abbreviation: 'NIV' }] });
    return Response.json(opts.passage ?? { data: { content: ' ¶ For God so loved the world,  that he gave his one and only Son.\n', copyright: 'NIV © Biblica' } });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

beforeEach(() => clearBibleIdCache());

describe('/api/verse (API.Bible proxy)', () => {
  it('USFM ids line up with the app’s book table', () => {
    expect(USFM).toHaveLength(66);
    expect(USFM).toEqual(BOOKS.map((b) => b.code));
  });

  it('is "not configured" without a key (the app then falls back to other sources)', async () => {
    const res = await handleVerse(get('translation=NIV&book=43&chapter=3&start=16'), {});
    expect(res.status).toBe(501);
  });

  it('finds the NIV Bible id, fetches the passage with the secret key, returns clean text', async () => {
    const api = fakeApiBible();
    const res = await handleVerse(get('translation=NIV&book=43&chapter=3&start=16'), ENV, api.fetchFn);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: 'For God so loved the world, that he gave his one and only Son.', copyright: 'NIV © Biblica' });
    expect(api.calls.every((c) => c.key === 'test-key-not-real')).toBe(true);
    expect(api.calls[0].url).toContain('https://rest.api.bible/v1/bibles?abbreviation=NIV');
    expect(api.calls[1].url).toContain('/v1/bibles/bible-niv-id/passages/JHN.3.16?');
    expect(api.calls[1].url).toContain('content-type=text');
    expect(api.calls[1].url).toContain('include-verse-numbers=false');
  });

  it('builds range passage ids and remembers the Bible id', async () => {
    const api = fakeApiBible();
    await handleVerse(get('translation=NIV&book=19&chapter=23&start=1&end=3'), ENV, api.fetchFn);
    await handleVerse(get('translation=NIV&book=46&chapter=13&start=4&end=7'), ENV, api.fetchFn);
    expect(api.calls.map((c) => c.url).filter((u) => u.includes('/passages/')).map((u) => u.split('/passages/')[1].split('?')[0])).toEqual(['PSA.23.1-PSA.23.3', '1CO.13.4-1CO.13.7']);
    expect(api.calls.filter((c) => c.url.includes('/v1/bibles?'))).toHaveLength(1); // cached
  });

  it('can be pinned to a specific Bible id', async () => {
    const api = fakeApiBible();
    await handleVerse(get('translation=NIV&book=43&chapter=3&start=16'), { ...ENV, API_BIBLE_NIV_ID: 'my-id' }, api.fetchFn);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0].url).toContain('/bibles/my-id/passages/');
  });

  it('rejects bad or abusive requests before spending any quota', async () => {
    const api = fakeApiBible();
    for (const qs of [
      'translation=ESV&book=43&chapter=3&start=16',
      'translation=NIV&book=0&chapter=3&start=16',
      'translation=NIV&book=67&chapter=3&start=16',
      'translation=NIV&book=43&chapter=3&start=16&end=15',
      'translation=NIV&book=43&chapter=3&start=1&end=200',
      'translation=NIV&book=43&chapter=abc&start=16',
      'translation=NIV&book=../../x&chapter=3&start=16',
    ])
      expect((await handleVerse(get(qs), ENV, api.fetchFn)).status, qs).toBe(400);
    expect((await handleVerse(new Request('https://app.test/api/verse', { method: 'POST' }), ENV, api.fetchFn)).status).toBe(405);
    expect(api.calls).toHaveLength(0);
  });

  it('reports key problems and missing NIV access without leaking details', async () => {
    const noNiv = fakeApiBible({ bibles: [] });
    const res = await handleVerse(get('translation=NIV&book=43&chapter=3&start=16'), ENV, noNiv.fetchFn);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'translation-unavailable' });
    clearBibleIdCache();
    const denied = fakeApiBible({ status: 403 });
    const res2 = await handleVerse(get('translation=NIV&book=43&chapter=3&start=16'), ENV, denied.fetchFn);
    expect(res2.status).toBe(502);
    expect(JSON.stringify(await res2.json())).not.toContain('test-key');
  });

  it('not-found passages return 404', async () => {
    const api = fakeApiBible({ status: 404 });
    expect((await handleVerse(get('translation=NIV&book=43&chapter=3&start=99'), ENV, api.fetchFn)).status).toBe(404);
  });
});

describe('app lookup of NIV', () => {
  const ref = { book: 43, chapter: 3, start: 16, end: 16 };
  it('uses our /api/verse first', async () => {
    const urls: string[] = [];
    const fetchFn = (async (u: string) => {
      urls.push(String(u));
      return Response.json({ text: 'For God so loved the world.' });
    }) as unknown as typeof fetch;
    expect(await lookupPassage(ref, 'NIV', { fetch: fetchFn })).toBe('For God so loved the world.');
    expect(urls).toEqual(['/api/verse?translation=NIV&book=43&chapter=3&start=16&end=16']);
  });

  it('falls back to bolls.life when the server function is not set up (501, 404, or the app page)', async () => {
    for (const first of [new Response('{"error":"not-configured"}', { status: 501, headers: { 'content-type': 'application/json' } }), new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })]) {
      const fetchFn = (async (u: string) => (String(u).startsWith('/api/verse') ? first.clone() : Response.json([{ verse: 16, text: 'From bolls' }]))) as unknown as typeof fetch;
      expect(await lookupPassage(ref, 'NIV', { fetch: fetchFn })).toBe('From bolls');
    }
  });
});
