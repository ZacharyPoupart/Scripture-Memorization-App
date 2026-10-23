import { expect, test, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

const stepId = (page: Page) => page.getByTestId('tour').getAttribute('data-step');
const realData = (page: Page) => page.evaluate(() => structuredClone((window as any).__mfl.getState().data));

/** From the first-run welcome to the first step of the tour. */
async function startFromWelcome(page: Page) {
  await page.goto('/');
  for (let i = 0; i < 4; i++) await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-next').click(); // "Take the tour"
  await expect(page.getByTestId('tour-card')).toBeVisible();
}

/** Does what each step asks (tapping where it says to) until the tour ends. Returns the step ids it saw. */
async function walk(page: Page, until?: string): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < 60; i++) {
    const card = page.getByTestId('tour-card');
    if (!(await card.isVisible().catch(() => false))) {
      await page.waitForTimeout(150);
      if (!(await card.isVisible().catch(() => false))) break;
    }
    const id = (await stepId(page))!;
    if (until && id === until) return seen;
    if (seen[seen.length - 1] !== id) seen.push(id);
    const act: Record<string, string> = {
      start: 'start-today',
      flip: 'card-front',
      grade: 'grade-good',
      close: 'close-review',
      sandwich: 'practice-preset-sandwich',
    };
    if (act[id]) {
      await expect(page.getByTestId(act[id])).toBeVisible();
      await page.getByTestId(act[id]).click();
    } else await page.getByTestId('tour-next').click();
    await expect(async () => expect(await stepId(page).catch(() => null)).not.toBe(id)).toPass({ timeout: 8000 }).catch(() => {});
  }
  return seen;
}

test('first run: the welcome leads into the tour, every lesson can be walked, and finishing earns the shield', async ({ page }) => {
  await startFromWelcome(page);
  expect(await stepId(page)).toBe('welcome');
  const seen = await walk(page, 'done');
  for (const id of ['welcome', 'start', 'flip', 'grade', 'type-try', 'sandwich', 'sim', 'break', 'sword', 'shield', 'backup']) expect(seen, id).toContain(id);
  expect(await stepId(page)).toBe('done');
  await page.getByTestId('tour-next').click(); // Finish
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await expect(page.getByTestId('toast')).toContainText('Shield of Faith');
  const data = await realData(page);
  expect(data.tourAt).toBeGreaterThan(0);
  expect(Object.keys(data.verses)).toHaveLength(0); // the practice verses are gone and nothing of them was saved
  expect(data.reviewsByDevice).toEqual({});
  // remembered across a reload, and the welcome does not come back
  await page.evaluate(() => (window as any).__mfl.flush());
  await page.reload();
  await expect(page.getByTestId('onboarding')).toBeHidden();
  expect((await realData(page)).tourAt).toBeGreaterThan(0);
});

test('"Not now" skips the tour, and Settings can open it any time', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 4; i++) await page.getByTestId('onboarding-next').click();
  await page.getByTestId('onboarding-later').click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await page.goto('/#/settings');
  await page.getByTestId('take-tour').click();
  await expect(page.getByTestId('tour-menu')).toBeVisible();
  await page.getByTestId('tour-lesson-streak').click();
  await expect(page.getByTestId('tour-card')).toBeVisible();
  expect(await stepId(page)).toBe('flame');
});

test('your own verses are untouched by the tour, and nothing done in it is saved', async ({ page }) => {
  await openApp(page);
  await addVerse(page, JOHN316);
  const before = await realData(page);
  await page.goto('/#/settings');
  await page.getByTestId('take-tour').click();
  await page.getByTestId('tour-lesson-review').click();
  await walk(page, 'counted'); // does a real review on the practice verses
  expect(await page.getByTestId('seeds-chip').count()).toBe(0);
  await page.getByTestId('tour-lessons').click();
  await page.getByTestId('tour-exit').click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  const after = await realData(page);
  expect(Object.keys(after.verses)).toEqual(Object.keys(before.verses));
  expect(after.reviewsByDevice).toEqual(before.reviewsByDevice);
  expect(after.tourAt).toBeUndefined(); // leaving early earns nothing
  // a reload mid tour also brings back only the real data
  await page.goto('/#/settings');
  await page.getByTestId('take-tour').click();
  await page.getByTestId('tour-lesson-basics').click();
  await page.evaluate(() => (window as any).__mfl.flush());
  await page.reload();
  await page.waitForTimeout(300);
  expect(Object.keys((await realData(page)).verses)).toEqual(Object.keys(before.verses));
});

test('the simulator uses the real rules: a Daily verse moves up after a reviewed week', async ({ page }) => {
  await openApp(page);
  await page.goto('/#/settings');
  await page.getByTestId('take-tour').click();
  await page.getByTestId('tour-lesson-piles').click();
  while ((await stepId(page)) !== 'sim') await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('sim-progress')).toHaveText('Day 84 of 90');
  await page.getByTestId('sim-skip').click();
  await expect(page.getByTestId('sim-progress')).toHaveText('Day 84 of 90'); // a skipped week earns nothing
  await page.getByTestId('sim-week').click();
  await expect(page.getByTestId('sim-log')).toContainText('Moved up to Weekly');
  await expect(page.getByTestId('sim-progress')).toContainText('Week');
  await page.getByTestId('sim-reset').click();
  await expect(page.getByTestId('sim-progress')).toHaveText('Day 84 of 90');
});

test('the card stays on screen at every step (no sideways scrolling, nothing cut off)', async ({ page }) => {
  await startFromWelcome(page);
  const vp = page.viewportSize()!;
  for (let i = 0; i < 60; i++) {
    const card = page.getByTestId('tour-card');
    if (!(await card.isVisible().catch(() => false))) break;
    const id = (await stepId(page))!;
    const box = (await card.boundingBox())!;
    expect(box.x, id).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, id).toBeLessThanOrEqual(vp.width + 0.5);
    expect(box.y, id).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, id).toBeLessThanOrEqual(vp.height + 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), id).toBe(true);
    const skip = page.getByTestId('tour-skip-step');
    if (await skip.isVisible().catch(() => false)) await skip.click();
    else await page.getByTestId('tour-next').click();
    await page.waitForTimeout(120);
  }
});

test('the sword comes from adding a verse AND practising it', async ({ page }) => {
  await openApp(page);
  await page.goto('/#/avatar');
  await page.getByTestId('slot-weapon').click();
  await expect(page.getByTestId('item-weapon-iron-bulwark')).toContainText('first practice');
  await addVerse(page, JOHN316);
  await page.goto('/#/avatar');
  await page.getByTestId('slot-weapon').click();
  await expect(page.getByTestId('item-weapon-iron-bulwark')).toContainText('first practice'); // added, not yet practised
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').click();
  await page.getByTestId('review-flashcard').click();
  await finishFlashcard(page);
  await page.goto('/#/avatar');
  await page.getByTestId('slot-weapon').click();
  await expect(page.getByTestId('item-weapon-iron-bulwark')).not.toContainText('first practice');
});
