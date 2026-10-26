// Avatar and seeds. Seeds are EARNED from real, counted practice and are never lost; items are bought with them or
// unlocked by achievements. Everything is derived from synced data (ledger, level-ups, counters), so devices agree,
// no new "wallet" state can drift, and nothing can ever be taken away. Presentation only: it never touches scheduling.
//
// The avatar is a knight who puts on the full armor of God (Ephesians 6:10-18). Everyone starts in the same basic
// steel armor (free); every piece can be swapped for another, because all the painted pieces are drawn to the same size.
// Some pieces cost seeds, some need a long streak first, and the finest take the most of both.
import { STREAK_MILESTONES } from './milestones.ts';
import type { AppData } from './types.ts';

export type Slot = 'helmet' | 'chest' | 'belt' | 'boots' | 'cape' | 'shield' | 'weapon' | 'scene';

/** Everything you can change, in the order the avatar screen lists it: the six armor pieces, then the extras (cape and background). */
export const SLOTS: Slot[] = ['helmet', 'chest', 'belt', 'boots', 'shield', 'weapon', 'cape', 'scene'];
/** The avatar screen keeps these two under "Extras", apart from the armor. */
export const EXTRA_SLOTS: Slot[] = ['cape', 'scene'];
export const SLOT_LABELS: Record<Slot, string> = {
  helmet: 'Helmet',
  chest: 'Chest plate',
  belt: 'Belt',
  boots: 'Boots',
  cape: 'Cape',
  shield: 'Shield',
  weapon: 'Sword',
  scene: 'Background',
};

/** The painted backgrounds (v1.35.0, from the owner's sheet; pictures in `public/scenes/<id>.webp`). All free; the first one is what everyone starts with (the old drawn morning sky is gone). */
export const SCENES = [
  { id: 'sunlit-castle', name: 'Sunlit Castle' },
  { id: 'frost-keep', name: 'Frost Keep' },
  { id: 'seaside-palace', name: 'Seaside Palace' },
  { id: 'ember-fortress', name: 'Ember Fortress' },
  { id: 'forest-falls', name: 'Forest Falls' },
  { id: 'moonlit-keep', name: 'Moonlit Keep' },
  { id: 'twilight-lake', name: 'Twilight Lake' },
  { id: 'frozen-peak', name: 'Frozen Peak' },
  { id: 'sunset-ruins', name: 'Sunset Ruins' },
  { id: 'sky-islands', name: 'Sky Islands' },
  { id: 'moonlit-ruins', name: 'Moonlit Ruins' },
  { id: 'harbor-town', name: 'Harbor Town' },
  { id: 'mountain-lake', name: 'Mountain Lake' },
  { id: 'marble-court', name: 'Marble Court' },
  { id: 'island-castle', name: 'Island Castle' },
] as const;

/** The picture for a background item id (`scene-frost-keep`), or null for the drawn sky. */
export function sceneUrl(id: string): string | null {
  const key = id.replace(/^scene-/, '');
  return SCENES.some((s) => s.id === key) ? `/scenes/${key}.webp` : null;
}

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
  | { kind: 'verses'; n: number }
  | { kind: 'yearly' }
  | { kind: 'tour' }
  | { kind: 'practiced' };

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Seeds. 0 = free (or earned, when `unlock` is set). */
  cost: number;
  /** Earned for free when the achievement is reached. */
  unlock?: Unlock;
  /** A painted piece (armor, weapons, capes). */
  art?: boolean;
  /** Which matching set (1-11, see SETS) a helmet, chest plate, belt, boots, cape, sword or shield belongs to. */
  set?: number;
  /** All of these must be reached before this item can be bought (it still costs seeds). */
  requires?: Unlock[];
}

const I = (slot: Slot, id: string, name: string, cost = 0, extra: Partial<Item> = {}): Item => ({ id, slot, name, cost, ...extra });
const streak = (days: number): Unlock => ({ kind: 'streak', days });
const art = (slot: Slot, id: string, name: string, cost: number, needs: Unlock[] = [], extra: Partial<Item> = {}): Item =>
  I(slot, id, name, cost, { art: true, ...(needs.length ? { requires: needs } : {}), ...extra });

/**
 * Every set is seven matching pieces drawn to the same scale (helmet, chest plate, belt, boots, cape, sword and shield), so
 * any piece goes with any other. The sets are listed from the plainest (the free start) to the finest, and each costs more than
 * the one before; the last four also need a long streak and a number of verses added. Nothing has to be bought in order.
 * The files are cut from the owner's sheet by design/armor-v2 (ids are the file names).
 */
export interface ArmorSet {
  n: number;
  id: string;
  name: string;
  /** Seeds for the whole set (every piece); each piece is a share of it, see SHARE. */
  price: number;
  /** Longest streak (days) and verses added that are needed before any piece can be bought. */
  streak?: number;
  verses?: number;
}
export const SETS: ArmorSet[] = [
  { n: 1, id: 'iron-bulwark', name: 'Iron Bulwark', price: 0 },
  { n: 2, id: 'silver-vanguard', name: 'Silver Vanguard', price: 400 },
  { n: 3, id: 'forest-guardian', name: 'Forest Guardian', price: 1000 },
  { n: 4, id: 'knights-oath', name: 'Knight’s Oath', price: 2400 },
  { n: 5, id: 'stormcaller', name: 'Stormcaller', price: 3600 },
  { n: 6, id: 'frostborn', name: 'Frostborn', price: 4800 },
  { n: 7, id: 'ember-knight', name: 'Ember Knight', price: 6400 },
  { n: 8, id: 'crimson-legion', name: 'Crimson Legion', price: 8800, streak: 30, verses: 10 },
  { n: 9, id: 'shadowblade', name: 'Shadowblade', price: 12000, streak: 60, verses: 20 },
  { n: 10, id: 'golden-paladin', name: 'Golden Paladin', price: 16000, streak: 180, verses: 30 },
  { n: 11, id: 'sulestial', name: 'Sulestial', price: 22000, streak: 365, verses: 50 },
];
/** What each piece costs, as a share of its set's price (they add up to 1). */
const SHARE = { helmet: 0.2, chest: 0.25, shield: 0.18, weapon: 0.18, boots: 0.08, belt: 0.06, cape: 0.05 } as const;
const NOUN = { helmet: 'helm', chest: 'chest plate', belt: 'belt', boots: 'boots', cape: 'cape', weapon: 'sword', shield: 'shield' } as const;
type SetSlot = keyof typeof SHARE;
const setPrice = (set: ArmorSet, slot: SetSlot) => Math.round((set.price * SHARE[slot]) / 5) * 5;
const setNeeds = (set: ArmorSet): Unlock[] => [...(set.streak ? [streak(set.streak)] : []), ...(set.verses ? [{ kind: 'verses', n: set.verses } as Unlock] : [])];
/** The free set's sword and shield are rewards, not purchases: the sword for adding your first verse and practising it, the shield for finishing the guided tour (or lighting your first flame, which is how it used to be earned). */
const REWARD: Partial<Record<SetSlot, Unlock>> = { weapon: { kind: 'practiced' }, shield: { kind: 'tour' } };
const setPiece = (slot: SetSlot, set: ArmorSet): Item =>
  art(slot, `${slot}-${set.id}`, `${set.name} ${NOUN[slot]}`, setPrice(set, slot), setNeeds(set), {
    set: set.n,
    ...(set.n === 1 && REWARD[slot] ? { unlock: REWARD[slot] } : {}),
  });
const piecesOf = (slot: SetSlot): Item[] => SETS.map((set) => setPiece(slot, set));

export const ITEMS: Item[] = [
  // ---- helmets, chest plates, belts and boots
  ...piecesOf('helmet'),
  ...piecesOf('chest'),
  ...piecesOf('belt'),
  ...piecesOf('boots'),
  // ---- capes
  I('cape', 'cape-none', 'None'),
  ...piecesOf('cape'),
  // ---- shields
  I('shield', 'shield-none', 'None'),
  ...piecesOf('shield'),
  // ---- swords
  I('weapon', 'weapon-none', 'None'),
  ...piecesOf('weapon'),
  // ---- backgrounds (all free)
  ...SCENES.map((s) => I('scene', `scene-${s.id}`, s.name)),
];

const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
export const itemById = (id: string): Item | undefined => BY_ID.get(id);
export const itemsIn = (slot: Slot): Item[] => ITEMS.filter((i) => i.slot === slot);

export type Look = Record<Slot, string>;

export function defaultLook(): Look {
  return {
    helmet: 'helmet-iron-bulwark',
    chest: 'chest-iron-bulwark',
    belt: 'belt-iron-bulwark',
    boots: 'boots-iron-bulwark',
    cape: 'cape-none',
    shield: 'shield-none',
    weapon: 'weapon-none',
    scene: 'scene-sunlit-castle',
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
    case 'verses':
      return u.n === 1 ? 'Add your first verse' : `Have ${u.n} verses`;
    case 'yearly':
      return 'Get a verse all the way to Yearly';
    case 'tour':
      return 'Finish the tour (or light your first flame)';
    case 'practiced':
      return 'Add a verse and practice it';
  }
}

/** The short form shown on a locked tile, one line each: "365-day streak", "60 verses". */
export function shortUnlock(u: Unlock): string {
  if (u.kind === 'tour') return 'finish the tour';
  if (u.kind === 'practiced') return 'first practice';
  return u.kind === 'streak' ? `${u.days}-day streak` : u.kind === 'verses' ? (u.n === 1 ? 'first verse' : `${u.n} verses`) : describeUnlock(u);
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
    case 'verses':
      return Object.values(data.verses).filter((v) => !v.deletedAt).length >= u.n;
    case 'tour':
      return !!data.tourAt || data.longestStreak >= 1;
    case 'practiced':
      return Object.values(data.verses).some((v) => !v.deletedAt) && totalCounted(data) >= 1;
    case 'yearly':
      return data.levelUps.some((l) => l.to === 'yearly') || Object.values(data.verses).some((v) => !v.deletedAt && v.pile === 'yearly');
  }
}

/** Ids of the achievement items (the sword, the shield) that have been unlocked by now. */
export function unlockedIds(data: AppData): string[] {
  return ITEMS.filter((i) => i.unlock && meets(data, i.unlock)).map((i) => i.id);
}

/** Achievement items unlocked but not yet shown to this person. `seen` is `null` the first time (nothing is announced: it is just remembered). */
export function freshUnlocks(data: AppData, seen: string[] | null): string[] {
  if (seen === null) return [];
  return unlockedIds(data).filter((id) => !seen.includes(id));
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
export const testing = { armorFree: false };

export function isGated(data: AppData, item: Item): boolean {
  if (testing.armorFree && item.art) return false;
  return !!item.requires && !item.requires.every((u) => meets(data, u));
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

/**
 * Owner-requested: forget everything bought and worn on this device, so the knight is back in the free start and every seed spent
 * comes back (seeds are derived from what is owned). Owned items otherwise only ever grow, and merging with another device that still
 * owns them would bring them back, so with sync on, reset (or have nothing bought on) the other devices too.
 */
export function resetAvatar(data: AppData, now: number): void {
  const lookAt = data.avatar?.lookAt ?? 0;
  data.avatar = { owned: [], look: {}, lookAt: Math.max(now, lookAt + 1) };
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
