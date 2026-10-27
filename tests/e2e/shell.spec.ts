import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp } from './helpers';

test('about page: purpose, rules, feedback link and version', async ({ page }) => {
  await blockLookups(page);
  await openApp(page, '/#/about');
  await expect(page.getByText('The four piles')).toBeVisible();
  await expect(page.getByText('Streaks and progress')).toBeVisible();
  await expect(page.getByTestId('feedback')).toHaveAttribute('href', /github\.com\/.*\/issues\/new/);
  await expect(page.getByTestId('version')).toContainText(/version \d+\.\d+\.\d+/);
});

test('light and dark theme can be chosen and persist', async ({ page }) => {
  await blockLookups(page);
  await openApp(page, '/#/settings');
  await page.getByRole('button', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Light' }).click();
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).not.toBe(dark);
});

test('the colour behind the phone\u2019s clock follows the app\u2019s own theme, not just the phone\u2019s setting', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' }); // a phone in dark mode
  await blockLookups(page);
  await openApp(page, '/#/settings');
  const bar = () => page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('content')));
  const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  // following the phone: dark app, dark bar
  expect(await bar()).toEqual([await bg()]);
  const dark = await bg();
  // the app set to Light on a dark phone: the bar is light too (it used to stay dark: a black box above a light page)
  await page.getByRole('button', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const light = await bg();
  expect(light).not.toBe(dark);
  expect(await bar()).toEqual([light]);
  // and back, and when the phone itself switches while following it
  await page.getByRole('button', { name: 'Match device' }).click();
  expect(await bar()).toEqual([dark]);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(bar).toEqual([light]);
});

test('installable: manifest, icons and standalone display', async ({ page, request }) => {
  await blockLookups(page);
  await openApp(page);
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href!)).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('Memorize For Life');
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBeTruthy();
  expect((await request.get('/apple-touch-icon.png')).ok()).toBeTruthy();
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test('navigation tabs work and the streak chip is shown', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.getByRole('link', { name: 'Today' }).click();
  await expect(page.getByTestId('streak')).toBeVisible();
  await page.getByRole('link', { name: 'Piles' }).click();
  await expect(page.getByRole('heading', { name: 'All verses' })).toBeVisible();
  await page.getByRole('link', { name: 'Friends' }).click();
  await expect(page.getByRole('heading', { name: 'Friends' })).toBeVisible();
  await expect(page.getByTestId('tab-friends')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});
