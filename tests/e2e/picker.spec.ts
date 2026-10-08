import { expect, test, type Page } from '@playwright/test';
import { BOOKS } from '../../src/core/books.ts';
import { addVerse, blockLookups, JOHN316, openApp, pickRange, pickRef, tapNumber } from './helpers';

/** Wait for slide/fade animations to finish so positions are measured at rest. */
const atRest = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));

test.describe('cascading verse picker (Book → Chapter → Verse)', () => {
  test.beforeEach(async ({ page }) => {
    await blockLookups(page);
    await openApp(page, '/#/add');
  });

  test('each pick opens the next box by itself; the popups are just tap-grids (no inputs)', async ({ page }) => {
    await expect(page.getByTestId('pick-chapter')).toBeDisabled(); // nothing to pick before a book
    await expect(page.getByTestId('pick-end')).toHaveCount(0); // no separate "To" box any more
    await page.getByTestId('pick-book').click();
    await expect(page.getByTestId('book-grid')).toBeVisible();
    expect(await page.getByRole('dialog').locator('input, textarea, select').count()).toBe(0); // minimal: no search box
    await page.getByTestId('book-option').filter({ hasText: /^John$/ }).click();
    await expect(page.getByTestId('chapter-grid')).toBeVisible(); // opened automatically
    expect(await page.getByRole('dialog').locator('input, textarea, select').count()).toBe(0);
    await tapNumber(page, 3);
    await expect(page.getByTestId('verse-grid')).toBeVisible(); // and again
    expect(await page.getByRole('dialog').locator('input, textarea, select').count()).toBe(0);
    await tapNumber(page, 16);
    await expect(page.getByTestId('pick-bar')).toContainText('John 3:16'); // shows what you picked, with a big Done
    await page.getByTestId('pick-done').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('pick-book')).toContainText('John');
    await expect(page.getByTestId('pick-chapter')).toContainText('3');
    await expect(page.getByTestId('pick-verse')).toContainText('16');
  });

  test('range: tap a first and a last verse; everything between is highlighted and the popup closes', async ({ page }) => {
    await pickRef(page, { book: 43, chapter: 3, start: 16, end: 18 });
    await expect(page.getByTestId('pick-verse')).toContainText('16–18');
    await page.getByTestId('pick-verse').click(); // reopen: the range is shown
    const n = (x: number) => page.getByTestId('num-option').filter({ hasText: new RegExp(`^${x}$`) });
    await expect(n(16)).toHaveAttribute('aria-pressed', 'true');
    await expect(n(18)).toHaveAttribute('aria-pressed', 'true');
    await expect(n(17)).toHaveClass(/between/);
    await expect(n(19)).not.toHaveClass(/between/);
    await page.getByTestId('pick-done').click(); // Done leaves it as it was
    await expect(page.getByTestId('pick-verse')).toContainText('16–18');
    await page.getByTestId('text').fill('For God so loved the world…');
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('verse-card')).toContainText('John 3:16-18');
  });

  test('tapping the same verse twice means just that verse; an earlier second tap moves the start', async ({ page }) => {
    await pickRef(page, { book: 43, chapter: 3, start: 16 });
    await page.getByTestId('pick-verse').click();
    await tapNumber(page, 20);
    await tapNumber(page, 20); // same verse again: single verse, closes
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('pick-verse')).toContainText(/^Verse\s*20$/);
    await page.getByTestId('pick-verse').click();
    await tapNumber(page, 18);
    await tapNumber(page, 15); // earlier than the first tap: becomes the new first verse
    await expect(page.getByTestId('pick-bar')).toContainText('John 3:15');
    await tapNumber(page, 17); // now a range 15-17
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('pick-verse')).toContainText('15–17');
  });

  test('reopening to change a verse starts fresh (never an accidental range from the old verse)', async ({ page }) => {
    await pickRef(page, { book: 43, chapter: 3, start: 16 });
    await page.getByTestId('pick-verse').click();
    await tapNumber(page, 20);
    await page.getByTestId('pick-done').click();
    await expect(page.getByTestId('pick-verse')).toContainText(/^Verse\s*20$/); // 20, not 16–20
  });

  test('changing the book or chapter clears what depended on it; re-picking the same keeps it', async ({ page }) => {
    await pickRef(page, { book: 43, chapter: 3, start: 16, end: 17 });
    await page.getByTestId('pick-chapter').click();
    await tapNumber(page, 3); // same chapter: just closes, verse kept
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('pick-verse')).toContainText('16–17');
    await page.getByTestId('pick-chapter').click();
    await tapNumber(page, 4); // different chapter: verse must be chosen again, and the grid opens by itself
    await expect(page.getByTestId('verse-grid')).toBeVisible();
    await page.getByTestId('verse-grid').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('pick-verse')).toContainText('Choose');
    await page.getByTestId('pick-book').click();
    await page.getByTestId('book-option').filter({ hasText: /^Romans$/ }).click();
    await expect(page.getByTestId('chapter-grid')).toBeVisible();
    await page.getByTestId('chapter-grid').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByTestId('pick-chapter')).toContainText('Choose');
  });

  test('the book popup is just the books: no shortcuts, no search, canonical order', async ({ page }) => {
    await page.getByTestId('pick-book').click();
    await expect(page.getByTestId('book-option')).toHaveCount(66);
    await expect(page.locator('[data-testid^="group-"], [data-testid="book-search"], .pick-chips')).toHaveCount(0);
    const names = await page.getByTestId('book-option').allTextContents();
    expect(names[0]).toBe('Genesis');
    expect(names[38]).toBe('Malachi');
    expect(names[39]).toBe('Matthew');
    expect(names[65]).toBe('Revelation');
    await page.getByTestId('book-option').filter({ hasText: /^1 Corinthians$/ }).click();
    await expect(page.getByTestId('num-option')).toHaveCount(16);
  });

  test('chapter and verse counts are right (Psalms 150, Jude 1 with 25 verses, Obadiah 21)', async ({ page }) => {
    await page.getByTestId('pick-book').click();
    await page.getByTestId('book-option').filter({ hasText: /^Psalms$/ }).click();
    await expect(page.getByTestId('num-option')).toHaveCount(150);
    await page.getByTestId('chapter-grid').getByRole('button', { name: 'Back' }).click();
    await page.getByTestId('book-option').filter({ hasText: /^Jude$/ }).click();
    await expect(page.getByTestId('num-option')).toHaveCount(1);
    await tapNumber(page, 1);
    await expect(page.getByTestId('num-option')).toHaveCount(25);
    await page.getByTestId('verse-grid').getByRole('button', { name: 'Back' }).click();
    await page.getByTestId('chapter-grid').getByRole('button', { name: 'Back' }).click();
    await page.getByTestId('book-option').filter({ hasText: /^Obadiah$/ }).click();
    await tapNumber(page, 1);
    await expect(page.getByTestId('num-option')).toHaveCount(21);
  });

  test('a verse number the list lacks (translations differ, e.g. 3 John 15) is reachable with ＋', async ({ page }) => {
    await page.getByTestId('pick-book').click();
    await page.getByTestId('book-option').filter({ hasText: /^3 John$/ }).click();
    await tapNumber(page, 1);
    await expect(page.getByTestId('num-option')).toHaveCount(14);
    await page.getByTestId('more-verses').click();
    await expect(page.getByTestId('num-option')).toHaveCount(19);
    await tapNumber(page, 15);
    await page.getByTestId('pick-done').click();
    await expect(page.getByTestId('pick-verse')).toContainText('15');
    await expect(page.getByText('has 14 verses in most Bibles')).toBeVisible();
  });

  test('Back moves up a step, Close and Escape dismiss, and focus returns to the box', async ({ page }) => {
    await page.getByTestId('pick-book').click();
    await page.getByTestId('book-option').filter({ hasText: /^Acts$/ }).click();
    await expect(page.getByTestId('chapter-grid')).toBeVisible();
    await page.getByTestId('chapter-grid').getByRole('button', { name: 'Back' }).click();
    await expect(page.getByTestId('book-grid')).toBeVisible();
    await expect(page.getByTestId('book-option').filter({ hasText: /^Acts$/ })).toHaveAttribute('aria-pressed', 'true'); // current choice marked
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('pick-book')).toBeFocused();
  });

  test('opening a picker never raises the keyboard', async ({ page }) => {
    await page.getByTestId('pick-book').click();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
    await page.getByTestId('book-option').filter({ hasText: /^John$/ }).click();
    await tapNumber(page, 3);
    await expect(page.getByTestId('verse-grid')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');
  });

  test('editing a saved verse starts with its reference filled in and can become a range', async ({ page }) => {
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('pick-book')).toContainText('John');
    await expect(page.getByTestId('pick-chapter')).toContainText('3');
    await expect(page.getByTestId('pick-verse')).toContainText('16');
    await pickRange(page, 16, 17);
    await page.getByTestId('save-verse').click();
    await expect(page.getByTestId('verse-title')).toHaveText('John 3:16-17');
  });

  test('the chosen chapter is marked and scrolled into view when you reopen a long grid', async ({ page }) => {
    await pickRef(page, { book: 19, chapter: 119, start: 1 });
    await page.getByTestId('pick-chapter').click();
    const chosen = page.getByTestId('num-option').filter({ hasText: /^119$/ });
    await expect(chosen).toHaveAttribute('aria-pressed', 'true');
    await atRest(page);
    const [b, area] = await Promise.all([chosen.boundingBox(), page.locator('.pick-scroll').boundingBox()]);
    expect(b!.y).toBeGreaterThanOrEqual(area!.y - 1);
    expect(b!.y + b!.height).toBeLessThanOrEqual(area!.y + area!.height + 1);
  });

  test('works with the keyboard: boxes open with Enter, items activate with Enter/Space', async ({ page }) => {
    await page.getByTestId('pick-book').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('book-grid')).toBeVisible();
    await page.getByTestId('book-option').filter({ hasText: /^Mark$/ }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('chapter-grid')).toBeVisible();
    await page.getByTestId('num-option').filter({ hasText: /^2$/ }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('verse-grid')).toBeVisible();
  });
});

test.describe('picker ergonomics on a phone', () => {
  test('grids fit the screen, targets are big, nothing scrolls sideways, Done is always reachable', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone project only');
    await blockLookups(page);
    await openApp(page, '/#/add');
    const vp = page.viewportSize()!;
    await page.getByTestId('pick-book').click();
    await atRest(page);
    const sheet = (await page.getByTestId('book-grid').boundingBox())!;
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(sheet.y + sheet.height).toBeLessThanOrEqual(vp.height + 1);
    expect(sheet.width).toBeLessThanOrEqual(vp.width + 1);
    const noSideScroll = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.pick-scroll, .pick-sheet')].every((el) => el.scrollWidth <= el.clientWidth + 1));
    expect(await noSideScroll()).toBe(true);
    const books = page.getByTestId('book-option');
    for (let i = 0; i < 6; i++) expect((await books.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await books.filter({ hasText: /^1 Thessalonians$/ }).scrollIntoViewIfNeeded();
    const longName = (await books.filter({ hasText: /^1 Thessalonians$/ }).boundingBox())!;
    expect(longName.height).toBeGreaterThanOrEqual(44);
    expect(longName.x + longName.width).toBeLessThanOrEqual(vp.width);

    await books.filter({ hasText: /^Psalms$/ }).click();
    expect(await noSideScroll()).toBe(true);
    for (let i = 0; i < 10; i++) {
      const b = (await page.getByTestId('num-option').nth(i).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
    await tapNumber(page, 23);
    await atRest(page);
    expect(await noSideScroll()).toBe(true);
    await tapNumber(page, 1);
    const done = (await page.getByTestId('pick-done').boundingBox())!;
    expect(done.y + done.height).toBeLessThanOrEqual(vp.height + 1); // the Done button is on screen without scrolling
    expect(done.height).toBeGreaterThanOrEqual(44);
    await page.getByTestId('pick-done').click();
    for (const id of ['pick-book', 'pick-chapter', 'pick-verse']) expect((await page.getByTestId(id).boundingBox())!.height).toBeGreaterThanOrEqual(56);
  });

  for (const [w, h] of [[390, 780], [375, 667], [430, 932]] as const) {
    test(`verse grid fits without scrolling for ordinary chapters at ${w}x${h}`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'phone project only');
      await page.setViewportSize({ width: w, height: h });
      await blockLookups(page);
      await openApp(page, '/#/add');
      const cases: [number, number, number][] = [
        [19, 23, 6], // Psalm 23
        [43, 3, 36], // John 3
        [1, 1, 31], // Genesis 1
        [40, 5, 48], // Matthew 5
      ];
      for (const [book, chapter, verses] of cases) {
        await page.getByTestId('pick-book').click();
        await page.getByTestId('book-option').filter({ hasText: new RegExp(`^${BOOKS[book - 1].name}$`) }).click();
        await tapNumber(page, chapter);
        await atRest(page);
        await expect(page.getByTestId('num-option')).toHaveCount(verses);
        const m = await page.evaluate(() => {
          const sheet = document.querySelector<HTMLElement>('.pick-sheet')!.getBoundingClientRect();
          const scroll = document.querySelector<HTMLElement>('.pick-scroll')!;
          const done = document.querySelector<HTMLElement>('[data-testid=pick-done]')!.getBoundingClientRect();
          return { top: sheet.top, bottom: sheet.bottom, scrolls: scroll.scrollHeight - scroll.clientHeight, doneBottom: done.bottom, innerHeight: window.innerHeight };
        });
        const label = `${BOOKS[book - 1].name} ${chapter} at ${w}x${h}`;
        expect(m.top, label).toBeGreaterThanOrEqual(0);
        expect(m.bottom, label).toBeLessThanOrEqual(m.innerHeight + 1);
        expect(m.doneBottom, label).toBeLessThanOrEqual(m.innerHeight + 1); // Done is on screen
        if (verses <= 36 || h >= 780) expect(m.scrolls, `${label}: nothing should need scrolling`).toBeLessThanOrEqual(1);
        // the last verse button is fully visible too
        const last = (await page.getByTestId('num-option').last().boundingBox())!;
        expect(last.y + last.height, label).toBeLessThanOrEqual(m.innerHeight);
        await page.getByTestId('verse-grid').getByRole('button', { name: 'Close' }).click();
      }
    });
  }
});
