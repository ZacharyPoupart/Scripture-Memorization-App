import { expect, test, type Browser, type Page } from '@playwright/test';
import { addVerse, autoDismissMilestones, blockLookups, finishFlashcard, JOHN316, openApp, saved } from './helpers';

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

/** The groups half of the Friends screen (the screen opens on friends). */
async function groupsTab(page: Page) {
  await page.getByTestId('friends-tab-groups').click();
}

/** Open a disclosure (a button with aria-expanded) if it is not open yet. */
async function openIf(page: Page, testid: string) {
  const b = page.getByTestId(testid);
  if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click();
}

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
  await openIf(page, 'friends-settings');
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
  await openIf(zach, 'friends-settings');
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

test('rude names are turned down kindly, for a person and for a group', async ({ page }) => {
  await openApp(page, '/#/friends');
  await page.getByTestId('friends-name').fill('f.u.c.k');
  await page.getByTestId('friends-on').click();
  await expect(page.getByTestId('friends-error')).toContainText('pick a different name');
  await expect(page.getByTestId('my-name')).toHaveCount(0); // still off
  await page.getByTestId('friends-name').fill('Sam L.');
  await page.getByTestId('friends-on').click();
  await expect(page.getByTestId('my-name')).toHaveText('Sam L.');
  await groupsTab(page);
  await page.getByTestId('guild-name-input').fill('Sh1t Club');
  await page.getByTestId('guild-create').click();
  await expect(page.getByTestId('friends-error')).toContainText('pick a different name');
  await expect(page.getByTestId('guild-card')).toHaveCount(0);
  await page.getByTestId('guild-name-input').fill('Youth Group');
  await page.getByTestId('guild-create').click();
  await expect(page.getByTestId('guild-name')).toHaveText('Youth Group');
  await openIf(page, 'guild-more');
  await page.getByTestId('guild-rename').click();
  await page.getByTestId('guild-rename-input').fill('N4zi Club');
  await page.getByTestId('guild-rename-save').click();
  await expect(page.getByTestId('friends-error')).toContainText('pick a different name');
});

test('groups: create, invite, join, see a shared weekly goal, leave', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await groupsTab(zach);
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await expect(zach.getByTestId('guild-name')).toHaveText('Youth Group');
  await expect(zach.getByTestId('guild-progress')).toContainText('0 of 5 reviews'); // nobody has verses yet: the goal is the smallest, 5
  await zach.getByTestId('guild-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.goto(`/#/guild/${code}`);
  await expect(sam.getByTestId('guild-join-card')).toContainText('Youth Group');
  await sam.getByTestId('guild-join-yes').click();
  await expect(sam.getByTestId('guild-name')).toHaveText('Youth Group');
  await expect(sam.getByTestId('guild-progress')).toContainText('of 5 reviews');
  await expect(sam.getByTestId('guild-reward')).toContainText('25 each at the goal'); // the coin reward for a group of two or more
  await expect(sam.getByTestId('guild-countdown')).toContainText(/(\d+ days|\d+ h|\d+ min) left/); // when the week (and the goal) ends
  // who leads, and a members list you can open
  await expect(sam.getByTestId('guild-leader')).toHaveText('Led by Zach P.');
  await expect(zach.getByTestId('guild-leader')).toHaveText('Led by you');
  await openIf(sam, 'guild-members-toggle');
  await expect(sam.getByTestId('guild-members')).toContainText('Leader');
  await sam.getByTestId('guild-member').first().click();
  await expect(sam.getByTestId('friend-sheet')).toBeVisible();
  await expect(sam.getByTestId('friend-sheet-name')).toBeVisible();
  await expect(sam.getByTestId('friend-sheet-cheer')).toHaveCount(0); // they are in the group but not friends
  await sam.getByRole('button', { name: 'Done' }).click();
  // only the leader can rename
  await openIf(sam, 'guild-more');
  await expect(sam.getByTestId('guild-rename')).toHaveCount(0);
  await openIf(zach, 'guild-more');
  await zach.getByTestId('guild-rename').click();
  await zach.getByTestId('guild-rename-input').fill('Bible Crew');
  await zach.getByTestId('guild-rename-save').click();
  await expect(zach.getByTestId('guild-name')).toHaveText('Bible Crew');
  await sam.goto('/#/stats');
  await sam.goto('/#/friends');
  await groupsTab(sam);
  await expect(sam.getByTestId('guild-name')).toHaveText('Bible Crew');
  await openIf(sam, 'guild-more');
  await sam.getByTestId('guild-leave').click();
  await sam.getByRole('button', { name: 'Leave', exact: true }).last().click();
  await expect(sam.getByTestId('guild-card')).toHaveCount(0);
});

test('tapping a friend shows their whole knight, their numbers and the groups you share', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await zach.getByTestId('friends-invite').click();
  const friendCode = (await zach.getByTestId('invite-code').innerText()).trim();
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.getByTestId('friends-code').fill(friendCode);
  await sam.getByTestId('friends-add').click();
  await expect(sam.getByTestId('friend-name')).toHaveText('Zach P.');
  // no group yet
  await sam.getByTestId('friend-open').click();
  await expect(sam.getByTestId('friend-sheet')).toBeVisible();
  await expect(sam.getByTestId('friend-sheet-name')).toHaveText('Zach P.');
  await expect(sam.getByTestId('friend-sheet-streak')).toContainText('0');
  await expect(sam.getByTestId('friend-sheet-longest')).toHaveText('0');
  await expect(sam.getByTestId('friend-sheet-week')).toHaveText('0');
  await expect(sam.getByTestId('friend-sheet-groups')).toContainText('No group together');
  await expect(sam.getByTestId('friend-sheet').locator('svg').first()).toBeVisible(); // the whole knight
  await sam.getByRole('button', { name: 'Done' }).click();
  await expect(sam.getByTestId('friend-sheet')).toHaveCount(0);
  // now a group together
  await groupsTab(zach);
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await zach.getByTestId('guild-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.goto(`/#/guild/${code}`);
  await sam.getByTestId('guild-join-yes').click();
  await expect(sam.getByTestId('guild-name')).toHaveText('Youth Group');
  await sam.getByTestId('friends-tab-friends').click();
  await sam.getByTestId('friend-open').click();
  await expect(sam.getByTestId('friend-sheet-groups')).toContainText('Youth Group');
  await sam.getByTestId('friend-sheet-cheer').click();
  await expect(sam.getByTestId('friend-sheet-cheer')).toContainText('Cheered today');
});

test('a group has a banner next to its name: the leader designs it, members see it and can hang it on their flag stand, and it follows the group', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await groupsTab(zach);
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await expect(zach.getByTestId('guild-name')).toHaveText('Youth Group');
  // every group already has a banner (a default); the leader changes it
  await expect(zach.getByTestId('guild-card').locator('[data-banner]')).toHaveCount(1);
  await openIf(zach, 'guild-more');
  await zach.getByTestId('guild-banner-edit').click();
  await zach.getByTestId('banner-design-chevron').click();
  await zach.getByTestId('banner-field-crimson').click();
  await zach.getByTestId('banner-pattern-gold').click();
  await expect(zach.getByTestId('banner-editor').locator('[data-banner="chevron-crimson-gold"]').first()).toBeVisible(); // the preview follows the choices
  await zach.getByTestId('banner-save').click();
  await expect(zach.getByTestId('banner-editor')).toHaveCount(0);
  await expect(zach.getByTestId('guild-card').locator('[data-banner="chevron-crimson-gold"]')).toBeVisible();
  // Sam joins: sees it, cannot edit it
  await zach.getByTestId('guild-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.goto(`/#/guild/${code}`);
  await sam.getByTestId('guild-join-yes').click();
  await expect(sam.getByTestId('guild-card').locator('[data-banner="chevron-crimson-gold"]')).toBeVisible();
  await openIf(sam, 'guild-more');
  await expect(sam.getByTestId('guild-banner-edit')).toHaveCount(0);
  // and Sam can hang it on the flag stand next to the knight (not as the background)
  await sam.goto('/#/avatar');
  await sam.getByTestId('slot-flag').click();
  await sam.getByTestId('item-flag-chevron-crimson-gold').click();
  await expect(sam.getByTestId('item-flag-chevron-crimson-gold')).toContainText('Wearing');
  await expect(sam.locator('svg [data-flag="chevron-crimson-gold"]').first()).toBeVisible();
  // the leader redesigns it: Sam's flag changes the next time the groups load
  await openIf(zach, 'guild-more');
  await zach.getByTestId('guild-banner-edit').click();
  await zach.getByTestId('banner-design-cross').click();
  await zach.getByTestId('banner-field-teal').click();
  await zach.getByTestId('banner-pattern-ivory').click();
  await zach.getByTestId('banner-save').click();
  await expect(zach.getByTestId('banner-editor')).toHaveCount(0);
  await sam.goto('/#/friends');
  await groupsTab(sam);
  await expect(sam.getByTestId('guild-card').locator('[data-banner="cross-teal-ivory"]')).toBeVisible();
  await sam.goto('/#/avatar');
  await expect(sam.locator('svg [data-flag="cross-teal-ivory"]').first()).toBeVisible();
  await expect(sam.locator('svg [data-flag="chevron-crimson-gold"]')).toHaveCount(0);
  // Sam leaves the group: the flag goes
  await sam.goto('/#/friends');
  await groupsTab(sam);
  await openIf(sam, 'guild-more');
  await sam.getByTestId('guild-leave').click();
  await sam.getByRole('button', { name: 'Leave', exact: true }).last().click();
  await expect(sam.getByTestId('guild-card')).toHaveCount(0);
  await sam.goto('/#/avatar');
  await expect(sam.locator('svg [data-flag]')).toHaveCount(0);
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

test('Friends and Groups are two halves you switch between, and the screen can be used by keyboard and screen reader', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  // two tabs, the first one selected, linked to their panels
  const tabs = zach.getByRole('tab');
  await expect(tabs).toHaveCount(2);
  await expect(zach.getByRole('tab', { name: /^Friends/ })).toHaveAttribute('aria-selected', 'true');
  await expect(zach.getByRole('tabpanel')).toBeVisible();
  await expect(zach.getByTestId('guild-name-input')).toHaveCount(0); // groups are not on this half
  // arrow keys move between the tabs
  await zach.getByRole('tab', { name: /^Friends/ }).focus();
  await zach.keyboard.press('ArrowRight');
  await expect(zach.getByRole('tab', { name: /^Groups/ })).toHaveAttribute('aria-selected', 'true');
  await expect(zach.getByTestId('guild-name-input')).toBeVisible();
  await zach.keyboard.press('ArrowLeft');
  await expect(zach.getByRole('tab', { name: /^Friends/ })).toHaveAttribute('aria-selected', 'true');
  // the things you rarely need are tucked away, and say so (aria-expanded)
  const sharing = zach.getByTestId('friends-settings');
  await expect(sharing).toHaveAttribute('aria-expanded', 'false');
  await expect(zach.getByTestId('friends-stop')).toHaveCount(0);
  await sharing.click();
  await expect(sharing).toHaveAttribute('aria-expanded', 'true');
  await expect(zach.getByTestId('friends-stop')).toBeVisible();
  // every button and field on the screen is a comfortable size to touch
  await groupsTab(zach);
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await expect(zach.getByTestId('guild-name')).toBeVisible();
  for (const b of await zach.getByRole('main').getByRole('button').all()) {
    if (!(await b.isVisible())) continue;
    const box = (await b.boundingBox())!;
    expect(box.height, await b.innerText()).toBeGreaterThanOrEqual(40);
  }
});

test('the leader can choose a new leader, and leaving tells who takes over', async ({ browser }) => {
  const zach = await person(browser, 'Zach P.');
  const sam = await person(browser, 'Sam L.');
  await groupsTab(zach);
  await zach.getByTestId('guild-name-input').fill('Youth Group');
  await zach.getByTestId('guild-create').click();
  await expect(zach.getByTestId('guild-leader')).toHaveText('Led by you');
  // with only one person there is nobody to choose
  await openIf(zach, 'guild-more');
  await expect(zach.getByTestId('guild-transfer')).toHaveCount(0);
  await zach.getByTestId('guild-invite').click();
  const code = (await zach.getByTestId('invite-code').innerText()).replace('-', '');
  await zach.getByRole('button', { name: 'Done' }).click();
  await sam.goto(`/#/guild/${code}`);
  await sam.getByTestId('guild-join-yes').click();
  await expect(sam.getByTestId('guild-leader')).toHaveText('Led by Zach P.');
  // Zach picks Sam
  await zach.goto('/#/stats');
  await zach.goto('/#/friends');
  await groupsTab(zach);
  await openIf(zach, 'guild-more');
  await zach.getByTestId('guild-transfer').click();
  await expect(zach.getByTestId('leader-picker')).toBeVisible();
  await expect(zach.getByTestId('leader-option')).toHaveCount(1); // everyone but you
  await zach.getByTestId('leader-option').click();
  await zach.getByRole('button', { name: 'Make leader' }).click();
  await expect(zach.getByTestId('guild-leader')).toHaveText('Led by Sam L.');
  await expect(zach.getByTestId('guild-rename')).toHaveCount(0); // no longer the leader
  // Sam now leads, and leaving would pass it back to the person who has been there longest
  await sam.goto('/#/stats');
  await sam.goto('/#/friends');
  await groupsTab(sam);
  await expect(sam.getByTestId('guild-leader')).toHaveText('Led by you');
  await openIf(sam, 'guild-more');
  await sam.getByTestId('guild-leave').click();
  await expect(sam.getByText('Zach P., who has been in the group longest, will lead it')).toBeVisible();
});
