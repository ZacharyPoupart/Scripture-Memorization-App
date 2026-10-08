import { expect, test } from '@playwright/test';
import { addVerse, blockLookups, JOHN316, openApp, PSALM23_1 } from './helpers';

// Visual comfort + "does it behave on a phone" checks.

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
};

test.describe('theme follows the system by default', () => {
  test('light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await blockLookups(page);
    await openApp(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(rgb('#f6f3ec'));
    expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe(rgb('#272d2c'));
  });
  test('dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await blockLookups(page);
    await openApp(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(rgb('#161b1c'));
    expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe(rgb('#e3e8e6'));
  });
  test('an explicit choice in Settings overrides the system', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await blockLookups(page);
    await openApp(page, '/#/settings');
    await page.getByRole('button', { name: 'Light' }).click();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(rgb('#f6f3ec'));
  });
});

test.describe('scripture text is easy to read', () => {
  test('size, leading and line length', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    const m = await page.getByTestId('verse-text').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { size: parseFloat(cs.fontSize), line: parseFloat(cs.lineHeight), width: el.getBoundingClientRect().width, family: cs.fontFamily };
    });
    expect(m.size).toBeGreaterThanOrEqual(19);
    expect(m.size).toBeLessThanOrEqual(26);
    expect(m.line / m.size).toBeGreaterThanOrEqual(1.6);
    expect(m.width / m.size).toBeLessThanOrEqual(36); // ≈ 65–70 characters per line at most
    expect(m.family).toMatch(/serif|Georgia|New York/i);
  });
});

test.describe('motion and reduced motion', () => {
  test('animations are essentially off when the system asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    const dur = await page.getByTestId('toast').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(dur).toBeLessThan(0.01);
  });
  test('normal animations are short', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    const dur = await page.getByTestId('toast').evaluate((el) => parseFloat(getComputedStyle(el).animationDuration));
    expect(dur).toBeLessThanOrEqual(0.3);
  });
});

test.describe('taps are never blocked or sticky', () => {
  test('a toast never blocks anything beneath it, and Home has no layout shift', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await addVerse(page, PSALM23_1);
    await expect(page.getByTestId('toast')).toBeVisible();
    expect(await page.getByTestId('toast').evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await page.goto('/#/');
    await expect(page.getByTestId('start-today')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as any).__cls)).toBeLessThan(0.05);
  });

  test('primary controls are what you actually hit when you tap their centre (no invisible overlays)', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    for (const id of ['start-today', 'pile-daily']) {
      const ok = await page.getByTestId(id).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && el.contains(hit);
      });
      expect(ok, id).toBe(true);
    }
    for (const name of ['Today', 'Piles', 'Add', 'Settings']) {
      const ok = await page.getByRole('link', { name }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!hit && el.contains(hit);
      });
      expect(ok, name).toBe(true);
    }
  });

  test('touch targets are comfortably large', async ({ page }) => {
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    for (const id of ['start-today']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    for (const name of ['Today', 'Piles', 'Add', 'Settings']) {
      const b = (await page.getByRole('link', { name }).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('buttons have no hover styling on touch devices (no sticky highlight)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone project only');
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/settings');
    const supportsHover = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches);
    expect(supportsHover).toBe(false);
  });
});

test.describe('thumb-reachable primary action (phone)', () => {
  test('the main action sits in the lower part of the screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone project only');
    await blockLookups(page);
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    const b = (await page.getByTestId('start-today').boundingBox())!;
    const vh = page.viewportSize()!.height;
    expect(b.y).toBeGreaterThan(vh * 0.65);
    await page.goto('/#/pile/daily');
    const c = (await page.getByTestId('start-pile').boundingBox())!;
    expect(c.y).toBeGreaterThan(vh * 0.65);
  });
});

test.describe('accessibility basics', () => {
  test('button groups have their own names (not the whole section label) and switches are real switches', async ({ page }) => {
    await blockLookups(page);
    await openApp(page, '/#/settings');
    for (const name of ['Easy', 'Medium', 'Hard', 'Flashcard', 'Blanks', 'Full', 'Calm', 'Light', 'Dark']) {
      await expect(page.getByRole('button', { name, exact: true }).first(), name).toBeVisible();
    }
    await expect(page.getByRole('group', { name: 'Fill-in-the-blank difficulty (Daily verses)' })).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Quiet sounds' })).toHaveAttribute('aria-checked', 'false');
  });
});
