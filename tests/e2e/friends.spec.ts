import { expect, test, type Browser, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

// Each "person" is a separate browser context, so they have separate devices and data. They talk to the same test server.
async function person(browser: Browser, name: string): Promise<Page> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await autoDismissMilestones(page);
  await blockLookups(page);
  await openApp(page);
  await page.goto('/#/friends');
  await page.getByTestId('friends-name').fill(name);
  await page.getByTestId('friends-on').click();
  await expect(page.getByTestId('my-name')).toHaveText(name);
  return page;
}

test('turning on friends needs only a name, and it can be undone', async ({ page }) => {
  await openApp(page, '/#/friends');
  await expect(page.getByTestId('friends-on')).toBeDisabled();
  await page.getByTestId('friends-name').fill('Sam L.');
  await page.getByTestId('friends-on').click();
  await expect(page.getByTestId('my-name')).toHaveText('Sam L.');
  await expect(page.getByTestId('friends-empty')).toBeVisible();
  // remembered after a reload
  await saved(page);
  await page.reload();
  await expect(page.getByTestId('my-name')).toHaveText('Sam L.');
  // switch it off again
  await page.getByTestId('friends-stop').click();
  await page.getByTestId('friends-stop-erase').click();
  await expect(page.getByTestId('friends-on')).toBeVisible();
});

test('inviting a friend: they open the link, say yes, and each sees the other', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('friends-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  expect(code).toMatch(/^[A-Z2-9]{8}$/);
  // Sam opens the link
  await sam.goto(`/#/join/${code}`);
  await expect(sam.getByTestId('join-card')).toContainText('Zach P.');
  await sam.getByTestId('join-yes').click();
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P.');
  // Zach refreshes and sees Sam
  await zach.goto('/#/stats');
  await zach.goto('/#/friends');
  await expect(zach.getByTestId('friend-name')).toHaveText('Sam L.');
  // only the name and progress: never verses
  await expect(zach.getByTestId('friend-list')).not.toContainText('For God');
  // Zach removes Sam: gone for both
  await zach.getByTestId('friend-menu').click();
  await zach.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(zach.getByTestId('friends-empty')).toBeVisible();
  await sam.goto('/#/stats');
  await sam.goto('/#/friends');
  await expect(sam.getByTestId('friends-empty')).toBeVisible();
});

test('a new person opens an invite link before turning friends on: one tap does both', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  await zach.getByTestId('friends-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  const ctx = await browser.newContext();
  const ana = await ctx.newPage();
  await autoDismissMilestones(ana);
  await blockLookups(ana);
  await openApp(ana, `/#/join/${code}`);
  await expect(ana.getByTestId('invited-banner')).toContainText('Zach P.');
  await ana.getByTestId('friends-name').fill('Ana B.');
  await expect(ana.getByTestId('friends-on')).toContainText('Zach P.');
  await ana.getByTestId('friends-on').click();
  await expect(ana.getByTestId('friend-name')).toHaveText('Zach P.');
});

test('a typed code works, and a wrong or own code gets a kind message', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('friends-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).trim();
  await zach.getByRole('button', { name: 'Done' }).click();
  await zach.getByTestId('friends-code').fill(code);
  await zach.getByTestId('friends-add').click();
  await expect(zach.getByTestId('friends-error')).toContainText('your own code');
  await sam.getByTestId('friends-code').fill('hello');
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friends-error')).toContainText('does not look like a code');
  await sam.getByTestId('friends-code').fill('ZZZZ-ZZZZ');
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friends-error')).toContainText('did not work');
  await sam.getByTestId('friends-code').fill(code.toLowerCase());
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P.');
});

test('friends see your progress after you practice', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('friends-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).trim();
  await sam.getByTestId('friends-code').fill(code);
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P.');
  // Zach adds a verse and reviews it
  await addVerse(zach, JOHN316);
  await zach.goto('/#/pile/daily');
  await zach.getByTestId('verse-card').click();
  await zach.getByTestId('review-flashcard').click();
  await finishFlashcard(zach);
  // the profile is sent a moment later; opening the friends page sends anything new right away
  await zach.goto('/#/friends');
  await expect(zach.getByTestId('me-card')).toBeVisible();
  await zach.getByTestId('friends-rename').click();
  await zach.getByTestId('friends-rename-input').fill('Zach P');
  await zach.getByTestId('friends-rename-save').click();
  await sam.goto('/#/stats');
  await sam.goto('/#/friends');
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P');
  await expect(sam.getByTestId('friend-row')).toContainText('1 review this week');
});

test('a friend can cheer you on, and you see it', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('friends-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).trim();
  await sam.getByTestId('friends-code').fill(code);
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P.');
  await sam.getByTestId('friend-cheer').click();
  await expect(sam.getByTestId('toast')).toContainText('You cheered Zach P.');
  await expect(sam.getByTestId('friend-cheer')).toBeDisabled(); // one a day
  await zach.goto('/#/stats');
  await zach.goto('/#/friends');
  await expect(zach.getByTestId('cheers')).toContainText('Sam L. cheered you!');
});

test('groups: create, invite, join, see a shared weekly goal, leave', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await expect(zach.getByTestId('guild-name')).toHaveText('Youth Group');
  await expect(zach.getByTestId('guild-progress')).toContainText('0 of 25 reviews');
  await zach.getByTestId('guild-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.goto(`/#/guild/${code}`);
  await expect(sam.getByTestId('guild-join-card')).toContainText('Youth Group');
  await sam.getByTestId('guild-join-yes').click();
  await expect(sam.getByTestId('guild-name')).toHaveText('Youth Group');
  await expect(sam.getByTestId('guild-progress')).toContainText('of 50 reviews');
  await sam.getByTestId('guild-leave').click();
  await sam.getByRole('button', { name: 'Leave', exact: true }).last().click();
  await expect(sam.getByTestId('guild-card')).toHaveCount(0);
});

test('the friends page fits a phone and has no horizontal scrolling', async ({ browser }) => {
  const zach = await person(browser, 'Zachariah Longname-Hyphenated III');
  await zach.getByTestId('friends-invite').click();
  await expect(zach.getByTestId('invite-sheet')).toBeVisible();
  expect(await zach.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await zach.getByRole('button', { name: 'Done' }).click();
  expect(await zach.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('Friends has its own tab, and invite links keep it highlighted', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-friends').click();
  await expect(page.getByTestId('friends-on')).toBeVisible();
  await expect(page.getByTestId('tab-friends')).toHaveAttribute('aria-current', 'page');
  await page.goto('/#/join/ABCD-EFGH');
  await expect(page.getByTestId('tab-friends')).toHaveAttribute('aria-current', 'page');
});
