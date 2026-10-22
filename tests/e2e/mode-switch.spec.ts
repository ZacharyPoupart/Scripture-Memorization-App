import { expect, test } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, completeBlanks, finishFlashcard, firstLetters, JOHN316, JOHN_TEXT, openApp, PSALM23_1 } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
});

test.describe('review type picker and switching', () => {
  test('on Today the review type bar is at the top of the card, above the headline', async ({ page }) => {
    await page.goto('/#/');
    const bar = await page.getByRole('group', { name: 'Review mode' }).boundingBox();
    const title = await page.getByTestId('today-title').boundingBox();
    expect(bar).toBeTruthy();
    expect(title).toBeTruthy();
    expect(bar!.y).toBeLessThan(title!.y);
    await expect(page.getByTestId('today-list')).toBeVisible();
  });

  test('mid review, the type can be swapped: the verse starts over in the new type, slips do not carry over, the default is unchanged', async ({ page }) => {
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    await page.getByTestId('review-blanks').click();
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'blanks');
    // a wrong pick is a slip
    await page.getByTestId('option').first().click();
    await page.getByTestId('switch-mode').click();
    await expect(page.getByTestId('mode-sheet')).toBeVisible();
    await page.getByTestId('switch-to-type').click();
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'type');
    await expect(page.getByTestId('mistakes').locator('.dot.used')).toHaveCount(0); // a fresh attempt
    await expect(page.getByTestId('review')).toContainText('Verse 1 of 1'); // the same verse
    await page.getByTestId('type-input').focus();
    await page.keyboard.type(firstLetters(JOHN_TEXT));
    await expect(page.getByTestId('type-ref')).toBeVisible({ timeout: 6000 });
    // the saved default is still flashcards
    const mode = await page.evaluate(() => (window as any).__mfl.getState().settings.defaultMode);
    expect(mode).toBe('flashcard');
  });

  test('the sheet marks the current type, and cancelling changes nothing', async ({ page }) => {
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    await page.getByTestId('review-flashcard').click();
    await page.getByTestId('switch-mode').click();
    await expect(page.getByTestId('switch-to-flashcard')).toContainText('(current)');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('mode-sheet')).toHaveCount(0);
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'flashcard');
    await expect(page.getByTestId('card-front')).toBeVisible();
  });

  test('swapping to the type already in use does nothing; swapping on the result card applies to the next verse', async ({ page }) => {
    await addVerse(page, PSALM23_1);
    await page.goto('/#/');
    await page.getByTestId('start-today').click(); // both verses, in the default type (flashcards)
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'flashcard');
    await page.getByTestId('switch-mode').click();
    await page.getByTestId('switch-to-flashcard').click(); // already flashcards
    await expect(page.getByTestId('card-front')).toBeVisible();
    await finishFlashcard(page);
    await page.getByTestId('switch-mode').click(); // on the result card
    await expect(page.getByTestId('mode-sheet')).toContainText('The next verse will use it');
    await page.getByTestId('switch-to-blanks').click();
    await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'blanks');
    await expect(page.getByTestId('verse-result')).toBeVisible(); // the result card is untouched
    await page.getByTestId('verse-result').click(); // on to the next verse, now in blanks
    await expect(page.getByTestId('blank-text')).toBeVisible();
    await expect(page.getByTestId('review')).toContainText('Verse 2 of 2');
    await completeBlanks(page, PSALM23_1.text);
  });
});
