import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, replaceDataWith, saved } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;

/** Closes any "new item" popups that are up (restoring a backup also brings in items that were earned elsewhere). */
async function dismissReveals(page: Page) {
  for (let i = 0; i < 4; i++) {
    const close = page.getByTestId('reveal-close');
    if (!(await close.isVisible().catch(() => false))) {
      await page.waitForTimeout(250);
      if (!(await close.isVisible().catch(() => false))) return;
    }
    await close.click();
  }
}

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page, { reveals: false }); // these tests are about the popup itself
  await blockLookups(page);
});

test('buying an item shows it in the middle of the screen with a glow, and it can be closed', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => (window as any).__mfl.armorFree(false));
  await replaceDataWith(page, fixture);
  await page.goto('/#/avatar');
  await dismissReveals(page);
  await page.getByTestId('item-helmet-silver-vanguard').click();
  await page.getByTestId('buy').click();
  const reveal = page.getByTestId('item-reveal');
  await expect(reveal).toBeVisible();
  await expect(page.getByTestId('reveal-name')).toContainText('Silver Vanguard helm');
  await expect(reveal.locator('.reveal-glow')).toBeVisible();
  await expect(reveal.locator('img.reveal-img')).toBeVisible();
  // the item sits in the middle of the screen
  const vp = page.viewportSize()!;
  const box = (await reveal.locator('.reveal-stage').boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(vp.width * 0.06);
  expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(vp.height * 0.2);
  await page.getByTestId('reveal-close').click();
  await expect(reveal).toBeHidden();
  await expect(page.getByTestId('item-helmet-silver-vanguard')).toContainText('Wearing');
});

test('earning the sword by adding and practising a verse shows it once, with a button to wear it', async ({ page }) => {
  await openApp(page);
  await addVerse(page, JOHN316);
  await expect(page.getByTestId('item-reveal')).toHaveCount(0); // adding is not enough
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await finishFlashcard(page);
  await expect(page.getByTestId('item-reveal')).toHaveCount(0); // not in the middle of a review
  await page.goto('/#/');
  // the first review also lit the flame, which earns the shield: one popup each, the shield first
  await expect(page.getByTestId('item-reveal')).toBeVisible();
  await expect(page.getByTestId('reveal-name')).toContainText('shield');
  await page.getByTestId('reveal-close').click();
  await expect(page.getByTestId('reveal-name')).toContainText('sword');
  await page.getByTestId('reveal-wear').click();
  await expect(page.getByTestId('item-reveal')).toBeHidden();
  await page.goto('/#/avatar');
  await page.getByTestId('slot-weapon').click();
  await expect(page.getByTestId('item-weapon-iron-bulwark')).toContainText('Wearing');
  // never again, even after a reload
  await saved(page);
  await page.reload();
  await page.waitForTimeout(400);
  await expect(page.getByTestId('item-reveal')).toHaveCount(0);
});

test('nothing pops up during the tour', async ({ page }) => {
  await openApp(page, '/#/settings');
  await page.getByTestId('take-tour').click();
  await page.getByTestId('tour-lesson-review').click();
  for (const id of ['start-today', 'card-front', 'grade-good']) {
    await expect(page.getByTestId(id)).toBeVisible();
    await page.getByTestId(id).click();
  }
  await page.waitForTimeout(600);
  await expect(page.getByTestId('item-reveal')).toHaveCount(0);
});
