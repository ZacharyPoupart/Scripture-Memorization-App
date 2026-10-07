// Searching, filtering, sorting and topic management for the verse lists. Presentation-only helpers:
// none of this changes how verses are scheduled (within a pile the default stays "longest in pile first").
import { bookByNumber } from './books.ts';
import { formatRef, parseRef } from './reference.ts';
import { verseStatus } from './schedule.ts';
import type { AppData, Verse } from './types.ts';

export type SortKey = 'longest' | 'reference' | 'added' | 'due';

export const SORT_LABELS: Record<SortKey, string> = {
  longest: 'Longest in pile first',
  reference: 'Bible order',
  added: 'Newest added',
  due: 'Due soonest',
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s:]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Everything searchable about a verse, normalized once. */
function haystack(v: Verse): string {
  return norm(`${formatRef(v)} ${bookByNumber(v.book).name} ${v.translation} ${v.topic} ${v.text}`);
}

/**
 * A query matches when every word appears somewhere (reference, translation, topic or text), or when it
 * is itself a reference ("jn 3:16", "1 cor 13") that covers this verse.
 */
export function matchesQuery(v: Verse, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const asRef = parseRef(query.trim());
  if (asRef && asRef.book === v.book && asRef.chapter === v.chapter && asRef.start <= v.end && asRef.end >= v.start) return true;
  const hay = haystack(v);
  return q.split(' ').every((w) => hay.includes(w));
}

export interface Filter {
  query?: string;
  topic?: string;
  readyOnly?: boolean;
}

export function filterVerses(vs: Verse[], f: Filter, data: AppData, now: number): Verse[] {
  return vs.filter(
    (v) =>
      (!f.query || matchesQuery(v, f.query)) &&
      (!f.topic || v.topic === f.topic) &&
      (!f.readyOnly || verseStatus(data, v, now).state === 'ready'),
  );
}

const byReference = (a: Verse, b: Verse) => a.book - b.book || a.chapter - b.chapter || a.start - b.start || a.end - b.end;

function dueRank(data: AppData, v: Verse, now: number): number {
  const s = verseStatus(data, v, now);
  if (s.state === 'ready') return 0 - (s.daysUntilDue ?? 0) / 1000; // overdue first
  if (s.state === 'waiting') return 1 + (s.waitMs ?? 0) / 1e9;
  if (s.state === 'notdue') return 2 + (s.daysUntilDue ?? 0);
  return 1e6; // done for today
}

/** Sort a copy. `longest` keeps the input order (the app's rule: longest in pile first). */
export function sortVerses(vs: Verse[], key: SortKey, data: AppData, now: number): Verse[] {
  const out = vs.slice();
  switch (key) {
    case 'reference':
      return out.sort((a, b) => byReference(a, b) || a.id.localeCompare(b.id));
    case 'added':
      return out.sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
    case 'due':
      return out.sort((a, b) => dueRank(data, a, now) - dueRank(data, b, now) || byReference(a, b));
    default:
      return out;
  }
}

export function topicsOf(data: AppData): string[] {
  return [...new Set(Object.values(data.verses).filter((v) => !v.deletedAt && v.topic).map((v) => v.topic))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export interface TopicChange {
  id: string;
  topic: string;
  contentAt: number;
}

/**
 * Rename a topic on every verse that has it (merging into an existing topic if `to` already exists;
 * `to === ''` removes the label). Returns what to put back for an undo. Uses the normal edit timestamp so it
 * syncs like any other edit.
 */
export function renameTopic(data: AppData, from: string, to: string, now: number): TopicChange[] {
  const target = to.trim();
  const before: TopicChange[] = [];
  for (const v of Object.values(data.verses)) {
    if (v.deletedAt || v.topic !== from) continue;
    before.push({ id: v.id, topic: v.topic, contentAt: v.contentAt });
    v.topic = target;
    v.contentAt = now;
  }
  return before;
}

export function restoreTopics(data: AppData, before: TopicChange[], now: number): void {
  for (const b of before) {
    const v = data.verses[b.id];
    if (!v) continue;
    v.topic = b.topic;
    v.contentAt = Math.max(now, v.contentAt + 1); // a newer write, so it wins when synced
  }
}
