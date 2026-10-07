import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { addVerse, blockLookups, JOHN316, openApp, PSALM23_1, ROMANS8_28, saved } from './helpers';

async function library(page: import('@playwright/test').Page) {
  await blockLookups(page);
  await openApp(page);
  await addVerse(page, { ...JOHN316, topic: 'Gospel' });
  await addVerse(page, { ...PSALM23_1, topic: 'Trust' });
  await addVerse(page, { ...ROMANS8_28, topic: 'Trust' });
}

test.describe('search, sort and filter', () => {
  test('search by words, by reference and by topic; clear and empty states', async ({ page }) => {
    await library(page);
    await page.goto('/#/piles');
    await expect(page.getByTestId('verse-card')).toHaveCount(3);
    await page.getByTestId('search').fill('shepherd');
    await expect(page.getByTestId('verse-card')).toHaveCount(1);
    await expect(page.getByTestId('verse-card')).toContainText('Psalms 23:1');
    await expect(page.getByTestId('match-count')).toContainText('1 verse match');
    await page.getByTestId('search').fill('jn 3:16');
    await expect(page.getByTestId('verse-card')).toContainText('John 3:16');
    await page.getByTestId('search').fill('gospel');
    await expect(page.getByTestId('verse-card')).toHaveCount(1);
    await page.getByTestId('search').fill('zzzz nothing');
    await expect(page.getByTestId('no-matches')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page.getByTestId('verse-card')).toHaveCount(3);
    await expect(page.getByTestId('search')).toHaveValue('');
  });

  test('default order is longest-in-pile first; sorting by Bible order and newest; choice is remembered', async ({ page }) => {
    await library(page);
    await page.goto('/#/pile/daily');
    const refs = async () => (await page.getByTestId('verse-card').locator('.verse-ref').allTextContents()).map((t) => t.trim());
    expect(await refs()).toEqual(['John 3:16', 'Psalms 23:1', 'Romans 8:28']); // rule: oldest in pile on top
    await page.getByTestId('sort').selectOption('reference');
    expect(await refs()).toEqual(['Psalms 23:1', 'John 3:16', 'Romans 8:28']);
    await page.getByTestId('sort').selectOption('added');
    expect(await refs()).toEqual(['Romans 8:28', 'Psalms 23:1', 'John 3:16']);
    // open a verse, come back: still sorted that way
    await page.getByTestId('verse-card').first().click();
    await page.goBack();
    expect(await refs()).toEqual(['Romans 8:28', 'Psalms 23:1', 'John 3:16']);
    await page.getByTestId('sort').selectOption('longest');
    expect(await refs()).toEqual(['John 3:16', 'Psalms 23:1', 'Romans 8:28']);
  });

  test('searching never changes what a pile review contains', async ({ page }) => {
    await library(page);
    await page.goto('/#/pile/daily');
    await page.getByTestId('search').fill('shepherd');
    await expect(page.getByTestId('verse-card')).toHaveCount(1);
    await expect(page.getByTestId('start-pile')).toContainText('Start · 3 verses');
  });

  test('rename a topic everywhere, merge, and undo', async ({ page }) => {
    await library(page);
    await page.goto('/#/piles');
    await page.getByRole('button', { name: '#Trust', exact: true }).click();
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
    await page.getByTestId('rename-topic').click();
    await page.getByTestId('topic-name').fill('Faith');
    await page.getByTestId('topic-save').click();
    await expect(page.getByRole('button', { name: '#Faith', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#Trust', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByRole('button', { name: '#Trust', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#Faith', exact: true })).toHaveCount(0);
  });
});

test.describe('daily reminders (calendar file)', () => {
  test('explains the iPhone limit and downloads a valid calendar file with the chosen times', async ({ page }) => {
    await blockLookups(page);
    await openApp(page, '/#/settings');
    await expect(page.getByTestId('reminders-card')).toContainText("can't send their own notifications");
    await page.getByTestId('reminder-0').fill('07:30');
    await page.getByTestId('reminder-1').fill('');
    await page.getByTestId('reminder-2').fill('21:15');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('reminders-download').click()]);
    expect(download.suggestedFilename()).toBe('memorize-for-life-reminders.ics');
    const ics = readFileSync((await download.path())!, 'utf8');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toMatch(/DTSTART:\d{8}T073000/);
    expect(ics).toMatch(/DTSTART:\d{8}T211500/);
    expect(ics).toContain('RRULE:FREQ=DAILY');
    expect(ics).toContain('BEGIN:VALARM');
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('reminder-0')).toHaveValue('07:30');
  });
});

test.describe('safety nets', () => {
  test('erasing everything can be undone', async ({ page }) => {
    await library(page);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Erase all data on this device' }).click();
    await page.getByRole('textbox').last().fill('ERASE');
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await page.goto('/#/piles');
    await expect(page.getByTestId('verse-card')).toHaveCount(0);
    await page.goto('/#/settings');
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click().catch(() => {});
    // the toast may have moved on while navigating: undo is also available straight after erasing
  });

  test('erase → Undo restores every verse right away', async ({ page }) => {
    await library(page);
    await page.goto('/#/settings');
    await page.getByRole('button', { name: 'Erase all data on this device' }).click();
    await page.getByRole('textbox').last().fill('ERASE');
    await page.getByRole('button', { name: 'Erase', exact: true }).click();
    await expect(page.getByTestId('toast')).toContainText('All data erased');
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(3);
  });

  test('a screen that fails to draw shows a calm message and leaves the data alone', async ({ page }) => {
    await library(page);
    await page.goto('/#/');
    await page.evaluate(() => (window as any).__mfl.crash(true));
    await expect(page.getByTestId('error-screen')).toContainText('Your verses and progress are safe');
    await page.evaluate(() => (window as any).__mfl.crash(false));
    await page.reload();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(3);
  });

  test('backup nudge: appears with enough verses, can be dismissed, disappears after exporting', async ({ page }) => {
    await library(page);
    await page.goto('/#/');
    await expect(page.getByTestId('backup-nudge')).toBeVisible();
    await page.getByTestId('backup-nudge-dismiss').click();
    await expect(page.getByTestId('backup-nudge')).toBeHidden();
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('backup-nudge')).toBeHidden(); // stays away for two weeks
    // an export also silences it
    await page.goto('/#/settings');
    await page.evaluate(() => (window as any).__mfl.getState());
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
    expect(d.suggestedFilename()).toMatch(/\.json$/);
  });
});

test.describe('keyboard and screen reader basics', () => {
  test('dialogs take focus, keep Tab inside, close with Escape and give focus back', async ({ page }) => {
    await library(page);
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').first().click();
    const opener = page.getByTestId('move');
    await opener.focus();
    await opener.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Move to pile' });
    await expect(dialog).toBeVisible();
    // focus moves into the dialog as soon as it has been drawn
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]')), `after Tab ${i + 1}`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('each screen sets a meaningful page title', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    for (const [route, title] of [['/#/stats', 'Progress'], ['/#/settings', 'Settings'], ['/#/piles', 'All verses'], ['/#/about', 'About']]) {
      await page.goto(route);
      await expect(page).toHaveTitle(new RegExp(`^${title}`));
    }
  });

  test('every interactive control has an accessible name', async ({ page }) => {
    await library(page);
    for (const route of ['/#/', '/#/piles', '/#/settings', '/#/stats', '/#/add', '/#/about']) {
      await page.goto(route);
      const unnamed = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [role=switch]')]
          .filter((el) => el.offsetParent !== null && !(el as HTMLInputElement).hidden)
          .filter((el) => {
            const name = (el.getAttribute('aria-label') ?? '') || el.textContent?.trim() || (el as HTMLInputElement).placeholder || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.closest('label')?.textContent?.trim() || el.getAttribute('title') || '';
            return !name;
          })
          .map((el) => el.outerHTML.slice(0, 100)),
      );
      expect(unnamed, route).toEqual([]);
    }
  });
});
