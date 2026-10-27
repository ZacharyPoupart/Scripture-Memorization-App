// Friends and guilds. Opt-in and invite-only: nobody can be found by searching, only by a private invite code someone shared.
// What a person shares is small: a name, how their knight looks, their streak, how many verses are in each pile and how many
// reviews they did this week. Never the verses themselves. Shared by the Cloudflare Pages Function and the local e2e server.
//
// Storage is the same Cloudflare KV namespace the sync feature uses (binding SYNC), with different key prefixes:
//   u:<id>   a profile {sh (hash of the secret), name, snap, at}      f:<id>  a person's friend ids
//   inv:<code> {from}  ui:<id> {code, exp}                             g:<gid> a guild {name, owner, members, at}
//   gi:<code> {gid}   gu:<gid> {code, exp}                             ug:<id> a person's guild ids
//   ch:<id>  recent cheers received [{from, at}] (a fixed 👏, never text)
// Each person only ever writes their own profile; a friendship is "both lists contain the other", so removing someone works at once.

const ID = /^[a-f0-9]{32}$/;
const SECRET = /^[A-Za-z0-9_-]{32,64}$/;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: easy to read out loud
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BODY = 4096;
const MAX_FRIENDS = 200;
const MAX_GUILD_MEMBERS = 30;
const MAX_GUILDS = 3;
const FRIEND_INVITE_TTL = 7 * 86400;
const GUILD_INVITE_TTL = 14 * 86400;
const CHEER_KEEP = 7 * 86400_000; // how long a cheer stays on someone's page
/** A guild's weekly goal: every member's reviews due that week added up, rounded to the nearest 5 (never below 5). */
export const guildGoal = (dues) => Math.max(5, Math.round(dues.reduce((n, d) => n + d, 0) / 5) * 5);
/** One member's share. Members on an older version share no number yet: count 21 for each Daily verse and 1 for each Weekly one. */
const doneOf = (snap) => snap.week + (Number.isInteger(snap.extra) ? snap.extra : 0);
const dueOf = (snap) => (Number.isInteger(snap.due) ? snap.due : snap.counts.daily * 21 + snap.counts.weekly);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const fail = (error, status) => json({ error }, status);

// ---------------------------------------------------------------- small helpers

/** A person's name or a guild's name: text only, no control or invisible characters, one line, at most `max` characters. */
export function cleanName(raw, max = 40) {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** What a person shares about their progress. Returns the cleaned copy, or null when it is not valid. */
export function cleanSnap(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const streak = int(raw.streak, 99999);
  const longest = int(raw.longest, 99999);
  const week = int(raw.week, 99999);
  const c = raw.counts && typeof raw.counts === 'object' ? raw.counts : null;
  if (streak === null || longest === null || week === null || !c) return null;
  const counts = { daily: int(c.daily, 9999), weekly: int(c.weekly, 9999), monthly: int(c.monthly, 9999), yearly: int(c.yearly, 9999) };
  if (Object.values(counts).some((n) => n === null)) return null;
  if (typeof raw.weekStart !== 'string' || !DAY.test(raw.weekStart)) return null;
  const look = {};
  const entries = raw.look && typeof raw.look === 'object' ? Object.entries(raw.look) : null;
  if (!entries || entries.length > 12) return null;
  for (const [k, v] of entries) {
    if (!/^[a-z]{2,12}$/.test(k) || typeof v !== 'string' || !/^[a-z0-9-]{1,60}$/.test(v)) return null;
    look[k] = v;
  }
  const out = { look, streak, longest, counts, week, weekStart: raw.weekStart };
  const due = int(raw.due, 99999);
  if (due !== null) out.due = due;
  const extra = int(raw.extra, 99999);
  if (extra !== null) out.extra = extra;
  return out;
}

async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}
function randomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const card = (id, u) => ({ id, name: u.name, snap: u.snap, at: u.at });

// ---------------------------------------------------------------- the handler

/**
 * @param {Request} request
 * @param {{ get(key: string, type?: string): Promise<any>, put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>, delete(key: string): Promise<void> } | undefined} kv
 * @param {string} action
 * @param {number} [now]
 */
export async function handleSocial(request, kv, action, now = Date.now()) {
  if (!kv) return fail('social-not-configured', 501);
  if (request.method !== 'POST') return fail('method-not-allowed', 405);
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return fail('too-large', 413);
    body = JSON.parse(text);
  } catch {
    return fail('bad-json', 400);
  }
  if (!body || typeof body !== 'object') return fail('bad-request', 400);

  const get = (key) => kv.get(key, 'json');
  const put = (key, value, ttl) => kv.put(key, JSON.stringify(value), ttl ? { expirationTtl: ttl } : undefined);

  // two actions need no sign-in: they only say who sent an invite code
  if (action === 'invite-info') {
    if (!CODE.test(body.code || '')) return fail('bad-request', 400);
    const inv = await get(`inv:${body.code}`);
    const from = inv && (await get(`u:${inv.from}`));
    return from ? json({ name: from.name }) : fail('not-found', 404);
  }
  if (action === 'guild-info') {
    if (!CODE.test(body.code || '')) return fail('bad-request', 400);
    const gi = await get(`gi:${body.code}`);
    const g = gi && (await get(`g:${gi.gid}`));
    return g ? json({ name: g.name, members: g.members.length }) : fail('not-found', 404);
  }

  // everything else is signed in with the private id and secret kept on the person's device
  if (!ID.test(body.id || '') || !SECRET.test(body.secret || '')) return fail('bad-request', 400);
  const id = body.id;
  const hash = await sha256(body.secret);
  const me = await get(`u:${id}`);
  if (me && !same(me.sh, hash)) return fail('forbidden', 403);
  if (!me && action !== 'profile') return fail('forbidden', 403);

  const listOf = async (key) => {
    const v = await get(key);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  };

  switch (action) {
    case 'profile': {
      const name = cleanName(body.name);
      const snap = cleanSnap(body.snap);
      if (!name || !snap) return fail('bad-request', 400);
      if (me && me.name === name && JSON.stringify(me.snap) === JSON.stringify(snap)) return json({ ok: true, changed: false });
      await put(`u:${id}`, { sh: hash, name, snap, at: now });
      return json({ ok: true, changed: true, created: !me });
    }

    case 'invite': {
      const have = await get(`ui:${id}`);
      if (have && have.exp > now + 86400_000) return json({ code: have.code, expiresAt: have.exp });
      const code = randomCode();
      const exp = now + FRIEND_INVITE_TTL * 1000;
      await put(`inv:${code}`, { from: id }, FRIEND_INVITE_TTL);
      await put(`ui:${id}`, { code, exp }, FRIEND_INVITE_TTL);
      return json({ code, expiresAt: exp });
    }

    case 'accept': {
      if (!CODE.test(body.code || '')) return fail('bad-request', 400);
      const inv = await get(`inv:${body.code}`);
      if (!inv) return fail('not-found', 404);
      if (inv.from === id) return fail('own-code', 400);
      const them = await get(`u:${inv.from}`);
      if (!them) return fail('not-found', 404);
      const mine = await listOf(`f:${id}`);
      const theirs = await listOf(`f:${inv.from}`);
      if (!mine.includes(inv.from) || !theirs.includes(id)) {
        if (mine.length >= MAX_FRIENDS || theirs.length >= MAX_FRIENDS) return fail('full', 409);
        if (!mine.includes(inv.from)) await put(`f:${id}`, [...mine, inv.from]);
        if (!theirs.includes(id)) await put(`f:${inv.from}`, [...theirs, id]);
      }
      return json({ ok: true, friend: card(inv.from, them) });
    }

    case 'friends': {
      const ids = (await listOf(`f:${id}`)).slice(0, MAX_FRIENDS);
      const cards = [];
      await Promise.all(
        ids.map(async (fid) => {
          const [u, theirs] = await Promise.all([get(`u:${fid}`), listOf(`f:${fid}`)]);
          if (u && theirs.includes(id)) cards.push(card(fid, u));
        }),
      );
      cards.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      const names = new Map(cards.map((c) => [c.id, c.name]));
      const cheers = (await cheersOf(id, now))
        .filter((c) => names.has(c.from))
        .map((c) => ({ id: c.from, name: names.get(c.from), at: c.at }));
      return json({ friends: cards, cheers });
    }

    case 'cheer': {
      if (!ID.test(body.friendId || '') || body.friendId === id) return fail('bad-request', 400);
      const fid = body.friendId;
      const [mine, theirs] = await Promise.all([listOf(`f:${id}`), listOf(`f:${fid}`)]);
      if (!mine.includes(fid) || !theirs.includes(id)) return fail('not-found', 404);
      const list = await cheersOf(fid, now);
      const today = new Date(now).toISOString().slice(0, 10);
      if (list.some((c) => c.from === id && new Date(c.at).toISOString().slice(0, 10) === today)) return json({ ok: true, already: true });
      await put(`ch:${fid}`, [...list, { from: id, at: now }].slice(-30), 8 * 86400);
      return json({ ok: true });
    }

    case 'unfriend': {
      if (!ID.test(body.friendId || '')) return fail('bad-request', 400);
      const fid = body.friendId;
      const mine = await listOf(`f:${id}`);
      if (mine.includes(fid)) await put(`f:${id}`, mine.filter((x) => x !== fid));
      const theirs = await listOf(`f:${fid}`);
      if (theirs.includes(id)) await put(`f:${fid}`, theirs.filter((x) => x !== id));
      return json({ ok: true });
    }

    case 'delete': {
      for (const fid of await listOf(`f:${id}`)) {
        const theirs = await listOf(`f:${fid}`);
        if (theirs.includes(id)) await put(`f:${fid}`, theirs.filter((x) => x !== id));
      }
      for (const gid of await listOf(`ug:${id}`)) await leaveGuild(kv, gid, id);
      await Promise.all([kv.delete(`u:${id}`), kv.delete(`f:${id}`), kv.delete(`ug:${id}`), kv.delete(`ui:${id}`), kv.delete(`ch:${id}`)]);
      return json({ ok: true });
    }

    // ------------------------------------------------------------ guilds
    case 'guild-create': {
      const name = cleanName(body.name, 30);
      if (!name) return fail('bad-request', 400);
      const mine = await listOf(`ug:${id}`);
      if (mine.length >= MAX_GUILDS) return fail('full', 409);
      const gid = randomId();
      await put(`g:${gid}`, { name, owner: id, members: [id], at: now });
      await put(`ug:${id}`, [...mine, gid]);
      return json({ ok: true, gid });
    }

    case 'guild-invite': {
      const g = await memberGuild(kv, body.gid, id);
      if (!g) return fail('not-found', 404);
      const have = await get(`gu:${body.gid}`);
      if (have && have.exp > now + 86400_000) return json({ code: have.code, expiresAt: have.exp });
      const code = randomCode();
      const exp = now + GUILD_INVITE_TTL * 1000;
      await put(`gi:${code}`, { gid: body.gid }, GUILD_INVITE_TTL);
      await put(`gu:${body.gid}`, { code, exp }, GUILD_INVITE_TTL);
      return json({ code, expiresAt: exp });
    }

    case 'guild-join': {
      if (!CODE.test(body.code || '')) return fail('bad-request', 400);
      const gi = await get(`gi:${body.code}`);
      const g = gi && (await get(`g:${gi.gid}`));
      if (!g) return fail('not-found', 404);
      if (g.members.includes(id)) return json({ ok: true, gid: gi.gid });
      const mine = await listOf(`ug:${id}`);
      if (g.members.length >= MAX_GUILD_MEMBERS || mine.length >= MAX_GUILDS) return fail('full', 409);
      await put(`g:${gi.gid}`, { ...g, members: [...g.members, id] });
      await put(`ug:${id}`, [...mine, gi.gid]);
      return json({ ok: true, gid: gi.gid });
    }

    case 'guild-rename': {
      const name = cleanName(body.name, 30);
      if (!name) return fail('bad-request', 400);
      const g = await memberGuild(kv, body.gid, id);
      if (!g) return fail('not-found', 404);
      if (g.owner !== id) return fail('forbidden', 403); // only the leader renames
      if (g.name !== name) await put(`g:${body.gid}`, { ...g, name });
      return json({ ok: true });
    }

    case 'guild-leave': {
      if (!ID.test(body.gid || '')) return fail('bad-request', 400);
      await leaveGuild(kv, body.gid, id);
      return json({ ok: true });
    }

    case 'guilds': {
      const views = [];
      for (const gid of await listOf(`ug:${id}`)) {
        const g = await get(`g:${gid}`);
        if (!g || !g.members.includes(id)) continue;
        const members = [];
        await Promise.all(
          g.members.map(async (mid) => {
            const u = await get(`u:${mid}`);
            if (u) members.push(card(mid, u));
          }),
        );
        const weekStart = members.reduce((m, c) => (c.snap.weekStart > m ? c.snap.weekStart : m), '');
        const thisWeek = (c) => (c.snap.weekStart === weekStart ? doneOf(c.snap) : 0); // numbers from an older week count as nothing yet
        members.sort((a, b) => thisWeek(b) - thisWeek(a) || a.name.localeCompare(b.name));
        const progress = members.filter((c) => c.snap.weekStart === weekStart).reduce((n, c) => n + doneOf(c.snap), 0);
        views.push({ id: gid, name: g.name, owner: g.owner, members, weekStart, goal: guildGoal(members.map((c) => dueOf(c.snap))), progress });
      }
      return json({ guilds: views });
    }

    default:
      return fail('not-found', 404);
  }

  async function cheersOf(who, at) {
    const v = await get(`ch:${who}`);
    return Array.isArray(v) ? v.filter((c) => c && typeof c.from === 'string' && typeof c.at === 'number' && at - c.at < CHEER_KEEP) : [];
  }

  async function memberGuild(store, gid, who) {
    if (!ID.test(gid || '')) return null;
    const g = await store.get(`g:${gid}`, 'json');
    return g && g.members.includes(who) ? g : null;
  }
}

/** Take a person out of a guild; an emptied guild is deleted and a leaving owner hands the guild to the next member. */
async function leaveGuild(kv, gid, who) {
  const g = await kv.get(`g:${gid}`, 'json');
  const mine = (await kv.get(`ug:${who}`, 'json')) ?? [];
  if (Array.isArray(mine) && mine.includes(gid)) await kv.put(`ug:${who}`, JSON.stringify(mine.filter((x) => x !== gid)));
  if (!g) return;
  const members = g.members.filter((m) => m !== who);
  if (!members.length) {
    const gu = await kv.get(`gu:${gid}`, 'json');
    if (gu) await kv.delete(`gi:${gu.code}`);
    await Promise.all([kv.delete(`g:${gid}`), kv.delete(`gu:${gid}`)]);
    return;
  }
  await kv.put(`g:${gid}`, JSON.stringify({ ...g, members, owner: g.owner === who ? members[0] : g.owner }));
}
