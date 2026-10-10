// Avatar + seeds: seeds are EARNED from real, counted practice (never lost, never expire); items are bought with them or
// unlocked by achievements. Everything is derived from synced data so devices agree and nothing can be taken away.
import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import {
  buyItem,
  currentLook,
  defaultLook,
  equipItem,
  isUnlocked,
  ITEMS,
  itemById,
  owns,
  seedsBalance,
  seedsEarned,
  SLOTS,
  ARMOR_SETS,
  ARMOR_SLOTS,
  completedSet,
  armorWorn,
  SLOT_GROUPS,
  STREAK_SEED_BONUS,
} from '../../src/core/avatar.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview, settle } from '../../src/core/schedule.ts';
import { STREAK_MILESTONES } from '../../src/core/milestones.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

const rich = () => {
  const d = newData();
  d.longestStreak = 0;
  d.reviewsByDevice = { x: 1000 }; // 1000 seeds worth of counted reviews
  return d;
};

describe('catalog', () => {
  it('has unique ids, a free default in every slot, sane prices, and unlock items that are free to equip', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length);
    for (const slot of SLOTS) {
      const inSlot = ITEMS.filter((i) => i.slot === slot);
      expect(inSlot.length, slot).toBeGreaterThanOrEqual(2);
      expect(inSlot.some((i) => i.cost === 0 && !i.unlock), `free default in ${slot}`).toBe(true);
    }
    for (const i of ITEMS) {
      expect(Number.isInteger(i.cost) && i.cost >= 0, i.id).toBe(true);
      if (i.unlock) expect(i.cost, `${i.id} is earned, not bought`).toBe(0);
    }
  });
  it('the default look uses only free items', () => {
    const look = defaultLook();
    for (const slot of SLOTS) {
      const item = itemById(look[slot])!;
      expect(item.slot).toBe(slot);
      expect(item.cost).toBe(0);
      expect(item.unlock).toBeUndefined();
    }
  });
});

describe('the knight', () => {
  it('everything that makes the knight look like you is free', () => {
    const me = SLOT_GROUPS.find((g) => g.key === 'me')!.slots;
    for (const slot of me) for (const i of ITEMS.filter((x) => x.slot === slot)) expect(i.cost + (i.unlock ? 1 : 0), i.id).toBe(0);
    expect(ITEMS.filter((i) => i.slot === 'skin').length).toBeGreaterThanOrEqual(6);
    expect(ITEMS.filter((i) => i.slot === 'hair').length).toBeGreaterThanOrEqual(8);
  });

  it('has ten armor sets with a piece for each of the six slots, each set costing more than the one before', () => {
    expect(ARMOR_SETS.length).toBe(10);
    const prices = ARMOR_SETS.map((x) => x.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(10);
    for (const set of ARMOR_SETS) for (const slot of ARMOR_SLOTS) {
      const item = itemById(`${slot}-${set.key}`)!;
      expect(item, `${slot}-${set.key}`).toBeDefined();
      expect(item.cost).toBe(set.price);
      expect(item.set).toBe(set.key);
    }
    // the coolest sets are the hardest to get: they also need a long streak, and the streaks only go up
    const streaks = ARMOR_SETS.map((x) => x.streak ?? 0);
    expect(streaks).toEqual([...streaks].sort((a, b) => a - b));
    expect(ARMOR_SETS[9].streak).toBeGreaterThanOrEqual(365);
    expect(ARMOR_SETS.slice(0, 7).every((x) => !x.streak)).toBe(true);
  });

  it('a set that needs a streak cannot be bought early, however many seeds you have, and costs seeds once reached', () => {
    const d = rich();
    d.reviewsByDevice = { x: 100000 };
    const legend = itemById('sword-legend')!;
    d.longestStreak = 364;
    expect(buyItem(d, legend.id, 1)).toMatchObject({ ok: false, reason: 'locked' });
    d.longestStreak = 365;
    const before = seedsBalance(d);
    expect(buyItem(d, legend.id, 2)).toEqual({ ok: true });
    expect(seedsBalance(d)).toBe(before - legend.cost);
  });

  it('notices when a whole set is worn', () => {
    const look = defaultLook();
    expect(completedSet(look)).toBeUndefined();
    for (const s of ARMOR_SLOTS) look[s] = `${s}-paladin`;
    expect(completedSet(look)?.key).toBe('paladin');
    look.shield = 'shield-storm';
    expect(completedSet(look)).toBeUndefined();
  });

  it('counts how many pieces are worn', () => {
    const look = defaultLook();
    expect(armorWorn(look)).toBe(0);
    look.shield = 'shield-soldier';
    look.sword = 'sword-paladin';
    expect(armorWorn(look)).toBe(2);
    for (const s of ARMOR_SLOTS) look[s] = `${s}-soldier`;
    expect(armorWorn(look)).toBe(6);
  });
});

describe('earning seeds', () => {
  it('starts at zero', () => {
    expect(seedsEarned(newData())).toBe(0);
    expect(seedsBalance(newData())).toBe(0);
  });

  it('+1 per counted review, +5 per completed day; extra practice earns nothing', () => {
    const data = newData();
    const v = john316(data, at(D0, '07:00'));
    for (let i = 1; i <= 3; i++) reviewEverythingDue(data, day(i));
    settle(data, at(day(4), '08:00'));
    const counted = Object.values(data.reviewsByDevice).reduce((a, b) => a + b, 0);
    const doneDays = Object.values(data.ledger).filter((e) => e.o === 'c').length;
    expect(counted).toBe(9);
    expect(doneDays).toBe(3);
    const streakBonus = [1, 3].reduce((n, m) => n + (data.longestStreak >= m ? STREAK_SEED_BONUS[m] : 0), 0); // a 3-day streak was reached
    expect(data.longestStreak).toBe(3);
    expect(seedsEarned(data)).toBe(counted + doneDays * 5 + streakBonus);
    // the first counted review of a new day pays 1 (+5 because it completes the day for the streak);
    // a second review inside the cooldown is extra practice and pays nothing
    const before = seedsEarned(data);
    recordReview(data, v.id, at(day(4), '09:00'), DEVICE);
    const afterFirst = seedsEarned(data);
    expect(afterFirst).toBe(before + 1 + 5);
    recordReview(data, v.id, at(day(4), '09:05'), DEVICE);
    expect(seedsEarned(data)).toBe(afterFirst);
  });

  it('level-ups pay 25 each and streak milestones pay their bonus once longestStreak reaches them', () => {
    const d = newData();
    d.levelUps = [
      { id: 'a:weekly:2026-01-01', verseId: 'a', from: 'daily', to: 'weekly', day: '2026-01-01' },
      { id: 'b:weekly:2026-01-02', verseId: 'b', from: 'daily', to: 'weekly', day: '2026-01-02' },
    ];
    expect(seedsEarned(d)).toBe(50);
    d.longestStreak = 7;
    const expected = 50 + [1, 3, 7].reduce((s, m) => s + STREAK_SEED_BONUS[m], 0);
    expect(seedsEarned(d)).toBe(expected);
    d.longestStreak = 6;
    expect(seedsEarned(d)).toBe(50 + STREAK_SEED_BONUS[1] + STREAK_SEED_BONUS[3]);
  });

  it('every streak milestone has a bonus, and bigger milestones pay more', () => {
    let last = 0;
    for (const m of STREAK_MILESTONES) {
      expect(STREAK_SEED_BONUS[m], `bonus for ${m}`).toBeGreaterThan(0);
    }
    for (const m of [7, 30, 100, 365]) {
      expect(STREAK_SEED_BONUS[m]).toBeGreaterThan(last);
      last = STREAK_SEED_BONUS[m];
    }
  });

  it('merging never reduces what you have earned (so seeds can never be lost to a sync)', () => {
    const a = newData();
    john316(a, at(D0, '07:00'));
    for (let i = 1; i <= 4; i++) reviewEverythingDue(a, day(i), 'dev-A');
    const b = structuredClone(newData());
    b.reviewsByDevice = { 'dev-B': 7 };
    b.longestStreak = 14;
    const m = mergeData(a, b);
    expect(seedsEarned(m)).toBeGreaterThanOrEqual(seedsEarned(a));
    expect(seedsEarned(m)).toBeGreaterThanOrEqual(seedsEarned(b));
  });
});

describe('buying, unlocking and equipping', () => {
  const hat = ITEMS.find((i) => i.slot === 'helmet' && i.cost > 0)!;
  const locked = ITEMS.find((i) => i.unlock?.kind === 'streak')!;

  it('buying spends exactly the price, once, and the item is yours for good', () => {
    const d = rich();
    const before = seedsBalance(d);
    expect(buyItem(d, hat.id, 1)).toEqual({ ok: true });
    expect(seedsBalance(d)).toBe(before - hat.cost);
    expect(owns(d, hat)).toBe(true);
    expect(buyItem(d, hat.id, 2)).toMatchObject({ ok: false, reason: 'owned' });
    expect(seedsBalance(d)).toBe(before - hat.cost);
  });

  it('cannot buy without enough seeds, an unknown item, a free item or an achievement item', () => {
    const d = newData();
    expect(buyItem(d, hat.id, 1)).toMatchObject({ ok: false, reason: 'funds' });
    expect(buyItem(rich(), 'nope', 1)).toMatchObject({ ok: false, reason: 'unknown' });
    expect(buyItem(rich(), defaultLook().helmet, 1)).toMatchObject({ ok: false, reason: 'owned' });
    expect(buyItem(rich(), locked.id, 1)).toMatchObject({ ok: false, reason: 'locked' });
    expect(d.avatar).toBeUndefined(); // failed purchases change nothing
  });

  it('achievement items unlock by themselves, cost nothing, and can then be worn', () => {
    const d = newData();
    expect(isUnlocked(d, locked)).toBe(false);
    expect(equipItem(d, locked.id, 1)).toBe(false);
    d.longestStreak = 1000;
    d.reviewsByDevice = { x: 100000 };
    d.levelUps = [{ id: 'x:yearly:2026-01-01', verseId: 'x', from: 'monthly', to: 'yearly', day: '2026-01-01' }];
    expect(isUnlocked(d, locked)).toBe(true);
    const before = seedsBalance(d);
    expect(equipItem(d, locked.id, 5)).toBe(true);
    expect(currentLook(d)[locked.slot]).toBe(locked.id);
    expect(seedsBalance(d)).toBe(before);
  });

  it('you can only wear what you own; wearing is free and remembered', () => {
    const d = rich();
    expect(equipItem(d, hat.id, 1)).toBe(false);
    buyItem(d, hat.id, 2);
    expect(equipItem(d, hat.id, 3)).toBe(true);
    expect(currentLook(d).helmet).toBe(hat.id);
    expect(equipItem(d, defaultLook().helmet, 4)).toBe(true);
    expect(currentLook(d).helmet).toBe(defaultLook().helmet);
  });

  it('an unknown or unowned item in the data (e.g. from a newer version) falls back to the default instead of breaking', () => {
    const d = newData();
    d.avatar = { owned: [], look: { helmet: 'future-helmet', tunic: hat.id }, lookAt: 1 };
    const look = currentLook(d);
    expect(look.helmet).toBe(defaultLook().helmet);
    expect(look.tunic).toBe(defaultLook().tunic);
  });

  it('a balance can never show below zero, and no item is ever removed (two devices spending the same seeds)', () => {
    const base = rich();
    const other0 = ITEMS.find((i) => i.slot === 'background' && i.cost > 0)!;
    base.reviewsByDevice = { x: Math.max(hat.cost, other0.cost) + 5 }; // enough for either, not for both
    const a = structuredClone(base);
    const b = structuredClone(base);
    const other = ITEMS.find((i) => i.slot === 'background' && i.cost > 0)!;
    buyItem(a, hat.id, 1);
    buyItem(b, other.id, 2);
    const m = mergeData(a, b);
    expect(seedsBalance(m)).toBeGreaterThanOrEqual(0);
    expect(owns(m, hat)).toBe(true);
    expect(owns(m, other)).toBe(true);
  });
});

describe('sync and backup', () => {
  const hat = ITEMS.find((i) => i.slot === 'helmet' && i.cost > 0)!;
  const bg = ITEMS.find((i) => i.slot === 'background' && i.cost > 0)!;
  it('owned items are unioned, the look is last-writer-wins, and merge stays commutative / associative / idempotent', () => {
    const base = rich();
    const a = structuredClone(base);
    const b = structuredClone(base);
    const c = structuredClone(base);
    buyItem(a, hat.id, 10);
    equipItem(a, hat.id, 11);
    buyItem(b, bg.id, 20);
    equipItem(b, bg.id, 21);
    const ab = mergeData(a, b);
    expect(mergeData(b, a)).toEqual(ab);
    expect(mergeData(ab, ab)).toEqual(ab);
    expect(mergeData(mergeData(a, b), c)).toEqual(mergeData(a, mergeData(b, c)));
    expect([...ab.avatar!.owned].sort()).toEqual([hat.id, bg.id].sort());
    expect(ab.avatar!.lookAt).toBe(21);
    expect(ab.avatar!.look.background).toBe(bg.id); // the later decision wins
  });
  it('no avatar on either side stays no avatar (older data and older apps are unaffected)', () => {
    expect(mergeData(newData(), newData()).avatar).toBeUndefined();
  });
  it('export → import keeps the avatar; garbage in the avatar is cleaned, never crashes', () => {
    const d = rich();
    buyItem(d, hat.id, 1);
    equipItem(d, hat.id, 2);
    expect(parseBackup(exportBackup(d, '9.9.9', 0))).toEqual(d);
    const bad = JSON.parse(JSON.stringify(d));
    bad.avatar = { owned: [1, null, 'ok', 'x'.repeat(500)], look: { hat: 5, tunic: 'fine' }, lookAt: 'no' };
    const n = normalizeData(bad);
    expect(n.avatar === undefined || Array.isArray(n.avatar.owned)).toBe(true);
    if (n.avatar) expect(n.avatar.owned.every((s) => typeof s === 'string' && s.length < 80)).toBe(true);
  });
});
