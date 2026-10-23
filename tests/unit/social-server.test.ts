import { beforeEach, describe, expect, it } from 'vitest';
import { cleanName, cleanSnap, handleSocial } from '../../functions/_lib/social.js';

/** An in-memory stand-in for Cloudflare KV (values are stored as text, like the real thing). */
function memoryKv() {
  const m = new Map<string, string>();
  return {
    m,
    async get(key: string) {
      const v = m.get(key);
      return v ? JSON.parse(v) : null;
    },
    async put(key: string, value: string) {
      m.set(key, value);
    },
    async delete(key: string) {
      m.delete(key);
    },
  };
}

const hex = (n: number) => n.toString(16).padStart(32, '0');
const secret = (n: number) => `s${String(n).padStart(40, '0')}`;
const snap = (over: Record<string, unknown> = {}) => ({
  look: { helmet: 'helmet-iron-bulwark', scene: 'scene-sunlit-castle' },
  streak: 3,
  longest: 9,
  counts: { daily: 2, weekly: 1, monthly: 0, yearly: 0 },
  week: 12,
  weekStart: '2026-10-18',
  ...over,
});

let kv: ReturnType<typeof memoryKv>;
beforeEach(() => {
  kv = memoryKv();
});

async function call(action: string, body: Record<string, unknown>, now = 1_000_000) {
  const res = await handleSocial(new Request('http://x/api/social/' + action, { method: 'POST', body: JSON.stringify(body) }), kv, action, now);
  return { status: res.status, body: (await res.json()) as any };
}
const who = (n: number) => ({ id: hex(n), secret: secret(n) });
const join = (n: number, name = `Person ${n}`, s = snap()) => call('profile', { ...who(n), name, snap: s });

describe('names and shared progress are cleaned', () => {
  it('names: one line of plain text, at most 40 characters, nothing invisible', () => {
    expect(cleanName('  Zach​  P.\n ')).toBe('Zach P.');
    expect(cleanName('a'.repeat(100))).toHaveLength(40);
    expect(cleanName('')).toBe('');
    expect(cleanName(42)).toBe('');
    expect(cleanName('x'.repeat(50), 30)).toHaveLength(30);
  });
  it('progress: only the small expected shape is accepted', () => {
    expect(cleanSnap(snap())).toMatchObject({ streak: 3, week: 12 });
    expect(cleanSnap(snap({ streak: -1 }))).toBeNull();
    expect(cleanSnap(snap({ streak: 1.5 }))).toBeNull();
    expect(cleanSnap(snap({ weekStart: 'today' }))).toBeNull();
    expect(cleanSnap(snap({ counts: { daily: 1 } }))).toBeNull();
    expect(cleanSnap(snap({ look: { 'bad key!': 'x' } }))).toBeNull();
    expect(cleanSnap(snap({ look: { helmet: '<script>' } }))).toBeNull();
    expect(cleanSnap(null)).toBeNull();
    expect(cleanSnap({ ...snap(), extra: 'ignored', text: 'a verse' })).not.toHaveProperty('text'); // nothing extra is kept
  });
});

describe('profiles', () => {
  it('creates a profile, then only the owner of the secret can change it', async () => {
    expect((await join(1)).body).toMatchObject({ ok: true, created: true, changed: true });
    expect((await join(1)).body).toMatchObject({ ok: true, changed: false }); // nothing new: no write
    const writes = kv.m.size;
    await join(1, 'Person 1', snap({ week: 13 }));
    expect(kv.m.size).toBe(writes);
    const wrong = await call('profile', { id: hex(1), secret: secret(99), name: 'Thief', snap: snap() });
    expect(wrong.status).toBe(403);
    expect(JSON.parse(kv.m.get(hex(1) && `u:${hex(1)}`)!).name).toBe('Person 1');
  });
  it('the secret is stored only as a hash', async () => {
    await join(1);
    const stored = kv.m.get(`u:${hex(1)}`)!;
    expect(stored).not.toContain(secret(1));
  });
  it('rejects bad ids, short secrets, bad names, bad bodies, other methods, and a missing KV', async () => {
    expect((await call('profile', { id: 'nope', secret: secret(1), name: 'A', snap: snap() })).status).toBe(400);
    expect((await call('profile', { id: hex(1), secret: 'short', name: 'A', snap: snap() })).status).toBe(400);
    expect((await call('profile', { ...who(1), name: '   ', snap: snap() })).status).toBe(400);
    expect((await call('profile', { ...who(1), name: 'A', snap: { nope: 1 } })).status).toBe(400);
    const get = await handleSocial(new Request('http://x', { method: 'GET' }), kv, 'profile');
    expect(get.status).toBe(405);
    const bad = await handleSocial(new Request('http://x', { method: 'POST', body: '{nope' }), kv, 'profile');
    expect(bad.status).toBe(400);
    const big = await handleSocial(new Request('http://x', { method: 'POST', body: 'x'.repeat(5000) }), kv, 'profile');
    expect(big.status).toBe(413);
    const off = await handleSocial(new Request('http://x', { method: 'POST', body: '{}' }), undefined, 'profile');
    expect(off.status).toBe(501);
    expect((await call('friends', who(7))).status).toBe(403); // no profile yet
    await join(1);
    expect((await call('whatever', who(1))).status).toBe(404);
  });
});

describe('friends: invite only, both sides agree', () => {
  async function pair() {
    await join(1, 'Zach P.');
    await join(2, 'Sam L.', snap({ streak: 8 }));
    const { body } = await call('invite', who(1));
    return body.code as string;
  }

  it('an invite code says who sent it, and accepting makes both people friends', async () => {
    const code = await pair();
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    expect((await call('invite-info', { code })).body).toEqual({ name: 'Zach P.' });
    const acc = await call('accept', { ...who(2), code });
    expect(acc.body.friend).toMatchObject({ id: hex(1), name: 'Zach P.' });
    const mine = (await call('friends', who(2))).body.friends;
    const theirs = (await call('friends', who(1))).body.friends;
    expect(mine.map((f: any) => f.name)).toEqual(['Zach P.']);
    expect(theirs.map((f: any) => f.name)).toEqual(['Sam L.']);
    expect(theirs[0].snap.streak).toBe(8);
    expect(JSON.stringify(theirs)).not.toContain('secret');
    expect(JSON.stringify(theirs)).not.toContain('"sh"');
  });

  it('the same code can be used again and by several people; accepting twice changes nothing', async () => {
    const code = await pair();
    await join(3, 'Ana');
    await call('accept', { ...who(2), code });
    await call('accept', { ...who(2), code });
    await call('accept', { ...who(3), code });
    expect((await call('friends', who(1))).body.friends).toHaveLength(2);
    expect((await call('friends', who(2))).body.friends).toHaveLength(1);
  });

  it('you cannot accept your own code, a made-up one, or one whose sender has left', async () => {
    const code = await pair();
    expect((await call('accept', { ...who(1), code })).body.error).toBe('own-code');
    expect((await call('accept', { ...who(2), code: 'AAAAAAAA' })).status).toBe(404);
    expect((await call('accept', { ...who(2), code: 'short' })).status).toBe(400);
    await call('delete', who(1));
    expect((await call('accept', { ...who(2), code })).status).toBe(404);
  });

  it('the invite is reused for a while (fewer writes) and renewed when nearly expired', async () => {
    await join(1);
    const a = (await call('invite', who(1), 1_000)).body.code;
    const b = (await call('invite', who(1), 2_000)).body.code;
    expect(b).toBe(a);
    const later = (await call('invite', who(1), 1_000 + 7 * 86400_000 - 1000)).body.code;
    expect(later).not.toBe(a);
  });

  it('removing a friend works for both sides straight away, even if only one side asks', async () => {
    const code = await pair();
    await call('accept', { ...who(2), code });
    await call('unfriend', { ...who(2), friendId: hex(1) });
    expect((await call('friends', who(1))).body.friends).toEqual([]);
    expect((await call('friends', who(2))).body.friends).toEqual([]);
  });

  it('a one-sided entry never shows up (it needs both lists)', async () => {
    await join(1);
    await join(2);
    kv.m.set(`f:${hex(1)}`, JSON.stringify([hex(2)])); // only 1 lists 2
    expect((await call('friends', who(1))).body.friends).toEqual([]);
    expect((await call('friends', who(2))).body.friends).toEqual([]);
  });

  it('deleting a profile removes it everywhere', async () => {
    const code = await pair();
    await call('accept', { ...who(2), code });
    expect((await call('delete', who(1))).body.ok).toBe(true);
    expect((await call('friends', who(2))).body.friends).toEqual([]);
    expect(kv.m.has(`u:${hex(1)}`)).toBe(false);
    expect(kv.m.has(`f:${hex(1)}`)).toBe(false);
    expect((await call('friends', who(1))).status).toBe(403);
  });

  it('a person cannot read or change anyone else’s friends with their own secret', async () => {
    await pair();
    expect((await call('friends', { id: hex(1), secret: secret(2) })).status).toBe(403);
    expect((await call('unfriend', { id: hex(1), secret: secret(2), friendId: hex(2) })).status).toBe(403);
    expect((await call('delete', { id: hex(1), secret: secret(2) })).status).toBe(403);
  });
});

describe('cheers: a friendly 👏, once a day each, only between friends', () => {
  async function friends() {
    await join(1, 'Zach P.');
    await join(2, 'Sam L.');
    const code = (await call('invite', who(1))).body.code;
    await call('accept', { ...who(2), code });
  }
  const DAY = 86_400_000;

  it('a friend can cheer you; you see who, by name, on the friends list', async () => {
    await friends();
    expect((await call('cheer', { ...who(2), friendId: hex(1) }, 5 * DAY)).body.ok).toBe(true);
    const mine = (await call('friends', who(1), 5 * DAY + 1000)).body;
    expect(mine.cheers).toEqual([{ id: hex(2), name: 'Sam L.', at: 5 * DAY }]);
    expect((await call('friends', who(2), 5 * DAY + 1000)).body.cheers).toEqual([]); // cheering does not show on your own page
  });

  it('only once a day each (a second one is ignored), then again the next day', async () => {
    await friends();
    await call('cheer', { ...who(2), friendId: hex(1) }, 5 * DAY + 1000);
    expect((await call('cheer', { ...who(2), friendId: hex(1) }, 5 * DAY + 2000)).body.already).toBe(true);
    expect(JSON.parse(kv.m.get(`ch:${hex(1)}`)!)).toHaveLength(1);
    await call('cheer', { ...who(2), friendId: hex(1) }, 6 * DAY + 1000);
    expect(JSON.parse(kv.m.get(`ch:${hex(1)}`)!)).toHaveLength(2);
  });

  it('strangers, yourself and removed friends cannot cheer; old cheers fade after a week', async () => {
    await friends();
    await join(3, 'Ana B.');
    expect((await call('cheer', { ...who(3), friendId: hex(1) })).status).toBe(404);
    expect((await call('cheer', { ...who(1), friendId: hex(1) })).status).toBe(400);
    await call('cheer', { ...who(2), friendId: hex(1) }, 5 * DAY);
    expect((await call('friends', who(1), 5 * DAY + 8 * DAY)).body.cheers).toEqual([]);
    await call('unfriend', { ...who(1), friendId: hex(2) });
    expect((await call('cheer', { ...who(2), friendId: hex(1) }, 20 * DAY)).status).toBe(404);
    expect((await call('friends', who(1), 5 * DAY + 1000)).body.cheers).toEqual([]); // cheers from someone no longer a friend are hidden
  });

  it('deleting a profile clears the cheers it received', async () => {
    await friends();
    await call('cheer', { ...who(2), friendId: hex(1) }, 5 * DAY);
    await call('delete', who(1));
    expect(kv.m.has(`ch:${hex(1)}`)).toBe(false);
  });
});

describe('guilds: invite only', () => {
  async function guild() {
    await join(1, 'Zach P.', snap({ week: 10 }));
    await join(2, 'Sam L.', snap({ week: 5 }));
    await join(3, 'Ana B.', snap({ week: 7, weekStart: '2026-10-11' })); // still on last week's numbers
    const gid = (await call('guild-create', { ...who(1), name: ' Youth  Group ' })).body.gid as string;
    const code = (await call('guild-invite', { ...who(1), gid })).body.code as string;
    return { gid, code };
  }

  it('creating, inviting and joining; members see each other and a shared weekly goal', async () => {
    const { gid, code } = await guild();
    expect((await call('guild-info', { code })).body).toEqual({ name: 'Youth Group', members: 1 });
    expect((await call('guild-join', { ...who(2), code })).body.gid).toBe(gid);
    expect((await call('guild-join', { ...who(3), code })).body.ok).toBe(true);
    const g = (await call('guilds', who(2))).body.guilds[0];
    expect(g.name).toBe('Youth Group');
    expect(g.members.map((m: any) => m.name)).toEqual(['Zach P.', 'Sam L.', 'Ana B.']); // most reviews first
    expect(g.weekStart).toBe('2026-10-18');
    expect(g.progress).toBe(15); // Ana's numbers are from last week, so they are not counted
    expect(g.goal).toBe(75);
    expect(JSON.stringify(g)).not.toContain('"sh"');
  });

  it('joining twice changes nothing; outsiders cannot invite; made-up codes fail', async () => {
    const { gid, code } = await guild();
    await call('guild-join', { ...who(2), code });
    await call('guild-join', { ...who(2), code });
    expect((await call('guilds', who(1))).body.guilds[0].members).toHaveLength(2);
    expect((await call('guild-invite', { ...who(3), gid })).status).toBe(404);
    expect((await call('guild-join', { ...who(3), code: 'AAAAAAAA' })).status).toBe(404);
    expect((await call('guilds', who(3))).body.guilds).toEqual([]);
  });

  it('leaving: the owner passes the guild on, and the last one out closes it and its invite', async () => {
    const { gid, code } = await guild();
    await call('guild-join', { ...who(2), code });
    await call('guild-leave', { ...who(1), gid });
    const g = (await call('guilds', who(2))).body.guilds[0];
    expect(g.owner).toBe(hex(2));
    expect(g.members).toHaveLength(1);
    await call('guild-leave', { ...who(2), gid });
    expect(kv.m.has(`g:${gid}`)).toBe(false);
    expect((await call('guild-info', { code })).status).toBe(404);
  });

  it('a person can be in at most five guilds, and a guild holds at most thirty people', async () => {
    await join(1);
    for (let i = 0; i < 5; i++) expect((await call('guild-create', { ...who(1), name: `G${i}` })).status).toBe(200);
    expect((await call('guild-create', { ...who(1), name: 'one more' })).status).toBe(409);
    await join(2);
    const gid = (await call('guild-create', { ...who(2), name: 'Big' })).body.gid;
    const code = (await call('guild-invite', { ...who(2), gid })).body.code;
    for (let n = 10; n < 39; n++) {
      await join(n);
      expect((await call('guild-join', { ...who(n), code })).status).toBe(200);
    }
    await join(99);
    expect((await call('guild-join', { ...who(99), code })).status).toBe(409);
  });

  it('deleting a profile also leaves its guilds', async () => {
    const { gid, code } = await guild();
    await call('guild-join', { ...who(2), code });
    await call('delete', who(1));
    const g = (await call('guilds', who(2))).body.guilds[0];
    expect(g.id).toBe(gid);
    expect(g.members.map((m: any) => m.name)).toEqual(['Sam L.']);
  });
});
