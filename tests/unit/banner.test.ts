import { describe, expect, it } from 'vitest';
import { cleanSnap } from '../../functions/_lib/social.js';
import { BANNER_COLORS, BANNER_DESIGNS, bannerFromFlag, bannerOf, bannerSpec, defaultBanner, flagId, NO_FLAG, parseBanner, reconcileFlag } from '../../src/core/banner.ts';
import { currentLook, defaultLook, equipItem, itemById, owns, seedsSpent } from '../../src/core/avatar.ts';
import { newData } from './helpers.ts';

describe('group banners', () => {
  it('a banner is three words, and anything else is ignored', () => {
    expect(parseBanner('chevron-crimson-gold')).toEqual({ design: 'chevron', field: 'crimson', pattern: 'gold' });
    expect(bannerSpec(parseBanner('pall-navy-ivory')!)).toBe('pall-navy-ivory');
    for (const bad of ['', 'chevron', 'chevron-crimson', 'chevron-crimson-gold-extra', 'wave-crimson-gold', 'chevron-pink-gold', 'CHEVRON-crimson-gold', 42, null, undefined]) expect(parseBanner(bad)).toBeNull();
  });

  it('every design and colour name is one plain word (so the banner fits in a look id and never has a stray dash)', () => {
    for (const d of BANNER_DESIGNS) expect(d.id).toMatch(/^[a-z]{3,10}$/);
    for (const c of BANNER_COLORS) {
      expect(c.id).toMatch(/^[a-z]{3,10}$/);
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(BANNER_DESIGNS.length * BANNER_COLORS.length * (BANNER_COLORS.length - 1)).toBeGreaterThan(1500); // plenty of combinations
  });

  it('a group with no banner gets the same one every time, and it is always a valid one with two different colours', () => {
    const a = defaultBanner('group-1');
    expect(defaultBanner('group-1')).toEqual(a);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const b = defaultBanner(`g${i}`);
      expect(parseBanner(bannerSpec(b))).toEqual(b);
      expect(b.field).not.toBe(b.pattern);
      seen.add(bannerSpec(b));
    }
    expect(seen.size).toBeGreaterThan(40); // they differ from group to group
    expect(bannerOf({ id: 'g1', banner: 'cross-teal-ivory' })).toEqual({ design: 'cross', field: 'teal', pattern: 'ivory' });
    expect(bannerOf({ id: 'g1', banner: 'nonsense' })).toEqual(defaultBanner('g1'));
  });

  it('can be worn on the flag stand: free, valid, kept, and shared in a look', () => {
    const id = flagId('chevron-crimson-gold');
    expect(id).toBe('flag-chevron-crimson-gold');
    expect(bannerFromFlag(id)).toEqual({ design: 'chevron', field: 'crimson', pattern: 'gold' });
    expect(bannerFromFlag('flag-none')).toBeNull();
    expect(itemById(id)).toMatchObject({ slot: 'flag', cost: 0 });
    expect(itemById('flag-wave-red-gold')).toBeUndefined(); // not one of ours
    expect(defaultLook().flag).toBe(NO_FLAG);
    const d = newData();
    expect(owns(d, itemById(id)!)).toBe(true);
    expect(equipItem(d, id, 1)).toBe(true);
    expect(currentLook(d).flag).toBe(id);
    expect(currentLook(d).scene).toBe(defaultLook().scene); // the background is untouched
    expect(seedsSpent(d)).toBe(0);
    d.avatar!.look.flag = 'flag-wave-red-gold'; // a made-up banner falls back to no flag
    expect(currentLook(d).flag).toBe(NO_FLAG);
    // friends accept it inside a look
    const snap = cleanSnap({ look: { ...defaultLook(), flag: id }, streak: 0, longest: 0, counts: { daily: 0, weekly: 0, monthly: 0, yearly: 0 }, week: 0, weekStart: '2026-01-04' });
    expect((snap as { look: Record<string, string> }).look.flag).toBe(id);
  });

  it('the flag follows its group: a redesign changes it, leaving removes it', () => {
    const g = { id: 'g1', banner: 'cross-teal-ivory' };
    const worn = flagId('chevron-crimson-gold');
    expect(reconcileFlag(worn, 'g1', [g])).toEqual({ flag: flagId('cross-teal-ivory'), guild: 'g1' }); // redesigned
    expect(reconcileFlag(flagId('cross-teal-ivory'), 'g1', [g])).toEqual({ flag: flagId('cross-teal-ivory'), guild: 'g1' }); // unchanged
    expect(reconcileFlag(worn, 'g1', [])).toEqual({ flag: NO_FLAG, guild: '' }); // left
    expect(reconcileFlag(worn, 'g1', [{ id: 'g2', banner: 'chevron-crimson-gold' }])).toEqual({ flag: NO_FLAG, guild: '' }); // another group with the same look is not it
    expect(reconcileFlag(worn, '', [{ id: 'g2', banner: 'chevron-crimson-gold' }])).toEqual({ flag: worn, guild: 'g2' }); // a second device finds its group by the look
    expect(reconcileFlag(NO_FLAG, '', [g])).toEqual({ flag: NO_FLAG, guild: '' });
  });
});
