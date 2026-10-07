# DECISIONS.md — autonomous improvement pass

Living log for the overnight/long-running improvement pass (started 2026-10-07). If the session is cut off, **read "Resume here" first**.

## Resume here
- **Current stage:** Phase 0, Workstream 1 (v1.2.0) and Workstream 2 (v1.3.0) are merged and tagged. Workstream 3 (product features, v1.4.0) is in review on `feature/product-polish`; then final docs.
- **Plan:** merge PR #2 (save-race fix, v1.1.1) → Workstream 1 (visual design, v1.2.0) → Workstream 2 (motivation & stats, v1.3.0) → Workstream 3 (product features, v1.4.0) → final docs/checklist.
- **Rule:** every stage = branch → PR → CI green → merge → stage tag. Never merge red/skipped. Last green state is always `main`.
- **Rollback to before this whole pass:** `git checkout v1.1.0-stable` (see "Rollback" below).

## How to try the new version on your phone (≈10 minutes)
1. **Back up first:** open the app → Settings → *Export backup* (or make sure sync is on).
2. Open your live site in Safari (the new version is deployed automatically after each merge). If you use the home-screen app: open it while online; an **Update** bar appears at the top — tap it. *About* shows the version (should be **1.4.0**).
3. Walk through [`docs/IOS-CHECKLIST.md`](docs/IOS-CHECKLIST.md): install/offline start, keyboard in Type mode and the reference step, no sticky highlights, nothing blocking taps after messages/dialogs, Light/Dark, and the optional features (sound, calendar reminders, Speak, sync).
4. Things worth a look with your eyes: the calmer colours and larger verse text; the **Stats** tab (heatmap, “Nearly there”); finishing a review (result card, “All done for today”); Settings → *Feedback & celebrations* and *Daily reminders*; Search on **Piles**.
5. If anything feels wrong, tell me which screen and what you did. To go back, see **Rollback**.

## Tags (rollback points)
| Tag | Meaning |
|---|---|
| `v1.0.0` | first release |
| `v1.1.0` | NIV lookup via API.Bible |
| `v1.1.0-stable` | **last known-good before this pass** (same commit as `v1.1.0`, `d588f84`) |
| `vX.Y.Z` | auto-tagged by `release.yml` when a version bump merges to `main` |
| `v1.2.0-ui` | after Workstream 1 (visual design) |
| `v1.3.0-motivation` | after Workstream 2 (feedback, stats) |
| `v1.4.0-features` | after Workstream 3 (search, reminders, safety nets) |
| `v1.4.0-final` | the finished version of this pass |

## Phase 0 results
1. **Stable tag:** `v1.1.0` already existed on `main`. The sandbox git connection **refuses to push new tags** (every attempt: "remote end hung up unexpectedly"), so I added `.github/workflows/tag.yml` — a manual, **add-only** workflow (refuses to move/overwrite a tag, only tags commits already on `main`) — and use it to create `v1.1.0-stable` and later stage tags. Named `v1.1.0-stable` rather than `v1.0.0-stable` because `main` is at 1.1.0.
2. **Baseline tests (before any change):** CI on PR #1 was green (`test` check, twice — first run had two timing flakes, see below); locally on the same code: 90 unit tests and 74 e2e tests (desktop + phone viewport) passed. Nothing was already broken except:
   - two e2e tests were timing-sensitive on slow runners (reload straight after a save). Root cause = non-atomic save; fixed in PR #2 (v1.1.1), tests made to wait for saves via a `flush` hook. No test was weakened.
3. **Secrets:** scanned the working tree and all 12 commits in history for key/token/private-key patterns and for any `.env`/key files: **none found**. (The API.Bible key you pasted in chat was never written to the repo; you rotated it.) `.env.example` contains only commented placeholders.
4. **CI:** `.github/workflows/ci.yml` runs on every `push` and `pull_request`: typecheck → unit tests → build → Playwright (desktop + phone viewport, offline, sync, backup). Full suite, no skips.

## Data-safety guard added in Phase 0
- `tests/fixtures/backup-v1.1.0.json` (a real export from v1.1.0 incl. a deleted verse, a level-up record, 37-day longest streak, per-device counters) and `settings-v1.1.0.json` (device settings) + `tests/unit/migration.test.ts`. They prove: old data loads unchanged, loading/normalizing twice is a no-op, export→import round-trips exactly, merging with itself is a no-op, old settings keep their values and new settings default in. **If any later change alters the stored shape, these must stay green (with a migration).**
- Policy for this pass: **no changes to the stored data document's shape.** New device-only preferences are added to the local *settings* object with defaults, which already merges safely over older saved settings.

## Test changes (for your review)
- **PR #2 (save fix):** `tests/e2e/verses.spec.ts` (walkthrough "remembered" check) and `tests/e2e/time-rules.spec.ts` (`oneReview`) now call a `saved(page)` helper (waits for the app's save queue via `window.__mfl.flush()`) before reloading. Reason: those tests reloaded within milliseconds of a save, which is what exposed the real non-atomic-save bug; the bug is fixed and the tests now model a human pause. Assertions unchanged.
- **Existing tests otherwise untouched.** WS1 added new files only: `unit/contrast.test.ts`, `e2e/comfort.spec.ts`, `e2e/offline-smoke.spec.ts`.

## Decisions

### Workstream 1 — visual design and comfort (v1.2.0)
- **Palette (research-informed, not exotic):** warm off-white paper `#f6f3ec` + soft charcoal `#272d2c` in light; deep blue-grey `#161b1c` + soft off-white `#e3e8e6` in dark. Rationale: avoiding pure black-on-pure-white reduces glare/halation for long reading, and dark surfaces that aren't pure black avoid the harsh "smear" on OLED. Accent is a muted teal; status colours are desaturated. All text/background pairs are enforced ≥ 4.5:1 (WCAG AA) by `tests/unit/contrast.test.ts` in **both** themes, and the test also fails if the "follow the system" dark block drifts from the forced-dark block.
- **Theme:** follows the system by default (unchanged); Settings can force light/dark. `theme-color`/manifest colours updated to match the new paper/charcoal.
- **Scripture as the hero:** serif at `clamp(1.22rem, 1.08rem + 0.6vw, 1.5rem)` (~19–24 px), line-height 1.75, measure capped at 34em (~65–70 characters/line), `text-wrap: pretty`. Checked by an e2e test (size, leading, line length).
- **Thumb zone:** the primary action on Home ("Review N ready") and on each pile ("Start · N verses") moved from mid-page cards into a fixed bottom **action bar** above the tab bar (≥ 54 px tall). e2e asserts it sits in the lower third of a phone screen.
- **Toasts moved to the top** so they can never cover the bottom action bar, and made `pointer-events: none` (only their Undo button is tappable) so a toast can never be an invisible blocker.
- **Tap quality (iOS):** `touch-action: manipulation` (no double-tap zoom/300 ms delay), `-webkit-touch-callout: none`, `user-select: none` on controls, hover styles only under `@media (hover: hover) and (pointer: fine)` so taps never leave a sticky highlight. Safe-area insets now apply left/right as well as top/bottom.
- **Motion:** unchanged short animations (≤ 0.25 s); `prefers-reduced-motion` already collapses all animation/transition durations (e2e verifies). Removed the tab-bar `backdrop-filter` blur (cost on older iPhones, no benefit).
- **No layout shift:** e2e measures CLS on Home (< 0.05).
- **Not changed:** any scheduling/stored-data logic. No data shape change.

### Workstream 2 — motivation and feedback (v1.3.0)
Each feature and the idea it rests on. These are established, widely used behavioural ideas; effect sizes vary between people and apps, so I treat them as reasonable defaults, not guarantees.

| Feature | Principle it is based on | Guardrail |
|---|---|---|
| Correct answers settle in with a small animation (and an optional quiet tone/vibration) | **Immediate feedback**: feedback close in time to the action helps people connect effort and result | Sound and vibration are **off by default**, individually switchable; reduced-motion respected |
| Result card after each review: check mark, progress bar "N of 90 days toward Weekly", "X of Y due reviews done today" | **Visible progress / goal-gradient**: people tend to stay motivated as a goal looks closer | Shows only real numbers from the schedule; nothing invented |
| Session progress bar (existing), "Nearly there" list on Stats (verses closest to their next pile) | Goal-gradient again | Purely derived from existing data |
| Calm "All done for today" moment (check mark + streak) and a ring that turns green | **Closure / completion feedback**: a clear end to the day's task is satisfying and lets people stop | No confetti for the ordinary daily finish |
| Celebrations scaled to the achievement: small = quiet card (3 and 7-day streak), medium = card + little confetti (14–99 days, a verse moving up), large = full confetti (100+ days, a verse reaching Yearly) | **Proportional recognition**; over-rewarding trivial things can dull motivation | Settings → Celebrations: **Full** or **Calm** (no confetti ever). Each streak milestone is celebrated once |
| Stats screen: streaks and best runs, calendar heatmap, verses per pile, totals | **Self-monitoring**: seeing your own record is one of the better-supported habit aids | Missed days look **exactly like rest days** (no red, no blame); shows what you did, never what you didn't |
| Wording: freeze = "short pause, nothing is lost"; no "at risk"/"last chance" text | Avoid **loss-aversion pressure** and guilt, which can backfire and drive people away | e2e test scans screens during a freeze for guilt/urgency phrases |

Other notes:
- **No data shape change.** New preferences (`soundOn`, `hapticsOn`, `celebrations`, `seenMilestones`) live in the device-local *settings*, which load by layering saved values over defaults — verified against the v1.1.0 settings fixture. Streak/heatmap are derived from the existing ledger.
- **Haptics:** iPhone web apps (Safari/home-screen) cannot vibrate; the switch is disabled there with an explanation (many Android phones can).
- **Streak milestones** are detected when today becomes complete and keyed `streak:<n>:<day>` in `seenMilestones` so reloads don't repeat them.
- **Accessibility bug found by the new tests and fixed:** button groups on Settings were inside a `<label>`, so "Easy" / "Flashcard" were announced with the whole section label as their name. Now a labelled `role="group"`.
- **Test changes:** none to existing tests. New: `unit/stats.test.ts`, `unit/feedback.test.ts`, `e2e/motivation.spec.ts` (+ a11y test in `comfort.spec.ts`, stats route in `offline-smoke.spec.ts`).


### Workstream 3 — product features (v1.4.0)
Chosen because they are valuable and low-risk; no scheduling/data-shape changes (new fields are device-local settings).
- **Search, sort, filter** (All verses and each pile): words in text/topic/translation/reference, or a reference like `jn 3:16` / `ps 23:2` (matches ranges). Sort: *Longest in pile first* (default = the documented rule), Bible order, Newest added, Due soonest. "Ready now" filter. Remembered while the app is open. **Starting a pile review ignores the search** (counts and queue always use the whole pile) — covered by an e2e test.
- **Topic management:** rename/merge/remove a topic across all verses, with Undo; it uses the normal edit timestamp so it syncs like any other edit.
- **Reminders — honest limits:** an installed iPhone web app can only get push notifications from a server (a push service + keys), which would break "static files, no accounts". Local scheduled notifications aren't available to web apps. So Settings → Daily reminders builds a **calendar file (.ics)**: up to three repeating daily events with an alert; the iPhone Calendar delivers the alerts, offline. Stable event ids mean re-importing updates instead of duplicating. **Needs a real-iPhone check**: downloading a `.ics` from a home-screen web app can be flaky on iOS; the card says "if nothing happens, open this page in Safari".
- **Friendlier failures:** a calm full-screen message if any screen ever fails to draw (data untouched; reload / export backup / go home). A test-only hook (`window.__mfl.crash`) makes this testable. "Erase all data" now has an **Undo** toast (it previously had only a typed confirmation).
- **Backup nudge** on Home: only when ≥ 3 verses, sync is off and no export in 30 days; "Not now" silences it for 14 days. Replaces the older one-time tip.
- **Accessibility:** dialogs now move focus in, trap Tab, close on Escape and return focus to what opened them; each screen sets a page title; e2e checks every visible control has an accessible name. (The Field/label bug is in WS2's notes.)
- **Walkthrough** text mentions the Stats tab and the kinder freeze wording.
- **Performance:** no change needed — the production bundle is ~110 KB (≈ 38 KB gzip), everything is local, and per-minute work is a cheap settle. Not measured on a real device.
- **Tests:** new `unit/organize.test.ts`, `unit/reminders.test.ts`, `unit/nudges.test.ts`, `e2e/polish.spec.ts`; `offline-smoke` now also searches offline.
- **Two existing e2e tests were edited (locators only, same assertions) because the UI intentionally changed — please review:** (1) `verses.spec.ts` topic-filter test: the "All" topic chip is now labelled "All topics". (2) `offline-backup-sync.spec.ts` restore test: `getByText('#Gospel')` now also matches the new topic filter chip on the pile page, so it is scoped to the verse card (`getByTestId('verse-card').getByText('#Gospel')`) — still proves the restored verse kept its topic.

### Final stage — docs and a service-worker safety test
- **New e2e test `update-flow.spec.ts`** (answers "service worker problems that break offline loading"): it builds two real versions (9.0.1 and 9.0.2) into a scratch folder, installs the first, adds a verse, "deploys" the second, and checks: the **Update** bar appears → tapping it loads the new version (About shows it) → the verse is still there → the app **still starts with the network off** afterwards. To support it, `vite.config.ts` accepts an `APP_VERSION_OVERRIDE` env var and `scripts/e2e-server.mjs` accepts `DIST_DIR`/`PORT` (test-only; normal builds are unaffected).
- Docs: `docs/IOS-CHECKLIST.md`, README, CLAUDE.md (new modules, delegated-merge agreement, tag workflow, data-safety and design guard rails), `docs/SETUP.md` (create a *Pages* project, not a Worker; leave Root directory blank).

## Open questions for you
1. **iPhone checks I can't do:** keyboard behaviour in Type mode and the reference step, the `.ics` reminder download from the home-screen app, Speak mode, home-screen install/offline start, and the Update bar. All are on the checklist. Please tell me what you see.
2. **Reminders:** is the calendar-file approach acceptable? True push notifications would need a small server (push keys + a scheduler), i.e. a new moving part and probably an account. I left that out on purpose.
3. **API.Bible/NIV terms:** still not read by me (no access). Copyright text and usage reporting may be required; `functions/api/verse.js` returns the copyright text but the app doesn't store/show it yet.
4. **Celebration defaults:** Full (confetti on big moments) is the default; sound and vibration default to off. Say if you'd prefer Calm by default.
5. **Cloudflare:** the old Worker project's failed “Workers Builds” check is gone; confirm the Pages project's preview/production deploys look right from your side (I can only see the check result).
6. **Branch protection:** `test` isn't marked *required* on `main` as far as I can tell; I only merged on green. Consider turning it on (README/SETUP explain).

## Needs a closer look
- _(nothing stuck.)_ Two timing flakes appeared in CI during the pass (the walkthrough "remembered" test and the streak test on a slow runner); both traced to the real non-atomic-save bug, fixed in v1.1.1 and not seen since. If a flake returns, it is worth a look rather than a retry.

## Rollback
```bash
git fetch --tags
git checkout v1.1.0-stable        # inspect the old version
# to put it live: Cloudflare dashboard -> Deployments -> the deployment for v1.1.0 -> "Rollback to this deployment"
# or revert in git: git checkout -b fix/rollback main && git revert --no-commit v1.1.0-stable..main && git commit -m "Roll back to v1.1.0-stable" && git push -u origin fix/rollback   # then PR + merge
```
Your verses live on the phone, so a rollback never touches them.
