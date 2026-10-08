import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { autoDismissMilestones, addVerse, blockLookups, JOHN316, localDay, openApp, replaceDataWith, finishFlashcard } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;
const TODAY = [2026, 2, 10]; // 10 March 2026 (months are 0-based)

/** App data for "a verse in Daily for 8 days; the last 6 days all done; 2 of today's 3 reviews already done". */
async function sixDayStreakWithOneReviewLeft(page: Page) {
  const data = await page.evaluate(() => structuredClone((window as any).__mfl.getState().data));
  const day = (n: number) => localDay(TODAY[0], TODAY[1], TODAY[2] + n);
  const v = Object.values<any>(data.verses)[0];
  v.pileSince = day(-8);
  v.addedDay = day(-8);
  data.createdDay = day(-8);
  data.settledThrough = day(-1);
  data.ledger = {};
  v.reviews = [];
  for (let n = -6; n <= -1; n++) {
    data.ledger[day(n)] = { r: 1, o: 'c' };
    for (const h of [8, 11, 14]) v.reviews.push(new Date(TODAY[0], TODAY[1], TODAY[2] + n, h).getTime());
  }
  data.ledger[day(-8)] = { o: 'n' };
  data.ledger[day(-7)] = { r: 1, o: 'm' }; // an earlier day that wasn't finished: it just isn't part of the streak
  for (const [h, m] of [[8, 0], [10, 30]]) v.reviews.push(new Date(TODAY[0], TODAY[1], TODAY[2], h, m).getTime());
  data.ledger[day(0)] = { r: 1 };
  await replaceDataWith(page, data);
}

async function finishOneFlashcard(page: Page) {
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await finishFlashcard(page);
  await expect(page.getByTestId('verse-result')).toBeVisible();
}

test.describe('stats screen', () => {
  test('friendly empty state', async ({ page }) => {
    await blockLookups(page);
    await openApp(page, '/#/stats');
    await expect(page.getByTestId('stats-empty')).toBeVisible();
  });

  test('shows streaks, calendar heatmap, pile counts and what is nearly there for existing data', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 2, 15, 9, 0) });
    await page.clock.resume();
    await blockLookups(page);
    await openApp(page);
    await replaceDataWith(page, fixture);
    await page.goto('/#/stats');
    await expect(page.getByTestId('stat-longest')).toContainText('37');
    await expect(page.getByTestId('stat-reviews')).toContainText('828');
    await expect(page.getByTestId('stat-verses')).toContainText('4');
    await expect(page.getByTestId('heatmap').locator('.cell')).toHaveCount(26 * 7);
    expect(await page.getByTestId('heatmap').locator('.cell.k-complete').count()).toBeGreaterThan(50);
    await expect(page.getByTestId('heat-summary')).toContainText(/days with everything done/); // screen-reader summary
    await expect(page.getByTestId('pile-stat-daily')).toContainText('2');
    await expect(page.getByTestId('pile-stat-yearly')).toContainText('1');
    await expect(page.getByTestId('nearly').first()).toContainText('days to');
    expect(await page.getByTestId('run').count()).toBeGreaterThan(0);
    // reachable from Home via the streak chip and via the tab bar
    await page.goto('/#/');
    // the fixture contains a recorded level-up; its celebration is shown once, then dismissed
    if (await page.getByTestId('celebration').isVisible()) await page.getByTestId('celebration-close').click();
    await page.getByTestId('streak').click();
    await expect(page.getByRole('heading', { name: 'Progress' })).toBeVisible();
    await page.getByRole('link', { name: 'Today' }).click();
    await page.getByRole('link', { name: 'Stats' }).click();
    await expect(page.getByTestId('stats')).toBeVisible();
  });
});

test.describe('feedback and celebrations', () => {
  test('finishing the last review of the day: result card, all-done moment, then a quiet streak milestone', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 2, 10, 13, 0) });
    await page.clock.resume();
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await sixDayStreakWithOneReviewLeft(page);
    await page.goto('/#/');
    // since v1.5.2 one review keeps the streak, so the 7-day milestone arrives as soon as today's
    // first reviews are in (they already are in this fixture): a quiet card, no confetti
    await expect(page.getByTestId('milestone')).toBeVisible();
    await expect(page.getByTestId('milestone')).toContainText('A full week');
    await expect(page.locator('.confetti')).toHaveCount(0);
    await page.getByTestId('milestone-close').click();
    await expect(page.getByTestId('milestone')).toBeHidden();
    await finishOneFlashcard(page);
    await expect(page.getByTestId('verse-result')).toContainText('Review counted');
    await expect(page.getByTestId('result-progress')).toContainText('days toward Weekly');
    await expect(page.getByTestId('verse-result')).toContainText('everything for today');
    await expect(page.getByTestId('session-summary')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('all-done')).toContainText('All done for today');
    await expect(page.getByTestId('all-done')).toContainText('Streak: 7 days');
    await page.getByTestId('session-done').click();
    await expect(page.getByTestId('milestone')).toBeHidden(); // already celebrated once
    await expect(page.locator('.ring.done')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('milestone')).toBeHidden(); // celebrated once
  });

  for (const mode of ['full', 'calm'] as const) {
    test(`a verse moving up: ${mode === 'full' ? 'confetti in Full mode' : 'Calm mode keeps it quiet'}`, async ({ page }) => {
      await page.clock.install({ time: new Date(2026, 2, 10, 13, 0) });
      await page.clock.resume();
      await blockLookups(page);
      await openApp(page);
      await page.goto('/#/settings');
      await page.getByRole('button', { name: mode === 'full' ? 'Full' : 'Calm', exact: true }).click();
      await addVerse(page, JOHN316);
      const data = await page.evaluate(() => structuredClone((window as any).__mfl.getState().data));
      const day = (n: number) => localDay(2026, 2, 10 + n);
      const v = Object.values<any>(data.verses)[0];
      v.pileSince = day(-90);
      v.addedDay = day(-90);
      data.createdDay = day(-90);
      data.settledThrough = day(-91);
      data.ledger = {};
      v.reviews = [];
      for (let n = -89; n < 0; n++) for (const h of [8, 11, 14]) v.reviews.push(new Date(2026, 2, 10 + n, h).getTime());
      await replaceDataWith(page, data);
      await page.goto('/#/');
      await expect(page.getByTestId('celebration')).toBeVisible();
      await expect(page.locator('.confetti')).toHaveCount(mode === 'full' ? 1 : 0);
      await page.getByTestId('celebration-close').click();
      await expect(page.getByTestId('celebration')).toBeHidden();
    });
  }

  test('sound and vibration are off by default and only used when switched on', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__audio = 0;
      (window as any).__vibes = 0;
      (window as any).AudioContext = class {
        currentTime = 0;
        destination = {};
        constructor() {
          (window as any).__audio++;
        }
        createOscillator() {
          return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
        }
        createGain() {
          return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
        }
        resume() {
          return Promise.resolve();
        }
      };
      navigator.vibrate = () => ((window as any).__vibes++, true);
    });
    await autoDismissMilestones(page);
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await finishOneFlashcard(page);
    expect(await page.evaluate(() => [(window as any).__audio, (window as any).__vibes])).toEqual([0, 0]);

    await page.goto('/#/settings');
    await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('toggle-haptics')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('toggle-sound').click();
    await page.getByTestId('toggle-haptics').click();
    await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-checked', 'true');
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-checked', 'true'); // remembered
    const before = await page.evaluate(() => [(window as any).__audio, (window as any).__vibes]);
    await finishOneFlashcard(page);
    const after = await page.evaluate(() => [(window as any).__audio, (window as any).__vibes]);
    expect(after[0]).toBeGreaterThan(0);
    expect(after[1]).toBeGreaterThan(before[1]);
    // and off again
    await page.goto('/#/settings');
    await page.getByTestId('toggle-sound').click();
    await page.getByTestId('toggle-haptics').click();
    await expect(page.getByTestId('toggle-sound')).toHaveAttribute('aria-checked', 'false');
  });

  test('vibration switch explains itself where the device cannot vibrate (iPhone web apps)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true });
    });
    await blockLookups(page);
    await openApp(page, '/#/settings');
    await expect(page.getByTestId('toggle-haptics')).toBeDisabled();
    await expect(page.getByTestId('feedback-card')).toContainText('iPhone web apps can’t vibrate');
  });

  test('wording stays kind: a long break and a freeze never scold', async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 2, 10, 8, 0) });
    await page.clock.resume();
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.clock.setSystemTime(new Date(2026, 2, 16, 9, 0));
    await page.reload();
    await page.goto('/#/');
    await expect(page.getByTestId('freeze-banner')).toBeVisible();
    const guilt = /you (missed|failed|lost|let)|streak (lost|broken|ruined)|behind|shame|disappoint|don['’]t give up|last chance|hurry/i;
    for (const route of ['/#/', '/#/stats', '/#/piles', '/#/settings']) {
      await page.goto(route);
      expect(await page.locator('main').innerText(), route).not.toMatch(guilt);
    }
  });
});

async function saved(page: Page) {
  await page.evaluate(() => (window as any).__mfl.flush());
}
