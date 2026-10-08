import { expect, type Page } from '@playwright/test';
import { BOOKS } from '../../src/core/books.ts';

export const JOHN_TEXT =
  'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.';
export const PS23 = 'The LORD is my shepherd; I shall not want.';
export const ROM8 = 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.';

export interface VerseInput {
  book: number;
  chapter: number;
  start: number;
  end?: number;
  text: string;
  topic?: string;
  translation?: string;
}

export const JOHN316: VerseInput = { book: 43, chapter: 3, start: 16, text: JOHN_TEXT };
export const PSALM23_1: VerseInput = { book: 19, chapter: 23, start: 1, text: PS23 };
export const ROMANS8_28: VerseInput = { book: 45, chapter: 8, start: 28, text: ROM8 };

export const BOOK_NAMES: Record<number, string> = { 19: 'Psalms', 43: 'John', 45: 'Romans', 46: '1 Corinthians' };

/** Open the app fresh and dismiss the first-run walkthrough. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  const skip = page.getByTestId('onboarding-skip');
  await skip.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await skip.isVisible()) await skip.click();
  await expect(page.getByTestId('onboarding')).toBeHidden();
}

/** Stop any real network lookups; offline-style typing is what these tests exercise. */
export async function blockLookups(page: Page) {
  await page.route(/bolls\.life|bible-api\.com/, (r) => r.abort());
}

const exact = (n: string | number) => new RegExp(`^${n}$`);

/** Pick a number in whichever number grid (chapter / verse / to) is currently open. */
export async function tapNumber(page: Page, n: number) {
  await page.getByTestId('num-option').filter({ hasText: exact(n) }).click();
}

/** Use the cascading picker: Book → Chapter → Verse open one after another. In the verse grid, a second tap makes a range. */
export async function pickRef(page: Page, v: { book: number; chapter: number; start: number; end?: number }) {
  await page.getByTestId('pick-book').click();
  await page.getByTestId('book-option').filter({ hasText: exact(BOOKS[v.book - 1].name) }).click();
  await tapNumber(page, v.chapter); // the chapter grid opened by itself
  await tapNumber(page, v.start); // ...and then the verse grid
  if (v.end) await tapNumber(page, v.end); // second tap = range, and the grid closes
  else await page.getByTestId('pick-done').click();
  await expect(page.getByTestId('verse-picker').getByRole('dialog')).toHaveCount(0);
}

/** Reopen the verse box and choose a single verse. */
export async function pickVerse(page: Page, n: number) {
  await page.getByTestId('pick-verse').click();
  await tapNumber(page, n);
  await page.getByTestId('pick-done').click();
}

/** Reopen the verse box and choose a range (first tap, last tap). */
export async function pickRange(page: Page, start: number, end: number) {
  await page.getByTestId('pick-verse').click();
  await tapNumber(page, start);
  await tapNumber(page, end);
}

export async function addVerse(page: Page, v: VerseInput) {
  await page.goto('/#/add');
  if (v.translation) await page.getByTestId('translation').selectOption(v.translation);
  await pickRef(page, v);
  await page.getByTestId('text').fill(v.text);
  if (v.topic) await page.getByTestId('topic').fill(v.topic);
  await page.getByTestId('save-verse').click();
  await expect(page.getByTestId('toast')).toContainText('Added');
}

export async function chooseBook(page: Page, name: string) {
  await page.getByTestId('ref-book').click();
  await page.getByTestId('book-search').fill(name);
  await page.getByTestId('book-option').filter({ hasText: new RegExp(`^${name}$`) }).click();
}

export async function answerReference(page: Page, v: VerseInput) {
  await expect(page.getByTestId('ref-verse-text')).toBeVisible();
  await chooseBook(page, BOOK_NAMES[v.book]);
  await page.getByTestId('ref-chapter').fill(String(v.chapter));
  await page.getByTestId('ref-start').fill(String(v.start));
  if (v.end) await page.getByTestId('ref-end').fill(String(v.end));
  await page.getByTestId('ref-check').click();
}

/** Finishes the reference step and lands on the "result" card. */
export async function finishWithReference(page: Page, v: VerseInput) {
  await answerReference(page, v);
  await expect(page.getByTestId('verse-result')).toBeVisible();
}

export function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

export const firstLetters = (text: string) => wordsOf(text).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')[0]).join('');

/** Fake the experimental Web Speech API so "Speak it" can be driven in tests. */
export async function installFakeSpeech(page: Page, transcript: string) {
  await page.addInitScript((t) => {
    class FakeRecognition {
      continuous = false;
      interimResults = false;
      lang = '';
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        setTimeout(() => {
          const words = t.split(' ');
          const mid = Math.ceil(words.length / 2);
          const mk = (text: string, isFinal: boolean) => ({ 0: { transcript: text }, isFinal, length: 1 });
          this.onresult?.({ resultIndex: 0, results: [mk(words.slice(0, mid).join(' '), true)] });
          setTimeout(() => this.onresult?.({ resultIndex: 1, results: [mk(words.slice(0, mid).join(' '), true), mk(words.slice(mid).join(' '), true)] }), 50);
        }, 50);
      }
      stop() {
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {}
    }
    (window as any).SpeechRecognition = FakeRecognition;
  }, transcript);
}

/** Wait until everything the app has done so far is safely on disk (what a real pause between taps does). */
export async function saved(page: Page) {
  await page.evaluate(() => (window as any).__mfl.flush());
}

/** Replace the app's data with `data` through the real Settings → Import screen (the way a restore works). */
export async function replaceDataWith(page: Page, data: unknown) {
  const file = JSON.stringify({ app: 'memorize-for-life', format: 1, appVersion: '1.0.0', exportedAt: new Date().toISOString(), data });
  await page.goto('/#/settings');
  await page.getByTestId('import-file').setInputFiles({ name: 'restore.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.getByTestId('import-replace').click();
}

/** Local calendar day key; `d` may overflow (e.g. 10 - 90) and is normalized by Date. */
export const localDay = (y: number, m0: number, d: number) => {
  const t = new Date(y, m0, d);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};
