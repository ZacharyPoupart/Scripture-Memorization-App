import { expect, test, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, JOHN316, openApp, PSALM23_1 } from './helpers';

// The games run against the clock, so the helpers below play quickly and never wait on a moving thing to hold still.
const rightShot = (page: Page) => page.locator('[data-testid="shot"][data-right]').first();
async function winVolley(page: Page) {
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const shot = rightShot(page);
    if (await shot.count()) await shot.dispatchEvent('pointerdown').catch(() => {});
    else await page.waitForTimeout(80);
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
async function winBurrows(page: Page) {
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const mole = page.locator('[data-testid="burrow"][data-right]:not([disabled])');
    if (await mole.count()) await mole.first().dispatchEvent('pointerdown').catch(() => {});
    else await page.waitForTimeout(60);
  }
}

async function winDance(page: Page) {
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const sh = page.locator('[data-testid="dance-shield"][data-right]:not([disabled])');
    if (await sh.count()) await sh.first().dispatchEvent('pointerdown').catch(() => {});
    else await page.waitForTimeout(60);
  }
}
async function winParry(page: Page) {
  for (let i = 0; i < 600; i++) {
    if (await page.getByTestId('game-finish').isVisible()) return;
    const rune = page.getByTestId('parry-rune');
    if (await rune.count()) {
      const right = (await rune.getAttribute('data-right').catch(() => null)) === 'yes';
      await page.getByTestId(right ? 'parry-strike' : 'parry-block').dispatchEvent('pointerdown').catch(() => {});
    }
    await page.waitForTimeout(60);
  }
}

test.describe('the games', () => {
  test('Sword Dance: the words of each phrase are cut in order; one out of order costs a heart', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    await page.getByTestId('hub-dance').click();
    await expect(page.getByTestId('dance-shield')).toHaveCount(5); // the first phrase: "For God so loved the"
    await page.locator('[data-testid="dance-shield"]:not([data-right])').first().dispatchEvent('pointerdown');
    await expect(page.getByTestId('dance-hearts')).toHaveAttribute('data-hearts', '2');
    await page.locator('[data-testid="dance-shield"][data-right]').dispatchEvent('pointerdown');
    // the word flies from the shield into its place in the verse
    await expect(page.locator('.fly-word')).toHaveText('For');
    await expect(page.getByTestId('dance-text').locator('.w.ok').first()).toHaveText('For');
    await winDance(page);
    await expect(page.getByTestId('game-finish')).toContainText('Every shield cut');
    await expect(page.getByTestId('game-verdict')).toContainText('counted as its review');
  });

  test('Parry: strike the next word, block the rest; a wrong call costs a heart', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    await page.getByTestId('hub-parry').click();
    const rune = page.getByTestId('parry-rune');
    await rune.waitFor({ timeout: 5000 });
    const right = (await rune.getAttribute('data-right')) === 'yes';
    await page.getByTestId(right ? 'parry-block' : 'parry-strike').dispatchEvent('pointerdown'); // the wrong call
    await expect(page.getByTestId('parry-hearts')).toHaveAttribute('data-hearts', '2');
    await winParry(page);
    await expect(page.getByTestId('game-finish')).toContainText('Not one rune got past');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2');
  });

  test('Hold the Gate: the first letter of the next word strikes the goblin; a score, stars and a personal best are kept', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    await expect(page.getByTestId('hub-stars')).toHaveText('0');
    await page.getByTestId('hub-gate').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'gate');
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
    await winGate(page);
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.getByTestId('game-new-best')).toBeVisible();
    await page.getByTestId('game-close').click();
    await expect(page.getByTestId('hub-stars')).toHaveText('3');
  });

  test('Goblin Burrows: bonk the goblin with the next word; a wrong one costs a heart', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.goto('/#/play');
    await page.getByTestId('hub-burrows').click();
    const wrong = page.locator('[data-testid="burrow"]:not([data-right]) .mole');
    await wrong.first().waitFor({ timeout: 5000 });
    await page.locator('[data-testid="burrow"]:has(.mole):not([data-right])').first().dispatchEvent('pointerdown');
    await expect(page.getByTestId('burrows-hearts')).toHaveAttribute('data-hearts', '2');
    await winBurrows(page);
    await expect(page.getByTestId('game-finish')).toContainText('Every goblin bonked');
    await expect(page.getByTestId('game-verdict')).toContainText('counted as its review');
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

  test('Play is a tab and a panel on Today; Arrow Volley is won by tapping the next word, and the win counts as the review', async ({ page }) => {
    await openApp(page);
    await addVerse(page, PSALM23_1);
    await addVerse(page, JOHN316);
    await page.goto('/#/');
    await page.getByTestId('play-card').click();
    await expect(page.getByTestId('play-hub')).toBeVisible();
    await expect(page.getByTestId('tab-play')).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('hub-volley').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'volley');
    await expect(page.getByTestId('volley-hearts')).toHaveAttribute('data-hearts', '3');
    // a word that is not next costs a heart
    const decoy = page.locator('[data-testid="shot"]:not([data-right])').first();
    await decoy.waitFor({ timeout: 15000 });
    await decoy.dispatchEvent('pointerdown');
    await expect(page.getByTestId('volley-hearts')).toHaveAttribute('data-hearts', '2');
    expect(await reviewsOf(page)).toBe(0);
    await winVolley(page);
    await expect(page.getByTestId('game-finish')).toContainText('The archers are routed');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2'); // one slip
    await expect(page.getByTestId('game-verdict')).toContainText('counted as its review');
    expect(await reviewsOf(page)).toBe(1);
    // on to the next verse that is ready, in the same game
    await page.getByTestId('game-next').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'volley');
    await expect(page.getByTestId('game').locator('.sub')).toHaveText('John 3:16');
    await page.getByTestId('game-close').click();
    await page.goto('/#/');
    await expect(page.getByTestId('today-list')).toContainText('1/3');
  });

  test('Arrow Volley: letting the next word land costs a heart, and three of them end the game with nothing counted', async ({ page }) => {
    test.setTimeout(90_000);
    await openApp(page);
    await addVerse(page, PSALM23_1);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-volley').click();
    await expect(page.getByTestId('game-finish')).toContainText('The arrows got through', { timeout: 60_000 });
    await expect(page.getByTestId('game-finish')).toHaveAttribute('data-counted', 'no');
    expect(await reviewsOf(page)).toBe(0);
    await page.getByTestId('game-again').click();
    await expect(page.getByTestId('volley-hearts')).toHaveAttribute('data-hearts', '3');
  });

  test('Dragon Duel: right words beat the dragon, a wrong word or waiting too long costs a heart', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-duel').click();
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

  test('Bridge Run: phrases laid in order carry the knight across; standing still, he walks off the edge', async ({ page }) => {
    await openApp(page);
    await addVerse(page, JOHN316);
    await page.getByTestId('verse-card').click();
    await page.getByTestId('play-bridge').click();
    const bank = page.getByTestId('bridge-bank');
    await expect(bank.locator('button').first()).toBeVisible();
    const total = await bank.locator('button').count();
    expect(total).toBeGreaterThan(3);
    // nothing laid: he reaches the edge and falls, once
    await expect(page.getByTestId('bridge-hearts')).toHaveAttribute('data-hearts', '2', { timeout: 10_000 });
    // a wrong plank stays on the bank and costs a heart
    await bank.locator('button:not([data-order="0"])').first().click();
    await expect(bank.locator('button')).toHaveCount(total);
    await expect(page.getByTestId('bridge-stage')).toHaveAttribute('data-laid', '0');
    await expect(page.getByTestId('bridge-hearts')).toHaveAttribute('data-hearts', '1');
    for (let i = 0; i < total; i++) await bank.locator(`button[data-order="${i}"]`).click();
    await expect(page.getByTestId('game-finish')).toContainText('Safely across');
    await expect(page.getByTestId('game-stars')).toHaveAttribute('data-stars', '2');
    // and over to another game from here
    await page.getByTestId('game-swap').click();
    await expect(page.getByTestId('game')).toHaveAttribute('data-game', 'gate');
  });
});
