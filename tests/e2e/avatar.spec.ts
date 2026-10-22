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

  test('try on, buy, wear, keep after reload and offline', async ({ page, context }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(false));
    await replaceDataWith(page, fixture);
    await page.goto('/#/');
    await page.getByTestId('avatar-bubble').click();
    await expect(page.getByRole('heading', { name: 'Your avatar' })).toBeVisible();
    const before = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(before).toBeGreaterThan(100);
    // everyone starts in the same free basic steel armor
    await expect(page.getByTestId('armor-meter')).toContainText('0 of 6');
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    // a paid piece previews first, then is bought and worn
    await page.getByTestId('item-helmet-silver-vanguard').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).not.toContainText('Wearing');
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    const after = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(after).toBe(before - 40);
    await expect(page.getByTestId('armor-meter')).toContainText('1 of 6');
    // going back to the free helmet is one tap and costs nothing
    await page.getByTestId('item-helmet-iron-bulwark').click();
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    await page.getByTestId('item-helmet-silver-vanguard').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    await saved(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    const bal = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(bal).toBe(after);
    await context.setOffline(false);
  });

  test('"Reset my armor" in Settings forgets what was bought and gives the seeds back', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(false));
    await replaceDataWith(page, fixture);
    await page.goto('/#/avatar');
    const before = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    await page.getByTestId('item-helmet-silver-vanguard').click();
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    await page.goto('/#/settings');
    await page.getByTestId('reset-armor').click();
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await page.goto('/#/avatar');
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('🌱 40');
    expect(Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''))).toBe(before);
  });

  test('a new knight starts in free basic armor, with every other piece waiting to be earned', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(false));
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await expect(page.getByTestId('armor-meter')).toContainText('0 of 6');
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('🌱 40');
    await page.getByTestId('slot-chest').click();
    await expect(page.getByTestId('item-chest-iron-bulwark')).toContainText('Wearing');
    await expect(page.getByTestId('item-chest-sulestial')).toContainText('🔒');
    // the free set's sword came with the first verse; its shield waits for a first streak
    await page.getByTestId('slot-weapon').click();
    await expect(page.getByTestId('item-weapon-iron-bulwark')).toContainText('Owned');
    await page.getByTestId('slot-shield').click();
    await expect(page.getByTestId('item-shield-iron-bulwark')).toContainText('🔒 1-day');
    await page.getByTestId('item-shield-iron-bulwark').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('1-day streak');
  });

  test('while testing, all armor is free to wear with no seeds and no streak', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(true)); // the switch is off by default now
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await expect(page.getByTestId('armor-free-banner')).toBeVisible();
    await page.getByTestId('item-helmet-sulestial').click(); // costs seeds and a 365-day streak when not testing; now one tap wears it
    await expect(page.getByTestId('item-helmet-sulestial')).toContainText('Wearing');
    await expect(page.getByTestId('armor-meter')).toContainText('1 of 6');
    await expect(page.getByTestId('seeds-balance')).toContainText('0'); // nothing was spent
  });

  test('earned items explain how to get them, and the avatar can be hidden', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(false));
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await page.getByTestId('slot-weapon').click();
    await page.getByTestId('item-weapon-sulestial').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('365-day streak'); // the finest pieces also ask for the longest streak
    await expect(page.getByTestId('armor-verse')).toContainText('Ephesians 6:17');
    await page.getByTestId('slot-cape').click();
    await page.getByTestId('item-cape-wings').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('500-day streak');
    await page.goto('/#/settings');
    await page.getByTestId('toggle-avatar').click();
    await page.goto('/#/');
    await expect(page.getByTestId('avatar-bubble')).toBeHidden();
  });
});
