// Group banners (v1.56.0, owner-requested): a small shield made of one simple design in two colours, painted like the knights.
// A banner is just three words, `design-field-pattern` (for example `chevron-crimson-gold`), so it can be stored on the group,
// sent to friends inside a look id and checked with a plain pattern. Presentation only: it never touches scheduling.

export const BANNER_DESIGNS = [
  { id: 'plain', name: 'Plain' },
  { id: 'pale', name: 'Split' },
  { id: 'fess', name: 'Halves' },
  { id: 'bend', name: 'Slash' },
  { id: 'chevron', name: 'Chevron' },
  { id: 'cross', name: 'Cross' },
  { id: 'saltire', name: 'Crossed' },
  { id: 'quarters', name: 'Quarters' },
  { id: 'chief', name: 'Top band' },
  { id: 'bars', name: 'Bars' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'circle', name: 'Circle' },
  { id: 'pall', name: 'Fork' },
  { id: 'border', name: 'Border' },
] as const;

/** Twelve painted colours (softer than pure primaries, so they sit well with the armor). */
export const BANNER_COLORS = [
  { id: 'crimson', name: 'Crimson', hex: '#b3262f' },
  { id: 'orange', name: 'Orange', hex: '#e07a2b' },
  { id: 'gold', name: 'Gold', hex: '#e3b23c' },
  { id: 'green', name: 'Green', hex: '#3c8d4f' },
  { id: 'teal', name: 'Teal', hex: '#1f8a8a' },
  { id: 'sky', name: 'Sky', hex: '#4aa3df' },
  { id: 'navy', name: 'Navy', hex: '#243a73' },
  { id: 'violet', name: 'Violet', hex: '#6b3fa0' },
  { id: 'rose', name: 'Rose', hex: '#d9608f' },
  { id: 'ivory', name: 'Ivory', hex: '#f4efe0' },
  { id: 'silver', name: 'Silver', hex: '#a9b2bd' },
  { id: 'onyx', name: 'Onyx', hex: '#23252b' },
] as const;

export type BannerDesign = (typeof BANNER_DESIGNS)[number]['id'];
export type BannerColor = (typeof BANNER_COLORS)[number]['id'];

export interface Banner {
  design: BannerDesign;
  field: BannerColor;
  pattern: BannerColor;
}

const DESIGN_IDS = new Set<string>(BANNER_DESIGNS.map((d) => d.id));
const COLOR_IDS = new Set<string>(BANNER_COLORS.map((c) => c.id));

export const colorHex = (id: BannerColor): string => BANNER_COLORS.find((c) => c.id === id)!.hex;

/** `design-field-pattern`, or null when it is not one of ours (so a made-up or older value is simply ignored). */
export function parseBanner(spec: unknown): Banner | null {
  if (typeof spec !== 'string') return null;
  const [design, field, pattern, extra] = spec.split('-');
  if (extra !== undefined || !DESIGN_IDS.has(design) || !COLOR_IDS.has(field) || !COLOR_IDS.has(pattern)) return null;
  return { design: design as BannerDesign, field: field as BannerColor, pattern: pattern as BannerColor };
}

export const bannerSpec = (b: Banner): string => `${b.design}-${b.field}-${b.pattern}`;

/** A banner worn as the avatar's background is the item `scene-banner-<spec>`. */
export const BANNER_SCENE_PREFIX = 'scene-banner-';
export const bannerSceneId = (spec: string): string => `${BANNER_SCENE_PREFIX}${spec}`;
export function bannerFromScene(id: string): Banner | null {
  return id.startsWith(BANNER_SCENE_PREFIX) ? parseBanner(id.slice(BANNER_SCENE_PREFIX.length)) : null;
}

/** A group nobody has designed a banner for yet still gets one: always the same for the same group, chosen from its id. */
export function defaultBanner(seed: string): Banner {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const design = BANNER_DESIGNS[h % BANNER_DESIGNS.length].id;
  const field = BANNER_COLORS[(h >>> 4) % BANNER_COLORS.length].id;
  let pattern = BANNER_COLORS[(h >>> 9) % BANNER_COLORS.length].id;
  if (pattern === field) pattern = BANNER_COLORS[((h >>> 9) + 5) % BANNER_COLORS.length].id;
  return { design, field, pattern };
}

/** The banner to show for a group: the one its leader chose, else the default for its id. */
export const bannerOf = (g: { id: string; banner?: string }): Banner => parseBanner(g.banner) ?? defaultBanner(g.id);
