import { handleSocial } from '../../_lib/social.js';

// Cloudflare Pages Function: /api/social/:action  (uses the same KV namespace as sync, bound as SYNC; see README)
export function onRequest({ request, env, params }) {
  return handleSocial(request, env.SYNC, params.action);
}
