import { test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { autoDismissMilestones, blockLookups, openApp, replaceDataWith } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;
const OUT = process.env.SHOT_DIR!;
test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false, isMobile: false });

async function shot(page: Page, name: string, tall = false) {
  await page.setViewportSize({ width: 390, height: tall ? 1700 : 844 });
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.setViewportSize({ width: 390, height: 844 });
}

async function loaded(page: Page, dark = false) {
  await page.clock.install({ time: new Date(2026, 2, 13, 9, 0) });
  await page.clock.resume();
  await autoDismissMilestones(page);
  await blockLookups(page);
  if (dark) await page.emulateMedia({ colorScheme: 'dark' });
  await openApp(page);
  await page.evaluate(() => (window as any).__mfl.armorFree?.(true));
  await replaceDataWith(page, fixture);
  await page.goto('/#/');
  await page.waitForTimeout(300);
  for (let i = 0; i < 4; i++) {
    if (await page.getByTestId('celebration').isVisible().catch(() => false)) {
      await shot(page, '16-celebration-level-up');
      await page.keyboard.press('Escape');
    } else if (await page.getByTestId('item-reveal').isVisible().catch(() => false)) {
      await shot(page, '16-item-reveal');
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(400);
  }
  await page.getByTestId('toast').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
}

test('first launch', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 2, 13, 9, 0) });
  await page.clock.resume();
  await blockLookups(page);
  await page.goto('/');
  await page.waitForTimeout(800);
  await shot(page, '01-welcome-1');
  for (const n of [2, 3, 4, 5]) {
    await page.getByTestId('onboarding-next').click().catch(() => {});
    await page.waitForTimeout(200);
    await shot(page, `01-welcome-${n}`);
  }
  await page.getByTestId('onboarding-later').click().catch(() => {});
  await page.waitForTimeout(300);
  await shot(page, '02-today-empty');
  await page.goto('/#/stats');
  await shot(page, '03-stats-empty');
  await page.goto('/#/piles');
  await shot(page, '04-piles-empty');
  await page.goto('/#/add');
  await shot(page, '05-add-verse');
  await page.getByTestId('pick-book').click();
  await shot(page, '05-add-verse-book-picker');
  await page.getByTestId('book-option').filter({ hasText: 'John' }).first().click();
  await shot(page, '05-add-verse-chapter-picker');
});

test('with data (light)', async ({ page }) => {
  await loaded(page);
  await shot(page, '10-today');
  await shot(page, '10-today-tall', true);
  await page.goto('/#/piles');
  await shot(page, '11-piles', true);
  await page.goto('/#/pile/daily');
  await shot(page, '12-pile-daily', true);
  await page.goto('/#/pile/weekly');
  await shot(page, '12-pile-weekly');
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').first().click();
  await shot(page, '13-verse-detail', true);
  await page.goto('/#/stats');
  await shot(page, '14-stats', true);
  await page.goto('/#/avatar');
  await shot(page, '15-avatar', true);
  await page.getByTestId('slot-helmet').click();
  await shot(page, '15-avatar-helmet', true);
  await page.getByTestId('seeds-balance').click();
  await shot(page, '15-avatar-coins-guide', true);
  await page.goto('/#/settings');
  await shot(page, '17-settings', true);
  await page.goto('/#/about');
  await shot(page, '18-about');
  await page.goto('/#/friends');
  await shot(page, '19-friends-off');
  await page.getByTestId('friends-name').fill('Sam L.');
  await page.getByTestId('friends-on').click();
  await page.waitForTimeout(500);
  await shot(page, '19-friends-on', true);
  await page.getByTestId('friends-tab-groups').click();
  await shot(page, '19-friends-groups', true);
});

test('reviews (light)', async ({ page }) => {
  await loaded(page);
  await page.goto('/#/review?today=1&mode=flashcard');
  await page.waitForTimeout(400);
  await shot(page, '20-review-flashcard-front');
  await page.getByTestId('card-front').click();
  await shot(page, '20-review-flashcard-back');
  await page.getByTestId('switch-mode').click();
  await shot(page, '20-review-type-sheet');
  await page.getByTestId('switch-to-blanks').click();
  await shot(page, '21-review-blanks');
  await page.getByTestId('option').first().click();
  await shot(page, '21-review-blanks-after-pick');
  await page.getByTestId('switch-mode').click();
  await page.getByTestId('switch-to-type').click();
  await shot(page, '22-review-type-it');
  await page.getByTestId('switch-mode').click();
  await page.getByTestId('switch-to-speak').click();
  await shot(page, '23-review-speak');
  await page.getByTestId('switch-mode').click();
  await page.getByTestId('switch-to-flashcard').click();
  for (let i = 0; i < 40 && !(await page.getByTestId('session-summary').isVisible()); i++) {
    if (await page.getByTestId('card-front').isVisible()) {
      await page.getByTestId('card-front').click();
      await page.getByTestId('grade-good').click();
      if (i === 0) await shot(page, '24-review-result-card');
      await page.getByTestId('verse-result').click().catch(() => {});
    } else await page.waitForTimeout(100);
    if (i === 2) {
      await page.getByTestId('close-review').click();
      break;
    }
  }
  await page.waitForTimeout(5500);
  await shot(page, '25-session-summary');
  await page.getByTestId('session-done').click().catch(() => {});
  await page.goto('/#/settings');
  await page.getByTestId('take-tour').click();
  await page.waitForTimeout(600);
  await shot(page, '26-tour-step');
});

test('dark mode', async ({ page }) => {
  await loaded(page, true);
  await shot(page, '30-dark-today');
  await page.goto('/#/piles');
  await shot(page, '30-dark-piles', true);
  await page.goto('/#/stats');
  await shot(page, '30-dark-stats', true);
  await page.goto('/#/avatar');
  await shot(page, '30-dark-avatar', true);
  await page.goto('/#/settings');
  await shot(page, '30-dark-settings', true);
  await page.goto('/#/review?today=1&mode=flashcard');
  await page.waitForTimeout(400);
  await shot(page, '30-dark-review');
});
