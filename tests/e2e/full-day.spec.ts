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

test('Stats tells a full day (everything done all the way) from an all-done day (every verse reviewed once)', async ({ page }) => {
  await page.clock.install({ time: at('2026-03-10T08:00:00') });
  await page.clock.resume();
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);

  // March 11: all three reviews
  await travel(page, '2026-03-11T08:00:00');
  await oneReview(page);
  await travel(page, '2026-03-11T10:05:00');
  await oneReview(page);
  await travel(page, '2026-03-11T12:10:00');
  await oneReview(page);
  // March 12: just one review, which still keeps the streak
  await travel(page, '2026-03-12T08:00:00');
  await oneReview(page);

  await travel(page, '2026-03-13T08:00:00');
  await page.goto('/#/stats');
  await expect(page.getByTestId('heat-counts')).toHaveText('1 full · 1 all-done · 0 practiced');
  await expect(page.locator('.cell.k-full').first()).toBeVisible();
  await expect(page.locator('.cell.k-complete').first()).toBeVisible();
  await expect(page.getByTestId('heat-summary')).toContainText('1 full days, 1 days with every verse reviewed');
});
