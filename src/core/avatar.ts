// Avatar and seeds. Seeds are EARNED from real, counted practice and are never lost; items are bought with them or
// unlocked by achievements. Everything is derived from synced data (ledger, level-ups, counters), so devices agree,
// no new "wallet" state can drift, and nothing can ever be taken away. Presentation only: it never touches scheduling.
//
// The avatar is a knight who puts on the full armor of God (Ephesians 6:10-18). Everyone starts in the same basic
// steel armor (free); every piece can be swapped for another, because all the painted pieces are drawn to the same size.
// Some pieces cost seeds, some need a long streak first, and the finest take the most of both.
import { STREAK_MILESTONES } from './milestones.ts';
import type { AppData } from './types.ts';

export type Slot = 'helmet' | 'chest' | 'belt' | 'boots' | 'cape' | 'shield' | 'weapon' | 'crown' | 'extra' | 'companion' | 'background';

export interface SlotGroup {
  key: 'armor' | 'gear' | 'extras';
  label: string;
  slots: Slot[];
}
export const SLOT_GROUPS: SlotGroup[] = [
  { key: 'armor', label: 'Armor', slots: ['helmet', 'chest', 'belt', 'boots'] },
  { key: 'gear', label: 'Weapons', slots: ['shield', 'weapon'] },
  { key: 'extras', label: 'Extras', slots: ['cape', 'extra', 'crown', 'companion', 'background'] },
];
export const SLOTS: Slot[] = SLOT_GROUPS.flatMap((g) => g.slots);
export const SLOT_LABELS: Record<Slot, string> = {
  helmet: 'Helmet',
  chest: 'Chest plate',
  belt: 'Belt',
  boots: 'Boots',
  cape: 'Cape',
  shield: 'Shield',
  weapon: 'Sword',
  crown: 'Crown',
  extra: 'Accessories',
  companion: 'Companion',
  background: 'Scene',
};

/** The six pieces of the armor of God, with where each is named (Ephesians 6:14-17). */
export const ARMOR_SLOTS = ['helmet', 'chest', 'belt', 'boots', 'shield', 'weapon'] as const;
export const ARMOR_NAMES: Record<(typeof ARMOR_SLOTS)[number], { title: string; verse: string }> = {
  helmet: { title: 'Helmet of Salvation', verse: 'Ephesians 6:17' },
  chest: { title: 'Breastplate of Righteousness', verse: 'Ephesians 6:14' },
  belt: { title: 'Belt of Truth', verse: 'Ephesians 6:14' },
  boots: { title: 'Shoes of the Gospel of Peace', verse: 'Ephesians 6:15' },
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
  /** Which of the twelve matching sets (1-12) a helmet, chest plate, belt, boots or cape belongs to. */
  set?: number;
  /** Must be reached before this item can be bought (it still costs seeds). */
  requires?: Unlock;
}

const I = (slot: Slot, id: string, name: string, cost = 0, extra: Partial<Item> = {}): Item => ({ id, slot, name, cost, ...extra });
const streak = (days: number): Unlock => ({ kind: 'streak', days });
const art = (slot: Slot, id: string, name: string, cost: number, needs?: number, extra: Partial<Item> = {}): Item =>
  I(slot, id, name, cost, { art: true, ...(needs ? { requires: streak(needs) } : {}), ...extra });

/**
 * Helmets, chest plates, belts and boots (and capes) come in twelve matching sets painted to the same scale, so any piece goes
 * with any other. Each set costs more than the one before, and the finest need a long streak first. Set 1 is the free start.
 * Leg armor is not a choice of its own: the legs of the chest plate's set are worn automatically (see ArmorArt).
 */
export interface ArmorSet {
  n: number;
  name: string;
  /** Seeds for the chest plate; the other pieces are a fraction of it. */
  price: number;
  streak?: number;
}
export const SETS: ArmorSet[] = [
  { n: 1, name: 'Knight', price: 0 },
  { n: 2, name: 'Azure', price: 15 },
  { n: 3, name: 'Dawn', price: 30 },
  { n: 4, name: 'Shadow', price: 50 },
  { n: 5, name: 'Forest', price: 75 },
  { n: 6, name: 'Sapphire', price: 105 },
  { n: 7, name: 'Iron', price: 140 },
  { n: 8, name: 'Crimson', price: 180, streak: 30 },
  { n: 9, name: 'Pearl', price: 230, streak: 60 },
  { n: 10, name: 'Amethyst', price: 290, streak: 90 },
  { n: 11, name: 'Midnight', price: 350, streak: 180 },
  { n: 12, name: 'Crusader', price: 420, streak: 365 },
];
const FRACTION = { helmet: 1, chest: 1, belt: 0.4, boots: 0.5, cape: 0.6 } as const;
const HELMET_NAMES = [
  'Steel helm',
  'Visor helm',
  'Golden helm',
  'Shadow helm',
  'Horned helm',
  'Plumed helm',
  'Spiked helm',
  'Cross helm',
  'Crested helm',
  'Royal helm',
  'Winged helm',
  'Golden crest helm',
];
const CAPE_NAMES = ['Blue lion', 'Red lion', 'Green tree', 'White sun', 'Purple rose', 'Black dragon', 'Blue star', 'Green stag', 'Red phoenix', 'Cross', 'Violet sun', 'Shadow'];
const NOUN = { chest: 'chest plate', belt: 'belt', boots: 'boots' } as const;
const setPieces: Item[] = SETS.flatMap((set) => {
  const cost = (slot: keyof typeof FRACTION) => Math.round((set.price * FRACTION[slot]) / 5) * 5;
  return [
    art('helmet', `helmet-${set.n}`, HELMET_NAMES[set.n - 1], cost('helmet'), set.streak, { set: set.n }),
    ...(['chest', 'belt', 'boots'] as const).map((slot) => art(slot, `${slot}-${set.n}`, `${set.name} ${NOUN[slot]}`, cost(slot), set.streak, { set: set.n })),
  ];
});
const capes: Item[] = SETS.map((set) => art('cape', `cape-${set.n}`, `${CAPE_NAMES[set.n - 1]} cape`, Math.round((set.price * FRACTION.cape + 10) / 5) * 5, set.streak, { set: set.n }));

const SHIELD_NAMES = ['Lion shield', 'Dragon shield', 'Sun shield', 'Tree shield', 'Spiked shield', 'Round shield'];
const SHIELD_COSTS = [30, 160, 100, 60, 240, 20];
const WEAPON_NAMES = ['Steel sword', 'Golden sword', 'Dark sword', 'Crystal sword', 'Battle axe', 'Mace', 'Spear', 'Longbow', 'Scimitar', 'Crystal staff', 'Great bow'];
const WEAPON_COSTS = [20, 350, 200, 120, 70, 50, 30, 100, 160, 150, 260];
const WEAPON_STREAKS: Record<number, number> = { 2: 365, 3: 90 };

export const ITEMS: Item[] = [
  // ---- helmets, chest plates, belts and boots
  ...setPieces,
  // ---- capes
  I('cape', 'cape-none', 'None'),
  ...capes,
  I('cape', 'cape-wings', 'Wings of light', 0, { unlock: streak(500) }),
  // ---- shields
  I('shield', 'shield-none', 'None'),
  ...SHIELD_NAMES.map((name, i) => art('shield', `shield-${i + 1}`, name, SHIELD_COSTS[i], i === 4 ? 180 : undefined)),
  // ---- weapons
  I('weapon', 'weapon-none', 'None'),
  ...WEAPON_NAMES.map((name, i) => art('weapon', `weapon-${i + 1}`, name, WEAPON_COSTS[i], WEAPON_STREAKS[i + 1])),
  // ---- accessories
  I('extra', 'ex-none', 'None'),
  art('extra', 'ex-ring', 'Ring', 25),
  art('extra', 'ex-amulet', 'Amulet', 40),
  art('extra', 'ex-gloves', 'Gloves', 30),
  art('extra', 'ex-pouch', 'Pouch', 20),
  art('extra', 'ex-lantern', 'Lantern', 45),
  art('extra', 'ex-charm', 'Charm', 35),
  art('extra', 'ex-banner', 'Banner', 55),
  art('extra', 'ex-medal', 'Medal', 0, undefined, { unlock: { kind: 'levelups', n: 1 } }),
  art('extra', 'ex-scroll', 'Scholar’s scroll', 0, undefined, { unlock: { kind: 'reviews', n: 500 } }),
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
    helmet: 'helmet-1',
    chest: 'chest-1',
    belt: 'belt-1',
    boots: 'boots-1',
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

/** The set being worn on helmet, chest plate, belt and boots, if all four match (and it is not the free start). */
export function matchedSet(look: Look): ArmorSet | undefined {
  const sets = (['helmet', 'chest', 'belt', 'boots'] as const).map((slot) => itemById(look[slot])?.set);
  return sets.every((n) => n && n === sets[0]) ? SETS.find((s) => s.n === sets[0] && s.n !== 1) : undefined;
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
