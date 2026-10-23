import { expect, test } from '@playwright/test';
import { autoDismissMilestones, blockLookups, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

test('fifteen free backgrounds: pick one, see it behind the knight, keep it after a reload', async ({ page }) => {
  await openApp(page, '/#/avatar');
  // the cape and the background live together under Extras, apart from the armor
  await expect(page.getByRole('group', { name: 'Extras' }).getByTestId('slot-scene')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Extras' }).getByTestId('slot-cape')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Armor' }).getByTestId('slot-helmet')).toBeVisible();
  await expect(page.getByRole('group', { name: 'Armor' }).getByTestId('slot-scene')).toHaveCount(0);
  await page.getByTestId('slot-scene').click();
  await expect(page.getByTestId('item-grid').locator('.item-tile')).toHaveCount(15);
  await expect(page.getByTestId('item-scene-sunlit-castle')).toContainText('Wearing'); // everyone starts with the first
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
