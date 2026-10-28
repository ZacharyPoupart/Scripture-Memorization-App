import { expect, test } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, JOHN316, JOHN_TEXT, openApp, PSALM23_1, typeReference, typeWholeVerse } from './helpers';

const focusedIsTypeInput = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid === 'type-input');

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
});

test.describe('Type it out keeps the keyboard up', () => {
  test('starting from Today in Type puts the cursor in the field without a tap, and a later verse too', async ({ page }) => {
    await addVerse(page, PSALM23_1);
    await page.goto('/#/');
    await page.getByRole('group', { name: 'Review mode' }).getByRole('button', { name: /Type/ }).click();
    await page.getByTestId('start-today').click();
    await expect(page.getByTestId('type-input')).toBeVisible();
    await expect.poll(() => focusedIsTypeInput(page)).toBe(true);
    // the field has the keyboard before anything is tapped; finish the first verse, then check the second
    const first = (await page.getByTestId('review').textContent()) ?? '';
    const isJohn = first.includes('John');
    await typeWholeVerse(page, isJohn ? JOHN_TEXT : PSALM23_1.text);
    await typeReference(page, isJohn ? JOHN316 : PSALM23_1);
    await expect(page.getByTestId('verse-result')).toBeVisible({ timeout: 6000 });
    await expect(page.getByTestId('type-input')).toBeVisible({ timeout: 6000 });
    await expect.poll(() => focusedIsTypeInput(page)).toBe(true);
  });

  test('swapping to Type mid review focuses the field, and leaving the review leaves no hidden field behind', async ({ page }) => {
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    await page.getByTestId('review-flashcard').click();
    await page.getByTestId('switch-mode').click();
    await page.getByTestId('switch-to-type').click();
    await expect(page.getByTestId('type-input')).toBeVisible();
    await expect.poll(() => focusedIsTypeInput(page)).toBe(true);
    await page.getByTestId('close-review').click();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('body > input').length)).toBe(0);
  });
});
