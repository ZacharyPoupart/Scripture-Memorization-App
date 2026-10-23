import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { autoDismissMilestones, blockLookups, openApp, replaceDataWith } from './helpers';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/backup-v1.1.0.json', import.meta.url), 'utf8')).data;

test.beforeEach(async ({ page }) => {
  await autoDismissMilestones(page);
  await blockLookups(page);
});

/** The fixture's verses, repeated under thirty different topics (all Daily, so they share one list). */
function withTopics(n: number) {
  const data = structuredClone(fixture);
  const base = Object.values<any>(data.verses).find((v) => !v.deletedAt && v.pile === 'daily') ?? Object.values<any>(data.verses)[0];
  data.verses = {};
  for (let i = 0; i < n; i++) {
    const id = `t${i}`;
    data.verses[id] = { ...structuredClone(base), id, topic: `Topic ${String(i).padStart(2, '0')}`, chapter: 1 + (i % 20), start: 1 + i, end: 1 + i, deletedAt: undefined };
  }
  return data;
}

test('many topics fold into one tidy, searchable list', async ({ page }) => {
  await openApp(page);
  await replaceDataWith(page, withTopics(30));
  await page.goto('/#/pile/daily');
  // one button instead of thirty chips
  await expect(page.getByTestId('topic-open')).toContainText('all (30)');
  await expect(page.getByRole('button', { name: '#Topic 07', exact: true })).toHaveCount(0);
  await page.getByTestId('topic-open').click();
  await expect(page.getByTestId('topic-sheet')).toBeVisible();
  await expect(page.getByTestId('topic-sheet').locator('.topic-row')).toHaveCount(31); // all topics + thirty
  // search narrows it, then pick one
  await page.getByTestId('topic-search').fill('topic 1');
  await expect(page.getByTestId('topic-sheet').locator('.topic-row')).toHaveCount(10);
  await page.getByTestId('topic-search').fill('topic 07');
  await page.getByTestId('topic-option-Topic 07').click();
  await expect(page.getByTestId('topic-sheet')).toBeHidden();
  await expect(page.getByTestId('topic-open')).toContainText('#Topic 07');
  await expect(page.getByTestId('verse-card')).toHaveCount(1);
  // clear goes back to everything; rename is still there
  await expect(page.getByTestId('rename-topic')).toBeVisible();
  await page.getByTestId('topic-clear').click();
  await expect(page.getByTestId('topic-open')).toContainText('all (30)');
  expect(await page.getByTestId('verse-card').count()).toBeGreaterThan(1);
});

test('a few topics still show as plain buttons', async ({ page }) => {
  await openApp(page);
  await replaceDataWith(page, withTopics(4));
  await page.goto('/#/pile/daily');
  await expect(page.getByTestId('topic-open')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '#Topic 03', exact: true })).toBeVisible();
});
