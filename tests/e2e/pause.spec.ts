import { expect, test } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

test('take a break: Today rests, reviewing anyway still works, and the break can end early', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);

  await page.goto('/#/settings');
  await page.getByTestId('break-length').selectOption({ label: 'A week' });
  await page.getByTestId('break-start').click();
  await expect(page.getByTestId('break-status')).toContainText('On a break until');

  await page.goto('/#/');
  await expect(page.getByTestId('today-title')).toHaveText('On a break');
  await expect(page.getByTestId('today-sub')).toContainText('nothing is lost');
  await expect(page.getByTestId('freeze-banner')).toHaveCount(0);
  await expect(page.getByTestId('start-today')).toContainText('Review anyway');

  // reviewing anyway still works
  await page.getByTestId('start-today').click();
  await finishFlashcard(page);

  // and the break can be ended from Today
  await page.goto('/#/');
  await page.getByTestId('end-break').click();
  await expect(page.getByTestId('today-title')).not.toHaveText('On a break');
  await page.goto('/#/settings');
  await expect(page.getByTestId('break-start')).toBeVisible();
});

test('the break survives a reload (it is saved with your data)', async ({ page }) => {
  await blockLookups(page);
  await openApp(page, '/#/settings');
  await page.getByTestId('break-start').click();
  await expect(page.getByTestId('break-status')).toBeVisible();
  await page.evaluate(() => (window as any).__mfl.flush());
  await page.reload();
  await expect(page.getByTestId('break-status')).toBeVisible();
});
