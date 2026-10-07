import { VERSE_COUNTS } from './versification.ts';

export interface Book {
  /** 1-based canonical index (also the number used by most Bible APIs). */
  n: number;
  name: string;
  /** Short code used in URLs/search. */
  code: string;
  chapters: number;
  aliases: string[];
}

const RAW: [string, string, string[]][] = [
  ['Genesis', 'GEN', ['gen', 'ge', 'gn']],
  ['Exodus', 'EXO', ['exod', 'ex', 'exo']],
  ['Leviticus', 'LEV', ['lev', 'le', 'lv']],
  ['Numbers', 'NUM', ['num', 'nu', 'nm', 'nb']],
  ['Deuteronomy', 'DEU', ['deut', 'dt', 'de']],
  ['Joshua', 'JOS', ['josh', 'jos', 'jsh']],
  ['Judges', 'JDG', ['judg', 'jdg', 'jg']],
  ['Ruth', 'RUT', ['ru', 'rth']],
  ['1 Samuel', '1SA', ['1 sam', '1sam', '1 sa', '1sa', 'i samuel', 'first samuel']],
  ['2 Samuel', '2SA', ['2 sam', '2sam', '2 sa', '2sa', 'ii samuel', 'second samuel']],
  ['1 Kings', '1KI', ['1 kgs', '1kgs', '1 ki', '1ki', 'i kings', 'first kings']],
  ['2 Kings', '2KI', ['2 kgs', '2kgs', '2 ki', '2ki', 'ii kings', 'second kings']],
  ['1 Chronicles', '1CH', ['1 chron', '1 chr', '1chr', '1 ch', 'i chronicles', 'first chronicles']],
  ['2 Chronicles', '2CH', ['2 chron', '2 chr', '2chr', '2 ch', 'ii chronicles', 'second chronicles']],
  ['Ezra', 'EZR', ['ezr']],
  ['Nehemiah', 'NEH', ['neh', 'ne']],
  ['Esther', 'EST', ['esth', 'est']],
  ['Job', 'JOB', ['jb']],
  ['Psalms', 'PSA', ['psalm', 'ps', 'psa', 'pslm', 'psm']],
  ['Proverbs', 'PRO', ['prov', 'pr', 'prv']],
  ['Ecclesiastes', 'ECC', ['eccles', 'eccl', 'ecc', 'ec']],
  ['Song of Solomon', 'SNG', ['song of songs', 'song', 'sos', 'ss', 'canticles']],
  ['Isaiah', 'ISA', ['isa', 'is']],
  ['Jeremiah', 'JER', ['jer', 'je']],
  ['Lamentations', 'LAM', ['lam', 'la']],
  ['Ezekiel', 'EZK', ['ezek', 'eze', 'ezk']],
  ['Daniel', 'DAN', ['dan', 'dn']],
  ['Hosea', 'HOS', ['hos', 'ho']],
  ['Joel', 'JOL', ['joe', 'jl']],
  ['Amos', 'AMO', ['am']],
  ['Obadiah', 'OBA', ['obad', 'ob']],
  ['Jonah', 'JON', ['jnh']],
  ['Micah', 'MIC', ['mic', 'mc']],
  ['Nahum', 'NAM', ['nah', 'na']],
  ['Habakkuk', 'HAB', ['hab', 'hb']],
  ['Zephaniah', 'ZEP', ['zeph', 'zep', 'zp']],
  ['Haggai', 'HAG', ['hag', 'hg']],
  ['Zechariah', 'ZEC', ['zech', 'zec', 'zc']],
  ['Malachi', 'MAL', ['mal', 'ml']],
  ['Matthew', 'MAT', ['matt', 'mt']],
  ['Mark', 'MRK', ['mk', 'mr']],
  ['Luke', 'LUK', ['lk', 'lu']],
  ['John', 'JHN', ['jn', 'joh']],
  ['Acts', 'ACT', ['ac', 'acts of the apostles']],
  ['Romans', 'ROM', ['rom', 'ro', 'rm']],
  ['1 Corinthians', '1CO', ['1 cor', '1cor', '1 co', 'i corinthians', 'first corinthians']],
  ['2 Corinthians', '2CO', ['2 cor', '2cor', '2 co', 'ii corinthians', 'second corinthians']],
  ['Galatians', 'GAL', ['gal', 'ga']],
  ['Ephesians', 'EPH', ['eph', 'ep']],
  ['Philippians', 'PHP', ['phil', 'php', 'pp']],
  ['Colossians', 'COL', ['col', 'co']],
  ['1 Thessalonians', '1TH', ['1 thess', '1thess', '1 th', 'i thessalonians', 'first thessalonians']],
  ['2 Thessalonians', '2TH', ['2 thess', '2thess', '2 th', 'ii thessalonians', 'second thessalonians']],
  ['1 Timothy', '1TI', ['1 tim', '1tim', '1 ti', 'i timothy', 'first timothy']],
  ['2 Timothy', '2TI', ['2 tim', '2tim', '2 ti', 'ii timothy', 'second timothy']],
  ['Titus', 'TIT', ['tit', 'ti']],
  ['Philemon', 'PHM', ['philem', 'phm', 'pm']],
  ['Hebrews', 'HEB', ['heb']],
  ['James', 'JAS', ['jas', 'jm']],
  ['1 Peter', '1PE', ['1 pet', '1pet', '1 pe', 'i peter', 'first peter']],
  ['2 Peter', '2PE', ['2 pet', '2pet', '2 pe', 'ii peter', 'second peter']],
  ['1 John', '1JN', ['1 jn', '1jn', '1 jo', 'i john', 'first john']],
  ['2 John', '2JN', ['2 jn', '2jn', '2 jo', 'ii john', 'second john']],
  ['3 John', '3JN', ['3 jn', '3jn', '3 jo', 'iii john', 'third john']],
  ['Jude', 'JUD', ['jud']],
  ['Revelation', 'REV', ['rev', 're', 'revelations', 'the revelation']],
];

export const BOOKS: Book[] = RAW.map(([name, code, aliases], i) => ({
  n: i + 1,
  name,
  code,
  chapters: VERSE_COUNTS[i].length,
  aliases,
}));

export function bookByNumber(n: number): Book {
  const b = BOOKS[n - 1];
  if (!b) throw new Error(`Unknown book number ${n}`);
  return b;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();

const LOOKUP = new Map<string, number>();
for (const b of BOOKS) {
  LOOKUP.set(norm(b.name), b.n);
  LOOKUP.set(norm(b.code), b.n);
  for (const a of b.aliases) LOOKUP.set(norm(a), b.n);
}
LOOKUP.set('psalms', 19);
LOOKUP.set('song of solomon', 22);

/** Resolve free text ("1 cor", "Psalm", "Revelation") to a book number, or undefined. */
export function findBook(text: string): number | undefined {
  return LOOKUP.get(norm(text));
}

/** Books whose names start with (or whose alias starts with) the typed text. Shows *all* books for empty input. */
export function searchBooks(text: string): Book[] {
  const q = norm(text);
  if (!q) return BOOKS;
  return BOOKS.filter(
    (b) => norm(b.name).startsWith(q) || b.aliases.some((a) => norm(a).startsWith(q)) || norm(b.name).includes(` ${q}`),
  );
}

export function versesInChapter(bookN: number, chapter: number): number | undefined {
  return VERSE_COUNTS[bookN - 1]?.[chapter - 1];
}
