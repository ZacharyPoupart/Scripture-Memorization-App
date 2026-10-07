import { handleSync } from '../../_lib/sync.js';

// Cloudflare Pages Function: /api/sync/:id  (needs a KV namespace bound as SYNC; see README)
export function onRequest({ request, env, params }) {
  return handleSync(request, env.SYNC, params.id);
}
