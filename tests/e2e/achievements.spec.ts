import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, openApp, type VerseInput } from './helpers';

// Medals (v1.85.0): bronze, silver and gold for the same thing at rising counts, kept on Progress, announced once when earned.
const verse = (book: number, n: number): VerseInput => ({ book, chapter: 1, start: n, text: `A short practice verse number ${n} for the medals.` });

test('medals: Progress lists every achievement with the way to bronze; the fifth verse earns a bronze medal, announced once', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, verse(1, 1));
  await page.goto('/#/stats');
  await expect(page.getByTestId('achievements')).toBeVisible();
  await expect(page.getByTestId('medal-tally')).toHaveText('0 of 27');
  const treasured = page.locator('[data-testid="achievement"][data-id="treasured"]');
  await expect(treasured).toHaveAttribute('data-tier', 'none');
  await expect(treasured).toContainText('Bronze: Add 5 verses · 1 of 5');

  for (let i = 2; i <= 5; i++) await addVerse(page, verse(1, i));
  await expect(page.getByTestId('medal-reveal')).toBeVisible();
  await expect(page.getByTestId('medal-reveal')).toContainText('Bronze medal');
  await expect(page.getByTestId('medal-reveal')).toContainText('Hidden in my heart');
  await page.getByTestId('milestone-close').click();
  await expect(page.getByTestId('medal-reveal')).toHaveCount(0);

  await page.goto('/#/stats');
  await expect(treasured).toHaveAttribute('data-tier', 'bronze');
  await expect(treasured).toContainText('Silver: Add 20 verses · 5 of 20');
  await expect(page.getByTestId('medal-tally')).toHaveText('1 of 27');
  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.getByTestId('medal-reveal')).toHaveCount(0); // never twice
});
