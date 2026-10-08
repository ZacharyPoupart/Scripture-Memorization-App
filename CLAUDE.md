# Memorize For Life — project context for Claude Code

Read this first. It holds the goals, the rules that have caused the most bugs, how to run/test things, and our working agreements.

## Goal
Make Scripture memory a consistent daily habit and make verses stick for life. A verse is practiced heavily when new, then reviewed less and less as it becomes solid, never forgotten. Used mainly on an iPhone (installed to the home screen, full screen) and also on a computer. Clean, calm, focused, fast; no jumpy screens, no stuck buttons. Must work completely offline once installed; only verse lookup and sync need a connection. User data must never be lost. Simple for the owner to host and update.

## Stack
Preact + TypeScript + Vite, installable PWA (vite-plugin-pwa / Workbox). Data in IndexedDB (localStorage fallback). Optional sync: a Cloudflare Pages Function + KV storing one end-to-end-encrypted blob per link code. Hosting: Cloudflare Pages (Git integration). Tests: Vitest (unit) + Playwright (e2e, Chromium).

## Layout
- `src/core/` — **pure logic, no DOM**. `schedule.ts` is the heart (piles, due dates, spacing, graduation, freeze, streak). Also `dates.ts`, `merge.ts` (sync merge), `backup.ts` (export/import validation), `quiz.ts`, `speech.ts`, `text.ts`, `books.ts`, `reference.ts`, `versification.ts` (generated), and read-only helpers that never affect scheduling: `stats.ts` (streak history, heatmap, totals), `milestones.ts`, `organize.ts` (search/sort/filter/topic rename), `reminders.ts` (.ics builder), `nudges.ts`.
- `src/services/` — `storage.ts` (IndexedDB, atomic saves + snapshots), `lookup.ts` (verse text APIs), `sync.ts` + `syncCrypto.ts`, `feedback.ts` (optional quiet sound/vibration; off by default).
- `src/store.ts` — app state; all mutations go through `act()` (clone → settle days → mutate → save → schedule sync).
- `src/ui/` — screens; `src/ui/modes/` — the review modes and reference recall.
- `functions/` — Cloudflare Pages Function for sync (`functions/_lib/sync.js` is shared with the e2e server).
- `tests/unit/` (Vitest, TZ pinned to America/New_York), `tests/e2e/` (Playwright; `helpers.ts` has `saved(page)`, `replaceDataWith`, `localDay`) and `tests/fixtures/` (real v1.1.0 export + settings used by `migration.test.ts`).
- `DECISIONS.md` (what changed and why, test changes, open questions) and `docs/IOS-CHECKLIST.md` (manual iPhone checks).

## Commands
- `npm install` · `npm run dev` (dev server on your network, open the printed Network URL on a phone)
- `npm test` unit tests · `npm run typecheck` · `npm run build`
- `npm run test:e2e` e2e (builds first; set `E2E_SKIP_BUILD=1` to reuse `dist/`). In this cloud container use `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Locally run `npx playwright install chromium` once.
- `npm run test:all` everything CI runs.
- `npm run release -- patch|minor|major` bump version + roll CHANGELOG (see Releases).

## THE RULES (single source of truth: `src/core/schedule.ts`; these bugs bit us before)
- **Days** are local calendar days (`YYYY-MM-DD`) and roll over at local midnight. Day math uses UTC day numbers so DST never causes off-by-one. Never compare timestamps to decide "same day"; use `dayKeyOf`.
- **Daily pile**: 3 *counted* reviews per day, at least `spacingHours` (default 2; Settings offers No wait, 30 min, 1–4 h or a custom number of minutes, stored as hours 0–12) apart. Spacing resets at midnight (the first review of a new day is always available).
- **Weekly / Monthly / Yearly**: one counted review once due. Due = 7 days / 1 calendar month / 1 calendar year after the later of the last counted review and the day the verse entered the pile (month/year math clamps, e.g. Jan 31 + 1 month = Feb 28).
- **Extra practice** is always allowed and never counted or stored; it only marks the day as "reviewed" (keeps the freeze away).
- **Graduation**: Daily→Weekly after 90 progress days, Weekly→Monthly after 90, Monthly→Yearly after 365. Yearly is permanent. A progress day is a day after entering the pile that isn't frozen. Graduation is derived from the ledger and can cascade through several piles in one settle. The level-up id is deterministic (`verseId:to:day`) so devices agree.
- **Manual moves** (with undo) set `pileSince = today` (progress restarts) unless the owner uses "Start partway" (v1.10.0): `movePile(…, daysIn)` / `addVerse({daysInPile})` back-date `pileSince` by N whole days, clamped to `maxDaysIn` (89 Daily/Weekly, 364 Monthly, 366 Yearly), so progress and due dates follow the normal rules from that earlier start. A verse added with history counts as an obligation today; a brand-new one (N=0) still doesn't.
- **Ordering**: within a pile, longest in the pile (`pileSince` ascending) first.
- **Freeze**: a *lapse day* is a finished day where something was due but **nothing at all** was reviewed. A day is frozen (adds no progress) when the 3 days before it were all lapse days and nothing has been reviewed yet that day. Frozen days only pause progress; nothing is lost, and a verse that already earned its promotion still moves up. Days with nothing due are never lapse days (a user with only Yearly verses is never frozen).
- **Streak**: +1 for each day on which every due verse got at least ONE counted review (Daily's goal is still 3 a day, but one keeps the flame; changed by the owner's request in v1.5.2). Practising on a day when nothing was due (e.g. the first day) also earns it. A due verse with no review breaks it; days with nothing due and no practice are neutral. Verses added or moved *today* are exempt today ("brand-new verses don't count against me"). Longest streak is tracked and merged with max.
- **Break (pause, v1.9.0, owner-requested)**: Settings → Take a break sets `data.pause = {from, until, at}` (synced, last-writer-wins by `at`; absent = never used). On paused days nothing is due and nothing can be missed: `settle()` writes `{o:'n', p:1}` (or `'c'` if the user reviewed everything due anyway; never `'m'`), so the streak waits, there is no lapse and no freeze; but a paused day earns **no progress day** unless the user reviewed (`dayGains`), so nothing graduates on holiday. Due dates are not moved. Reviewing anyway is always allowed and counts normally. Additive optional fields only (`pause`, ledger `p`): `schema` stays 1; `tests/fixtures/backup-v1.9.0-pause.json` covers it.
- **Ledger** (`data.ledger[day] = {r, o}`; `p` marks a paused day): written by `settle()` for every finished day, and latched to `o:'c'` the moment today's obligations are all met. Merge precedence per day: reviewed = OR, outcome c > m > n.
- **Mistakes**: Daily verses allow 3 mistakes (in Type it out a wrong letter shows the word and play continues); Weekly/Monthly/Yearly allow none. Exceeding restarts the verse in the same mode. Every mode except Flashcard (owner's request, v1.7.0: flashcards show the reference on the card and have just "Nailed it" / "Needs work") ends with **reference recall** (book/chapter/verse, nothing on screen hints at the answer; wrong answers count as mistakes). Fill-in-the-blank difficulty is adjustable for Daily; other piles always use `hard`.
- **Sync merge** must stay commutative, associative and idempotent (`core/merge.ts`, tested). Verse content and pile are separate last-writer-wins groups; reviews are unioned; deletes win.

## Data safety
Every save is ONE atomic write (new data + `data.prev` + once-a-day snapshot, 7 kept); don't add reads or extra steps in front of it. Imports validate everything (`normalizeData`) and **merge by default** (replace is explicit and undoable). Never change the on-disk shape without bumping `schema` and writing a migration + tests; `tests/unit/migration.test.ts` + `tests/fixtures/*-v1.1.0.json` must stay green forever (add a new fixture whenever the shape changes). New device-only preferences go in `Settings` with a default (older saved settings load by layering over defaults). Test hooks on `window.__mfl` (`getState`, `flush`, `crash`) exist for e2e only.

## Design guard rails
Palette/type live in `src/styles.css` tokens; `tests/unit/contrast.test.ts` enforces WCAG AA in both themes and no pure black/white (change colours there, never ad hoc). Toasts appear at the top and are non-blocking; the primary action lives in the bottom `.action-bar`; hover styles only for real pointers. No guilt/urgency wording (an e2e test scans for it); missed days look like rest days in the heatmap.

## Working agreements (the owner's rules — follow them)
1. Every change happens on its own branch with a clear name (e.g. `feature/…`, `fix/…`).
2. Change only what was asked. If something else looks wrong, **tell the owner instead of fixing it silently**.
3. Run the tests before committing. Add or update tests for anything you change (rules changes need unit tests first).
4. Small, focused commits with clear messages.
5. Open a pull request summarising what changed, how it was tested, and the version bump (use the PR template). **The owner has delegated merging to Claude's discretion:** merge only on a fully green CI (never skipped/weakened tests), one PR per stage, then add a stage tag with the Tag workflow, and tell the owner what shipped and how to undo it. The owner can still ask for a revert or a hold at any time.
6. If a release causes problems, **roll back first, then fix**.

## Releases and rollback
Tags: `release.yml` adds `vX.Y.Z` when a version bump merges; the sandbox can't push tags, so stage tags (`v1.2.0-ui`, `v1.1.0-stable`, …) are created by the add-only `tag.yml` workflow (run it with the tag, a full commit sha on `main`, and a message). Semantic versioning in `package.json` (shown in the app via `__APP_VERSION__`). Each PR that ships changes bumps the version and moves notes from `## [Unreleased]` in `CHANGELOG.md` (`npm run release -- patch|minor|major`). Merging to `main` deploys via Cloudflare Pages and `.github/workflows/release.yml` tags `vX.Y.Z` + creates a GitHub release. Rollback: see README ("Rolling back").

## Secrets
None are needed to build, test or run. Never commit keys; use environment variables / gitignored `.env` (see `.env.example`). The only runtime secret is the optional `API_BIBLE_KEY` (Cloudflare secret) used by `functions/api/verse.js` for NIV lookup; the client never sees it. If a key is ever pasted into chat or committed, tell the owner to rotate it.

## Known limitations / things to verify on a real iPhone
- Verse lookup uses free public APIs (bible-api.com for KJV/WEB, bolls.life for the rest); NIV goes through our `/api/verse` function (API.Bible, needs the owner's key and NIV access, with bolls.life as backup). API.Bible's terms may require copyright display and usage (FUMS) reporting — copyright text is returned by the function but not yet stored or shown, and FUMS reporting is not implemented; the owner should read their terms. They were coded to the documented response shapes but **not exercised against the live services from the build sandbox**; typing the text always works. Copyright of NIV/ESV/etc. text belongs to the publishers — fine for personal study, check terms before making the app public.
- "Speak it" uses the Web Speech API: experimental, behaviour on iOS home-screen apps varies.
- On iOS the on-screen keyboard may need a tap on the text to re-open between verses in "Type it out" mode.
- Playwright runs Chromium only (no WebKit): iOS Safari quirks need a real-device check on every preview.
