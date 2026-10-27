import { expect, test, type Page } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, saved, finishFlashcard, autoDismissMilestones } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

const at = (iso: string) => new Date(iso);

async function oneReview(page: Page) {
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await finishFlashcard(page);
  await expect(page.getByTestId('verse-result')).toBeVisible();
  await saved(page);
}

async function travel(page: Page, iso: string) {
  await page.clock.setSystemTime(at(iso));
  await page.reload();
}

test('a missed day is saved once a month: the popup says so, the streak carries on, and the day is gold on Stats', async ({ page }) => {
  await page.clock.install({ time: at('2026-11-02T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await travel(page, '2026-11-03T08:00:00');
  await oneReview(page);
  await travel(page, '2026-11-04T08:00:00');
  await oneReview(page);
  // nothing on the 5th

  await travel(page, '2026-11-06T08:00:00');
  await page.goto('/#/');
  await expect(page.getByTestId('streak-saved')).toContainText('God may be the only one who can save you, but we can save your streak!');
  await expect(page.getByTestId('streak-saved')).toContainText('Enjoy one free streak save each month. Use it wisely!');
  await page.getByTestId('streak-saved-close').click();
  await expect(page.getByTestId('streak-saved')).toHaveCount(0);
  await expect(page.getByTestId('streak')).toContainText('2'); // the 3rd and 4th: the saved day adds nothing, but it did not break it

  // it does not come back
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('streak-saved')).toHaveCount(0);

  // and the stats page shows the day in gold
  await page.goto('/#/stats');
  await expect(page.getByTestId('heat-saved')).toBeVisible();
  await expect(page.locator('.cell.k-saved').first()).toBeVisible();
  await expect(page.getByTestId('heat-summary')).toContainText('1 streak save used');

  // a second miss in the same month is not saved
  await travel(page, '2026-11-08T08:00:00'); // the 7th passes with nothing
  await page.goto('/#/');
  await expect(page.getByTestId('streak')).toContainText('0');
  await expect(page.getByTestId('streak-saved')).toHaveCount(0);
});

test('the streak-saved pop-up closes with the corner × or a tap outside, and has no text button', async ({ page }) => {
  await page.clock.install({ time: at('2026-11-02T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await travel(page, '2026-11-03T08:00:00');
  await oneReview(page);
  await travel(page, '2026-11-04T08:00:00');
  await oneReview(page);
  await travel(page, '2026-11-06T08:00:00');
  await page.goto('/#/');
  const popup = page.getByTestId('streak-saved');
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button')).toHaveCount(1); // only the ×
  await expect(popup.getByRole('button', { name: 'Close' })).toBeVisible();
  // a tap on the dim area outside the pop-up closes it
  await page.mouse.click(5, 5);
  await expect(popup).toHaveCount(0);
});
