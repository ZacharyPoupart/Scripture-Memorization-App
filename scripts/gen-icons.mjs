// Builds the PWA / iOS icons from design/app-icon-master.png (1024px, rounded corners, transparent outside).
// Uses the Chromium that Playwright already provides:  npm run gen:icons
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const NAVY = '#07173a'; // the icon's own deep blue, used behind full-bleed versions
const master = 'data:image/png;base64,' + readFileSync(new URL('../design/app-icon-master.png', import.meta.url)).toString('base64');
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();

async function render(size, file, { padding = 0, full = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  // full-bleed versions (iOS rounds corners itself; maskable icons are cropped by the OS) sit on solid navy
  const scale = 1;
  await page.setContent(
    `<style>html,body{margin:0;background:${full ? NAVY : 'transparent'}}img{position:absolute;left:${padding}px;top:${padding}px;width:${inner}px;height:${inner}px;transform:scale(${scale})}</style><img src="${master}">`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  const buf = await page.screenshot({ omitBackground: !full, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(`../public/${file}`, import.meta.url), buf);
  console.log('wrote', file);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png', { full: true });
await render(512, 'icon-maskable-512.png', { padding: 56, full: true }); // safe zone for maskable
await render(128, 'favicon-128.png');
await browser.close();
