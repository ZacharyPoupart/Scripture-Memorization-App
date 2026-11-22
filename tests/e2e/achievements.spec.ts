import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, blockLookups, openApp, replaceDataWith, saved, wantMedals, type VerseInput } from './helpers';

// Medals (v1.85.0): bronze, silver and gold for the same thing at rising counts, kept on Progress, announced once when earned.
const verse = (book: number, n: number): VerseInput => ({ book, chapter: 1, start: n, text: `A short practice verse number ${n} for the medals.` });
const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;
const coins = async (page: import('@playwright/test').Page) => {
  await page.goto('/#/avatar');
  return Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
};

test('medals: Progress lists every achievement with the way to bronze; the fifth verse earns a bronze medal, announced once', async ({ page }) => {
  wantMedals(page);
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, verse(1, 1));
  await page.goto('/#/stats');
  await expect(page.getByTestId('achievements')).toBeVisible();
  await expect(page.getByTestId('medal-tally')).toHaveText('0 of 27');
  await expect(page.getByTestId('rank')).toHaveAttribute('data-rank', 'Page'); // ranks (v1.87.0)
  await expect(page.getByTestId('rank')).toContainText('Squire at 2 medals');
  const treasured = page.locator('[data-testid="achievement"][data-id="treasured"]');
  await expect(treasured).toHaveAttribute('data-tier', 'none');
  await expect(treasured).toContainText('Bronze: Add 5 verses · 1 of 5 · +50 coins');
  const before = await coins(page);

  for (let i = 2; i <= 5; i++) await addVerse(page, verse(1, i));
  const card = page.getByTestId('medal-reveal');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Bronze medal');
  await expect(card).toContainText('Hidden in my heart');
  await expect(page.getByTestId('medal-coins')).toContainText('+50 coins');
  await expect(page.getByTestId('medal-rank')).toHaveCount(0); // one medal is not yet a new rank
  await page.getByTestId('medal-close').click();
  await expect(card).toHaveCount(0);
  expect(await coins(page)).toBe(before + 50);

  await page.goto('/#/stats');
  await expect(treasured).toHaveAttribute('data-tier', 'bronze');
  await expect(treasured).toContainText('Silver: Add 20 verses · 5 of 20');
  await expect(page.getByTestId('medal-tally')).toHaveText('1 of 27');
  await saved(page);
  await page.reload();
  await page.waitForTimeout(600);
  await expect(card).toHaveCount(0); // never twice
  expect(await coins(page)).toBe(before + 50); // paid once
});

test('medals: several earned at once (a restored backup) are one card, not a chain of pop-ups', async ({ page }) => {
  wantMedals(page);
  await blockLookups(page);
  await openApp(page);
  await replaceDataWith(page, fixture); // a long streak and many reviews: six medals in four achievements
  await page.goto('/#/stats');
  const card = page.getByTestId('medal-reveal');
  await expect(card).toBeVisible();
  await expect(card).toContainText('4 new medals');
  await expect(card.locator('.medal-drop-row li')).toHaveCount(4);
  await expect(page.getByTestId('medal-coins')).toContainText('+400 coins'); // 50 + 100 twice, 50 twice
  await expect(page.getByTestId('medal-rank')).toContainText('New rank: Knight'); // six medals held (v1.87.0)
  await page.getByTestId('medal-close').click();
  await expect(card).toHaveCount(0);
  await page.waitForTimeout(600);
  await expect(card).toHaveCount(0); // closed once for all of them
  await expect(page.locator('[data-testid="achievement"][data-id="faithful"]')).toHaveAttribute('data-tier', 'silver');
  await expect(page.getByTestId('rank')).toHaveAttribute('data-rank', 'Knight');
  await expect(page.getByTestId('rank')).toContainText('Captain at 9 medals');
  await page.goto('/#/avatar');
  await expect(page.getByTestId('avatar-rank')).toHaveAttribute('data-rank', 'Knight');
});
