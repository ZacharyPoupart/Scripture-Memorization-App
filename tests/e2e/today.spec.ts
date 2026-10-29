import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, finishFlashcard, autoDismissMilestones, PSALM23_1, ROMANS8_28 } from './helpers';

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

test('with no connection, Today says so calmly and everything keeps working', async ({ page, context }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByTestId('offline-note')).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByTestId('offline-note')).toContainText('Offline');
  await page.getByTestId('start-today').click();
  await finishFlashcard(page);
  await context.setOffline(false);
  await page.goto('/#/');
  await expect(page.getByTestId('offline-note')).toHaveCount(0);
});

test('Today is just the verses: no date, greeting, ring or pile cards; the four piles are one quiet row', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByTestId('today-list')).toContainText('John 3:16');
  const row = (await page.getByTestId('pile-row').boundingBox())!;
  const card = (await page.getByTestId('today-title').boundingBox())!;
  expect(row.y + row.height).toBeLessThan(card.y); // the pile counts sit at the top, above the day's card
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(0); // no greeting
  await expect(page.locator('main')).not.toContainText(/Good (morning|afternoon|evening)|Still up/);
  await expect(page.locator('main')).not.toContainText(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }));
  await expect(page.locator('.ring')).toHaveCount(0);
  for (const p of ['daily', 'weekly', 'monthly', 'yearly']) await expect(page.getByTestId(`pile-${p}`)).toBeVisible();
  await expect(page.getByTestId('count-daily')).toHaveText('1');
});

test('Today: tap a verse in the list to practice just that one, whether it is ready or still waiting', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await page.getByTestId('today-verse').first().click();
  await expect(page).toHaveURL(/#\/review\?verse=/);
  await expect(page.getByTestId('review')).toContainText('Verse 1 of 1'); // one verse, not the day's whole queue
  await finishFlashcard(page);
  await expect(page.getByTestId('verse-result')).toBeVisible();
  await page.getByTestId('close-review').click();
  // it is now waiting for the next review, but can still be practiced
  await expect(page.getByTestId('today-list')).toContainText('in ');
  await page.getByTestId('today-verse').first().click();
  await expect(page.getByTestId('review')).toContainText('Verse 1 of 1');
});

test('Today: the verses reviewed the fewest times so far come first, in the list and in the review', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 2, 13, 9, 0) });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  for (const v of [JOHN316, PSALM23_1, ROMANS8_28]) await addVerse(page, v);
  const review = async (name: string) => {
    await page.goto('/#/');
    await page.getByTestId('today-verse').filter({ hasText: name }).click();
    await finishFlashcard(page);
    await page.getByTestId('verse-result').click();
  };
  await review('John 3:16');
  await page.clock.fastForward('02:05:00'); // the spacing between Daily reviews
  await review('John 3:16'); // John twice, Psalm once, Romans not yet
  await review('Psalms 23:1');
  await page.clock.fastForward('02:05:00');
  await page.goto('/#/');
  const names = async () => (await page.getByTestId('today-verse').allInnerTexts()).map((t) => t.split('\n')[0].trim());
  await expect.poll(names).toEqual(['Romans 8:28', 'Psalms 23:1', 'John 3:16']);
  await page.getByTestId('start-today').click();
  await expect(page.getByTestId('card-front')).toContainText('Romans 8:28'); // the session starts with the one not reviewed yet
});
