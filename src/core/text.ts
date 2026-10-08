// Turning verse text into words for the review modes.

export interface Word {
  index: number;
  /** As displayed, including attached punctuation: "world," */
  raw: string;
  /** Lower-case letters/digits only: "world" */
  key: string;
  /** First letter/digit, lower-case: "w" */
  first: string;
}

const strip = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

export const normalizeWord = strip;

/** Split on whitespace; pieces with no letters/digits (a lone dash, quote…) attach to the previous word. */
export function tokenize(text: string): Word[] {
  const words: Word[] = [];
  for (const part of text.trim().split(/\s+/)) {
    if (!part) continue;
    const key = strip(part);
    if (!key) {
      if (words.length) words[words.length - 1].raw += ' ' + part;
      continue;
    }
    words.push({ index: words.length, raw: part, key, first: key[0] });
  }
  return words;
}

/** Does the typed character match the first letter of the word? (ignores case/accents/punctuation) */
export function matchesFirstLetter(word: Word, typed: string): boolean {
  const t = strip(typed);
  return t.length > 0 && t[0] === word.first;
}

/** Clean text from a lookup API: strip tags, entities, verse numbers/footnote markers, extra spaces. */
export function cleanVerseText(input: string): string {
  return input
    .replace(/<S>.*?<\/S>/gi, '') // Strong's numbers
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#8217;/g, '’')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type RevealStep = 'word' | 'phrase';

/**
 * How a verse is uncovered by tapping: one word at a time, or by phrase (a group ends after
 * punctuation such as , ; : . ? ! or after 6 words). Returns the word count of each group.
 */
export function revealGroups(words: Word[], step: RevealStep): number[] {
  if (step === 'word') return words.map(() => 1);
  const groups: number[] = [];
  let n = 0;
  for (const w of words) {
    n++;
    if (/[,;:.!?…—–)”"'’]$/.test(w.raw.trim()) || n >= 6) {
      groups.push(n);
      n = 0;
    }
  }
  if (n) groups.push(n);
  return groups;
}
