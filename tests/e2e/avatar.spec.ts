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
    await expect(page.getByTestId('armor-meter')).toContainText('0 of 6');
    await page.getByTestId('group-armor').click();
    await page.getByTestId('item-helmet-iron').click();
    await expect(page.getByTestId('item-helmet-iron')).not.toContainText('Wearing');
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('item-helmet-iron')).toContainText('Wearing');
    const after = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(after).toBe(before - 60);
    await expect(page.getByTestId('armor-meter')).toContainText('1 of 6');
    await saved(page);
    await context.setOffline(true);
    await page.reload();
    await page.getByTestId('group-armor').click();
    await expect(page.getByTestId('item-helmet-iron')).toContainText('Wearing');
    const bal = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(bal).toBe(after);
    await context.setOffline(false);
  });

  test('everything that makes the knight look like you is free', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    for (const slot of ['skin', 'hair', 'hairColor', 'eyes', 'beard', 'glasses', 'tunic']) {
      await page.getByTestId(`slot-${slot}`).click();
      await expect(page.getByTestId('item-grid').getByText('🌱'), slot).toHaveCount(0);
      await expect(page.getByTestId('item-grid').getByText('🔒'), slot).toHaveCount(0);
    }
    await page.getByTestId('slot-beard').click();
    await page.getByTestId('item-beard-full').click();
    await expect(page.getByTestId('item-beard-full')).toContainText('Wearing');
  });

  test('earned items explain how to get them, and the avatar can be hidden', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await page.getByTestId('group-armor').click();
    await page.getByTestId('slot-sword').click();
    await page.getByTestId('item-sword-radiant').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('1000-day streak'); // the finest armor is the longest road
    await expect(page.getByTestId('armor-verse')).toContainText('Ephesians 6:17');
    await page.getByTestId('group-extras').click();
    await page.getByTestId('slot-crown').click();
    await page.getByTestId('item-crown-laurel').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('14-day streak');
    await page.goto('/#/settings');
    await page.getByTestId('toggle-avatar').click();
    await page.goto('/#/');
    await expect(page.getByTestId('avatar-bubble')).toBeHidden();
  });
});
