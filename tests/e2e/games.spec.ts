import { expect, test, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, JOHN316, openApp, PSALM23_1 } from './helpers';

// The games run against the clock, so the helpers below play quickly and never wait on a moving thing to hold still.
async function winBurrows(page: Page) {
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const mole = page.locator('[data-testid="burrow"][data-right]:not([disabled])');
    if (await mole.count()) await mole.first().dispatchEvent('pointerdown').catch(() => {});
    else await page.waitForTimeout(60);
  }
}
async function winDuel(page: Page) {
  for (let i = 0; i < 300; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const right = page.getByTestId('duel-choices').locator('button[data-right]:not([disabled])');
    if (await right.count()) await right.click();
    else await page.waitForTimeout(100);
  }
}
/** Every game opens with a short pause showing the verse (v1.81.0); Start skips the rest of it. */
const start = (page: Page) => page.getByTestId('intro-start').click();
const reviewsOf = (page: Page) => page.evaluate(() => Object.values((window as any).__mfl.getState().data.reviewsByDevice as Record<string, number>).reduce((n, c) => n + c, 0));

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

async function winGate(page: Page) {
  for (let i = 0; i < 200; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const key = page.getByTestId('gate-keys').locator('button[data-right]:not([disabled])');
    if (await key.count()) await key.dispatchEvent('pointerdown').catch(() => {});
    else await page.waitForTimeout(80);
  }
}
/** Wins whichever game is on screen (for runs, where the game is chosen at random). */
async function winAny(page: Page) {
  const game = await page.getByTestId('game').getAttribute('data-game');
  if (game === 'gate') return winGate(page);
  if (game === 'burrows') return winBurrows(page);
  if (game === 'duel') return winDuel(page);
  const total = Number(await page.getByTestId('bridge-stage').getAttribute('data-total'));
  for (let i = 0; i < total; i++) await page.getByTestId('bridge-bank').locator(`button[data-order="${i}"]`).dispatchEvent('pointerdown');
}

test.describe('the games', () => {
  test('Play today’s reviews: every verse due, in Today’s order, each in a different random game, and each win counts', async ({ page }) => {
    test.setTimeout(120_000);
    await openApp(page);
    await addVerse(page, PSALM23_1);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    await expect(page.getByTestId('play-card')).toContainText('2 ready');
    await page.getByTestId('play-card').click(); // straight into the run
    await expect(page.getByTestId('game')).toHaveAttribute('data-run', '1/2');
    await expect(page.getByTestId('game-ref')).toHaveText('Psalms 23:1'); // Today's order
    await expect(page.getByTestId('game-intro')).toContainText('Verse 1 of 2');
    await expect(page.getByTestId('intro-ref')).toHaveText('Psalms 23:1');
    await start(page);
    const first = await page.getByTestId('game').getAttribute('data-game');
    await winAny(page);
    await expect(page.getByTestId('game-verdict')).toContainText('counted as its review');
    await expect(page.getByTestId('game-swap')).toHaveCount(0);
    await page.getByTestId('run-next').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-run', '2/2');
    await expect(page.getByTestId('game-ref')).toHaveText('John 3:16');
    expect(await page.getByTestId('game').getAttribute('data-game')).not.toBe(first); // never the same game twice in a row
    await expect(page.getByTestId('intro-ref')).toHaveText('John 3:16'); // a pause before each verse
    await start(page);
    await winAny(page);
    await expect(page.getByTestId('run-next')).toHaveText('Finish');
    await page.getByTestId('run-next').click();
    await expect(page.getByTestId('run-tally')).toContainText('2 verses played · 2 counted');
    expect(await reviewsOf(page)).toBe(2);
    await page.getByTestId('run-done').click();
    await expect(page.getByTestId('today-list')).toContainText('1/3');
    // the hub has the same button
    await page.goto('/#/play');
    await expect(page.getByTestId('play-run')).toHaveCount(0); // nothing ready right now (the spacing between Daily reviews)
  });

  test('Hold the Gate: the first letter of the next word strikes the goblin; a score, stars and a personal best are kept', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    await expect(page.getByTestId('hub-stars')).toHaveText('0');
    await page.getByTestId('hub-gate').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'gate');
    // first a pause that shows the verse, large; the game has not started (no keys, no goblin) until it ends or Start is tapped
    await expect(page.getByTestId('intro-ref')).toHaveText('John 3:16');
    await expect(page.getByTestId('game-intro')).toContainText('Hold the Gate');
    await expect(page.getByTestId('gate-keys')).toHaveCount(0);
    await expect(page.getByTestId('gate-keys')).toBeVisible({ timeout: 5000 }); // it starts by itself after a moment
    await expect(page.getByTestId('game-intro')).toHaveCount(0);
    const keys = page.getByTestId('gate-keys').locator('button');
    await expect(keys).toHaveCount(6);
    // a wrong letter is a slip (a heart), and the word is not given away
    await page.getByTestId('gate-keys').locator('button:not([data-right])').first().dispatchEvent('pointerdown');
    await expect(page.getByTestId('gate-hearts')).toHaveAttribute('data-hearts', '2');
    await expect(page.getByTestId('gate-text').locator('.w.ok')).toHaveCount(0);
    // the right letter strikes, the word appears and the score goes up
    await page.getByTestId('gate-keys').locator('button[data-right]').dispatchEvent('pointerdown');
    await expect(page.getByTestId('gate-text').locator('.w.ok').first()).toHaveText('For');
    await expect(page.getByTestId('game-score')).not.toHaveText('0');
    // a computer keyboard works too
    await page.keyboard.press('g');
    await expect(page.getByTestId('gate-stage')).toHaveAttribute('data-next', '2');
    await winGate(page);
    await expect(page.getByTestId('game-finish')).toContainText('The gate holds');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2');
    const first = Number(await page.getByTestId('game-final-score').locator('b').textContent());
    expect(first).toBeGreaterThan(100);
    await expect(page.getByTestId('game-new-best')).toHaveCount(0); // a first win is not a "new best"
    expect(await reviewsOf(page)).toBe(1);
    // a clean second run scores more: a new best, and three stars kept for this game and verse
    await page.getByTestId('game-again').click();
    await expect(page.getByTestId('game-intro')).toHaveCount(0); // playing the same verse again needs no pause
    await winGate(page);
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('game-new-best')).toBeVisible();
    await page.getByTestId('game-close').click();
    await expect(page.getByTestId('hub-stars')).toHaveText('3');
  });

  test('the sound switch on Play turns the quiet sounds on and off', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    const sound = page.getByTestId('game-sound');
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__mfl.getState().settings.soundOn)).toBe(true);
  });

  test('Play is a tab and a panel on Today; Goblin Burrows is won by bonking the next word, and the win counts as the review', async ({ page }) => {
    await openApp(page);
    await addVerse(page, PSALM23_1);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    await page.getByTestId('tab-play').click();
    await expect(page.getByTestId('play-hub')).toBeVisible();
    await expect(page.getByTestId('tab-play')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-testid^="hub-"]:not([data-testid="hub-stars"])')).toHaveCount(4); // four games
    await page.getByTestId('hub-burrows').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'burrows');
    await expect(page.getByTestId('game-ref')).toHaveText('Psalms 23:1');
    await start(page);
    // a goblin with the wrong word costs a heart
    await page.locator('[data-testid="burrow"]:not([data-right]) .mole').first().waitFor({ timeout: 5000 });
    await page.locator('[data-testid="burrow"]:has(.mole):not([data-right])').first().dispatchEvent('pointerdown');
    await expect(page.getByTestId('burrows-hearts')).toHaveAttribute('data-hearts', '2');
    expect(await reviewsOf(page)).toBe(0);
    await winBurrows(page);
    await expect(page.getByTestId('game-finish')).toContainText('Every goblin bonked');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2'); // one slip
    await expect(page.getByTestId('game-verdict')).toContainText('counted as its review');
    expect(await reviewsOf(page)).toBe(1);
    // on to the next verse that is ready, in the same game
    await page.getByTestId('game-next').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'burrows');
    await expect(page.getByTestId('game-ref')).toHaveText('John 3:16');
    await expect(page.getByTestId('intro-ref')).toHaveText('John 3:16'); // a new verse: a pause again
    await page.getByTestId('game-close').click();
    await page.goto('/#/');
    await expect(page.getByTestId('today-list')).toContainText('1/3');
  });

  test('Goblin Burrows: goblins that get away cost hearts, and three of them end the game with nothing counted', async ({ page }) => {
    test.setTimeout(60_000);
    await openApp(page);
    await addVerse(page, PSALM23_1);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-burrows').click();
    await start(page);
    await expect(page.getByTestId('game-finish')).toContainText('The goblins got away', { timeout: 30_000 });
    await expect(page.getByTestId('game-finish')).toHaveAttribute('data-counted', 'no');
    expect(await reviewsOf(page)).toBe(0);
    await page.getByTestId('game-again').click();
    await expect(page.getByTestId('burrows-hearts')).toHaveAttribute('data-hearts', '3');
  });

  test('Dragon Duel: right words beat the dragon, a wrong word or waiting too long costs a heart', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-duel').click();
    await start(page);
    await expect(page.getByTestId('duel-hearts')).toHaveAttribute('data-hearts', '3');
    // a wrong word costs a heart and the same word is asked again
    await page.getByTestId('duel-choices').locator('button:not([data-right])').first().click();
    await expect(page.getByTestId('duel-hearts')).toHaveAttribute('data-hearts', '2');
    await expect(page.getByTestId('duel-text').locator('.w.ok')).toHaveCount(0);
    // waiting while the dragon draws breath costs one too
    await expect(page.getByTestId('duel-hearts')).toHaveAttribute('data-hearts', '1', { timeout: 12_000 });
    await winDuel(page);
    await expect(page.getByTestId('game-finish')).toContainText('The dragon is beaten');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2'); // two slips
    await expect(page.getByTestId('game-finish')).toContainText('For God so loved the world');
    expect(await reviewsOf(page)).toBe(1); // a Daily verse forgives a few slips, as in every review type
    // three wrong words and the dragon holds the gate; you can simply go again
    await page.getByTestId('game-again').click();
    for (let i = 0; i < 3; i++) await page.getByTestId('duel-choices').locator('button:not([data-right]):not([disabled])').first().click();
    await expect(page.getByTestId('game-finish')).toContainText('holds the gate');
    expect(await reviewsOf(page)).toBe(1);
  });

  test('Bridge Run: one word a plank, laid in order, carries the knight across; standing still, he walks off the edge', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-bridge').click();
    await start(page);
    await expect(page.getByTestId('game-ref')).toHaveText('John 3:16'); // the verse is the big line at the top
    const bank = page.getByTestId('bridge-bank');
    await expect(bank.locator('button')).toHaveCount(5); // the next word and the few after it
    for (const b of await bank.locator('button').allTextContents()) expect(b.trim()).not.toContain(' ');
    const total = Number(await page.getByTestId('bridge-stage').getAttribute('data-total'));
    expect(total).toBe(24);
    // nothing laid: he reaches the edge and falls, once
    await expect(page.getByTestId('bridge-hearts')).toHaveAttribute('data-hearts', '2', { timeout: 10_000 });
    // a wrong word stays on the bank and costs a heart
    await bank.locator('button:not([data-order="0"])').first().dispatchEvent('pointerdown');
    await expect(bank.locator('button')).toHaveCount(5);
    await expect(page.getByTestId('bridge-stage')).toHaveAttribute('data-laid', '0');
    await expect(page.getByTestId('bridge-hearts')).toHaveAttribute('data-hearts', '1');
    for (let i = 0; i < total; i++) await bank.locator(`button[data-order="${i}"]`).dispatchEvent('pointerdown');
    await expect(page.getByTestId('game-finish')).toContainText('Safely across');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2');
    // and over to another game from here
    await page.getByTestId('game-swap').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'gate');
  });
});
