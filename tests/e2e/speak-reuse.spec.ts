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

test('Speak it says so when nothing was heard, and shows what it did hear when it was far off', async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await installFakeSpeech(page, '');
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').first().click();
  await page.getByTestId('review-speak').click();
  await page.getByTestId('speak-start').click();
  await page.waitForTimeout(400);
  await page.getByTestId('speak-done').click();
  await expect(page.getByTestId('speak-nothing-heard')).toContainText('Nothing was heard');
  await page.getByRole('button', { name: 'Try again' }).click();

  await page.evaluate(() => {
    // now a recognizer that hears something unrelated
    const Fake = (window as any).SpeechRecognition;
    (window as any).SpeechRecognition = class extends Fake {
      start() {
        super.start();
        setTimeout(() => (this as any).onresult?.({ resultIndex: 0, results: [{ 0: { transcript: 'banana bread is tasty' }, isFinal: true, length: 1 }] }), 80);
      }
    };
  });
  await page.getByTestId('speak-start').click();
  await page.waitForTimeout(500);
  await page.getByTestId('speak-done').click();
  await expect(page.getByTestId('speak-heard')).toContainText('banana bread is tasty');
  await expect(page.getByTestId('speak-nothing-heard')).toHaveCount(0);
});

test('Speak it recovers by itself when the phone starts a later listener without giving it the microphone', async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await installFakeSpeech(page, JOHN_TEXT.replace(/[,.;]/g, '').toLowerCase());
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').first().click();
  await page.getByTestId('review-speak').click();
  // first verse: works
  await page.getByTestId('speak-start').click();
  await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByTestId('speak-done').click();
  await expect(page.getByTestId('speak-result')).toContainText('Perfect');
  // the next listener is deaf (no start, no audio, no words, no error), the one after it works
  await page.evaluate(() => ((window as any).__speechDeafStarts = 1));
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByTestId('speak-start').click();
  await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(400);
  await page.getByTestId('speak-done').click();
  await expect(page.getByTestId('speak-result')).toContainText('Perfect');
  await expect(page.getByTestId('speak-nothing-heard')).toHaveCount(0);
});

test('Speak it recovers when the microphone opens but hears nothing, and offers a restart by tap while it waits', async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
  await installFakeSpeech(page, JOHN_TEXT.replace(/[,.;]/g, '').toLowerCase());
  await openApp(page);
  await addVerse(page, JOHN316);
  await page.goto('/#/pile/daily');
  await page.getByTestId('verse-card').first().click();
  await page.getByTestId('review-speak').click();
  // the microphone opens (start and audio events) and then nothing is heard, once: a fresh listener takes over by itself
  await page.evaluate(() => ((window as any).__speechMuteStarts = 1));
  await page.getByTestId('speak-start').click();
  await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(300);
  await page.getByTestId('speak-done').click();
  await expect(page.getByTestId('speak-result')).toContainText('Perfect');
  // every listener is mute: after a while the screen offers a restart made by a tap, and that one works
  await page.evaluate(() => ((window as any).__speechMuteStarts = 3));
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByTestId('speak-start').click();
  await expect(page.getByTestId('speak-quiet')).toBeVisible({ timeout: 12000 });
  await page.evaluate(() => ((window as any).__speechMuteStarts = 0));
  await page.getByTestId('speak-restart').click();
  await expect(page.getByTestId('speak-text').locator('.w.ok').first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('speak-quiet')).toHaveCount(0);
});
