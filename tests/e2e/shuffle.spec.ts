import { expect, test, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, PSALM23_1, ROMANS8_28, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  for (const v of [JOHN316, PSALM23_1, ROMANS8_28]) await addVerse(page, v);
});

/** Go through a whole flashcard session on all of Daily (extra practice, so it can be repeated) and say which verses came, in order. */
async function visitAll(page: Page): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('card-front')).toBeVisible();
    seen.push((await page.locator('[data-testid=card-front] .prompt-ref').innerText()).trim());
    await finishFlashcard(page);
    await page.getByTestId('verse-result').click();
  }
  await expect(page.getByTestId('session-summary')).toBeVisible();
  return seen;
}

test.describe('shuffle', () => {
  test('a small shuffle button sits beside the review type bar, and is remembered', async ({ page }) => {
    await page.goto('/#/');
    const bar = await page.getByRole('group', { name: 'Review mode' }).boundingBox();
    const btn = page.getByTestId('shuffle-toggle');
    const box = await btn.boundingBox();
    expect(box!.x).toBeGreaterThan(bar!.x + bar!.width - 1); // to the right of the bar...
    expect(Math.abs(box!.y + box!.height / 2 - (bar!.y + bar!.height / 2))).toBeLessThan(8); // ...on the same line
    expect(Math.min(box!.width, box!.height)).toBeGreaterThanOrEqual(44); // easy to tap
    await expect(btn).toHaveAttribute('aria-pressed', 'false');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('shuffle-toggle')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('shuffle-toggle').click();
    await expect(page.getByTestId('shuffle-toggle')).toHaveAttribute('aria-pressed', 'false');
  });

  test('with shuffle on a session visits every verse exactly once in a different order; off, the order is the usual one', async ({ page }) => {
    const url = '/#/review?pile=daily&scope=all&mode=flashcard';
    await page.goto(url);
    const usual = await visitAll(page);
    expect([...usual].sort()).toEqual(['John 3:16', 'Psalms 23:1', 'Romans 8:28'].sort());

    await page.goto('/#/');
    await page.getByTestId('shuffle-toggle').click();
    await page.evaluate(() => {
      (window as any).__realRandom = Math.random;
      Math.random = () => 0; // a known shuffle: [a, b, c] becomes [b, c, a]
    });
    await page.goto(url);
    const shuffledOrder = await visitAll(page);
    await page.evaluate(() => (Math.random = (window as any).__realRandom));
    expect(shuffledOrder).toEqual([usual[1], usual[2], usual[0]]);

    // and switched off again, the usual order is back
    await page.goto('/#/');
    await page.getByTestId('shuffle-toggle').click();
    await page.goto(url);
    expect(await visitAll(page)).toEqual(usual);
  });

  test('one chosen verse is still one verse', async ({ page }) => {
    await page.goto('/#/');
    await page.getByTestId('shuffle-toggle').click();
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    await page.getByTestId('review-flashcard').click();
    await expect(page.getByTestId('review')).toContainText('Verse 1 of 1');
  });

  const url = '/#/review?pile=daily&scope=all&mode=flashcard';
  /** One counted review of John 3:16 (the first in the usual order), then back out. */
  async function reviewJohnOnce(page: Page) {
    await page.goto(url);
    await expect(page.getByTestId('card-front')).toBeVisible();
    await expect(page.locator('[data-testid=card-front] .prompt-ref')).toHaveText('John 3:16');
    await finishFlashcard(page);
    await page.getByTestId('verse-result').click();
    await page.getByTestId('close-review').click();
  }

  test('Review all starts with the verses not reviewed today, then the ones that were', async ({ page }) => {
    await reviewJohnOnce(page);
    await page.goto(url);
    expect(await visitAll(page)).toEqual(['Psalms 23:1', 'Romans 8:28', 'John 3:16']);
  });

  test('with shuffle on, Review all still ends with the ones already reviewed today', async ({ page }) => {
    await reviewJohnOnce(page);
    await page.goto('/#/');
    await page.getByTestId('shuffle-toggle').click();
    await page.evaluate(() => {
      (window as any).__realRandom = Math.random;
      Math.random = () => 0; // a known shuffle: [a, b] becomes [b, a]
    });
    await page.goto(url);
    const order = await visitAll(page);
    await page.evaluate(() => (Math.random = (window as any).__realRandom));
    expect(order).toEqual(['Romans 8:28', 'Psalms 23:1', 'John 3:16']);
  });
});
