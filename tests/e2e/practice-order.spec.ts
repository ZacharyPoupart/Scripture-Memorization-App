import { expect, test, type Page } from '@playwright/test';
import {
  addVerse,
  autoDismissMilestones,
  blockLookups,
  chooseBook,
  completeBlanks,
  finishBlankReference,
  finishFlashcard,
  firstLetters,
  installFakeSpeech,
  JOHN316,
  JOHN_TEXT,
  openApp,
  PSALM23_1,
  saved,
  typeReference,
} from './helpers';

const withTopic = { ...JOHN316, topic: 'Gospel' };

async function choosePreset(page: Page, id: string) {
  await page.goto('/#/settings');
  await page.getByTestId(`practice-preset-${id}`).click();
  await saved(page);
}

async function startReview(page: Page, mode: string, card = 'John 3:16') {
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').filter({ hasText: card }).first().click();
  await page.getByTestId(`review-${mode}`).click();
  await expect(page.getByTestId('review')).toHaveAttribute('data-mode', mode);
}

/** The shared citation questions (book, chapter, verse), when the verse text is not on screen (before the verse). */
async function fillCitation(page: Page, v = JOHN316) {
  await chooseBook(page, 'John');
  await page.getByTestId('ref-chapter').fill(String(v.chapter));
  await page.getByTestId('ref-start').fill(String(v.start));
  await page.getByTestId('ref-check').click();
}

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, withTopic);
  await addVerse(page, PSALM23_1); // a verse with no topic
});

test.describe('practice order: settings', () => {
  test('presets and toggles change the order, and it is remembered', async ({ page }) => {
    await page.goto('/#/settings');
    await expect(page.getByTestId('practice-preview')).toHaveText('Verse → Citation → Topic'); // the classic order is the default
    await page.getByTestId('practice-preset-sandwich').click();
    await expect(page.getByTestId('practice-preview')).toHaveText('Topic → Citation → Verse → Citation');
    await page.getByTestId('practice-after-citation').click(); // turn the closing citation off
    await expect(page.getByTestId('practice-preview')).toHaveText('Topic → Citation → Verse');
    await page.getByTestId('practice-before-topic').click();
    await page.getByTestId('practice-after-topic').click();
    await expect(page.getByTestId('practice-preview')).toHaveText('Citation → Verse → Topic');
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('practice-preview')).toHaveText('Citation → Verse → Topic');
    await page.getByTestId('practice-preset-verse-only').click();
    await expect(page.getByTestId('practice-preview')).toHaveText('Verse');
  });
});

test.describe('practice order: the sandwich (topic, citation, verse, citation)', () => {
  test.beforeEach(async ({ page }) => {
    await choosePreset(page, 'sandwich');
  });

  test('fill in the blank: topic and citation first, then the words, then the citation again', async ({ page }) => {
    await startReview(page, 'blanks');
    await expect(page.getByTestId('quiz-cue')).toHaveText('John 3:16'); // the citation is the cue for the topic question
    await page.getByTestId('topic-option').filter({ hasText: /^Gospel$/ }).click();
    await fillCitation(page);
    await completeBlanks(page, JOHN_TEXT);
    await finishBlankReference(page, JOHN316); // closing citation only: the topic was asked at the start
  });

  test('the citation is shown at the top; typing the topic hides it (the space stays), and the topic is typed in a box', async ({ page }) => {
    await startReview(page, 'blanks');
    const cue = page.getByTestId('quiz-cue');
    await expect(cue).toHaveText('John 3:16');
    const before = await cue.boundingBox();
    await expect(page.getByTestId('topic-input')).toBeFocused();
    await page.keyboard.type('gospel'); // the letters narrow the choices; the right one is taken as soon as it is the only one left
    await expect(cue).toBeHidden(); // gone once they start answering
    const after = await cue.boundingBox();
    expect(after?.height).toBe(before?.height); // the space stays, so nothing moves
    await expect(page.getByTestId('ref-book')).toBeVisible(); // now the citation, from memory
    await expect(cue).toBeHidden();
  });

  test('a wrong letter in the topic box is a slip, and the cue is already gone', async ({ page }) => {
    await startReview(page, 'blanks');
    await page.keyboard.type('q'); // no topic starts with q
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
    await expect(page.getByTestId('quiz-cue')).toBeHidden();
  });

  test('type it out: topic, citation, the verse, then the typed citation', async ({ page }) => {
    await startReview(page, 'type');
    await page.getByTestId('topic-option').filter({ hasText: /^Gospel$/ }).click();
    await fillCitation(page);
    await page.getByTestId('type-input').focus();
    await page.keyboard.type(firstLetters(JOHN_TEXT));
    await expect(page.getByTestId('type-ref')).toBeVisible({ timeout: 6000 });
    await typeReference(page, JOHN316);
    await expect(page.getByTestId('topic-options')).toHaveCount(0);
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });
  });

  test('speak it: topic, citation, the speaking, then the citation again', async ({ page }) => {
    await installFakeSpeech(page, JOHN_TEXT.replace(/[,.;]/g, '').toLowerCase());
    await page.goto('/#/pile/daily');
    await page.reload();
    await page.getByTestId('verse-card').filter({ hasText: 'John 3:16' }).first().click();
    await page.getByTestId('review-speak').click();
    await page.getByTestId('topic-option').filter({ hasText: /^Gospel$/ }).click();
    await fillCitation(page);
    await page.getByTestId('speak-start').click();
    await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByTestId('speak-done').click();
    await expect(page.getByTestId('speak-result')).toContainText('Perfect');
    await page.getByTestId('speak-continue').click();
    await expect(page.getByTestId('ref-verse-text')).toBeVisible({ timeout: 6000 });
    await fillCitation(page);
    await expect(page.getByTestId('topic-options')).toHaveCount(0);
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });
  });

  test('a wrong answer before the verse is a slip like any other', async ({ page }) => {
    await startReview(page, 'blanks');
    await page.getByTestId('topic-option').filter({ hasNotText: /^Gospel$/ }).first().click(); // any choice that is not this verse's topic
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(1);
  });

  test('a verse with no topic skips the topic and starts with the citation', async ({ page }) => {
    await startReview(page, 'blanks', 'Psalms');
    await expect(page.getByTestId('quiz-cue')).toHaveText('The LORD is my shepherd;…'); // no topic, so the first words
    await expect(page.getByTestId('topic-options')).toHaveCount(0);
    await expect(page.getByTestId('ref-book')).toBeVisible();
  });

  test('flashcards ask nothing extra', async ({ page }) => {
    await startReview(page, 'flashcard');
    await expect(page.getByTestId('card-front')).toBeVisible();
    await finishFlashcard(page);
  });
});

test.describe('practice order: other orders', () => {
  test('verse only: the words and nothing else, in every mode', async ({ page }) => {
    await choosePreset(page, 'verse-only');
    await startReview(page, 'blanks');
    await completeBlanks(page, JOHN_TEXT);
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });

    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').filter({ hasText: 'Psalms' }).first().click();
    await page.getByTestId('review-type').click();
    await page.getByTestId('type-input').focus();
    await page.keyboard.type(firstLetters(PSALM23_1.text));
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });
  });

  test('citation first: asked before the verse and not after', async ({ page }) => {
    await choosePreset(page, 'citation-first');
    await startReview(page, 'type');
    await expect(page.getByTestId('quiz-cue')).toHaveText('Gospel'); // the topic is the cue for the citation question
    await expect(page.getByTestId('topic-options')).toHaveCount(0);
    await fillCitation(page);
    await page.getByTestId('type-input').focus();
    await page.keyboard.type(firstLetters(JOHN_TEXT));
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 }); // no reference or topic after the words
  });

  test('the topic only, after the verse (fill in the blank)', async ({ page }) => {
    await page.goto('/#/settings');
    await page.getByTestId('practice-after-citation').click(); // classic order minus the citation
    await saved(page);
    await startReview(page, 'blanks');
    await completeBlanks(page, JOHN_TEXT);
    await expect(page.getByTestId('topic-blank-line')).toBeVisible();
    await expect(page.getByTestId('ref-blanks')).toHaveCount(0);
    await page.getByTestId('option').getByText('Gospel', { exact: true }).click();
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });
  });
});
