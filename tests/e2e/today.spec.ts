import { expect, test } from '@playwright/test';
import { addVerse, answerReference, blockLookups, JOHN316, openApp } from './helpers';

test('Today: one tap starts the queue, then a calm all-done state says when the next review unlocks', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByTestId('today-title')).toContainText('1 verse to review');
  await expect(page.getByTestId('today-list')).toContainText('John 3:16');
  await page.getByTestId('start-today').click();
  await page.getByTestId('flip').click();
  await page.getByTestId('grade-good').click();
  await answerReference(page, JOHN316);
  await expect(page.getByTestId('verse-result')).toBeVisible();
  await page.goto('/#/');
  // no disabled/empty button: the action bar goes away and the card explains what happens next
  await expect(page.getByTestId('start-today')).toHaveCount(0);
  await expect(page.getByTestId('today-title')).toContainText('Done for now');
  await expect(page.getByTestId('today-sub')).toContainText('Next review in');
});

test('verse cards show a progress ring with a readable label', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  const ring = page.getByTestId('verse-card').getByTestId('progress-ring');
  await expect(ring).toHaveAttribute('aria-label', 'Day 0 of 90 toward Weekly');
  await expect(ring).toHaveAttribute('data-state', 'progress');
});
