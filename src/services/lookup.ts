// Verse text lookup. Needs the internet; everything else in the app works offline.
// Several free providers are tried in order. Typing/pasting text always works as a fallback.
import { bookByNumber } from '../core/books.ts';
import type { Ref } from '../core/reference.ts';
import { cleanVerseText } from '../core/text.ts';

export type LookupErrorCode = 'offline' | 'not-found' | 'unavailable';

export class LookupError extends Error {
  constructor(
    public code: LookupErrorCode,
    message: string,
  ) {
    super(message);
  }
}

interface BollsVerse {
  verse: number;
  text: string;
}

const BIBLE_API_CODES: Record<string, string> = { KJV: 'kjv', WEB: 'web' };

async function getJson(fetchFn: typeof fetch, url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { signal: ctrl.signal });
    if (res.status === 404) throw new LookupError('not-found', 'Passage not found.');
    if (!res.ok) throw new LookupError('unavailable', `Lookup service error (${res.status}).`);
    return await res.json();
  } catch (e) {
    if (e instanceof LookupError) throw e;
    throw new LookupError('offline', 'Could not reach the lookup service.');
  } finally {
    clearTimeout(timer);
  }
}

async function fromBolls(ref: Ref, translation: string, fetchFn: typeof fetch, timeoutMs: number): Promise<string> {
  const url = `https://bolls.life/get-text/${encodeURIComponent(translation)}/${ref.book}/${ref.chapter}/`;
  const data = await getJson(fetchFn, url, timeoutMs);
  if (!Array.isArray(data)) throw new LookupError('unavailable', 'Unexpected response.');
  const picked = (data as BollsVerse[])
    .filter((v) => v && typeof v.verse === 'number' && typeof v.text === 'string' && v.verse >= ref.start && v.verse <= ref.end)
    .sort((a, b) => a.verse - b.verse);
  if (picked.length !== ref.end - ref.start + 1) throw new LookupError('not-found', 'Some of those verses were not found in this translation.');
  return picked.map((v) => cleanVerseText(v.text)).join(' ');
}

async function fromBibleApi(ref: Ref, translation: string, fetchFn: typeof fetch, timeoutMs: number): Promise<string> {
  const code = BIBLE_API_CODES[translation];
  if (!code) throw new LookupError('unavailable', 'Translation not offered by this provider.');
  const range = ref.end > ref.start ? `${ref.start}-${ref.end}` : `${ref.start}`;
  const q = encodeURIComponent(`${bookByNumber(ref.book).name} ${ref.chapter}:${range}`);
  const data = (await getJson(fetchFn, `https://bible-api.com/${q}?translation=${code}`, timeoutMs)) as {
    verses?: { verse: number; text: string }[];
    text?: string;
  };
  if (Array.isArray(data.verses) && data.verses.length === ref.end - ref.start + 1)
    return data.verses.map((v) => cleanVerseText(v.text)).join(' ');
  throw new LookupError('not-found', 'Passage not found.');
}

export async function lookupPassage(
  ref: Ref,
  translation: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<string> {
  const fetchFn = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const providers = BIBLE_API_CODES[translation]
    ? [() => fromBibleApi(ref, translation, fetchFn, timeoutMs), () => fromBolls(ref, translation, fetchFn, timeoutMs)]
    : [() => fromBolls(ref, translation, fetchFn, timeoutMs)];
  let last: LookupError | null = null;
  for (const run of providers) {
    try {
      const text = await run();
      if (text) return text;
    } catch (e) {
      last = e instanceof LookupError ? e : new LookupError('unavailable', 'Lookup failed.');
      if (last.code === 'offline' && typeof navigator !== 'undefined' && navigator.onLine === false) break;
    }
  }
  throw last ?? new LookupError('unavailable', 'Lookup failed.');
}
