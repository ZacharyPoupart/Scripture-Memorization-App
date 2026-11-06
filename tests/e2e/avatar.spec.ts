import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, replaceDataWith, saved } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;

test.describe('avatar and seeds', () => {
  test('a review earns a coin, and the avatar bubble shows the balance', async ({ page }) => {
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
    await expect(page.getByTestId('seeds-gain')).toContainText(/\+\d+ coin/);
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
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    // a paid piece previews first, then is bought and worn
    await page.getByTestId('item-helmet-silver-vanguard').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).not.toContainText('Wearing');
    await page.getByTestId('buy').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    const after = Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''));
    expect(after).toBe(before - 80);
    // going back to the free helmet is one tap and costs nothing
    await page.getByTestId('item-helmet-iron-bulwark').click();
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    await page.getByTestId('item-helmet-silver-vanguard').click();
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
    await saved(page);
    // the offline copy has to be fully stored before the network is cut (more pictures to store means this takes longer)
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error('no active service worker');
    });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
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
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('80');
    expect(Number((await page.getByTestId('seeds-balance').innerText()).replace(/\D/g, ''))).toBe(before);
  });

  test('a new knight starts in free basic armor, with every other piece waiting to be earned', async ({ page }) => {
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await page.evaluate(() => (window as any).__mfl.armorFree(false));
    await addVerse(page, JOHN316);
    await page.goto('/#/avatar');
    await expect(page.getByTestId('item-helmet-iron-bulwark')).toContainText('Wearing');
    await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('80');
    await page.getByTestId('slot-chest').click();
    await expect(page.getByTestId('item-chest-iron-bulwark')).toContainText('Wearing');
    await expect(page.getByTestId('item-chest-sulestial')).toContainText('🔒');
    // the free set's sword waits for a first practice (adding the verse is not enough); its shield waits for the tour or a first streak
    await page.getByTestId('slot-weapon').click();
    await expect(page.getByTestId('item-weapon-iron-bulwark')).toContainText('🔒 first practice');
    await page.getByTestId('slot-shield').click();
    await expect(page.getByTestId('item-shield-iron-bulwark')).toContainText('🔒 finish the tour');
    await page.getByTestId('item-shield-iron-bulwark').click();
    await expect(page.getByTestId('unlock-hint')).toContainText('Finish the tour');
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
    await page.goto('/#/settings');
    await page.getByTestId('toggle-avatar').click();
    await page.goto('/#/');
    await expect(page.getByTestId('avatar-bubble')).toBeHidden();
  });
});

test('tapping the coins or the multiplier explains where they come from', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 2, 13, 9, 0) });
  await page.clock.resume();
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await replaceDataWith(page, fixture);
  await page.goto('/#/');
  if (await page.getByTestId('celebration').isVisible()) await page.getByTestId('celebration-close').click(); // the fixture's level-up
  await page.goto('/#/avatar');
  await expect(page.getByTestId('coins-guide')).toHaveCount(0);
  await page.getByTestId('seeds-balance').click();
  const guide = page.getByTestId('coins-guide');
  await expect(guide).toContainText('How you earn coins');
  await expect(guide).toContainText('for every review that counts');
  await expect(guide).toContainText('more when it is a full day');
  await expect(guide).toContainText('Extra practice');
  await expect(page.getByTestId('multiplier-line')).toContainText('Your streak is');
  await page.getByTestId('seeds-balance').click(); // tapping again closes it
  await expect(guide).toHaveCount(0);
  // the multiplier chip shows once the streak is 3 days or more
  await page.getByTestId('streak-multiplier').click();
  await expect(page.getByTestId('coins-guide')).toContainText(/Why it is ×\d/);
  await expect(page.getByTestId('multiplier-line')).toContainText('worth');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByTestId('coins-guide')).toHaveCount(0);
});

test('coins count up after a session and, on a streak, the multiplier arrives and the total climbs', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 2, 13, 9, 0) });
  await page.clock.resume();
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await replaceDataWith(page, fixture);
  await page.goto('/#/');
  if (await page.getByTestId('celebration').isVisible()) await page.getByTestId('celebration-close').click();
  await page.goto('/#/review?today=1&mode=flashcard');
  for (let i = 0; i < 20 && !(await page.getByTestId('session-summary').isVisible()); i++) {
    if (await page.getByTestId('card-front').isVisible()) {
      await finishFlashcard(page);
      await page.getByTestId('verse-result').click();
    } else await page.waitForTimeout(100);
  }
  const seeds = page.getByTestId('session-seeds');
  await expect(seeds).toBeVisible();
  await expect(seeds).toContainText(/\+\d+ coins/); // the screen reader gets the final number straight away
  const final = Number((await seeds.locator('.sr-only').innerText()).match(/\+(\d+) coin/)![1]);
  // the multiplier reel spins and lands on the streak's multiplier, then the number lands on the total
  await expect(seeds.getByTestId('mult-reel')).toHaveAttribute('data-landed', 'true', { timeout: 9000 });
  expect(Number(await seeds.getByTestId('mult-reel').getAttribute('data-value'))).toBeGreaterThan(1);
  const slot = seeds.locator('.slot');
  await expect(slot).toHaveAttribute('data-done', 'true', { timeout: 9000 });
  await expect(slot).toHaveAttribute('data-total', String(final));
  // each reel stopped on a row showing the final digit
  const shown = await seeds.locator('.slot-number .reel').evaluateAll((reels) =>
    reels.map((r) => {
      const strip = r.firstElementChild as HTMLElement;
      const y = Math.round(-parseFloat(strip.style.transform.replace(/[^-.\d]/g, '').replace(/^-?/, '-')) / 1.35);
      return strip.children[Math.abs(y)]?.textContent;
    }),
  );
  expect(shown.join('')).toBe(String(final));
});
