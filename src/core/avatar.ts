// Avatar and seeds. Seeds are EARNED from real, counted practice and are never lost; items are bought with them or
// unlocked by achievements. Everything is derived from synced data (ledger, level-ups, counters), so devices agree,
// no new "wallet" state can drift, and nothing can ever be taken away. Presentation only: it never touches scheduling.
import { STREAK_MILESTONES } from './milestones.ts';
import type { AppData } from './types.ts';

export type Slot = 'skin' | 'hair' | 'hairColor' | 'outfit' | 'accessory' | 'hat' | 'background' | 'companion';
export const SLOTS: Slot[] = ['outfit', 'hair', 'hairColor', 'skin', 'accessory', 'hat', 'background', 'companion'];
export const SLOT_LABELS: Record<Slot, string> = {
  skin: 'Skin',
  hair: 'Hair',
  hairColor: 'Hair colour',
  outfit: 'Outfit',
  accessory: 'Extras',
  hat: 'Hat',
  background: 'Scene',
  companion: 'Companion',
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
  /** Main colour (skin tone, hair colour, outfit, scene) for the drawing. */
  color?: string;
}

const I = (slot: Slot, id: string, name: string, cost = 0, extra: Partial<Item> = {}): Item => ({ id, slot, name, cost, ...extra });

export const ITEMS: Item[] = [
  // skin tones (all free)
  I('skin', 'skin-peach', 'Peach', 0, { color: '#f6d6bd' }),
  I('skin', 'skin-sand', 'Sand', 0, { color: '#efc09a' }),
  I('skin', 'skin-honey', 'Honey', 0, { color: '#d9a273' }),
  I('skin', 'skin-caramel', 'Caramel', 0, { color: '#b87c52' }),
  I('skin', 'skin-cocoa', 'Cocoa', 0, { color: '#8d5a3a' }),
  I('skin', 'skin-espresso', 'Espresso', 0, { color: '#5e3a24' }),
  // hair styles
  I('hair', 'hair-short', 'Short'),
  I('hair', 'hair-long', 'Long'),
  I('hair', 'hair-curly', 'Curly'),
  I('hair', 'hair-buzz', 'Buzz'),
  I('hair', 'hair-none', 'None'),
  I('hair', 'hair-bun', 'Bun', 30),
  I('hair', 'hair-wave', 'Wavy bob', 30),
  I('hair', 'hair-spiky', 'Spiky', 45),
  // hair colours
  I('hairColor', 'hc-black', 'Black', 0, { color: '#2b2522' }),
  I('hairColor', 'hc-brown', 'Brown', 0, { color: '#6a4630' }),
  I('hairColor', 'hc-auburn', 'Auburn', 0, { color: '#9b4a2c' }),
  I('hairColor', 'hc-blond', 'Blond', 0, { color: '#d8b25f' }),
  I('hairColor', 'hc-gray', 'Silver', 0, { color: '#a7a9ad' }),
  I('hairColor', 'hc-teal', 'Teal', 25, { color: '#2f9aa0' }),
  I('hairColor', 'hc-pink', 'Rose', 25, { color: '#d9788f' }),
  I('hairColor', 'hc-violet', 'Violet', 25, { color: '#7d63c4' }),
  // outfits
  I('outfit', 'out-tee-teal', 'Teal tee', 0, { color: '#2a6569' }),
  I('outfit', 'out-tee-sand', 'Sand tee', 0, { color: '#c9a66b' }),
  I('outfit', 'out-hoodie-plum', 'Plum hoodie', 30, { color: '#7a4a78' }),
  I('outfit', 'out-hoodie-sky', 'Sky hoodie', 30, { color: '#5b8fc7' }),
  I('outfit', 'out-tunic-olive', 'Olive tunic', 40, { color: '#6f7d3c' }),
  I('outfit', 'out-cardigan-rose', 'Rose cardigan', 40, { color: '#c4647a' }),
  I('outfit', 'out-overalls', 'Overalls', 55, { color: '#3f6ea8' }),
  I('outfit', 'out-robe-cream', 'Cream robe', 80, { color: '#efe4c8' }),
  I('outfit', 'out-scholar', 'Scholar gown', 0, { color: '#2f3e63', unlock: { kind: 'reviews', n: 500 } }),
  I('outfit', 'out-robe-gold', 'Golden robe', 0, { color: '#c9962c', unlock: { kind: 'streak', days: 30 } }),
  // extras
  I('accessory', 'acc-none', 'None'),
  I('accessory', 'acc-glasses-round', 'Round glasses', 20),
  I('accessory', 'acc-glasses-square', 'Square glasses', 20),
  I('accessory', 'acc-bowtie', 'Bow tie', 25),
  I('accessory', 'acc-scarf', 'Scarf', 35),
  I('accessory', 'acc-book', 'Little book', 40),
  I('accessory', 'acc-headphones', 'Headphones', 45),
  I('accessory', 'acc-medal', 'Medal', 0, { unlock: { kind: 'levelups', n: 1 } }),
  // hats
  I('hat', 'hat-none', 'None'),
  I('hat', 'hat-cap', 'Cap', 30),
  I('hat', 'hat-beanie', 'Beanie', 30),
  I('hat', 'hat-flower', 'Flower', 25),
  I('hat', 'hat-sunhat', 'Sun hat', 45),
  I('hat', 'hat-crown', 'Crown', 300),
  I('hat', 'hat-laurel', 'Laurel', 0, { unlock: { kind: 'streak', days: 14 } }),
  I('hat', 'hat-halo', 'Halo', 0, { unlock: { kind: 'yearly' } }),
  // scenes
  I('background', 'bg-sky', 'Morning sky', 0, { color: '#cfe6ea' }),
  I('background', 'bg-meadow', 'Meadow', 0, { color: '#d6e8c4' }),
  I('background', 'bg-sunrise', 'Sunrise', 40, { color: '#f4d3b0' }),
  I('background', 'bg-dusk', 'Dusk', 40, { color: '#c9bfe0' }),
  I('background', 'bg-garden', 'Garden', 70, { color: '#bfe0c8' }),
  I('background', 'bg-night', 'Starry night', 60, { color: '#2d3a63' }),
  I('background', 'bg-library', 'Library', 80, { color: '#d9c2a0' }),
  I('background', 'bg-gold', 'Golden hour', 0, { color: '#f1d27a', unlock: { kind: 'streak', days: 100 } }),
  // companions
  I('companion', 'pet-none', 'None'),
  I('companion', 'pet-sprout', 'Sprout', 0, { unlock: { kind: 'streak', days: 3 } }),
  I('companion', 'pet-lamb', 'Lamb', 60),
  I('companion', 'pet-dove', 'Dove', 60),
  I('companion', 'pet-kitten', 'Kitten', 80),
  I('companion', 'pet-puppy', 'Puppy', 80),
  I('companion', 'pet-owl', 'Owl', 100),
  I('companion', 'pet-lion', 'Lion cub', 0, { unlock: { kind: 'streak', days: 365 } }),
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
    outfit: 'out-tee-teal',
    accessory: 'acc-none',
    hat: 'hat-none',
    background: 'bg-sky',
    companion: 'pet-none',
  };
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

export function isUnlocked(data: AppData, item: Item): boolean {
  const u = item.unlock;
  if (!u) return false;
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

/** Free items, bought items, and earned items that have been unlocked. */
export function owns(data: AppData, item: Item): boolean {
  if (item.unlock) return isUnlocked(data, item);
  return item.cost === 0 || (data.avatar?.owned ?? []).includes(item.id);
}

export type BuyResult = { ok: true } | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'funds' };

export function buyItem(data: AppData, id: string, now: number): BuyResult {
  const item = itemById(id);
  if (!item) return { ok: false, reason: 'unknown' };
  if (item.unlock) return { ok: false, reason: isUnlocked(data, item) ? 'owned' : 'locked' };
  if (owns(data, item)) return { ok: false, reason: 'owned' };
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
