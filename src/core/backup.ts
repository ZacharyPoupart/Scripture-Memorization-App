// Export / import. A backup is a single JSON file; import validates everything before touching data.
import { validateRef } from './reference.ts';
import { TRANSLATIONS, DEFAULT_PREFS, PILES, type AppData, type LedgerDay, type LevelUp, type Pile, type Verse } from './types.ts';

export const BACKUP_APP = 'memorize-for-life';
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  appVersion: string;
  exportedAt: string;
  data: AppData;
}

export function exportBackup(data: AppData, appVersion: string, now: number): string {
  const file: BackupFile = {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    appVersion,
    exportedAt: new Date(now).toISOString(),
    data,
  };
  return JSON.stringify(file, null, 2);
}

export class BackupError extends Error {}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown): x is string => typeof x === 'string';

function fail(msg: string): never {
  throw new BackupError(msg);
}

function cleanVerse(id: string, raw: unknown): Verse {
  if (!isObj(raw)) fail(`Verse ${id} is not an object.`);
  const r = raw;
  const label = `verse ${id}`;
  if (!isStr(r.id) || r.id !== id) fail(`Corrupt ${label}: bad id.`);
  for (const k of ['book', 'chapter', 'start', 'end', 'contentAt', 'pileAt', 'createdAt'] as const)
    if (!isNum(r[k])) fail(`Corrupt ${label}: ${k} is missing.`);
  const problem = validateRef({ book: r.book as number, chapter: r.chapter as number, start: r.start as number, end: r.end as number });
  if (problem) fail(`Corrupt ${label}: ${problem.message}`);
  if (!isStr(r.text) || !r.text.trim()) fail(`Corrupt ${label}: no text.`);
  if (!isStr(r.pile) || !PILES.includes(r.pile as Pile)) fail(`Corrupt ${label}: bad pile.`);
  if (!isStr(r.pileSince) || !DAY.test(r.pileSince)) fail(`Corrupt ${label}: bad pile date.`);
  if (!isStr(r.addedDay) || !DAY.test(r.addedDay)) fail(`Corrupt ${label}: bad added date.`);
  const reviews = Array.isArray(r.reviews) ? r.reviews.filter(isNum).sort((a, b) => a - b) : [];
  const v: Verse = {
    id,
    book: r.book as number,
    chapter: r.chapter as number,
    start: r.start as number,
    end: r.end as number,
    translation: isStr(r.translation) && r.translation ? r.translation : TRANSLATIONS[0],
    text: r.text,
    topic: isStr(r.topic) ? r.topic : '',
    contentAt: r.contentAt as number,
    pile: r.pile as Pile,
    pileSince: r.pileSince,
    pileAt: r.pileAt as number,
    addedDay: r.addedDay,
    createdAt: r.createdAt as number,
    reviews: [...new Set(reviews)],
  };
  if (isNum(r.deletedAt)) v.deletedAt = r.deletedAt;
  return v;
}

/** Validate + normalize untrusted data (from a file, the sync server, or storage). Throws BackupError. */
export function normalizeData(raw: unknown): AppData {
  if (!isObj(raw)) fail('Data is not an object.');
  if (raw.schema !== 1) fail('This backup was made by a newer or unknown version of the app.');
  if (!isStr(raw.createdDay) || !DAY.test(raw.createdDay)) fail('Missing start date.');
  if (!isObj(raw.verses)) fail('Missing verses.');
  const verses: Record<string, Verse> = {};
  for (const [id, v] of Object.entries(raw.verses)) {
    // `verses.__proto__ = …` would replace the object's prototype instead of adding a verse
    if (id === '__proto__') fail('Corrupt data: a verse has a reserved id.');
    verses[id] = cleanVerse(id, v);
  }

  const ledger: Record<string, LedgerDay> = {};
  if (isObj(raw.ledger)) {
    for (const [day, e] of Object.entries(raw.ledger)) {
      if (!DAY.test(day) || !isObj(e)) continue;
      const entry: LedgerDay = {};
      if (e.r === 1) entry.r = 1;
      if (e.p === 1) entry.p = 1;
      if (e.o === 'c' || e.o === 'm' || e.o === 'n') entry.o = e.o;
      ledger[day] = entry;
    }
  }

  const levelUps: LevelUp[] = [];
  if (Array.isArray(raw.levelUps)) {
    for (const l of raw.levelUps) {
      if (isObj(l) && isStr(l.id) && isStr(l.verseId) && PILES.includes(l.from as Pile) && PILES.includes(l.to as Pile) && isStr(l.day) && DAY.test(l.day))
        levelUps.push({ id: l.id, verseId: l.verseId, from: l.from as Pile, to: l.to as Pile, day: l.day });
    }
  }

  const reviewsByDevice: Record<string, number> = {};
  if (isObj(raw.reviewsByDevice))
    for (const [k, n] of Object.entries(raw.reviewsByDevice)) if (k !== '__proto__' && isNum(n) && n >= 0) reviewsByDevice[k] = n;

  let prefs = { value: { ...DEFAULT_PREFS }, at: 0 };
  if (isObj(raw.prefs) && isObj(raw.prefs.value) && isNum(raw.prefs.at)) {
    const pv = raw.prefs.value;
    prefs = {
      at: raw.prefs.at,
      value: {
        defaultTranslation: isStr(pv.defaultTranslation) && pv.defaultTranslation ? pv.defaultTranslation : DEFAULT_PREFS.defaultTranslation,
        spacingHours: isNum(pv.spacingHours) && pv.spacingHours >= 0 && pv.spacingHours <= 12 ? pv.spacingHours : DEFAULT_PREFS.spacingHours,
      },
    };
  }

  let pause: AppData['pause'];
  if (isObj(raw.pause) && isStr(raw.pause.from) && DAY.test(raw.pause.from) && isStr(raw.pause.until) && DAY.test(raw.pause.until) && isNum(raw.pause.at))
    pause = { from: raw.pause.from, until: raw.pause.until, at: raw.pause.at };

  const out: AppData = {
    schema: 1,
    createdDay: raw.createdDay,
    verses,
    ledger,
    settledThrough: isStr(raw.settledThrough) && DAY.test(raw.settledThrough) ? raw.settledThrough : raw.createdDay,
    levelUps,
    longestStreak: isNum(raw.longestStreak) && raw.longestStreak >= 0 ? Math.floor(raw.longestStreak) : 0,
    reviewsByDevice,
    prefs,
  };
  if (pause) out.pause = pause;
  return out;
}

/** Parse the text of a backup file. */
export function parseBackup(text: string): AppData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail('That file is not a valid backup (it could not be read as JSON).');
  }
  if (!isObj(parsed) || parsed.app !== BACKUP_APP) fail('That file is not a Memorize For Life backup.');
  if (!isNum(parsed.format) || parsed.format > BACKUP_FORMAT) fail('This backup was made by a newer version of the app. Update the app and try again.');
  return normalizeData(parsed.data);
}
