// Avatar + seeds: seeds are EARNED from real, counted practice (never lost, never expire); items are bought with them or
// unlocked by achievements. Everything is derived from synced data so devices agree and nothing can be taken away.
import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  testing,
  ARMOR_SLOTS,
  SETS,
  matchedSet,
  armorWorn,
  resetAvatar,
  STREAK_SEED_BONUS,
  SCENES,
  sceneUrl,
} from '../../src/core/avatar.ts';
import { mergeData } from '../../src/core/merge.ts';
import { recordReview, settle } from '../../src/core/schedule.ts';
import { STREAK_MILESTONES } from '../../src/core/milestones.ts';
import { at, D0, day, DEVICE, john316, newData, reviewEverythingDue } from './helpers.ts';

// the real rules are tested with the temporary "armor is free" switch off
beforeAll(() => {
  testing.armorFree = false;
});
afterAll(() => {
  testing.armorFree = false;
});

const rich = () => {
  const d = newData();
  d.longestStreak = 0;
  d.reviewsByDevice = { x: 1000 }; // 1000 seeds worth of counted reviews
  return d;
};

describe('backgrounds', () => {
  it('are fifteen painted pictures, all free, plus the drawn morning sky as the default', () => {
    const scenes = ITEMS.filter((i) => i.slot === 'scene');
    expect(scenes).toHaveLength(SCENES.length + 1);
    expect(SCENES).toHaveLength(15);
    expect(defaultLook().scene).toBe('scene-sky');
    const d = newData();
    for (const s of scenes) {
      expect(s.cost, s.id).toBe(0);
      expect(s.unlock, s.id).toBeUndefined();
      expect(owns(d, s), s.id).toBe(true); // free for everyone, nothing to earn
    }
    expect(sceneUrl('scene-sky')).toBeNull();
    expect(sceneUrl('scene-frost-keep')).toBe('/scenes/frost-keep.webp');
    expect(sceneUrl('scene-nope')).toBeNull();
  });

  it('every background has its picture file, and wearing one is remembered and falls back safely when unknown', () => {
    for (const s of SCENES) expect(existsSync(`public/scenes/${s.id}.webp`), s.id).toBe(true);
    const d = newData();
    expect(equipItem(d, 'scene-frost-keep', 5)).toBe(true);
    expect(currentLook(d).scene).toBe('scene-frost-keep');
    d.avatar!.look.scene = 'scene-from-the-future';
    expect(currentLook(d).scene).toBe('scene-sky');
  });
});

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
  it('everyone starts in the same free basic steel armor, with nothing in the shield and weapon slots', () => {
    const look = defaultLook();
    expect(look).toMatchObject({ helmet: 'helmet-iron-bulwark', chest: 'chest-iron-bulwark', belt: 'belt-iron-bulwark', boots: 'boots-iron-bulwark', shield: 'shield-none', weapon: 'weapon-none' });
    for (const slot of SLOTS) expect(itemById(look[slot])!.cost, slot).toBe(0);
    expect(armorWorn(look)).toBe(0);
  });

  it('the avatar screen lists the six armor pieces, then the cape and the background, and nothing else (no extras)', () => {
    expect(SLOTS).toEqual(['helmet', 'chest', 'belt', 'boots', 'shield', 'weapon', 'cape', 'scene']);
    expect([...new Set(ITEMS.map((i) => i.slot))].sort()).toEqual([...SLOTS].sort());
  });

  it('the six armor categories are helmet, chest plate, belt, boots, shield and sword (no separate arms)', () => {
    expect([...ARMOR_SLOTS]).toEqual(['helmet', 'chest', 'belt', 'boots', 'shield', 'weapon']);
    expect(SLOTS).not.toContain('arms');
  });

  it('helmets, chest plates, belts, boots, capes, swords and shields come in eleven matching sets, each costing more than the one before', () => {
    expect(SETS.length).toBe(11);
    expect(SETS[0].price).toBe(0);
    const prices = SETS.map((s) => s.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(prices).size).toBe(11);
    expect(new Set(SETS.map((s) => s.id)).size).toBe(11);
    for (const set of SETS) {
      for (const slot of ['helmet', 'chest', 'belt', 'boots', 'cape', 'weapon', 'shield'] as const) {
        const item = itemById(`${slot}-${set.id}`)!;
        expect(item, `${slot}-${set.id}`).toBeDefined();
        expect(item.set).toBe(set.n);
      }
    }
    for (const slot of ['helmet', 'chest', 'belt', 'boots', 'cape', 'weapon', 'shield'] as const) {
      const costs = SETS.map((s) => itemById(`${slot}-${s.id}`)!.cost);
      expect(costs, slot).toEqual([...costs].sort((a, b) => a - b));
    }
  });

  it('the finest pieces are the hardest to get: they cost the most and also need a long streak', () => {
    const days = (id: string) => (itemById(id)?.requires?.find((u) => u.kind === 'streak') as { days: number } | undefined)?.days ?? 0;
    expect(days('chest-sulestial')).toBeGreaterThanOrEqual(365);
    expect(days('helmet-sulestial')).toBeGreaterThanOrEqual(365);
    expect(days('weapon-sulestial')).toBeGreaterThanOrEqual(365);
    expect(days('chest-shadowblade')).toBeGreaterThan(0);
    for (const slot of ['helmet', 'chest', 'belt', 'boots', 'shield', 'weapon'] as const) {
      const inSlot = ITEMS.filter((i) => i.slot === slot && i.art);
      const priciest = inSlot.reduce((a, b) => (b.cost > a.cost ? b : a));
      expect(days(priciest.id), `${slot}: ${priciest.id}`).toBeGreaterThanOrEqual(180);
    }
    // a gated piece is never cheaper than the free-for-everyone ones in its slot
    for (const i of ITEMS.filter((x) => x.requires)) expect(i.cost, i.id).toBeGreaterThan(0);
  });

  it('a piece that needs a streak cannot be bought early, however many seeds you have, and costs seeds once reached', () => {
    const d = rich();
    d.reviewsByDevice = { x: 100000 };
    const sword = itemById('weapon-sulestial')!;
    d.longestStreak = 364;
    expect(buyItem(d, sword.id, 1)).toMatchObject({ ok: false, reason: 'locked' });
    d.longestStreak = 365;
    expect(buyItem(d, sword.id, 1)).toMatchObject({ ok: false, reason: 'locked' }); // the streak is not enough on its own: it also needs 50 verses
    for (let i = 0; i < 50; i++) john316(d, 1000 + i);
    const before = seedsBalance(d);
    expect(buyItem(d, sword.id, 2)).toEqual({ ok: true });
    expect(seedsBalance(d)).toBe(before - sword.cost);
  });

  it('the prices are the owner-approved table: whole-set totals, with each piece a fixed share of its set', () => {
    expect(SETS.map((s) => [s.id, s.price])).toEqual([
      ['iron-bulwark', 0],
      ['silver-vanguard', 800],
      ['forest-guardian', 1600],
      ['knights-oath', 2400],
      ['stormcaller', 3600],
      ['frostborn', 4800],
      ['ember-knight', 6400],
      ['crimson-legion', 8800],
      ['shadowblade', 12000],
      ['golden-paladin', 16000],
      ['sulestial', 22000],
    ]);
    const cost = (slot: string, id: string) => itemById(`${slot}-${id}`)!.cost;
    expect(['helmet', 'chest', 'shield', 'weapon', 'boots', 'belt', 'cape'].map((s) => cost(s, 'silver-vanguard'))).toEqual([160, 200, 145, 145, 65, 50, 40]);
    expect(['helmet', 'chest', 'shield', 'weapon', 'boots', 'belt', 'cape'].map((s) => cost(s, 'sulestial'))).toEqual([4400, 5500, 3960, 3960, 1760, 1320, 1100]);
    for (const slot of ['helmet', 'chest', 'belt', 'boots', 'cape', 'weapon', 'shield']) expect(cost(slot, 'iron-bulwark'), slot).toBe(0);
  });

  it('the free set\'s sword is a reward for adding a first verse and practising it, and its shield for finishing the tour (or a first streak)', () => {
    const d = newData();
    const sword = itemById('weapon-iron-bulwark')!;
    const shield = itemById('shield-iron-bulwark')!;
    expect(sword.cost).toBe(0);
    expect(shield.cost).toBe(0);
    expect(owns(d, sword)).toBe(false);
    expect(owns(d, shield)).toBe(false);
    expect(equipItem(d, sword.id, 1)).toBe(false);
    const v = john316(d, 1000);
    expect(owns(d, sword)).toBe(false); // adding is not enough: it has to be practised too
    d.reviewsByDevice = { x: 1 };
    expect(owns(d, sword)).toBe(true);
    expect(equipItem(d, sword.id, 2)).toBe(true);
    // a deleted verse does not count
    v.deletedAt = 5;
    expect(owns(d, sword)).toBe(false);
    delete v.deletedAt;
    expect(owns(d, shield)).toBe(false);
    d.tourAt = 1234;
    expect(owns(d, shield)).toBe(true);
    // people who already lit their first flame keep the shield they had
    const old = newData();
    old.longestStreak = 1;
    expect(owns(old, shield)).toBe(true);
    expect(buyItem(d, sword.id, 3)).toMatchObject({ ok: false, reason: 'owned' });
    // every other set's sword and shield are still bought with seeds
    expect(itemById('weapon-silver-vanguard')!.unlock).toBeUndefined();
    expect(itemById('shield-silver-vanguard')!.unlock).toBeUndefined();
  });

  it('only the last four sets need verses (10, 20, 30, 50) and a streak; every earlier set needs nothing but coins, in any order', () => {
    const need = (id: string) => itemById(id)!.requires ?? [];
    for (const set of ['silver-vanguard', 'forest-guardian', 'knights-oath', 'stormcaller', 'frostborn', 'ember-knight']) expect(need(`helmet-${set}`), set).toEqual([]);
    expect(need('chest-crimson-legion')).toEqual([{ kind: 'streak', days: 30 }, { kind: 'verses', n: 10 }]);
    expect(need('chest-shadowblade')).toEqual([{ kind: 'streak', days: 60 }, { kind: 'verses', n: 20 }]);
    expect(need('chest-golden-paladin')).toEqual([{ kind: 'streak', days: 180 }, { kind: 'verses', n: 30 }]);
    expect(need('chest-sulestial')).toEqual([{ kind: 'streak', days: 365 }, { kind: 'verses', n: 50 }]);
    const d = rich();
    d.reviewsByDevice = { x: 100000 };
    expect(buyItem(d, 'helmet-stormcaller', 1)).toEqual({ ok: true }); // no verses or streak needed
    expect(buyItem(d, 'helmet-ember-knight', 2)).toEqual({ ok: true }); // and no need to own the earlier sets
    d.longestStreak = 30;
    expect(buyItem(d, 'chest-crimson-legion', 3)).toMatchObject({ ok: false, reason: 'locked' }); // the streak alone is not enough
    const added = Array.from({ length: 10 }, (_, i) => john316(d, 1000 + i));
    added[0].deletedAt = 5; // a deleted verse no longer counts
    expect(buyItem(d, 'chest-crimson-legion', 4)).toMatchObject({ ok: false, reason: 'locked' });
    john316(d, 2000);
    expect(buyItem(d, 'chest-crimson-legion', 5)).toEqual({ ok: true });
  });

  it('notices a matching set on helmet, chest plate, belt and boots (but not the free start)', () => {
    const look = defaultLook();
    expect(matchedSet(look)).toBeUndefined();
    for (const s of ['helmet', 'chest', 'belt', 'boots'] as const) look[s] = `${s}-stormcaller`;
    expect(matchedSet(look)?.name).toBe('Stormcaller');
    look.boots = 'boots-frostborn';
    expect(matchedSet(look)).toBeUndefined();
  });

  it('counts how many of the six pieces have been changed from the basic start', () => {
    const look = defaultLook();
    expect(armorWorn(look)).toBe(0);
    look.shield = 'shield-iron-bulwark';
    look.weapon = 'weapon-iron-bulwark';
    expect(armorWorn(look)).toBe(2);
    look.helmet = 'helmet-ember-knight';
    look.chest = 'chest-ember-knight';
    look.belt = 'belt-ember-knight';
    look.boots = 'boots-ember-knight';
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
  const locked = ITEMS.find((i) => i.unlock?.kind === 'tour')!;

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
    d.avatar = { owned: [], look: { helmet: 'future-helmet', chest: hat.id }, lookAt: 1 };
    const look = currentLook(d);
    expect(look.helmet).toBe(defaultLook().helmet);
    expect(look.chest).toBe(defaultLook().chest);
  });

  it('a balance can never show below zero, and no item is ever removed (two devices spending the same seeds)', () => {
    const base = rich();
    const other0 = ITEMS.find((i) => i.slot === 'cape' && i.cost > 0)!;
    base.reviewsByDevice = { x: Math.max(hat.cost, other0.cost) + 5 }; // enough for either, not for both
    const a = structuredClone(base);
    const b = structuredClone(base);
    const other = ITEMS.find((i) => i.slot === 'cape' && i.cost > 0)!;
    buyItem(a, hat.id, 1);
    buyItem(b, other.id, 2);
    const m = mergeData(a, b);
    expect(seedsBalance(m)).toBeGreaterThanOrEqual(0);
    expect(owns(m, hat)).toBe(true);
    expect(owns(m, other)).toBe(true);
  });
});

describe('resetting the armor (owner request)', () => {
  it('forgets everything bought and worn, gives every seed back, and keeps verses and progress', () => {
    const d = rich();
    john316(d, 1000);
    buyItem(d, 'helmet-silver-vanguard', 1);
    equipItem(d, 'helmet-silver-vanguard', 2);
    const spent = itemById('helmet-silver-vanguard')!.cost;
    const before = seedsBalance(d);
    const earned = seedsEarned(d);
    resetAvatar(d, 5);
    expect(d.avatar!.owned).toEqual([]);
    expect(currentLook(d)).toEqual(defaultLook());
    expect(seedsBalance(d)).toBe(before + spent);
    expect(seedsEarned(d)).toBe(earned);
    expect(Object.keys(d.verses)).toHaveLength(1);
    expect(d.avatar!.lookAt).toBeGreaterThanOrEqual(5);
  });
});

describe('sync and backup', () => {
  const hat = ITEMS.find((i) => i.slot === 'helmet' && i.cost > 0)!;
  const bg = ITEMS.find((i) => i.slot === 'cape' && i.cost > 0)!;
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
    expect(ab.avatar!.look.cape).toBe(bg.id); // the later decision wins
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
    bad.avatar = { owned: [1, null, 'ok', 'x'.repeat(500)], look: { hat: 5, chest: 'fine' }, lookAt: 'no' };
    const n = normalizeData(bad);
    expect(n.avatar === undefined || Array.isArray(n.avatar.owned)).toBe(true);
    if (n.avatar) expect(n.avatar.owned.every((s) => typeof s === 'string' && s.length < 80)).toBe(true);
  });
});

describe('temporary "armor is free" testing switch', () => {
  it('while on, any armor can be worn with no seeds and no streak, nothing is recorded, and it falls off again when switched off', () => {
    const d = newData();
    const legend = itemById('weapon-sulestial')!;
    testing.armorFree = true;
    try {
      expect(owns(d, legend)).toBe(true);
      expect(equipItem(d, legend.id, 1)).toBe(true);
      expect(currentLook(d).weapon).toBe(legend.id);
      expect(seedsBalance(d)).toBe(0);
      expect(d.avatar?.owned ?? []).toEqual([]); // nothing was bought
    } finally {
      testing.armorFree = false;
    }
    expect(currentLook(d).weapon).toBe(defaultLook().weapon);
  });
});
