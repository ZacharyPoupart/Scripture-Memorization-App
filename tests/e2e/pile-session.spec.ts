import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, PSALM23_1, ROMANS8_28, finishFlashcard, autoDismissMilestones } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

test('reviewing a whole pile flows verse to verse and updates the schedule', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  for (const v of [JOHN316, PSALM23_1, ROMANS8_28]) await addVerse(page, v);

  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('start-pile')).toContainText('Start · 3 verses');
  await page.getByTestId('start-pile').click();

  const order = [JOHN316, PSALM23_1, ROMANS8_28]; // longest-in-pile first = order added
  for (const [i] of order.entries()) {
    await expect(page.getByTestId('review').locator('.sub')).toHaveText(`Verse ${i + 1} of 3`);
    await finishFlashcard(page);
    await expect(page.getByTestId('verse-result')).toBeVisible();
    // flows on by itself
  }
  await expect(page.getByTestId('session-summary')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('session-summary')).toContainText('3 verses reviewed · 3 counted');
  await page.getByTestId('session-done').click();

  // each Daily verse now needs a 2 hour gap before its 2nd review
  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('status').first()).toContainText('Next review in 2 hr');
  await expect(page.getByTestId('start-pile')).toContainText('Nothing due');
  // …but "all" lets you practise anyway
  await page.getByRole('button', { name: /All \(3\)/ }).click();
  await expect(page.getByTestId('start-pile')).toContainText('Start · 3 verses');
});

test('"today\'s reviews" from Home runs every ready verse in the chosen mode', async ({ page }) => {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, JOHN316);
  await addVerse(page, PSALM23_1);
  await page.goto('/#/');
  await page.getByText('Mode:').click(); // the mode picker is tucked behind a quiet "Mode: …" line
  await page.getByRole('button', { name: 'Type', exact: true }).click();
  await page.getByTestId('start-today').click();
  await expect(page.getByTestId('review')).toHaveAttribute('data-mode', 'type');
  await expect(page.getByTestId('review').locator('.sub')).toHaveText('Verse 1 of 2');
});
