// Verse lookup through API.Bible (https://scripture.api.bible) for licensed translations such as NIV.
// The API key lives only in the server environment (API_BIBLE_KEY) — never in the app or the repo.
// Shared by the Cloudflare Pages Function and the unit tests.

const BASE = 'https://rest.api.bible';

/** USFM book ids in canonical order (index + 1 = book number used by the app). */
export const USFM = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH',
  'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON',
  'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL',
  'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN',
  'JUD', 'REV',
];

/** Translations served this way: app code -> API.Bible abbreviation and an optional env override for the Bible id. */
const SUPPORTED = { NIV: { abbreviation: 'NIV', idEnv: 'API_BIBLE_NIV_ID' } };

const MAX_VERSES = 40;
const idCache = new Map();

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });

const int = (v) => (/^\d{1,3}$/.test(v ?? '') ? Number(v) : NaN);

async function api(path, env, fetchFn) {
  const res = await fetchFn(`${BASE}${path}`, { headers: { 'api-key': env.API_BIBLE_KEY, accept: 'application/json' } });
  return res;
}

async function findBibleId(cfg, env, fetchFn) {
  const override = env[cfg.idEnv];
  if (override) return override;
  if (idCache.has(cfg.abbreviation)) return idCache.get(cfg.abbreviation);
  const res = await api(`/v1/bibles?abbreviation=${encodeURIComponent(cfg.abbreviation)}`, env, fetchFn);
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error('unauthorized'), { status: 502 });
  if (!res.ok) throw Object.assign(new Error('upstream'), { status: 502 });
  const body = await res.json();
  const list = Array.isArray(body.data) ? body.data : [];
  const hit = list.find((b) => b.abbreviation === cfg.abbreviation) ?? list.find((b) => String(b.abbreviation).startsWith(cfg.abbreviation));
  if (!hit) throw Object.assign(new Error('translation-unavailable'), { status: 404 });
  idCache.set(cfg.abbreviation, hit.id);
  return hit.id;
}

export function clearBibleIdCache() {
  idCache.clear();
}

/**
 * GET /api/verse?translation=NIV&book=43&chapter=3&start=16&end=17
 * @param {Request} request
 * @param {Record<string, string | undefined>} env
 * @param {typeof fetch} [fetchFn]
 */
export async function handleVerse(request, env, fetchFn = fetch) {
  if (request.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);
  if (!env || !env.API_BIBLE_KEY) return json({ error: 'not-configured' }, 501);

  const q = new URL(request.url).searchParams;
  const cfg = SUPPORTED[q.get('translation') ?? ''];
  const book = int(q.get('book'));
  const chapter = int(q.get('chapter'));
  const start = int(q.get('start'));
  const end = q.get('end') === null ? start : int(q.get('end'));
  if (!cfg || !(book >= 1 && book <= 66) || !(chapter >= 1 && chapter <= 150) || !(start >= 1) || !(end >= start) || end - start + 1 > MAX_VERSES)
    return json({ error: 'bad-request' }, 400);

  try {
    const bibleId = await findBibleId(cfg, env, fetchFn);
    const code = USFM[book - 1];
    const passage = start === end ? `${code}.${chapter}.${start}` : `${code}.${chapter}.${start}-${code}.${chapter}.${end}`;
    const qs = 'content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=false&include-verse-spans=false';
    const res = await api(`/v1/bibles/${bibleId}/passages/${passage}?${qs}`, env, fetchFn);
    if (res.status === 404 || res.status === 400) return json({ error: 'not-found' }, 404);
    if (res.status === 401 || res.status === 403) return json({ error: 'unauthorized' }, 502); // key wrong or no access to this Bible
    if (!res.ok) return json({ error: 'upstream' }, 502);
    const body = await res.json();
    const text = String(body?.data?.content ?? '')
      .replace(/¶/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return json({ error: 'not-found' }, 404);
    return json({ text, copyright: body?.data?.copyright ?? '' }, 200, { 'cache-control': 'public, max-age=86400' });
  } catch (e) {
    const status = e && typeof e === 'object' && 'status' in e ? e.status : 502;
    return json({ error: e instanceof Error ? e.message : 'upstream' }, status);
  }
}
