import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp } from './helpers';

test.describe('minigames with the knight', () => {
  test('Dragon Duel: the right words beat the dragon, wrong ones cost hearts, and nothing is counted or paid', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-duel').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'duel');
    await expect(page.getByTestId('duel-hearts')).toHaveAttribute('data-hearts', '3');
    // a wrong word costs a heart and the same word is asked again
    await page.getByTestId('duel-choices').locator('button:not([data-right])').first().click();
    await expect(page.getByTestId('duel-hearts')).toHaveAttribute('data-hearts', '2');
    await expect(page.getByTestId('duel-text').locator('.w.ok')).toHaveCount(0);
    // then every right word, to the end
    // (the last blow plays out for a moment before the result shows, and the buttons rest meanwhile)
    for (let i = 0; i < 200; i++) {
      if (await page.getByTestId('game-finish').isVisible()) break;
      const right = page.getByTestId('duel-choices').locator('button[data-right]:not([disabled])');
      if (await right.count()) await right.click();
      else await page.waitForTimeout(100);
    }
    await expect(page.getByTestId('game-finish')).toContainText('The dragon is beaten');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2'); // one slip
    await expect(page.getByTestId('game-finish')).toContainText('For God so loved the world');
    // three wrong words in a row and the dragon holds the gate; you can simply go again
    await page.getByTestId('game-again').click();
    for (let i = 0; i < 3; i++) await page.getByTestId('duel-choices').locator('button:not([data-right])').first().click();
    await expect(page.getByTestId('game-finish')).toContainText('holds the gate');
    // it was only play: no review counted, no coins
    await page.getByTestId('game-close').click();
    const state = await page.evaluate(() => (window as any).__mfl.getState());
    expect(Object.values(state.data.verses as Record<string, { reviews?: unknown[] }>).every((v) => !(v.reviews ?? []).length)).toBe(true);
  });

  test('Bridge of the Word: laying the phrases in order walks the knight across', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-bridge').click();
    const bank = page.getByTestId('bridge-bank');
    await expect(bank.locator('button').first()).toBeVisible();
    const total = await bank.locator('button').count();
    expect(total).toBeGreaterThan(3);
    // a wrong plank stays on the bank
    await bank.locator('button:not([data-order="0"])').first().click();
    await expect(bank.locator('button')).toHaveCount(total);
    await expect(page.getByTestId('bridge-stage')).toHaveAttribute('data-laid', '0');
    for (let i = 0; i < total; i++) await bank.locator(`button[data-order="${i}"]`).click();
    await expect(page.getByTestId('game-finish')).toContainText('Safely across');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2');
    // and over to the other game from here
    await page.getByTestId('game-swap').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'duel');
  });
});
