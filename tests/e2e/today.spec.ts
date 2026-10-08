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

test('three tabs (Today · Verses · Progress) plus a gear: every screen is still reachable', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveCount(3);
  // Verses -> Add
  await page.getByRole('link', { name: 'Verses' }).click();
  await page.getByTestId('add-verse').click();
  await expect(page.getByRole('heading', { name: /Add a verse/ })).toBeVisible();
  // Progress
  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByTestId('stats')).toBeVisible();
  // the gear opens Settings from each main screen, and About is reachable from there
  for (const tab of ['Today', 'Verses', 'Progress']) {
    await page.getByRole('link', { name: tab, exact: true }).click();
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }
});
