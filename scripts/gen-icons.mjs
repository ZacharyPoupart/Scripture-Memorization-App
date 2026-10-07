// Renders public/icon.svg to the PNG icons the PWA manifest and iOS need.
// Uses the Chromium that Playwright already provides:  npm run gen:icons
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8');
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();

async function render(size, file, { padding = 0, full = false } = {}) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  const body = full
    ? svg.replace('rx="112"', 'rx="0"')
    : svg;
  await page.setContent(
    `<style>html,body{margin:0;background:${full ? '#2a6468' : 'transparent'}}svg{position:absolute;left:${padding}px;top:${padding}px;width:${inner}px;height:${inner}px}</style>${body}`,
  );
  const buf = await page.screenshot({ omitBackground: !full, clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(`../public/${file}`, import.meta.url), buf);
  console.log('wrote', file);
}

await render(192, 'icon-192.png');
await render(512, 'icon-512.png');
await render(180, 'apple-touch-icon.png', { full: true }); // iOS rounds corners itself
await render(512, 'icon-maskable-512.png', { padding: 64, full: true }); // safe zone for maskable
await browser.close();
