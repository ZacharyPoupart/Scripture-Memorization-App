import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, finishFlashcard, autoDismissMilestones } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

test('Today: one tap starts the queue, then a calm all-done state says when the next review unlocks', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByTestId('today-title')).toContainText('1 verse to review');
  await expect(page.getByTestId('today-list')).toContainText('John 3:16');
  await page.getByTestId('start-today').click();
  await finishFlashcard(page);
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

test('flashcards: flip, or uncover bit by bit with start over / show all', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await page.getByTestId('gradual-start').click();
  const shown = () => page.locator('.reveal-text .rw.on').count();
  expect(await shown()).toBe(0);
  await expect(page.getByTestId('grade-good')).toHaveCount(0);
  await page.getByTestId('reveal-next').click();
  const first = await shown();
  expect(first).toBeGreaterThan(0);
  await page.locator('.reveal-text').click(); // tapping the text uncovers the next phrase too
  expect(await shown()).toBeGreaterThan(first);
  // one word at a time
  await page.getByTestId('reveal-step').click();
  await expect(page.getByTestId('reveal-step')).toContainText('By word');
  expect(await shown()).toBe(0); // switching restarts
  await page.getByTestId('reveal-next').click();
  expect(await shown()).toBe(1);
  await page.getByTestId('reveal-reset').click();
  expect(await shown()).toBe(0);
  await page.getByTestId('show-all').click();
  await expect(page.getByTestId('card-back')).toContainText('For God so loved the world');
  await page.getByTestId('grade-good').click();
  await expect(page.getByTestId('verse-result')).toBeVisible();
});

test('a first-day review ends with a warm "Nice work" (streak kept) instead of claiming everything is done', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await page.getByTestId('start-today').click();
  await finishFlashcard(page);
  await expect(page.getByTestId('session-summary')).toBeVisible({ timeout: 6000 });
  await expect(page.getByTestId('streak-kept')).toContainText('Nice work');
  await expect(page.getByTestId('all-done')).toHaveCount(0);
});
