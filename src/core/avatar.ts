// Avatar and seeds. Seeds are EARNED from real, counted practice and are never lost; items are bought with them or
// unlocked by achievements. Everything is derived from synced data (ledger, level-ups, counters), so devices agree,
// no new "wallet" state can drift, and nothing can ever be taken away. Presentation only: it never touches scheduling.
//
// The avatar is a knight who can put on the full armor of God (Ephesians 6:10-18). Everything that makes the figure
// look like YOU (skin, hair, eyes, beard, glasses, tunic) is free. Armor, capes, crowns, extras, companions and scenes
// are earned: some with seeds, some by streak length, and the finest armor takes the longest streaks of all.
import { STREAK_MILESTONES } from './milestones.ts';
import type { AppData } from './types.ts';

export type Slot =
  | 'skin'
  | 'hair'
  | 'hairColor'
  | 'eyes'
  | 'beard'
  | 'glasses'
  | 'tunic'
  | 'helmet'
  | 'breastplate'
  | 'belt'
  | 'shoes'
  | 'shield'
  | 'sword'
  | 'cape'
  | 'crown'
  | 'extra'
  | 'companion'
  | 'background';

export interface SlotGroup {
  key: 'me' | 'armor' | 'extras';
  label: string;
  slots: Slot[];
}
export const SLOT_GROUPS: SlotGroup[] = [
  { key: 'me', label: 'You', slots: ['skin', 'hair', 'hairColor', 'eyes', 'beard', 'glasses', 'tunic'] },
  { key: 'armor', label: 'Armor of God', slots: ['helmet', 'breastplate', 'belt', 'shoes', 'shield', 'sword'] },
  { key: 'extras', label: 'Extras', slots: ['cape', 'crown', 'extra', 'companion', 'background'] },
];
export const SLOTS: Slot[] = SLOT_GROUPS.flatMap((g) => g.slots);
export const SLOT_LABELS: Record<Slot, string> = {
  skin: 'Skin',
  hair: 'Hair',
  hairColor: 'Hair colour',
  eyes: 'Eyes',
  beard: 'Beard',
  glasses: 'Glasses',
  tunic: 'Tunic',
  helmet: 'Helmet',
  breastplate: 'Breastplate',
  belt: 'Belt',
  shoes: 'Shoes',
  shield: 'Shield',
  sword: 'Sword',
  cape: 'Cape',
  crown: 'Crown',
  extra: 'Extras',
  companion: 'Companion',
  background: 'Scene',
};

/** The six pieces of the armor of God, with where each is named (Ephesians 6:14-17). */
export const ARMOR_SLOTS = ['belt', 'breastplate', 'shoes', 'shield', 'helmet', 'sword'] as const;
export const ARMOR_NAMES: Record<(typeof ARMOR_SLOTS)[number], { title: string; verse: string }> = {
  belt: { title: 'Belt of Truth', verse: 'Ephesians 6:14' },
  breastplate: { title: 'Breastplate of Righteousness', verse: 'Ephesians 6:14' },
  shoes: { title: 'Shoes of the Gospel of Peace', verse: 'Ephesians 6:15' },
  shield: { title: 'Shield of Faith', verse: 'Ephesians 6:16' },
  helmet: { title: 'Helmet of Salvation', verse: 'Ephesians 6:17' },
  sword: { title: 'Sword of the Spirit', verse: 'Ephesians 6:17' },
};

export type Unlock =
  | { kind: 'streak'; days: number }
  | { kind: 'reviews'; n: number }
  | { kind: 'levelups'; n: number }
  | { kind: 'yearly' };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Seeds. 0 = free (or earned, when `unlock` is set). */
  cost: number;
  /** Earned for free when the achievement is reached. */
  unlock?: Unlock;
  /** Main colour (skin tone, hair colour, metal, scene) for the drawing. */
  color?: string;
  /** Armor sets: which set a piece belongs to, and how rare it is. */
  set?: string;
  rarity?: ArmorSet['rarity'];
  /** Must be reached before this item can be bought (it still costs seeds). */
  requires?: Unlock;
}

const I = (slot: Slot, id: string, name: string, cost = 0, extra: Partial<Item> = {}): Item => ({ id, slot, name, cost, ...extra });
const streak = (days: number): Unlock => ({ kind: 'streak', days });

// Armor comes in ten sets, from The Initiate to The Legend, each costing more than the one before. Every set has a piece for
// each of the six slots, so you can mix and match or complete a set. The last three sets also ask for a long streak.
export interface ArmorSet {
  key: string;
  name: string;
  tagline: string;
  rarity: 'Basic' | 'Common' | 'Rare' | 'Epic' | 'Legendary';
  /** Seeds for each piece of the set. */
  price: number;
  /** A streak (in days) you must have reached before the set can be bought. */
  streak?: number;
  /** What the helmet slot is called for this set. */
  helm?: string;
  color: string;
}
export const ARMOR_SETS: ArmorSet[] = [
  { key: 'initiate', name: 'The Initiate', tagline: 'Every legend starts somewhere.', rarity: 'Basic', price: 15, color: '#3f62a8' },
  { key: 'soldier', name: 'The Soldier', tagline: 'Stronger. Braver. Farther.', rarity: 'Basic', price: 35, color: '#7f8996' },
  { key: 'vanguard', name: 'The Vanguard', tagline: 'Discipline builds strength.', rarity: 'Common', price: 70, color: '#aab5c4' },
  { key: 'paladin', name: 'The Paladin', tagline: 'Faith. Courage. Purpose.', rarity: 'Common', price: 120, color: '#e8e2cf' },
  { key: 'warden', name: 'The Warden', tagline: 'Hold the line.', rarity: 'Rare', price: 190, color: '#4a4348' },
  { key: 'ranger', name: 'The Ranger', tagline: 'Swift. Silent. Ready.', rarity: 'Rare', price: 280, helm: 'hood', color: '#4f7a4a' },
  { key: 'crusader', name: 'The Crusader', tagline: 'For a greater tomorrow.', rarity: 'Epic', price: 400, color: '#b5483f' },
  { key: 'shadow', name: 'The Shadow', tagline: 'Move unseen. Strike true.', rarity: 'Epic', price: 560, streak: 90, helm: 'hood', color: '#5b3f86' },
  { key: 'storm', name: 'The Storm', tagline: 'Power in motion.', rarity: 'Legendary', price: 780, streak: 180, color: '#4a78c9' },
  { key: 'legend', name: 'The Legend', tagline: 'All that you’ve become.', rarity: 'Legendary', price: 1100, streak: 365, color: '#e2b53c' },
];
const NOUN: Record<(typeof ARMOR_SLOTS)[number], string> = { belt: 'belt', breastplate: 'armor', shoes: 'boots', shield: 'shield', helmet: 'helm', sword: 'sword' };
const armor: Item[] = ARMOR_SLOTS.flatMap((slot) => [
  I(slot, `${slot}-none`, 'None'),
  ...ARMOR_SETS.map((t) =>
    I(slot, `${slot}-${t.key}`, `${t.name.replace('The ', '')} ${slot === 'helmet' && t.helm ? t.helm : NOUN[slot]}`, t.price, {
      color: t.color,
      set: t.key,
      rarity: t.rarity,
      ...(t.streak ? { requires: streak(t.streak) } : {}),
    }),
  ),
]);

export const ITEMS: Item[] = [
  // ---- you: all free, so the knight can look like you
  I('skin', 'skin-peach', 'Peach', 0, { color: '#f6d6bd' }),
  I('skin', 'skin-rosy', 'Rosy', 0, { color: '#f3c4b0' }),
  I('skin', 'skin-sand', 'Sand', 0, { color: '#efc09a' }),
  I('skin', 'skin-olive', 'Olive', 0, { color: '#d2ad7e' }),
  I('skin', 'skin-honey', 'Honey', 0, { color: '#d9a273' }),
  I('skin', 'skin-caramel', 'Caramel', 0, { color: '#b87c52' }),
  I('skin', 'skin-cocoa', 'Cocoa', 0, { color: '#8d5a3a' }),
  I('skin', 'skin-espresso', 'Espresso', 0, { color: '#5e3a24' }),
  I('hair', 'hair-short', 'Short'),
  I('hair', 'hair-long', 'Long'),
  I('hair', 'hair-curly', 'Curly'),
  I('hair', 'hair-buzz', 'Buzz'),
  I('hair', 'hair-bun', 'Bun'),
  I('hair', 'hair-wave', 'Wavy bob'),
  I('hair', 'hair-spiky', 'Spiky'),
  I('hair', 'hair-ponytail', 'Ponytail'),
  I('hair', 'hair-afro', 'Afro'),
  I('hair', 'hair-none', 'Bald'),
  I('hairColor', 'hc-black', 'Black', 0, { color: '#2b2522' }),
  I('hairColor', 'hc-brown', 'Brown', 0, { color: '#6a4630' }),
  I('hairColor', 'hc-auburn', 'Auburn', 0, { color: '#9b4a2c' }),
  I('hairColor', 'hc-ginger', 'Ginger', 0, { color: '#c4682b' }),
  I('hairColor', 'hc-blond', 'Blond', 0, { color: '#d8b25f' }),
  I('hairColor', 'hc-platinum', 'Platinum', 0, { color: '#ece0b8' }),
  I('hairColor', 'hc-gray', 'Silver', 0, { color: '#a7a9ad' }),
  I('hairColor', 'hc-white', 'White', 0, { color: '#f1f1ee' }),
  I('hairColor', 'hc-teal', 'Teal', 0, { color: '#2f9aa0' }),
  I('hairColor', 'hc-pink', 'Rose', 0, { color: '#d9788f' }),
  I('hairColor', 'hc-violet', 'Violet', 0, { color: '#7d63c4' }),
  I('hairColor', 'hc-blue', 'Blue', 0, { color: '#4a78c9' }),
  I('hairColor', 'hc-green', 'Green', 0, { color: '#5aa05a' }),
  I('eyes', 'eyes-brown', 'Brown', 0, { color: '#5a3a24' }),
  I('eyes', 'eyes-hazel', 'Hazel', 0, { color: '#8a6a2c' }),
  I('eyes', 'eyes-green', 'Green', 0, { color: '#4f9a62' }),
  I('eyes', 'eyes-blue', 'Blue', 0, { color: '#4a78c9' }),
  I('eyes', 'eyes-gray', 'Gray', 0, { color: '#7a8794' }),
  I('beard', 'beard-none', 'None'),
  I('beard', 'beard-stubble', 'Stubble'),
  I('beard', 'beard-moustache', 'Moustache'),
  I('beard', 'beard-goatee', 'Goatee'),
  I('beard', 'beard-short', 'Short beard'),
  I('beard', 'beard-full', 'Full beard'),
  I('glasses', 'gl-none', 'None'),
  I('glasses', 'gl-round', 'Round'),
  I('glasses', 'gl-square', 'Square'),
  I('tunic', 'tunic-teal', 'Teal', 0, { color: '#2a6569' }),
  I('tunic', 'tunic-sand', 'Sand', 0, { color: '#c9a66b' }),
  I('tunic', 'tunic-red', 'Red', 0, { color: '#b5483f' }),
  I('tunic', 'tunic-navy', 'Navy', 0, { color: '#2f3e63' }),
  I('tunic', 'tunic-forest', 'Forest', 0, { color: '#4f7a4a' }),
  I('tunic', 'tunic-plum', 'Plum', 0, { color: '#7a4a78' }),
  I('tunic', 'tunic-charcoal', 'Charcoal', 0, { color: '#4a4f55' }),
  I('tunic', 'tunic-white', 'White', 0, { color: '#efe9db' }),

  // ---- the armor of God
  ...armor,

  // ---- capes
  I('cape', 'cape-none', 'None'),
  I('cape', 'cape-crimson', 'Crimson cape', 40, { color: '#b5483f' }),
  I('cape', 'cape-blue', 'Blue cape', 40, { color: '#3f6ea8' }),
  I('cape', 'cape-forest', 'Forest cape', 40, { color: '#4f7a4a' }),
  I('cape', 'cape-violet', 'Violet cape', 70, { color: '#6e4fa0' }),
  I('cape', 'cape-white', 'White cape', 90, { color: '#f4f1e8' }),
  I('cape', 'cape-gold', 'Golden mantle', 0, { color: '#e2b53c', unlock: streak(100) }),
  I('cape', 'cape-wings', 'Wings of light', 0, { color: '#fffaf0', unlock: streak(500) }),
  // ---- crowns (they sit on top of a helmet, too)
  I('crown', 'crown-none', 'None'),
  I('crown', 'crown-flower', 'Flower', 25),
  I('crown', 'crown-laurel', 'Laurel', 0, { unlock: streak(14) }),
  I('crown', 'crown-royal', 'Royal crown', 300),
  I('crown', 'crown-halo', 'Halo', 0, { unlock: { kind: 'yearly' } }),
  I('crown', 'crown-life', 'Crown of life', 0, { unlock: streak(730) }),
  // ---- extras
  I('extra', 'ex-none', 'None'),
  I('extra', 'ex-butterfly', 'Butterfly', 30),
  I('extra', 'ex-bowtie', 'Bow tie', 25),
  I('extra', 'ex-scarf', 'Scarf', 35),
  I('extra', 'ex-star', 'Little star', 40),
  I('extra', 'ex-scroll', 'Scroll', 40),
  I('extra', 'ex-headphones', 'Headphones', 45),
  I('extra', 'ex-lantern', 'Lantern', 50),
  I('extra', 'ex-banner', 'Banner', 60),
  I('extra', 'ex-medal', 'Medal', 0, { unlock: { kind: 'levelups', n: 1 } }),
  I('extra', 'ex-scholar', 'Scholar’s sash', 0, { unlock: { kind: 'reviews', n: 500 } }),
  // ---- companions
  I('companion', 'pet-none', 'None'),
  I('companion', 'pet-sprout', 'Sprout', 0, { unlock: streak(3) }),
  I('companion', 'pet-lamb', 'Lamb', 60),
  I('companion', 'pet-dove', 'Dove', 60),
  I('companion', 'pet-kitten', 'Kitten', 80),
  I('companion', 'pet-puppy', 'Puppy', 80),
  I('companion', 'pet-owl', 'Owl', 100),
  I('companion', 'pet-eagle', 'Eagle', 120),
  I('companion', 'pet-dragon', 'Baby dragon', 200),
  I('companion', 'pet-lion', 'Lion cub', 0, { unlock: streak(365) }),
  I('companion', 'pet-angel', 'Guardian angel', 0, { unlock: streak(500) }),
  // ---- scenes
  I('background', 'bg-sky', 'Morning sky', 0, { color: '#cfe6ea' }),
  I('background', 'bg-meadow', 'Meadow', 0, { color: '#d6e8c4' }),
  I('background', 'bg-sunrise', 'Sunrise', 40, { color: '#f4d3b0' }),
  I('background', 'bg-dusk', 'Dusk', 40, { color: '#c9bfe0' }),
  I('background', 'bg-night', 'Starry night', 60, { color: '#2d3a63' }),
  I('background', 'bg-garden', 'Garden', 70, { color: '#bfe0c8' }),
  I('background', 'bg-castle', 'Castle wall', 70, { color: '#c9ccd4' }),
  I('background', 'bg-library', 'Library', 80, { color: '#d9c2a0' }),
  I('background', 'bg-mountain', 'Mountain top', 90, { color: '#cfdcea' }),
  I('background', 'bg-gold', 'Golden hour', 0, { color: '#f1d27a', unlock: streak(100) }),
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: string): Item | undefined => BY_ID.get(id);
export const itemsIn = (slot: Slot): Item[] => ITEMS.filter((i) => i.slot === slot);

export type Look = Record<Slot, string>;

export function defaultLook(): Look {
  return {
    skin: 'skin-sand',
    hair: 'hair-short',
    hairColor: 'hc-brown',
    eyes: 'eyes-brown',
    beard: 'beard-none',
    glasses: 'gl-none',
    tunic: 'tunic-teal',
    helmet: 'helmet-none',
    breastplate: 'breastplate-none',
    belt: 'belt-none',
    shoes: 'shoes-none',
    shield: 'shield-none',
    sword: 'sword-none',
    cape: 'cape-none',
    crown: 'crown-none',
    extra: 'ex-none',
    companion: 'pet-none',
    background: 'bg-sky',
  };
}

/** How many of the six pieces of the armor of God are being worn (0-6). */
export function armorWorn(look: Look): number {
  return ARMOR_SLOTS.filter((s) => !look[s].endsWith('-none')).length;
}

/** The set being worn if all six pieces belong to the same one. */
export function completedSet(look: Look): ArmorSet | undefined {
  const keys = ARMOR_SLOTS.map((slot) => itemById(look[slot])?.set);
  return keys.every((k) => k && k === keys[0]) ? ARMOR_SETS.find((x) => x.key === keys[0]) : undefined;
}

export function describeUnlock(u: Unlock): string {
  switch (u.kind) {
    case 'streak':
      return `Reach a ${u.days}-day streak`;
    case 'reviews':
      return `Complete ${u.n} reviews`;
    case 'levelups':
      return u.n === 1 ? 'Move a verse up to the next pile' : `Move ${u.n} verses up`;
    case 'yearly':
      return 'Get a verse all the way to Yearly';
  }
}

// ---------------------------------------------------------------- seeds

/** Bonus seeds the first time your longest streak reaches each milestone. */
export const STREAK_SEED_BONUS: Record<number, number> = {
  1: 2,
  3: 5,
  7: 10,
  14: 15,
  30: 40,
  60: 60,
  100: 150,
  150: 100,
  200: 100,
  365: 300,
  500: 200,
  730: 300,
  1000: 500,
};

export const SEEDS_PER_REVIEW = 1;
export const SEEDS_PER_DAY = 5;
export const SEEDS_PER_LEVELUP = 25;

const totalCounted = (data: AppData) => Object.values(data.reviewsByDevice).reduce((a, b) => a + b, 0);

/**
 * Everything earned so far. Derived only from grow-only data (counted-review counters, the ledger, level-ups,
 * the longest streak), so it never goes down, whatever order devices sync in. Extra practice and "start partway"
 * earn nothing: seeds come from real, counted reviews.
 */
export function seedsEarned(data: AppData): number {
  const days = Object.values(data.ledger).filter((e) => e.o === 'c').length;
  let bonus = 0;
  for (const m of STREAK_MILESTONES) if (data.longestStreak >= m) bonus += STREAK_SEED_BONUS[m] ?? 0;
  return totalCounted(data) * SEEDS_PER_REVIEW + days * SEEDS_PER_DAY + data.levelUps.length * SEEDS_PER_LEVELUP + bonus;
}

export function seedsSpent(data: AppData): number {
  return (data.avatar?.owned ?? []).reduce((sum, id) => sum + (itemById(id)?.cost ?? 0), 0);
}

/** What you can spend. Never below zero (two devices spending the same seeds can overlap; nothing is taken back). */
export function seedsBalance(data: AppData): number {
  return Math.max(0, seedsEarned(data) - seedsSpent(data));
}

// ---------------------------------------------------------------- owning, buying, wearing

/** Has the achievement behind an unlock been reached? */
export function meets(data: AppData, u: Unlock): boolean {
  switch (u.kind) {
    case 'streak':
      return data.longestStreak >= u.days;
    case 'reviews':
      return totalCounted(data) >= u.n;
    case 'levelups':
      return data.levelUps.length >= u.n;
    case 'yearly':
      return data.levelUps.some((l) => l.to === 'yearly') || Object.values(data.verses).some((v) => !v.deletedAt && v.pile === 'yearly');
  }
}

export function isUnlocked(data: AppData, item: Item): boolean {
  return item.unlock ? meets(data, item.unlock) : false;
}

/** Bought items that still need an achievement (e.g. a long streak) before they can be bought. */
/**
 * TEMPORARY, for testing: while `armorFree` is on, every armor piece can be worn for free (and a streak is not needed).
 * Nothing is bought or recorded, so seeds are untouched, and turning it off simply takes the unearned armor off again.
 * To end the test, set `armorFree` to false (one line) and remove the banner on the avatar screen.
 */
export const testing = { armorFree: true };

export function isGated(data: AppData, item: Item): boolean {
  if (testing.armorFree && item.set) return false;
  return !!item.requires && !meets(data, item.requires);
}

/** Free items, bought items, and earned items that have been unlocked. */
export function owns(data: AppData, item: Item): boolean {
  if (testing.armorFree && item.set) return true;
  if (item.unlock) return isUnlocked(data, item);
  return item.cost === 0 || (data.avatar?.owned ?? []).includes(item.id);
}

export type BuyResult = { ok: true } | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'funds' };

export function buyItem(data: AppData, id: string, now: number): BuyResult {
  const item = itemById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.unlock) return { ok: false, reason: isUnlocked(data, item) ? 'owned' : 'locked' };
  if (owns(data, item)) return { ok: false, reason: 'owned' };
  if (isGated(data, item)) return { ok: false, reason: 'locked' };
  if (seedsBalance(data) < item.cost) return { ok: false, reason: 'funds' };
  const avatar = data.avatar ?? { owned: [], look: {}, lookAt: 0 };
  data.avatar = { ...avatar, owned: [...avatar.owned, id] };
  void now;
  return { ok: true };
}

export function equipItem(data: AppData, id: string, now: number): boolean {
  const item = itemById(id);
  if (!item || !owns(data, item)) return false;
  const avatar = data.avatar ?? { owned: [], look: {}, lookAt: 0 };
  data.avatar = { owned: avatar.owned, look: { ...avatar.look, [item.slot]: id }, lookAt: Math.max(now, avatar.lookAt + 1) };
  return true;
}

/** What the avatar is wearing: your choices, with anything unknown or not owned replaced by the default. */
export function currentLook(data: AppData): Look {
  const look = defaultLook();
  const chosen = data.avatar?.look ?? {};
  for (const slot of SLOTS) {
    const id = chosen[slot];
    const item = id ? itemById(id) : undefined;
    if (item && item.slot === slot && owns(data, item)) look[slot] = item.id;
  }
  return look;
}
