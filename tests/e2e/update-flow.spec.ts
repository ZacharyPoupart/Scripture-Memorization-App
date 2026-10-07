import { expect, test } from '@playwright/test';
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addVerse, blockLookups, JOHN316 } from './helpers';

// "A new version was deployed" on an installed app: the Update bar appears, tapping it switches to the new
// version, the verses are still there, and the app STILL starts with no network afterwards.
// Uses two real builds (9.0.1 then 9.0.2) served from a scratch folder on its own port.

test.describe.configure({ mode: 'serial' });
const PORT = 4180;
const ORIGIN = `http://127.0.0.1:${PORT}`;
test.use({ baseURL: ORIGIN }); // the shared helpers use relative URLs
let work = '';
let server: ChildProcess;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  work = mkdtempSync(join(tmpdir(), 'mfl-update-'));
  for (const v of ['9.0.1', '9.0.2']) {
    execFileSync('npx', ['vite', 'build', '--outDir', join(work, v), '--emptyOutDir'], {
      env: { ...process.env, APP_VERSION_OVERRIDE: v },
      stdio: 'ignore',
    });
  }
  cpSync(join(work, '9.0.1'), join(work, 'live'), { recursive: true });
  server = spawn('node', ['scripts/e2e-server.mjs'], { env: { ...process.env, PORT: String(PORT), DIST_DIR: join(work, 'live') }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(ORIGIN)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('update-test server did not start');
});

test.afterAll(() => {
  server?.kill();
  if (work) rmSync(work, { recursive: true, force: true });
});

test('update bar → new version → data kept → still starts offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium');
  test.setTimeout(120_000);
  await blockLookups(page);
  await page.goto(ORIGIN + '/');
  await page.getByTestId('onboarding-skip').click();
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error('no active service worker');
  });
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto(ORIGIN + '/#/');
  await addVerse(page, JOHN316);
  await page.goto(ORIGIN + '/#/about');
  await expect(page.getByTestId('version')).toContainText('9.0.1');

  // "deploy" the new version: swap the files the server serves
  for (const f of readdirSync(join(work, 'live'))) rmSync(join(work, 'live', f), { recursive: true, force: true });
  cpSync(join(work, '9.0.2'), join(work, 'live'), { recursive: true });

  // the app checks for updates when it comes back to the foreground; trigger the same check
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect(page.locator('.banner-update')).toContainText('A new version is ready', { timeout: 20_000 });
  await Promise.all([page.waitForEvent('load'), page.locator('.banner-update button').click()]);
  await page.goto(ORIGIN + '/#/about');
  await expect(page.getByTestId('version')).toContainText('9.0.2', { timeout: 15_000 });
  await page.goto(ORIGIN + '/#/pile/daily');
  await expect(page.getByTestId('verse-card')).toHaveCount(1); // data survived the update

  // and offline start still works on the new version
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('verse-card')).toHaveCount(1);
  await page.goto(ORIGIN + '/#/about');
  await expect(page.getByTestId('version')).toContainText('9.0.2');
  await context.setOffline(false);
});
