// Avatar and seeds. Seeds are EARNED from real, counted practice and are never lost; items are bought with them or
// unlocked by achievements. Everything is derived from synced data (ledger, level-ups, counters), so devices agree,
// no new "wallet" state can drift, and nothing can ever be taken away. Presentation only: it never touches scheduling.
//
// The avatar is a knight who puts on the full armor of God (Ephesians 6:10-18). Everyone starts in the same basic
// steel armor (free); every piece can be swapped for another, because all the painted pieces are drawn to the same size.
// Some pieces cost seeds, some need a long streak first, and the finest take the most of both.
import { STREAK_MILESTONES } from './milestones.ts';
import type { AppData } from './types.ts';

export type Slot = 'helmet' | 'plume' | 'chest' | 'arms' | 'legs' | 'cape' | 'shield' | 'weapon' | 'crown' | 'extra' | 'companion' | 'background';

export interface SlotGroup {
  key: 'armor' | 'gear' | 'extras';
  label: string;
  slots: Slot[];
}
export const SLOT_GROUPS: SlotGroup[] = [
  { key: 'armor', label: 'Armor', slots: ['helmet', 'plume', 'chest', 'arms', 'legs', 'cape'] },
  { key: 'gear', label: 'Weapons', slots: ['shield', 'weapon'] },
  { key: 'extras', label: 'Extras', slots: ['extra', 'crown', 'companion', 'background'] },
];
export const SLOTS: Slot[] = SLOT_GROUPS.flatMap((g) => g.slots);
export const SLOT_LABELS: Record<Slot, string> = {
  helmet: 'Helmet',
  plume: 'Plume',
  chest: 'Breastplate',
  arms: 'Arms & belt',
  legs: 'Legs & boots',
  cape: 'Cape',
  shield: 'Shield',
  weapon: 'Weapon',
  crown: 'Crown',
  extra: 'Extras',
  companion: 'Companion',
  background: 'Scene',
};

/** The six pieces of the armor of God, with where each is named (Ephesians 6:14-17). */
export const ARMOR_SLOTS = ['helmet', 'chest', 'arms', 'legs', 'shield', 'weapon'] as const;
export const ARMOR_NAMES: Record<(typeof ARMOR_SLOTS)[number], { title: string; verse: string }> = {
  helmet: { title: 'Helmet of Salvation', verse: 'Ephesians 6:17' },
  chest: { title: 'Breastplate of Righteousness', verse: 'Ephesians 6:14' },
  arms: { title: 'Belt of Truth', verse: 'Ephesians 6:14' },
  legs: { title: 'Shoes of the Gospel of Peace', verse: 'Ephesians 6:15' },
  shield: { title: 'Shield of Faith', verse: 'Ephesians 6:16' },
  weapon: { title: 'Sword of the Spirit', verse: 'Ephesians 6:17' },
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
  /** Main colour of a scene, for the drawing. */
  color?: string;
  /** A painted piece (armor, weapons, capes, plumes, banners...), as opposed to a simple drawn extra. */
  art?: boolean;
  /** Breastplate, arms and legs come in the same seven colourways, so a matching set can be worn. */
  colourway?: string;
  /** Must be reached before this item can be bought (it still costs seeds). */
  requires?: Unlock;
}

const I = (slot: Slot, id: string, name: string, cost = 0, extra: Partial<Item> = {}): Item => ({ id, slot, name, cost, ...extra });
const streak = (days: number): Unlock => ({ kind: 'streak', days });
const art = (slot: Slot, id: string, name: string, cost: number, needs?: number, extra: Partial<Item> = {}): Item =>
  I(slot, id, name, cost, { art: true, ...(needs ? { requires: streak(needs) } : {}), ...extra });

/** Breastplate, arms and legs: the same seven colourways, each costing more than the last. The steel knight set is the free start. */
export interface Colourway {
  key: string;
  name: string;
  price: number;
  streak?: number;
}
export const COLOURWAYS: Colourway[] = [
  { key: 'knight', name: 'Knight', price: 0 },
  { key: 'iron', name: 'Iron', price: 15 },
  { key: 'azure', name: 'Azure', price: 35 },
  { key: 'forest', name: 'Forest', price: 60 },
  { key: 'crimson', name: 'Crimson', price: 100 },
  { key: 'shadow', name: 'Shadow', price: 180, streak: 90 },
  { key: 'gold', name: 'Gold', price: 320, streak: 365 },
];
const NOUN = { chest: 'breastplate', arms: 'arms & belt', legs: 'greaves & boots' } as const;
const bodyPieces: Item[] = (['chest', 'arms', 'legs'] as const).flatMap((slot) =>
  COLOURWAYS.map((c) => art(slot, `${slot}-${c.key}`, `${c.name} ${NOUN[slot]}`, c.price, c.streak, { colourway: c.key })),
);

export const ITEMS: Item[] = [
  // ---- helmets
  art('helmet', 'helmet-steel', 'Steel helm', 0),
  art('helmet', 'helmet-cross', 'Cross helm', 25),
  art('helmet', 'helmet-shadow', 'Shadow helm', 70),
  art('helmet', 'helmet-spiked', 'Spiked helm', 120),
  art('helmet', 'helmet-horned', 'Horned helm', 180),
  art('helmet', 'helmet-winged', 'Winged helm', 260, 180),
  art('helmet', 'helmet-gold', 'Golden helm', 400, 365),
  // ---- plumes (sit on top of the helmet)
  I('plume', 'plume-none', 'None'),
  art('plume', 'plume-blue', 'Blue plume', 20),
  art('plume', 'plume-red', 'Red plume', 20),
  art('plume', 'plume-green', 'Green plume', 20),
  art('plume', 'plume-white', 'White plume', 30),
  art('plume', 'plume-purple', 'Purple plume', 40),
  // ---- breastplate, arms and legs
  ...bodyPieces,
  // ---- capes
  I('cape', 'cape-none', 'None'),
  art('cape', 'cape-blue', 'Blue cape', 30),
  art('cape', 'cape-green', 'Green cape', 50),
  art('cape', 'cape-red', 'Red cape', 70),
  art('cape', 'cape-white', 'White cape', 110),
  art('cape', 'cape-purple', 'Purple cape', 150),
  art('cape', 'cape-black', 'Black cape', 200, 90),
  I('cape', 'cape-wings', 'Wings of light', 0, { unlock: streak(500) }),
  // ---- shields
  I('shield', 'shield-none', 'None'),
  art('shield', 'shield-round', 'Round shield', 15),
  art('shield', 'shield-lion', 'Lion shield', 30),
  art('shield', 'shield-tree', 'Tree shield', 60),
  art('shield', 'shield-sun', 'Sun shield', 100),
  art('shield', 'shield-dragon', 'Dragon shield', 160),
  art('shield', 'shield-spiked', 'Spiked shield', 240, 180),
  // ---- weapons
  I('weapon', 'weapon-none', 'None'),
  art('weapon', 'weapon-sword', 'Steel sword', 20),
  art('weapon', 'weapon-spear', 'Spear', 30),
  art('weapon', 'weapon-mace', 'Mace', 50),
  art('weapon', 'weapon-axe', 'Battle axe', 70),
  art('weapon', 'weapon-bow', 'Longbow', 100),
  art('weapon', 'weapon-staff', 'Crystal staff', 150),
  art('weapon', 'weapon-darksword', 'Dark sword', 200, 90),
  art('weapon', 'weapon-goldsword', 'Golden sword', 350, 365),
  // ---- extras
  I('extra', 'ex-none', 'None'),
  art('extra', 'ex-pouch', 'Pouch', 20),
  art('extra', 'ex-lantern', 'Lantern', 45),
  art('extra', 'ex-banner-lion', 'Lion banner', 55),
  art('extra', 'ex-banner-dragon', 'Dragon banner', 55),
  art('extra', 'ex-banner-tree', 'Tree banner', 55),
  art('extra', 'ex-banner-sun', 'Sun banner', 55),
  art('extra', 'ex-medal', 'Medal', 0, undefined, { unlock: { kind: 'levelups', n: 1 }, requires: undefined }),
  art('extra', 'ex-scroll', 'Scholar’s scroll', 0, undefined, { unlock: { kind: 'reviews', n: 500 }, requires: undefined }),
  // ---- crowns (they float above the helmet)
  I('crown', 'crown-none', 'None'),
  I('crown', 'crown-royal', 'Royal crown', 300),
  I('crown', 'crown-halo', 'Halo', 0, { unlock: { kind: 'yearly' } }),
  I('crown', 'crown-life', 'Crown of life', 0, { unlock: streak(730) }),
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
    helmet: 'helmet-steel',
    plume: 'plume-none',
    chest: 'chest-knight',
    arms: 'arms-knight',
    legs: 'legs-knight',
    cape: 'cape-none',
    shield: 'shield-none',
    weapon: 'weapon-none',
    crown: 'crown-none',
    extra: 'ex-none',
    companion: 'pet-none',
    background: 'bg-sky',
  };
}

/** How many of the six pieces of the armor of God have been changed from the basic steel start (0-6). */
export function armorWorn(look: Look): number {
  const base = defaultLook();
  return ARMOR_SLOTS.filter((s) => look[s] !== base[s]).length;
}

/** The colourway being worn on breastplate, arms and legs, if all three match (and it is not the free start). */
export function matchedColourway(look: Look): Colourway | undefined {
  const keys = (['chest', 'arms', 'legs'] as const).map((slot) => itemById(look[slot])?.colourway);
  return keys.every((k) => k && k === keys[0]) ? COLOURWAYS.find((c) => c.key === keys[0] && c.key !== 'knight') : undefined;
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
  if (testing.armorFree && item.art) return false;
  return !!item.requires && !meets(data, item.requires);
}

/** Free items, bought items, and earned items that have been unlocked. */
export function owns(data: AppData, item: Item): boolean {
  if (testing.armorFree && item.art) return true;
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
