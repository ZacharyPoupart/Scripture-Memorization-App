import { expect, test } from '@playwright/test';
import { autoDismissMilestones, blockLookups, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

test('fifteen free backgrounds: pick one, see it behind the knight, keep it after a reload', async ({ page }) => {
  await openApp(page, '/#/avatar');
  await page.getByTestId('slot-scene').click();
  await expect(page.getByTestId('item-grid').locator('.item-tile')).toHaveCount(16); // the drawn sky plus fifteen pictures
  await expect(page.getByTestId('item-scene-sky')).toContainText('Wearing');
  await expect(page.getByTestId('item-scene-frost-keep')).not.toContainText('🔒'); // nothing to earn or buy
  await expect(page.getByTestId('item-scene-frost-keep')).not.toContainText('Buy');
  await page.getByTestId('item-scene-frost-keep').click();
  await expect(page.getByTestId('item-scene-frost-keep')).toContainText('Wearing');
  await expect(page.locator('svg[role="img"] image').first()).toHaveAttribute('href', '/scenes/frost-keep.webp');
  await page.evaluate(() => (window as any).__mfl.flush());
  await page.reload();
  await expect(page.locator('svg[role="img"] image').first()).toHaveAttribute('href', '/scenes/frost-keep.webp');
  // every picture really loads
  await page.getByTestId('slot-scene').click();
  const broken = await page.locator('.item-grid img.scene-img').evaluateAll((imgs) => (imgs as HTMLImageElement[]).filter((i) => i.complete && i.naturalWidth === 0).length);
  expect(broken).toBe(0);
});
