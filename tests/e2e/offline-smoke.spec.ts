import { expect, test } from '@playwright/test';
import { addVerse, answerReference, blockLookups, JOHN316, openApp } from './helpers';

// "Does the whole app still boot and respond with the network OFF?" Re-run on every workstream; extend as
// screens are added. Runs on the phone-sized viewport (and desktop).

const ROUTES: [string, RegExp][] = [
  ['/#/', /Good (morning|afternoon|evening)|Still up/],
  ['/#/piles', /All verses/],
  ['/#/add', /Add a verse/],
  ['/#/settings', /Settings/],
  ['/#/about', /About/],
  ['/#/stats', /Progress/],
  ['/#/pile/daily', /Daily/],
];

test('every screen loads and is clickable with the network off', async ({ page, context }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error('no active service worker');
  });
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);

  await context.setOffline(true);
  await page.reload(); // cold boot offline
  await expect(page.getByTestId('verse-card')).toHaveCount(1);
  // nothing may overlay and block the app after boot
  expect(await page.evaluate(() => document.querySelectorAll('.overlay').length)).toBe(0);

  for (const [route, heading] of ROUTES) {
    await page.goto(route);
    await expect(page.locator('main')).toContainText(heading);
  }
  // tab bar is tappable offline
  await page.goto('/#/');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await page.getByRole('link', { name: 'Today' }).click();

  // a full review works offline
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await page.getByTestId('flip').click();
  await page.getByTestId('grade-good').click();
  await answerReference(page, JOHN316);
  await expect(page.getByTestId('verse-result')).toContainText('Review counted');
  await context.setOffline(false);
});
