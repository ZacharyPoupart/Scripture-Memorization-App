import { expect, test } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, installFakeSpeech, JOHN316, JOHN_TEXT, openApp } from './helpers';

test('Speak it works again after Try again and for a second verse, without a refresh', async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await installFakeSpeech(page, JOHN_TEXT.replace(/[,.;]/g, '').toLowerCase());
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').first().click();
  await page.getByTestId('review-speak').click();
  for (let round = 0; round < 3; round++) {
    await page.getByTestId('speak-start').click(); // straight after the last one closed, like a phone that is slow to let go
    await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible();
    await page.waitForTimeout(400);
    await page.getByTestId('speak-done').click();
    await expect(page.getByTestId('speak-result')).toContainText('Perfect');
    await expect(page.getByRole('alert')).toHaveCount(0);
    if (round < 2) await page.getByRole('button', { name: 'Try again' }).click();
  }
});
