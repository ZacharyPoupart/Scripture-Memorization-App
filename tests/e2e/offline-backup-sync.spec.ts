import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, blockLookups, JOHN316, openApp, pickRef, PSALM23_1, finishFlashcard, autoDismissMilestones } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

test.describe('offline', () => {
  test('installs, then works with no connection at all', async ({ page, context }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    // wait until the service worker has cached the app, then reload so it controls the page
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) throw new Error('no active service worker');
    });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('verse-card')).toHaveCount(1); // app shell and data both load offline

    // full review while offline
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').click();
    await page.getByTestId('review-flashcard').click();
    await finishFlashcard(page);
    await expect(page.getByTestId('verse-result')).toContainText('Review counted');

    // adding a verse offline: lookup is skipped politely, manual text works
    await page.goto('/#/add');
    await pickRef(page, { book: 19, chapter: 23, start: 1 });
    await expect(page.getByTestId('lookup-status')).toContainText('Offline');
    await page.getByTestId('text').fill(PSALM23_1.text);
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('verse-card')).toHaveCount(2);

    // still there after another offline reload
    await page.reload();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
    await context.setOffline(false);
  });
});

test.describe('backup and restore', () => {
  test('export, wipe, import (merge and replace), and bad files are rejected', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, { ...JOHN316, topic: 'Gospel' });
    await addVerse(page, PSALM23_1);
    await page.goto('/#/settings');

    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
    expect(download.suggestedFilename()).toMatch(/^memorize-for-life-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const file = JSON.parse(readFileSync(path!, 'utf8'));
    expect(file.app).toBe('memorize-for-life');
    expect(Object.keys(file.data.verses)).toHaveLength(2);

    // wipe
    await page.getByRole('button', { name: 'Erase all data on this device' }).click();
    await page.getByRole('textbox').last().fill('ERASE');
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await page.goto('/#/');
    await expect(page.getByTestId('empty-home')).toBeVisible();

    // restore from the exported file
    await page.goto('/#/settings');
    await page.getByTestId('import-file').setInputFiles(path!);
    await expect(page.getByTestId('import-dialog')).toContainText('2 verses');
    await page.getByTestId('import-merge').click();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
    await expect(page.getByTestId('verse-card').getByText('#Gospel')).toBeVisible(); // on the verse card itself (the page now also has topic filter chips)

    // importing again merges: no duplicates
    await page.goto('/#/settings');
    await page.getByTestId('import-file').setInputFiles(path!);
    await page.getByTestId('import-merge').click();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(2);

    // survives a reload
    await page.reload();
    await expect(page.getByTestId('verse-card')).toHaveCount(2);

    // junk files are refused with a clear message and change nothing
    await page.goto('/#/settings');
    await page.getByTestId('import-file').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') });
    await expect(page.getByTestId('import-error')).toContainText('not a Memorize For Life backup');
    await page.getByTestId('import-file').setInputFiles({ name: 'y.json', mimeType: 'application/json', buffer: Buffer.from('definitely not json') });
    await expect(page.getByTestId('import-error')).toContainText('could not be read');
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
  });
});

test.describe('sync between devices', () => {
  test('a phone and a computer link with a code and merge changes from both', async ({ browser }) => {
    const phone = await (await browser.newContext()).newPage();
    const computer = await (await browser.newContext()).newPage();
    await autoDismissMilestones(phone);
    await autoDismissMilestones(computer);
    for (const p of [phone, computer]) await blockLookups(p);

    await openApp(phone);
    await addVerse(phone, JOHN316);
    await phone.goto('/#/settings');
    await phone.getByTestId('sync-enable').click();
    await expect(phone.getByTestId('sync-status')).toContainText('Last synced', { timeout: 10000 });
    // the code is revealed right after turning sync on, so it can be copied to the other device
    const code = (await phone.getByTestId('sync-code').textContent())!.trim();
    expect(code).toMatch(/^([0-9A-Z]{5}-){3}[0-9A-Z]{5}$/);

    await openApp(computer);
    await addVerse(computer, PSALM23_1); // made independently, before linking
    await computer.goto('/#/settings');
    await computer.getByTestId('sync-link').click();
    await computer.getByTestId('sync-code-input').fill(code.toLowerCase());
    await computer.getByTestId('sync-link-go').click();
    await expect(computer.getByTestId('sync-status')).toContainText('Last synced', { timeout: 10000 });
    await computer.goto('/#/pile/daily');
    await expect(computer.getByTestId('verse-card')).toHaveCount(2); // both verses merged

    await phone.goto('/#/settings');
    await phone.getByTestId('sync-now').click();
    await expect(phone.getByTestId('sync-status')).toContainText('Last synced');
    await phone.goto('/#/pile/daily');
    await expect(phone.getByTestId('verse-card')).toHaveCount(2);

    // a review on the computer shows up on the phone
    await computer.getByTestId('verse-card').first().click();
    await computer.getByTestId('review-flashcard').click();
    await finishFlashcard(computer);
    await expect(computer.getByTestId('verse-result')).toBeVisible();
    await computer.goto('/#/settings');
    await computer.getByTestId('sync-now').click();
    await expect(computer.getByTestId('sync-status')).toContainText('Last synced');
    await phone.goto('/#/settings');
    await phone.getByTestId('sync-now').click();
    await expect(phone.getByTestId('sync-status')).toContainText('Last synced');
    await phone.goto('/#/pile/daily');
    await expect(phone.getByTestId('verse-card').first().getByTestId('status')).toContainText('Next review in');

    // a malformed code is rejected without damaging anything
    await phone.goto('/#/settings');
    await phone.getByRole('button', { name: 'Turn off' }).click();
    await phone.getByRole('button', { name: 'Turn off' }).last().click();
    await phone.getByTestId('sync-link').click();
    await phone.getByTestId('sync-code-input').fill('too short');
    await phone.getByTestId('sync-link-go').click();
    await expect(phone.getByText("That code doesn't look right")).toBeVisible();
    await phone.goto('/#/pile/daily');
    await expect(phone.getByTestId('verse-card')).toHaveCount(2);
  });
});
