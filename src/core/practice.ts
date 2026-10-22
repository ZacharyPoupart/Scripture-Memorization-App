// How a practice is ordered. Beside the verse itself, a practice can ask for the topic and the citation (the reference),
// before the verse, after it, or both: the Navigators' Topical Memory System says "topic, reference, verse, reference"
// (a sandwich). This is only the order of questions; counting mistakes and the other rules are unchanged.
import type { Verse } from './types.ts';

export type PracticePart = 'topic' | 'citation';

export interface PracticeOrder {
  /** Asked before the verse, in this order. Each at most once. */
  before: PracticePart[];
  /** Asked after the verse. Always citation first, then topic. */
  after: PracticePart[];
}

/** What the app has always done: the citation, then the topic, after the verse. */
export const CLASSIC_ORDER: PracticeOrder = { before: [], after: ['citation', 'topic'] };

export interface PracticePreset {
  id: string;
  label: string;
  hint: string;
  order: PracticeOrder;
}

export const PRESETS: PracticePreset[] = [
  { id: 'classic', label: 'Classic', hint: 'Verse, then citation, then topic', order: CLASSIC_ORDER },
  { id: 'sandwich', label: 'Sandwich', hint: 'Topic, citation, verse, citation (as in the Topical Memory System)', order: { before: ['topic', 'citation'], after: ['citation'] } },
  { id: 'citation-first', label: 'Citation first', hint: 'Citation, then verse', order: { before: ['citation'], after: [] } },
  { id: 'verse-only', label: 'Verse only', hint: 'No questions beyond the verse', order: { before: [], after: [] } },
];

const isPart = (x: unknown): x is PracticePart => x === 'topic' || x === 'citation';

/** Anything saved (or garbage) becomes a valid order: known parts only, each once before, citation then topic after. */
export function normalizeOrder(raw: unknown): PracticeOrder {
  const o = (raw ?? {}) as { before?: unknown; after?: unknown };
  if (!Array.isArray(o.before) || !Array.isArray(o.after)) return { before: [...CLASSIC_ORDER.before], after: [...CLASSIC_ORDER.after] };
  const before: PracticePart[] = [];
  for (const p of o.before) if (isPart(p) && !before.includes(p)) before.push(p);
  const rawAfter: unknown[] = o.after;
  const after: PracticePart[] = (['citation', 'topic'] as const).filter((p) => rawAfter.includes(p));
  return { before, after };
}

/** The order for one verse: a topic is only asked when the verse has one. */
export function planFor(order: unknown, verse: Pick<Verse, 'topic'>): PracticeOrder {
  const o = normalizeOrder(order);
  const keep = (p: PracticePart) => p !== 'topic' || !!verse.topic;
  return { before: o.before.filter(keep), after: o.after.filter(keep) };
}

/** The whole sequence for a preview: ['topic', 'citation', 'verse', 'citation']. */
export function sequenceOf(order: PracticeOrder): Array<PracticePart | 'verse'> {
  return [...order.before, 'verse', ...order.after];
}

export const PART_LABELS: Record<PracticePart | 'verse', string> = { topic: 'Topic', citation: 'Citation', verse: 'Verse' };

/** "Topic → Citation → Verse → Citation" */
export function describeOrder(order: PracticeOrder): string {
  return sequenceOf(order).map((p) => PART_LABELS[p]).join(' → ');
}

/** The preset that matches this order exactly, if any. */
export function presetOf(order: PracticeOrder): PracticePreset | undefined {
  const o = normalizeOrder(order);
  return PRESETS.find((p) => JSON.stringify(p.order) === JSON.stringify(o));
}

/** The first few words, shown as the cue when something is asked before the verse ("For God so loved the world…"). */
export function firstWords(text: string, n = 5): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= n ? words.join(' ') : `${words.slice(0, n).join(' ')}…`;
}
