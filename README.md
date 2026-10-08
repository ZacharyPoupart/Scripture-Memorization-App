# Memorize For Life

A calm, offline-first app for memorizing Bible verses and **keeping them memorized for life**. New verses are practiced three times a day; as they become solid they graduate through Weekly, Monthly and Yearly piles — reviewed less and less, never forgotten.

- Installs to your iPhone home screen and runs full screen; works completely offline once installed.
- Add a verse or range (book, chapter, verses), pick a translation, text is looked up automatically when online — or type/paste it any time.
- Four review modes (flashcard, fill in the blank, type first letters, speak it) + recalling *where* the verse is.
- Streaks, a gentle 3-day freeze, a Progress tab (streak history, calendar heatmap, what's nearly ready to move up), level-up and streak celebrations that scale with the achievement, light/dark mode (follows your phone).
- Search, sort and filter your verses; rename topics; daily reminders through your Calendar app.
- Export/import backups; optional private sync between your phone and computer with a link code (no email/password).

**Trying a new version on your iPhone?** Use [docs/IOS-CHECKLIST.md](docs/IOS-CHECKLIST.md). Changes and reasoning are logged in [DECISIONS.md](DECISIONS.md).

**Setting it up for the first time?** Follow [docs/SETUP.md](docs/SETUP.md) (GitHub → Cloudflare → install on your phone).

## How the piles work
| Pile | Review | Moves up after |
|---|---|---|
| Daily | 3 times a day, ≥ 2 h apart (adjustable) | 90 days |
| Weekly | once a week | 90 days |
| Monthly | once a month | 365 days |
| Yearly | once a year | stays for life |

- **Freeze:** if you go 3 days without reviewing, verses stop gaining days toward the next pile until you review again. Progress is paused, never lost; a verse that already earned its promotion still moves up.
- **Streak:** +1 for each day you finish all your due reviews; resets if you miss a day. Verses added today don't count against you; days with nothing due neither add nor break it.
- Extra practice is always allowed and never counts toward the schedule. In each pile, the verses you've held longest are at the top.

The exact rules (and the edge cases we chose) are in [CLAUDE.md](CLAUDE.md).

## Run it locally
Requires Node 20+.
```bash
npm install
npm run dev          # http://localhost:5173 — and a "Network" URL for your phone
```
### Try it on your phone over your home network
1. Phone and computer on the same Wi-Fi. Run `npm run dev` and open the **Network** URL it prints (e.g. `http://192.168.1.20:5173`) in Safari on the phone.
2. Plain `http://` pages can't register the service worker or use sync encryption, so this tests layout, touch and keyboard behaviour — **not** offline mode or install. For those, use the Cloudflare preview link (https) described in [docs/SETUP.md](docs/SETUP.md).
3. `npm run preview:lan` serves the production build the same way.

## Tests
```bash
npm test             # unit tests: pile timing, daily spacing, graduation, freeze, streak, midnight rollover, merge, import/export, sync, lookup
npm run typecheck
npm run test:e2e     # real-browser tests: desktop + phone-sized screen, all review modes, pile session, offline, backup/restore, sync
npm run test:all     # everything CI runs
```
First time with e2e on your own machine: `npx playwright install chromium`. (In the Claude Code cloud container: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.) Set `E2E_SKIP_BUILD=1` to reuse an existing `dist/`.

CI (`.github/workflows/ci.yml`) runs all of this on every push and pull request. Make the **test** check required on `main` so a failing test blocks merging.

## Deploy
Hosting is **Cloudflare Pages** connected to the GitHub repo:
- Production branch `main` → every merge deploys the live app.
- Every other branch and pull request gets its own preview URL.
- Build command `npm run build`, output directory `dist`, environment variable `NODE_VERSION=20`.

Step-by-step with screenshots-in-words: [docs/SETUP.md](docs/SETUP.md).

### Turn on sync (optional)
Sync stores one encrypted blob per link code in Cloudflare KV. In Cloudflare: *Workers & Pages → KV → Create namespace* (e.g. `memorize-sync`), then in your Pages project *Settings → Bindings → Add → KV namespace*, variable name **`SYNC`**, for Production (and Preview, ideally a separate namespace). Redeploy. The app works fully without it; if the binding is missing the Settings screen says so.

Privacy: data is encrypted on your device (AES-GCM, key derived from your 20-character code) before upload; the server only stores ciphertext under an id derived from the code. Anyone with the code can read the data, so keep it private. Free-tier KV allows 1,000 writes/day; the app only writes when something changed and batches changes.

### NIV text via API.Bible (optional)
NIV isn't free to look up, so it goes through API.Bible with *your* key, held server-side:
1. Get a key at https://scripture.api.bible and make sure your account has access to the NIV (their terms apply, including any copyright/usage-reporting requirements).
2. Cloudflare → your Pages project → *Settings → Variables and Secrets → Add* → name `API_BIBLE_KEY`, type **Secret**, for Production (and Preview if you want it there) → redeploy.
3. Add a verse with translation NIV; the text should appear. If the key is missing or the NIV isn't in your account, the app quietly tries its backup source, and you can always paste the text.
Anyone who finds `/api/verse` can use your quota, so requests are strictly validated and limited to 40 verses; keep an eye on usage in your API.Bible dashboard.

## Versions and releases
- Version `MAJOR.MINOR.PATCH` lives in `package.json`, is shown in **Settings → About**, and `CHANGELOG.md` keeps a short history.
- To release: on your branch add notes under `## [Unreleased]`, run `npm run release -- patch` (or `minor`/`major`), open a PR. When it merges to `main`, Cloudflare deploys it and a GitHub Action tags `vX.Y.Z` and publishes a GitHub release.

### Rolling back
**Stable tags:** `v1.5.1-stable` is the last version before the Today-screen / flashcard pass (`v1.6.0-today`, `v1.7.0-flashcards`); `v1.1.0-stable` is the last version before the earlier 2026-10 improvement pass. Older stage tags: `v1.2.0-ui`, `v1.3.0-motivation`, `v1.4.0-features`, `v1.4.0-final`. Tags are added by the *Create stage tag* workflow (Actions tab → Run workflow).

Roll back first, then fix.
1. **Fastest (30 seconds):** Cloudflare dashboard → your Pages project → *Deployments* → find the last good deployment → **⋯ → Rollback to this deployment**. The live site is the old version immediately. Your data lives on your devices and isn't touched.
2. **In Git (so `main` matches what's live):**
   ```bash
   git fetch --tags
   git checkout -b fix/rollback-to-v1.0.0 main
   git revert --no-commit v1.0.0..main     # undo everything after the good tag
   git commit -m "Roll back to v1.0.0"
   git push -u origin fix/rollback-to-v1.0.0   # open a PR, merge; Cloudflare redeploys
   ```
   (Or re-deploy the tag itself: Cloudflare *Deployments → Create deployment*, or `git checkout v1.0.0 && npx wrangler pages deploy dist` after `npm ci && npm run build`.)
3. After rolling back, open a branch for the fix as usual.

Phones pick up the new (or rolled-back) version the next time the app is opened: an **Update** banner appears; tap it.

## Project structure
```
src/core       pure rules (schedule, merge, backup, quiz, speech, dates, books)
src/services   storage, verse lookup, sync client + crypto
src/ui         screens; src/ui/modes review modes
src/store.ts   app state
functions/     Cloudflare Pages Function for sync
tests/unit     Vitest        tests/e2e   Playwright
scripts/       icons, versification generator, release, e2e server
```
Icons: `npm run gen:icons` re-renders PNGs from `public/icon.svg`.

## Notes
- Verse text comes from public APIs (bible-api.com, bolls.life); translations such as NIV/ESV are © their publishers — for personal study. If lookup is unavailable, just type or paste the text.
- No analytics, no accounts, no tracking.
