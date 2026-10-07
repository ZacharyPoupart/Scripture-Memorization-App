import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Accessibility guard: every text/background pairing the UI uses must meet WCAG AA (4.5:1) in BOTH themes,
// and neither theme may use pure black or pure white as a main text/background colour (glare).
const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

function vars(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}
const lightBlock = css.match(/^:root \{([\s\S]*?)\n\}/m)![1];
const mediaDark = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme='light'\]\) \{([\s\S]*?)\n  \}\n\}/)![1];
const attrDark = css.match(/^:root\[data-theme='dark'\] \{([\s\S]*?)\n\}/m)![1];

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const PAIRS: [string, string][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'surface-2'],
  ['muted', 'bg'], ['muted', 'surface'], ['muted', 'surface-2'],
  ['accent-strong', 'bg'], ['accent-strong', 'surface'],
  ['on-accent', 'accent'],
  ['good', 'good-bg'], ['warn', 'warn-bg'], ['bad', 'bad-bg'],
  ['good', 'surface'], ['bad', 'surface'], ['warn', 'bg'],
  ['on-pile', 'daily'], ['on-pile', 'weekly'], ['on-pile', 'monthly'], ['on-pile', 'yearly'],
  ['daily', 'surface'], ['weekly', 'surface'], ['monthly', 'surface'], ['yearly', 'surface'],
];

describe('theme contrast (WCAG AA)', () => {
  const themes = { light: vars(lightBlock), dark: vars(attrDark) };

  it('the "follow the system" dark block is identical to the forced dark block', () => {
    expect(vars(mediaDark)).toEqual(themes.dark);
  });

  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: all text pairs are at least 4.5:1`, () => {
      for (const [fg, bg] of PAIRS) {
        expect(t[fg], `${name} --${fg} missing`).toBeTruthy();
        expect(t[bg], `${name} --${bg} missing`).toBeTruthy();
        expect(ratio(t[fg], t[bg]), `${name}: --${fg} on --${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    });
    it(`${name}: no pure black/white for text or backgrounds`, () => {
      for (const k of ['text', 'bg', 'surface', 'muted']) expect(['#000000', '#ffffff']).not.toContain(t[k]);
    });
  }
});
