import { handleVerse } from '../_lib/verse.js';

// Cloudflare Pages Function: /api/verse — NIV (and other licensed text) via API.Bible.
// Needs the secret API_BIBLE_KEY (see README). Without it the app falls back to other sources.
export function onRequest({ request, env }) {
  return handleVerse(request, env);
}
