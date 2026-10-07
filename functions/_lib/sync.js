// Tiny "dumb" sync store. The server only keeps one opaque, client-side-encrypted blob per
// sync id, with a revision number for optimistic concurrency. It can't read your verses.
// Shared by the Cloudflare Pages Function and the local e2e test server.

const ID = /^[a-f0-9]{32}$/;
const MAX_BLOB = 8 * 1024 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

/**
 * @param {Request} request
 * @param {{ get(key: string, type?: string): Promise<any>, put(key: string, value: string): Promise<void> } | undefined} kv
 * @param {string} id
 */
export async function handleSync(request, kv, id) {
  if (!kv) return json({ error: 'sync-not-configured' }, 501);
  if (!ID.test(id || '')) return json({ error: 'bad-id' }, 400);
  const key = `sync:${id}`;

  if (request.method === 'GET') {
    const cur = await kv.get(key, 'json');
    if (!cur) return json({ error: 'not-found' }, 404);
    return json({ rev: cur.rev, blob: cur.blob, updatedAt: cur.updatedAt });
  }

  if (request.method === 'PUT') {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad-json' }, 400);
    }
    if (!body || typeof body.blob !== 'string' || !Number.isInteger(body.baseRev) || body.baseRev < 0)
      return json({ error: 'bad-body' }, 400);
    if (body.blob.length > MAX_BLOB) return json({ error: 'too-large' }, 413);
    const cur = await kv.get(key, 'json');
    const curRev = cur ? cur.rev : 0;
    if (curRev !== body.baseRev) return json({ error: 'conflict', rev: curRev, blob: cur?.blob }, 409);
    const next = { rev: curRev + 1, blob: body.blob, updatedAt: Date.now() };
    await kv.put(key, JSON.stringify(next));
    return json({ rev: next.rev });
  }

  return json({ error: 'method-not-allowed' }, 405);
}
