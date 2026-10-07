# Memorize For Life — project context for Claude Code

Read this first. It holds the goals, the rules that have caused the most bugs, how to run/test things, and our working agreements.

## Goal
Make Scripture memory a consistent daily habit and make verses stick for life. A verse is practiced heavily when new, then reviewed less and less as it becomes solid, never forgotten. Used mainly on an iPhone (installed to the home screen, full screen) and also on a computer. Clean, calm, focused, fast; no jumpy screens, no stuck buttons. Must work completely offline once installed; only verse lookup and sync need a connection. User data must never be lost. Simple for the owner to host and update.

## Stack
Preact + TypeScript + Vite, installable PWA (vite-plugin-pwa / Workbox). Data in IndexedDB (localStorage fallback). Optional sync: a Cloudflare Pages Function + KV storing one end-to-end-encrypted blob per link code. Hosting: Cloudflare Pages (Git integration). Tests: Vitest (unit) + Playwright (e2e, Chromium).

## Layout
- `src/core/` — **pure logic, no DOM**. `schedule.ts` is the heart (piles, due dates, spacing, graduation, freeze, streak). Also `dates.ts`, `merge.ts` (sync merge), `backup.ts` (export/import validation), `quiz.ts`, `speech.ts`, `text.ts`, `books.ts`, `reference.ts`, `versification.ts` (generated).
- `src/services/` — `storage.ts` (IndexedDB + snapshots), `lookup.ts` (verse text APIs), `sync.ts` + `syncCrypto.ts`.
- `src/store.ts` — app state; all mutations go through `act()` (clone → settle days → mutate → save → schedule sync).
- `src/ui/` — screens; `src/ui/modes/` — the review modes and reference recall.
- `functions/` — Cloudflare Pages Function for sync (`functions/_lib/sync.js` is shared with the e2e server).
- `tests/unit/` (Vitest, TZ pinned to America/New_York) and `tests/e2e/` (Playwright).

## Commands
- `npm install` · `npm run dev` (dev server on your network, open the printed Network URL on a phone)
- `npm test` unit tests · `npm run typecheck` · `npm run build`
- `npm run test:e2e` e2e (builds first; set `E2E_SKIP_BUILD=1` to reuse `dist/`). In this cloud container use `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Locally run `npx playwright install chromium` once.
- `npm run test:all` everything CI runs.
- `npm run release -- patch|minor|major` bump version + roll CHANGELOG (see Releases).

## THE RULES (single source of truth: `src/core/schedule.ts`; these bugs bit us before)
- **Days** are local calendar days (`YYYY-MM-DD`) and roll over at local midnight. Day math uses UTC day numbers so DST never causes off-by-one. Never compare timestamps to decide "same day"; use `dayKeyOf`.
- **Daily pile**: 3 *counted* reviews per day, at least `spacingHours` (default 2, setting 1–4) apart. Spacing resets at midnight (the first review of a new day is always available).
- **Weekly / Monthly / Yearly**: one counted review once due. Due = 7 days / 1 calendar month / 1 calendar year after the later of the last counted review and the day the verse entered the pile (month/year math clamps, e.g. Jan 31 + 1 month = Feb 28).
- **Extra practice** is always allowed and never counted or stored; it only marks the day as "reviewed" (keeps the freeze away).
- **Graduation**: Daily→Weekly after 90 progress days, Weekly→Monthly after 90, Monthly→Yearly after 365. Yearly is permanent. A progress day is a day after entering the pile that isn't frozen. Graduation is derived from the ledger and can cascade through several piles in one settle. The level-up id is deterministic (`verseId:to:day`) so devices agree.
- **Manual moves** (with undo) set `pileSince = today` (progress restarts).
- **Ordering**: within a pile, longest in the pile (`pileSince` ascending) first.
- **Freeze**: a *lapse day* is a finished day where something was due but **nothing at all** was reviewed. A day is frozen (adds no progress) when the 3 days before it were all lapse days and nothing has been reviewed yet that day. Frozen days only pause progress; nothing is lost, and a verse that already earned its promotion still moves up. Days with nothing due are never lapse days (a user with only Yearly verses is never frozen).
- **Streak**: +1 for each day on which all due reviews were completed. A day with an unmet obligation breaks it; days with nothing due are neutral (neither add nor break). Verses added or moved *today* are exempt today ("brand-new verses don't count against me"). Longest streak is tracked and merged with max.
- **Ledger** (`data.ledger[day] = {r, o}`): written by `settle()` for every finished day, and latched to `o:'c'` the moment today's obligations are all met. Merge precedence per day: reviewed = OR, outcome c > m > n.
- **Mistakes**: Daily verses allow 3 mistakes; Weekly/Monthly/Yearly allow none. Exceeding restarts the verse in the same mode. Every mode ends with **reference recall** (book/chapter/verse, nothing on screen hints at the answer; wrong answers count as mistakes). Fill-in-the-blank difficulty is adjustable for Daily; other piles always use `hard`.
- **Sync merge** must stay commutative, associative and idempotent (`core/merge.ts`, tested). Verse content and pile are separate last-writer-wins groups; reviews are unioned; deletes win.

## Data safety
Every save keeps `data.prev`; one snapshot per day (7 kept). Imports validate everything (`normalizeData`) and **merge by default** (replace is explicit and undoable). Never change the on-disk shape without bumping `schema` and writing a migration + tests.

## Working agreements (the owner's rules — follow them)
1. Every change happens on its own branch with a clear name (e.g. `feature/…`, `fix/…`).
2. Change only what was asked. If something else looks wrong, **tell the owner instead of fixing it silently**.
3. Run the tests before committing. Add or update tests for anything you change (rules changes need unit tests first).
4. Small, focused commits with clear messages.
5. Open a pull request summarising what changed, how it was tested, and the version bump (use the PR template). The owner reviews the preview link on their phone, then we merge.
6. If a release causes problems, **roll back first, then fix**.

## Releases and rollback
Semantic versioning in `package.json` (shown in the app via `__APP_VERSION__`). Each PR that ships changes bumps the version and moves notes from `## [Unreleased]` in `CHANGELOG.md` (`npm run release -- patch|minor|major`). Merging to `main` deploys via Cloudflare Pages and `.github/workflows/release.yml` tags `vX.Y.Z` + creates a GitHub release. Rollback: see README ("Rolling back").

## Secrets
None are needed to build, test or run. Never commit keys; use environment variables / gitignored `.env` (see `.env.example`). The only runtime secret is the optional `API_BIBLE_KEY` (Cloudflare secret) used by `functions/api/verse.js` for NIV lookup; the client never sees it. If a key is ever pasted into chat or committed, tell the owner to rotate it.

## Known limitations / things to verify on a real iPhone
- Verse lookup uses free public APIs (bible-api.com for KJV/WEB, bolls.life for the rest); NIV goes through our `/api/verse` function (API.Bible, needs the owner's key and NIV access, with bolls.life as backup). API.Bible's terms may require copyright display and usage (FUMS) reporting — copyright text is returned by the function but not yet stored or shown, and FUMS reporting is not implemented; the owner should read their terms. They were coded to the documented response shapes but **not exercised against the live services from the build sandbox**; typing the text always works. Copyright of NIV/ESV/etc. text belongs to the publishers — fine for personal study, check terms before making the app public.
- "Speak it" uses the Web Speech API: experimental, behaviour on iOS home-screen apps varies.
- On iOS the on-screen keyboard may need a tap on the text to re-open between verses in "Type it out" mode.
- Playwright runs Chromium only (no WebKit): iOS Safari quirks need a real-device check on every preview.
