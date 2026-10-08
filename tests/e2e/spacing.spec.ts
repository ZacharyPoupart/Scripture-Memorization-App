import { expect, test } from '@playwright/test';
import { blockLookups, openApp, saved } from './helpers';

test('time between Daily reviews: presets and custom minutes', async ({ page }) => {
  await blockLookups(page);
  await openApp(page, '/#/settings');
  const spacing = page.getByTestId('spacing');
  const hours = () => page.evaluate(() => (window as any).__mfl.getState().data.prefs.value.spacingHours);

  await spacing.selectOption({ label: 'No wait' });
  await saved(page);
  expect(await hours()).toBe(0);

  await spacing.selectOption({ label: '30 minutes' });
  await saved(page);
  expect(await hours()).toBe(0.5);

  await spacing.selectOption('custom');
  await page.getByTestId('spacing-custom').fill('45');
  await saved(page);
  expect(await hours()).toBe(0.75);

  // survives a reload and shows as Custom
  await page.reload();
  await expect(page.getByTestId('spacing')).toHaveValue('custom');
  await expect(page.getByTestId('spacing-custom')).toHaveValue('45');
});
