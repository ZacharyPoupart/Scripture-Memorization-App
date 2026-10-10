import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, replaceDataWith, saved } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;

test.describe('avatar and seeds', () => {
  test('a review plants a seed, and the avatar bubble shows the balance', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    await expect(page.getByTestId('seeds-chip')).toContainText('0');
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').click();
    await page.getByTestId('review-flashcard').click();
    await finishFlashcard(page);
    await expect(page.getByTestId('seeds-gain')).toContainText(/\+\d+ seed/);
  });

  test('try on, buy, wear, keep after reload and offline; free items cost nothing', async ({ page, context }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await replaceDataWith(page, fixture);
    await page.goto('/#/');
    await page.getByTestId('avatar-bubble').click();
    await expect(page.getByRole('heading', { name: 'Your avatar' })).toBeVisible();
    const before = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(before).toBeGreaterThan(100);
    // a free item is worn with one tap
    await page.getByTestId('slot-hair').click();
    await page.getByTestId('item-hair-long').click();
    await expect(page.getByTestId('item-hair-long')).toContainText('Wearing');
    // a paid item previews first, then is bought
    await page.getByTestId('slot-outfit').click();
    await page.getByTestId('item-out-hoodie-sky').click();
    await expect(page.getByTestId('item-out-hoodie-sky')).not.toContainText('Wearing');
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('item-out-hoodie-sky')).toContainText('Wearing');
    const after = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(after).toBe(before - 30);
    await saved(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('item-out-hoodie-sky')).toContainText('Wearing');
    const bal = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(bal).toBe(after);
    await context.setOffline(false);
  });

  test('earned items explain how to get them, and the avatar can be hidden', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await page.getByTestId('slot-hat').click();
    await page.getByTestId('item-hat-laurel').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('14-day streak');
    await page.goto('/#/settings');
    await page.getByTestId('toggle-avatar').click();
    await page.goto('/#/');
    await expect(page.getByTestId('avatar-bubble')).toBeHidden();
  });
});
