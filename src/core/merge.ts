// Merging two copies of the data (two devices, or an import into existing data).
// merge(a, b) is commutative, associative and idempotent, so devices converge no matter
// how often or in which order they sync. Nothing is ever dropped:
//   * verses: union by id; content and pile each use last-writer-wins on their own timestamp
//     (ties broken deterministically); review timestamps are unioned; deletion wins.
//   * ledger: per day, reviewed = OR, outcome precedence c > m > n.
//   * counters (longest streak, reviews per device): max.
import { mergeLedgerDay } from './schedule.ts';
import type { AppData, LedgerDay, LevelUp, Verse } from './types.ts';

function pickLater<T extends { toString(): string }>(aAt: number, bAt: number, a: T, b: T, tie: (a: T, b: T) => T): T {
  if (aAt > bAt) return a;
  if (bAt > aAt) return b;
  return tie(a, b);
}

const jsonTie = <T>(a: T, b: T): T => (JSON.stringify(a) >= JSON.stringify(b) ? a : b);

export function mergeVerse(a: Verse, b: Verse): Verse {
  const content = pickLater(
    a.contentAt,
    b.contentAt,
    a,
    b,
    (x, y) => (JSON.stringify([x.book, x.chapter, x.start, x.end, x.translation, x.text, x.topic]) >=
      JSON.stringify([y.book, y.chapter, y.start, y.end, y.translation, y.text, y.topic])
      ? x
      : y),
  );
  const pile = pickLater(a.pileAt, b.pileAt, a, b, (x, y) =>
    JSON.stringify([x.pile, x.pileSince]) >= JSON.stringify([y.pile, y.pileSince]) ? x : y,
  );
  const reviews = [...new Set([...a.reviews, ...b.reviews])].sort((x, y) => x - y);
  const deletedAt =
    a.deletedAt !== undefined && b.deletedAt !== undefined
      ? Math.max(a.deletedAt, b.deletedAt)
      : (a.deletedAt ?? b.deletedAt);
  const older = a.createdAt <= b.createdAt ? a : b;
  const merged: Verse = {
    id: a.id,
    book: content.book,
    chapter: content.chapter,
    start: content.start,
    end: content.end,
    translation: content.translation,
    text: content.text,
    topic: content.topic,
    contentAt: Math.max(a.contentAt, b.contentAt),
    pile: pile.pile,
    pileSince: pile.pileSince,
    pileAt: Math.max(a.pileAt, b.pileAt),
    addedDay: a.addedDay <= b.addedDay ? a.addedDay : b.addedDay,
    createdAt: older.createdAt,
    reviews,
  };
  if (deletedAt !== undefined) merged.deletedAt = deletedAt;
  return merged;
}

export function mergeData(a: AppData, b: AppData): AppData {
  const verses: Record<string, Verse> = {};
  for (const id of new Set([...Object.keys(a.verses), ...Object.keys(b.verses)])) {
    const va = a.verses[id];
    const vb = b.verses[id];
    verses[id] = va && vb ? mergeVerse(va, vb) : structuredClone((va ?? vb) as Verse);
  }

  const ledger: Record<string, LedgerDay> = {};
  for (const day of new Set([...Object.keys(a.ledger), ...Object.keys(b.ledger)])) {
    ledger[day] = mergeLedgerDay(a.ledger[day], b.ledger[day]);
  }

  const levelUps = new Map<string, LevelUp>();
  for (const lu of [...a.levelUps, ...b.levelUps]) if (!levelUps.has(lu.id)) levelUps.set(lu.id, lu);

  const reviewsByDevice: Record<string, number> = { ...a.reviewsByDevice };
  for (const [k, n] of Object.entries(b.reviewsByDevice)) reviewsByDevice[k] = Math.max(reviewsByDevice[k] ?? 0, n);

  const prefs = pickLater(a.prefs.at, b.prefs.at, a.prefs, b.prefs, jsonTie);

  const pause = a.pause && b.pause ? pickLater(a.pause.at, b.pause.at, a.pause, b.pause, jsonTie) : (a.pause ?? b.pause);

  const merged: AppData = {
    schema: 1,
    createdDay: a.createdDay <= b.createdDay ? a.createdDay : b.createdDay,
    verses,
    ledger,
    settledThrough: a.settledThrough >= b.settledThrough ? a.settledThrough : b.settledThrough,
    levelUps: [...levelUps.values()].sort((x, y) => x.id.localeCompare(y.id)),
    longestStreak: Math.max(a.longestStreak, b.longestStreak),
    reviewsByDevice,
    prefs: { value: { ...prefs.value }, at: Math.max(a.prefs.at, b.prefs.at) },
  };
  if (pause) merged.pause = { ...pause };
  return merged;
}
