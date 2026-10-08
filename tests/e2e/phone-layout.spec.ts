import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, typeWholeVerse, firstLetters, openApp, wordsOf, autoDismissMilestones } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
});

const LONG = {
  book: 19,
  chapter: 23,
  start: 1,
  end: 6,
  text: "The LORD is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters. He restores my soul. He leads me in paths of righteousness for his name's sake. Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me. You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows. Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the LORD forever.",
};

test.describe('phone layout and keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, LONG);
    await page.getByTestId('verse-card').click();
  });

  test('long verse: the current word stays in view and the page never scrolls', async ({ page }) => {
    await page.getByTestId('review-type').click();
    await page.getByTestId('type-input').focus();
    const letters = firstLetters(LONG.text);
    const total = wordsOf(LONG.text).length;
    // simulate the on-screen keyboard taking nearly half the screen
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });

    for (let i = 0; i < total - 8; i += 9) {
      await page.keyboard.type(letters.slice(i, i + 9));
      await page.waitForTimeout(500); // smooth scroll
      const [cb, ab, dock, input] = await Promise.all([
        page.locator('.w.cur').boundingBox(),
        page.locator('.verse-area').boundingBox(),
        page.locator('.dock').boundingBox(),
        page.getByTestId('type-input').boundingBox(),
      ]);
      // current word fully inside the text area, which ends where the controls begin
      expect(cb!.y).toBeGreaterThanOrEqual(ab!.y - 1);
      expect(cb!.y + cb!.height).toBeLessThanOrEqual(ab!.y + ab!.height + 1);
      expect(ab!.y + ab!.height).toBeLessThanOrEqual(dock!.y + 1);
      // the input is on screen, not under anything
      expect(input!.y + input!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      expect(input!.y).toBeGreaterThan(0);
      // the page itself never moved
      expect(await page.evaluate(() => [window.scrollY, document.documentElement.scrollTop, document.body.scrollTop])).toEqual([0, 0, 0]);
    }
  });

  test('the controls keep their position as words are revealed (nothing jumps)', async ({ page }) => {
    await page.getByTestId('review-type').click();
    await page.getByTestId('type-input').focus();
    const before = await page.getByTestId('type-input').boundingBox();
    await page.keyboard.type(firstLetters(LONG.text).slice(0, 12));
    await page.waitForTimeout(300);
    expect(await page.getByTestId('type-input').boundingBox()).toEqual(before);
    // and the field kept focus the whole time (so a phone keyboard would stay open), even after a mistake
    await page.keyboard.type('q');
    await expect(page.getByTestId('type-input')).toBeFocused();
  });

  test('fill in the blank: options stay put and the current blank stays in view', async ({ page }) => {
    await page.getByTestId('review-blanks').click();
    const opts = page.getByTestId('options');
    const first = await opts.boundingBox();
    for (let i = 0; i < 5; i++) {
      const cur = page.getByTestId('current-blank');
      if (!(await cur.count())) break;
      const idx = await cur.evaluate((el) => [...el.closest('p')!.children].findIndex((c) => c.contains(el)));
      const answer = wordsOf(LONG.text)[idx].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      await page.getByTestId('option').getByText(answer, { exact: true }).click();
      await page.waitForTimeout(450);
      expect((await opts.boundingBox())!.y).toBe(first!.y);
      const cb = await page.getByTestId('current-blank').boundingBox();
      const ab = await page.locator('.verse-area').boundingBox();
      expect(cb!.y).toBeGreaterThanOrEqual(ab!.y - 1);
      expect(cb!.y + cb!.height).toBeLessThanOrEqual(ab!.y + ab!.height + 1);
    }
  });

  test('reference recall fields stay on screen when the keyboard is up', async ({ page }) => {
    await page.getByTestId('review-type').click();
    await typeWholeVerse(page, LONG.text);
    const vp = page.viewportSize()!;
    await page.setViewportSize({ width: vp.width, height: Math.round(vp.height * 0.55) });
    await page.getByTestId('ref-chapter').focus();
    for (const id of ['ref-book', 'ref-chapter', 'ref-start', 'ref-check']) {
      const b = await page.getByTestId(id).boundingBox();
      expect(b!.y + b!.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      expect(b!.y).toBeGreaterThanOrEqual(0);
    }
    // a wrong answer shakes but keeps what was typed and keeps focus
    await page.getByTestId('ref-start').fill('1');
    await page.getByTestId('ref-book').click();
    await page.getByTestId('book-option').first().click();
    await page.getByTestId('ref-chapter').fill('5');
    await page.getByTestId('ref-check').click();
    await expect(page.getByTestId('ref-message')).toBeVisible();
    await expect(page.getByTestId('ref-chapter')).toHaveValue('5');
  });
});

test.describe('fill in the blank stays put', () => {
  test('choosing an answer never moves the other words (no refitting)', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, LONG);
    await page.goto('/#/pile/daily');
    await page.getByTestId('verse-card').click();
    await page.getByTestId('review-blanks').click();
    const positions = () =>
      page.locator('[data-testid=blank-text] > span').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width)]; }));
    for (let i = 0; i < 6; i++) {
      const before = await positions();
      const answer = (await page.locator('[data-testid=current-blank] > span[aria-hidden]').first().textContent())!;
      await page.getByTestId('option').getByText(answer, { exact: true }).click();
      await page.waitForTimeout(350); // let the scroll/settle animation finish
      const after = await positions();
      // same layout: every word has the same left edge, width and line (vertical scroll aside, everything moves together)
      expect(after.map((p) => p[0])).toEqual(before.map((p) => p[0]));
      expect(after.map((p) => p[2])).toEqual(before.map((p) => p[2]));
      const dy = after[0][1] - before[0][1];
      expect(after.map((p, k) => p[1] - before[k][1]).every((d) => d === dy)).toBe(true);
    }
  });
});
