import { expect, test, type Page } from '@playwright/test';
import { addVerse, answerReference, blockLookups, JOHN316, openApp, saved } from './helpers';

// These drive the real app with a controlled clock to check the day-based rules end to end.
// (The exhaustive rule tests are unit tests; this proves the UI is wired to them.)

const at = (iso: string) => new Date(iso);

async function oneReview(page: Page) {
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await page.getByTestId('flip').click();
  await page.getByTestId('grade-good').click();
  await answerReference(page, JOHN316);
  await expect(page.getByTestId('verse-result')).toBeVisible();
  await saved(page);
}

async function travel(page: Page, iso: string) {
  await page.clock.setSystemTime(at(iso));
  await page.reload();
}

test('daily spacing, streak and the local-midnight rollover', async ({ page }) => {
  await page.clock.install({ time: at('2026-03-10T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/');
  await expect(page.getByTestId('streak')).toContainText('0'); // added today: nothing required yet

  // next morning: 3 reviews, spaced 2h apart
  await travel(page, '2026-03-11T08:00:00');
  await page.goto('/#/');
  await expect(page.getByTestId('today-ring')).toHaveText('0/1');
  await oneReview(page);
  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('status')).toContainText('Next review in 2 hr');
  await travel(page, '2026-03-11T09:59:00');
  await expect(page.getByTestId('status')).toContainText('Next review in');
  await travel(page, '2026-03-11T10:00:30');
  await expect(page.getByTestId('status')).toContainText('Ready');
  await oneReview(page);
  await travel(page, '2026-03-11T12:05:00');
  await oneReview(page);
  await page.goto('/#/');
  await expect(page.getByTestId('streak')).toContainText('1');
  await expect(page.getByText('All done for today!')).toBeVisible();

  // just after local midnight: a new day, counts reset, streak still alive
  await travel(page, '2026-03-12T00:01:00');
  await page.goto('/#/');
  await expect(page.getByTestId('today-ring')).toHaveText('0/1');
  await expect(page.getByTestId('streak')).toContainText('1');
  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('status')).toContainText('Ready');

  // miss the whole day, come back: streak resets, longest remembered
  await travel(page, '2026-03-13T09:00:00');
  await page.goto('/#/');
  await expect(page.getByTestId('streak')).toContainText('0');
  await expect(page.getByTestId('streak')).toHaveAttribute('title', 'Longest streak: 1');
});

test('freeze: 3 days without reviewing pauses progress, reviewing resumes it', async ({ page }) => {
  await page.clock.install({ time: at('2026-03-10T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await travel(page, '2026-03-12T09:00:00'); // one day lapsed
  await page.goto('/#/');
  await expect(page.getByTestId('freeze-banner')).toBeHidden();
  await travel(page, '2026-03-15T09:00:00'); // days lapsed: 11, 12, 13, 14
  await page.goto('/#/');
  await expect(page.getByTestId('freeze-banner')).toBeVisible();
  await expect(page.getByTestId('freeze-banner')).toContainText('paused');
  await oneReview(page); // any review resumes progress
  await page.goto('/#/');
  await expect(page.getByTestId('freeze-banner')).toBeHidden();
});

test('a verse that earned its promotion moves up with a celebration', async ({ page }) => {
  await page.clock.install({ time: at('2026-03-10T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  // take the app's own data and rewrite it so the verse has been Daily for 90 days with daily reviews
  const data = await page.evaluate(() => structuredClone((window as any).__mfl.getState().data));
  const day = (n: number) => {
    const d = new Date(2026, 2, 10 + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const v = Object.values<any>(data.verses)[0];
  v.pileSince = day(-90);
  v.addedDay = day(-90);
  data.createdDay = day(-90);
  data.settledThrough = day(-91);
  data.ledger = {};
  v.reviews = [];
  for (let n = -89; n < 0; n++) for (const h of [8, 11, 14]) v.reviews.push(new Date(2026, 2, 10 + n, h).getTime());
  const file = JSON.stringify({ app: 'memorize-for-life', format: 1, appVersion: '1.0.0', exportedAt: new Date().toISOString(), data });

  await page.goto('/#/settings');
  await page.getByTestId('import-file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(file) });
  await page.getByTestId('import-replace').click();
  await page.goto('/#/');
  await expect(page.getByTestId('celebration')).toBeVisible();
  await expect(page.getByTestId('celebration')).toContainText('John 3:16');
  await expect(page.getByTestId('celebration')).toContainText('Daily → Weekly');
  await page.getByTestId('celebration-close').click();
  await expect(page.getByTestId('count-weekly')).toHaveText('1');
  await expect(page.getByTestId('count-daily')).toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('celebration')).toBeHidden(); // only celebrated once
});
