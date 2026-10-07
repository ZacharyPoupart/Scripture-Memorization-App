import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, JOHN_TEXT, openApp, PSALM23_1, ROMANS8_28, saved } from './helpers';

test.describe('adding, editing and organizing verses', () => {
  test('first-run walkthrough can be skipped, finished and reopened', async ({ page }) => {
    await blockLookups(page);
    await page.goto('/');
    await expect(page.getByTestId('onboarding')).toBeVisible();
    for (let i = 0; i < 4; i++) await page.getByTestId('onboarding-next').click();
    await page.getByTestId('onboarding-next').click(); // "Get started"
    await expect(page.getByTestId('onboarding')).toBeHidden();
    await saved(page);
    await page.reload();
    await expect(page.getByTestId('onboarding')).toBeHidden(); // remembered
    await page.goto('/#/settings');
    await page.getByTestId('show-intro').click();
    await expect(page.getByTestId('onboarding')).toBeVisible();
  });

  test('adds a verse by typing the text and shows it in the Daily pile', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await expect(page.getByTestId('empty-home')).toBeVisible();
    await addVerse(page, { ...JOHN316, topic: 'Gospel' });
    await expect(page).toHaveURL(/#\/pile\/daily/);
    const card = page.getByTestId('verse-card');
    await expect(card).toContainText('John 3:16');
    await expect(card).toContainText('Daily');
    await expect(card).toContainText('#Gospel');
    await expect(card.getByTestId('status')).toContainText('Ready');
  });

  test('looks up text automatically when online (ranges too)', async ({ page }) => {
    await page.route(/bolls\.life\/get-text\/ESV\/19\/23\//, (route) =>
      route.fulfill({
        json: [
          { verse: 1, text: 'The <i>LORD</i> is my shepherd; I shall not want.' },
          { verse: 2, text: 'He makes me lie down in green pastures.' },
          { verse: 3, text: 'He restores my soul.' },
        ],
      }),
    );
    await openApp(page);
    await page.goto('/#/add');
    await page.getByTestId('book').selectOption('19');
    await page.getByTestId('chapter').selectOption('23');
    await page.getByTestId('start').fill('1');
    await page.getByTestId('end').fill('2');
    await expect(page.getByTestId('text')).toHaveValue('The LORD is my shepherd; I shall not want. He makes me lie down in green pastures.');
    await expect(page.getByTestId('lookup-status')).toContainText('Found it');
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('verse-card')).toContainText('Psalms 23:1-2');
  });

  test('falls back gracefully when lookup fails, and manual text is never overwritten', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await page.goto('/#/add');
    await page.getByTestId('book').selectOption('43');
    await page.getByTestId('chapter').selectOption('3');
    await page.getByTestId('start').fill('16');
    await expect(page.getByTestId('lookup-status')).toContainText("Couldn't look it up");
    await page.getByTestId('text').fill('my own words');
    await page.getByTestId('end').fill('17');
    await page.waitForTimeout(700);
    await expect(page.getByTestId('text')).toHaveValue('my own words');
  });

  test('validates the form', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await page.goto('/#/add');
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('form-error')).toContainText('Choose a book');
    await page.getByTestId('book').selectOption('43');
    await page.getByTestId('chapter').selectOption('3');
    await page.getByTestId('start').fill('16');
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('form-error')).toContainText('Add the verse text');
    await page.getByTestId('end').fill('15');
    await expect(page.getByText('same as or after')).toBeVisible();
  });

  test('edit, move between piles with undo, delete with undo, topic filter', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, { ...JOHN316, topic: 'Gospel' });
    await addVerse(page, { ...PSALM23_1, topic: 'Trust' });

    await page.goto('/#/piles');
    await page.getByRole('button', { name: '#Trust', exact: true }).click();
    await expect(page.getByTestId('verse-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await expect(page.getByTestId('verse-card')).toHaveCount(2);

    await page.getByTestId('verse-card').filter({ hasText: 'John 3:16' }).click();
    await expect(page.getByTestId('verse-title')).toHaveText('John 3:16');
    // edit
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('topic').fill('Love');
    await page.getByTestId('text').fill(JOHN_TEXT + ' (edited)');
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('verse-text')).toContainText('(edited)');
    await expect(page.getByText('#Love')).toBeVisible();
    // move + undo
    await page.getByTestId('move').click();
    await page.getByTestId('move-weekly').click();
    await expect(page.getByTestId('toast')).toContainText('Moved to Weekly');
    await expect(page.getByTestId('detail-status')).toContainText('Next review in 7 days');
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('detail-status')).toContainText('Ready');
    // delete + undo
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
    await expect(page.getByTestId('toast')).toContainText('Deleted John 3:16');
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card')).toHaveCount(2);
  });

  test('"Open in Bible" links to the chapter for context', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, ROMANS8_28);
    await page.getByTestId('verse-card').click();
    const link = page.getByRole('link', { name: /Open in Bible/ });
    await expect(link).toHaveAttribute('href', /biblegateway\.com\/passage\/\?search=Romans%208&version=ESV/);
  });

  test('longest-in-pile verses come first and pile counts show on Home', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await addVerse(page, PSALM23_1);
    await page.goto('/#/');
    await expect(page.getByTestId('count-daily')).toHaveText('2');
    await expect(page.getByTestId('count-weekly')).toHaveText('0');
    await page.goto('/#/pile/daily');
    await expect(page.getByTestId('verse-card').first()).toContainText('John 3:16'); // added first
  });

  test('NIV text comes from our server function (API.Bible); falls back when it is not set up', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/verse*', (route) => {
      calls++;
      const url = new URL(route.request().url());
      expect(url.searchParams.get('translation')).toBe('NIV');
      expect(url.searchParams.get('book')).toBe('43');
      return route.fulfill({ json: { text: 'For God so loved the world (NIV text).' } });
    });
    await openApp(page);
    await page.goto('/#/add');
    await page.getByTestId('book').selectOption('43');
    await page.getByTestId('chapter').selectOption('3');
    await page.getByTestId('translation').selectOption('NIV');
    await page.getByTestId('start').fill('16');
    await expect(page.getByTestId('text')).toHaveValue('For God so loved the world (NIV text).');
    await expect(page.getByTestId('niv-note')).toContainText('Biblica');
    expect(calls).toBeGreaterThan(0);

    // not configured on the server (501) -> the next source is tried, and if everything fails you can type it
    await page.unroute('**/api/verse*');
    await page.route('**/api/verse*', (route) => route.fulfill({ status: 501, json: { error: 'not-configured' } }));
    await page.route(/bolls\.life/, (route) => route.fulfill({ json: [{ verse: 17, text: 'From the backup source.' }] }));
    await page.getByTestId('start').fill('17');
    await expect(page.getByTestId('text')).toHaveValue('From the backup source.');
  });
});
