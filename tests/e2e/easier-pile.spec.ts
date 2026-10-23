import { expect, test, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, JOHN316, JOHN_TEXT, openApp, typeReference, typeWholeVerse } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
});

// A verse that has been in Weekly for a while, so a review is ready and counts.
async function weeklyVerse(page: Page) {
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('move').click();
  await page.getByText('Already know this one?').click();
  await page.getByTestId('days-in').fill('30');
  await page.getByTestId('move-weekly').click();
  await expect(page.getByTestId('toast')).toContainText('Moved to Weekly');
}

async function startTypeReview(page: Page) {
  await page.getByTestId('review-type').click();
  await page.getByTestId('type-input').focus();
}

async function slip(page: Page) {
  await page.keyboard.type('q'); // Weekly allows no slips, so this restarts the verse
  await expect(page.getByTestId('toast')).toContainText('try that verse again');
}

test('a verse that took many tries offers to move down, and it can be undone', async ({ page }) => {
  await weeklyVerse(page);
  await startTypeReview(page);
  await slip(page);
  await page.getByTestId('type-input').focus();
  await slip(page);
  await page.getByTestId('type-input').focus();
  await typeWholeVerse(page, JOHN_TEXT);
  await typeReference(page, JOHN316);
  await expect(page.getByTestId('easier-suggestion')).toBeVisible();
  await expect(page.getByTestId('easier-suggestion')).toContainText('more often');
  await page.getByTestId('easier-move').click();
  await expect(page.getByTestId('toast')).toContainText('Moved to Daily');
  await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
  await page.goto('/#/');
  await expect(page.getByTestId('count-weekly')).toHaveText('1');
  await expect(page.getByTestId('count-daily')).toHaveText('0');
});

test('keeping it where it is just carries on', async ({ page }) => {
  await weeklyVerse(page);
  await startTypeReview(page);
  await slip(page);
  await page.getByTestId('type-input').focus();
  await slip(page);
  await page.getByTestId('type-input').focus();
  await typeWholeVerse(page, JOHN_TEXT);
  await typeReference(page, JOHN316);
  await page.getByTestId('easier-keep').click();
  await expect(page.getByTestId('session-summary')).toBeVisible();
  await page.goto('/#/');
  await expect(page.getByTestId('count-weekly')).toHaveText('1');
});

test('one slip is not enough to offer anything', async ({ page }) => {
  await weeklyVerse(page);
  await startTypeReview(page);
  await slip(page);
  await page.getByTestId('type-input').focus();
  await typeWholeVerse(page, JOHN_TEXT);
  await typeReference(page, JOHN316);
  await expect(page.getByTestId('verse-result')).toBeVisible();
  await expect(page.getByTestId('easier-suggestion')).toHaveCount(0);
});
