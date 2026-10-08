import { expect, test, type Page } from '@playwright/test';
import {
  addVerse,
  answerReference,
  blockLookups,
  finishWithReference,
  firstLetters,
  installFakeSpeech,
  JOHN316,
  JOHN_TEXT,
  openApp,
  PSALM23_1,
  ROMANS8_28,
  wordsOf,
  chooseBook,
} from './helpers';

async function startVerseReview(page: Page, mode: string, v = JOHN316) {
  await page.getByTestId('verse-card').filter({ hasText: v === JOHN316 ? 'John 3:16' : 'Psalms' }).first().click();
  await page.getByTestId(`review-${mode}`).click();
  await expect(page.getByTestId('review')).toHaveAttribute('data-mode', mode);
}

/** Fill every blank by reading which word is missing from the visible text. */
async function completeBlanks(page: Page, text: string) {
  const words = wordsOf(text);
  for (let guard = 0; guard < 60; guard++) {
    const cur = page.getByTestId('current-blank');
    if (!(await cur.count())) break;
    const idx = await cur.evaluate((el) => {
      const p = el.closest('p')!;
      return [...p.children].findIndex((c) => c.contains(el));
    });
    const answer = words[idx].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    await page.getByTestId('option').getByText(answer, { exact: true }).click();
  }
}

test.describe('review modes', () => {
  test.beforeEach(async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
  });

  test('flashcard: reference first, flip, grade, then recall the reference', async ({ page }) => {
    await startVerseReview(page, 'flashcard');
    await expect(page.getByTestId('review')).toContainText('John 3:16');
    await expect(page.getByTestId('card-front')).toBeVisible();
    await expect(page.locator('.reveal-text .rw.on')).toHaveCount(0); // covered until tapped
    await page.getByTestId('flip').click(); // "Show all"
    await expect(page.getByTestId('card-back')).toContainText('For God so loved the world');
    await page.getByTestId('grade-good').click();
    // reference recall: the reference must NOT be visible anywhere on this screen
    await expect(page.getByTestId('ref-verse-text')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('John 3:16');
    await finishWithReference(page, JOHN316);
    await expect(page.getByTestId('verse-result')).toContainText('Review counted');
    await expect(page.getByTestId('session-summary')).toBeVisible({ timeout: 5000 });
  });

  test('flashcard: "Missed it" restarts the same verse in the same mode', async ({ page }) => {
    await startVerseReview(page, 'flashcard');
    await page.getByTestId('flip').click();
    await page.getByTestId('grade-missed').click();
    await expect(page.getByTestId('card-front')).toBeVisible();
    await expect(page.getByTestId('toast')).toContainText('try that verse again');
  });

  test('fill in the blank: wrong picks are mistakes (3 allowed on Daily), then complete', async ({ page }) => {
    await startVerseReview(page, 'blanks');
    await expect(page.getByTestId('current-blank')).toBeVisible();
    // one wrong pick: allowed, option greys out, blank stays
    const words = wordsOf(JOHN_TEXT);
    const cur = page.getByTestId('current-blank');
    const idx = await cur.evaluate((el) => [...el.closest('p')!.children].findIndex((c) => c.contains(el)));
    const answer = words[idx].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const options = page.getByTestId('option');
    const wrong = options.filter({ hasNotText: new RegExp(`^${answer}$`) }).first();
    await wrong.click();
    await expect(wrong).toBeDisabled();
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
    await completeBlanks(page, JOHN_TEXT);
    await expect(page.getByTestId('ref-verse-text')).toBeVisible({ timeout: 5000 });
    await finishWithReference(page, JOHN316);
  });

  test('fill in the blank: a fourth mistake restarts the verse', async ({ page }) => {
    await startVerseReview(page, 'blanks');
    const cur = page.getByTestId('current-blank');
    const words = wordsOf(JOHN_TEXT);
    const idx = await cur.evaluate((el) => [...el.closest('p')!.children].findIndex((c) => c.contains(el)));
    const answer = words[idx].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    const wrongs = page.getByTestId('option').filter({ hasNotText: new RegExp(`^${answer}$`) });
    const n = await wrongs.count();
    expect(n).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i++) await wrongs.nth(i).click(); // 3 slips are fine
    await expect(page.getByTestId('toast')).toBeHidden();
    // medium difficulty has 4 options -> only 3 wrong ones exist; a 4th mistake needs a new blank
    await page.getByTestId('option').getByText(answer, { exact: true }).click();
    const idx2 = await page.getByTestId('current-blank').evaluate((el) => [...el.closest('p')!.children].findIndex((c) => c.contains(el)));
    const ans2 = words[idx2].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    await page.getByTestId('option').filter({ hasNotText: new RegExp(`^${ans2}$`) }).first().click();
    await expect(page.getByTestId('toast')).toContainText('try that verse again');
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(0); // fresh attempt
  });

  test('type it out: first letters reveal words; wrong letters are mistakes', async ({ page }) => {
    await startVerseReview(page, 'type');
    const input = page.getByTestId('type-input');
    await input.focus();
    await page.keyboard.type('x'); // wrong
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
    await expect(page.getByTestId('revealed')).toHaveCount(0);
    const letters = firstLetters(JOHN_TEXT);
    await page.keyboard.type(letters.slice(0, 4));
    await expect(page.getByTestId('revealed')).toHaveCount(4);
    await page.keyboard.type(letters.slice(4));
    await expect(page.getByTestId('revealed')).toHaveCount(wordsOf(JOHN_TEXT).length);
    await expect(page.getByTestId('ref-verse-text')).toBeVisible({ timeout: 5000 });
    await finishWithReference(page, JOHN316);
  });

  test('type it out: too many mistakes restarts; Reveal counts as a mistake', async ({ page }) => {
    await startVerseReview(page, 'type');
    await page.getByTestId('type-input').focus();
    await page.keyboard.type('qqq'); // 3 slips allowed on Daily
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(3);
    await page.keyboard.type('q'); // 4th
    await expect(page.getByTestId('toast')).toContainText('try that verse again');
    await expect(page.getByTestId('revealed')).toHaveCount(0);
    await page.getByTestId('reveal').click();
    await expect(page.getByTestId('revealed')).toHaveCount(1);
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
  });

  test('type it out: established verses must be perfect (first mistake restarts)', async ({ page }) => {
    await page.getByTestId('verse-card').click();
    await page.getByTestId('move').click();
    await page.getByTestId('move-weekly').click();
    await page.getByTestId('review-type').click();
    await page.getByTestId('type-input').focus();
    await expect(page.getByTestId('review').getByText('no mistakes allowed')).toBeVisible();
    await page.keyboard.type(firstLetters(JOHN_TEXT).slice(0, 3));
    await page.keyboard.type('q');
    await expect(page.getByTestId('toast')).toContainText('try that verse again');
    await expect(page.getByTestId('revealed')).toHaveCount(0);
  });

  test('speak it: word-by-word feedback, then continue', async ({ page }) => {
    await installFakeSpeech(page, JOHN_TEXT.replace(/[,.]/g, '').toLowerCase());
    await page.goto('/#/pile/daily');
    await page.reload(); // so the init script is in place
    await startVerseReview(page, 'speak');
    await page.getByTestId('speak-start').click();
    await expect(page.getByTestId('speak-done')).toBeVisible();
    await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible();
    await page.getByTestId('speak-done').click();
    await expect(page.getByTestId('speak-result')).toContainText('Perfect');
    await page.getByTestId('speak-continue').click();
    await finishWithReference(page, JOHN316);
  });

  test('speak it: says so when speech recognition is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
    });
    await page.goto('/#/pile/daily');
    await page.reload();
    await startVerseReview(page, 'speak');
    await expect(page.getByTestId('speak-unsupported')).toBeVisible();
    await page.getByRole('button', { name: /Type it out/ }).click();
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'type');
  });

  test('reference recall: wrong answers are mistakes, no hints, "I don\'t remember" reveals and restarts', async ({ page }) => {
    await startVerseReview(page, 'flashcard');
    await page.getByTestId('flip').click();
    await page.getByTestId('grade-good').click();
    // the book list shows every book (no narrowing hints)
    await page.getByTestId('ref-book').click();
    await expect(page.getByTestId('book-option')).toHaveCount(66);
    await page.getByTestId('book-search').fill('Psalms');
    await page.getByTestId('book-option').first().click();
    await page.getByTestId('ref-chapter').fill('23');
    await page.getByTestId('ref-start').fill('1');
    await page.getByTestId('ref-check').click();
    await expect(page.getByTestId('ref-message')).toBeVisible();
    await expect(page.getByTestId('ref-message')).not.toContainText('John'); // no hint about the answer
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
    await page.getByTestId('ref-giveup').click();
    await expect(page.getByTestId('ref-answer')).toContainText('John 3:16');
    await page.getByTestId('ref-retry').click();
    await expect(page.getByTestId('card-front')).toBeVisible();
  });

  test('reference recall for a range needs the whole range', async ({ page }) => {
    const range = { book: 19, chapter: 23, start: 1, end: 2, text: 'The LORD is my shepherd; I shall not want. He makes me lie down in green pastures.' };
    await addVerse(page, range);
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').filter({ hasText: 'Psalms 23:1-2' }).click();
    await page.getByTestId('review-flashcard').click();
    await page.getByTestId('flip').click();
    await page.getByTestId('grade-good').click();
    await chooseBook(page, 'Psalms');
    await page.getByTestId('ref-chapter').fill('23');
    await page.getByTestId('ref-start').fill('1'); // forgot the range end
    await page.getByTestId('ref-check').click();
    await expect(page.getByTestId('ref-message')).toBeVisible();
    await page.getByTestId('ref-end').fill('2');
    await page.getByTestId('ref-check').click();
    await expect(page.getByTestId('verse-result')).toBeVisible();
  });

  test('extra practice is labelled and does not count', async ({ page }) => {
    await startVerseReview(page, 'flashcard');
    const doIt = async () => {
      await page.getByTestId('flip').click();
      await page.getByTestId('grade-good').click();
      await answerReference(page, JOHN316);
      await expect(page.getByTestId('verse-result')).toBeVisible();
    };
    await doIt();
    await expect(page.getByTestId('verse-result')).toContainText('Review counted');
    await page.getByTestId('session-done').click({ timeout: 5000 });
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    await expect(page.getByTestId('detail-status')).toContainText('Next review in');
    await page.getByTestId('review-flashcard').click();
    await doIt();
    await expect(page.getByTestId('verse-result')).toContainText('Extra practice');
    void PSALM23_1;
    void ROMANS8_28;
  });
});
