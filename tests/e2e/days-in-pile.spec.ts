import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, pickRef } from './helpers';

test('moving a verse can carry days with it, and Undo puts everything back', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('move').click();
  await page.getByText('Already know this one?').click();
  await page.getByTestId('days-in').fill('45');
  await expect(page.getByTestId('days-in-caption')).toContainText('45 days already');
  await page.getByTestId('move-weekly').click();
  await expect(page.getByTestId('toast')).toContainText('Moved to Weekly (45 days in)');

  await page.goto('/#/pile/weekly');
  await expect(page.getByTestId('verse-card').getByTestId('progress-ring')).toHaveAttribute('aria-label', 'Day 45 of 90 toward Monthly');

  // Undo from the message puts the verse back exactly as it was
  await page.goto('/#/pile/weekly');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('move').click();
  await page.getByTestId('move-daily').click(); // a plain move starts fresh
  await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
  await page.goto('/#/pile/weekly');
  await expect(page.getByTestId('verse-card').getByTestId('progress-ring')).toHaveAttribute('aria-label', 'Day 45 of 90 toward Monthly');
});

test('a new verse can start partway through Daily', async ({ page }) => {
  await blockLookups(page);
  await openApp(page, '/#/add');
  await pickRef(page, JOHN316);
  await page.getByTestId('text').fill(JOHN316.text);
  await page.getByText('Already know this one?').click();
  await page.getByTestId('days-in').fill('60');
  await page.getByTestId('save-verse').click();
  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('verse-card').getByTestId('progress-ring')).toHaveAttribute('aria-label', 'Day 60 of 90 toward Weekly');
});

test('"Open in Bible" is the same size as the other buttons', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  const h = async (name: RegExp) => (await page.getByRole('link', { name }).or(page.getByRole('button', { name })).first().boundingBox())!.height;
  const bible = await h(/Open in Bible/);
  const edit = await h(/^Edit$/);
  expect(Math.abs(bible - edit)).toBeLessThanOrEqual(1);
});
