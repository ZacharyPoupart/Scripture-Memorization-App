import { bookByNumber, findBook, versesInChapter } from './books.ts';

/** A passage inside one chapter: a single verse (end === start) or a range. */
export interface Ref {
  book: number;
  chapter: number;
  start: number;
  end: number;
}

export function formatRef(r: Ref): string {
  const name = bookByNumber(r.book).name;
  const v = r.end > r.start ? `${r.start}-${r.end}` : `${r.start}`;
  return `${name} ${r.chapter}:${v}`;
}

export function refsEqual(a: Ref, b: Ref): boolean {
  return a.book === b.book && a.chapter === b.chapter && a.start === b.start && a.end === b.end;
}

export interface RefProblem {
  field: 'book' | 'chapter' | 'start' | 'end';
  message: string;
}

/** Hard errors only. Verse numbers beyond the KJV count are allowed (translations differ) — see refWarning. */
export function validateRef(r: Ref): RefProblem | null {
  if (!Number.isInteger(r.book) || r.book < 1 || r.book > 66) return { field: 'book', message: 'Choose a book.' };
  const book = bookByNumber(r.book);
  if (!Number.isInteger(r.chapter) || r.chapter < 1 || r.chapter > book.chapters)
    return { field: 'chapter', message: `${book.name} has ${book.chapters} chapter${book.chapters === 1 ? '' : 's'}.` };
  if (!Number.isInteger(r.start) || r.start < 1 || r.start > 176) return { field: 'start', message: 'Enter a verse number.' };
  if (!Number.isInteger(r.end) || r.end < r.start || r.end > 176)
    return { field: 'end', message: 'The last verse must be the same as or after the first.' };
  return null;
}

export function refWarning(r: Ref): string | null {
  const max = versesInChapter(r.book, r.chapter);
  if (max !== undefined && r.end > max)
    return `${bookByNumber(r.book).name} ${r.chapter} has ${max} verses in most Bibles.`;
  return null;
}

/** Parse "John 3:16", "1 Cor 13:4-7", "Ps 23:1–3". Returns null if it can't be understood. */
export function parseRef(text: string): Ref | null {
  const m = text.trim().match(/^(.+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const start = Number(m[3]);
  const end = m[4] ? Number(m[4]) : start;
  const ref = { book, chapter: Number(m[2]), start, end };
  return validateRef(ref) ? null : ref;
}

export function bibleGatewayUrl(r: Ref, translation: string): string {
  const q = encodeURIComponent(`${bookByNumber(r.book).name} ${r.chapter}`);
  return `https://www.biblegateway.com/passage/?search=${q}&version=${encodeURIComponent(translation)}`;
}
