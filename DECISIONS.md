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

### Verse picker (v1.5.0) — requested after the pass
- **Interpretation (please confirm on your phone):** "dropdown boxes instead of a long dropdown list" → three separate boxes (Book, Chapter, Verse). Each opens a bottom sheet with a grid of large buttons; picking Book opens Chapter, picking Chapter opens Verse (one tap leads to the next). Per your follow-up: **no search box / no inputs in the popups**, and **a range is two taps in the same verse grid with the space between highlighted** (no separate "To" box). ~~The book grid has six one-tap filters~~ — **removed in 1.5.1 at your request**; the Book popup is now only the 66 books in order.
- **Verse grid behaviour:** first tap = that verse (panel stays open with a big **Done** button and "John 3:16"); a second, later verse makes the range and closes; tapping the same verse twice = just that verse; a second tap *earlier* than the first moves the start. Reopening the grid always starts a fresh selection (so changing 16 → 20 can never become 16–20); the old choice stays highlighted until you tap.
- **Cost of the minimalism:** a single verse is Book → Chapter → Verse → **Done** (4 taps after opening). The "type a number" fallback was removed; instead a dashed **＋** at the end of the verse grid reveals 5 more numbers for translations that number extra verses (3 John 15). A verse beyond the common list shows the existing "has N verses in most Bibles" hint.
- **Keyboard:** dialogs now focus the dialog itself (not the first input) on open, so a picker never raises the phone keyboard; only fields marked `autofocus` (e.g. Rename topic) take focus.
- **Test changes (please review):** (1) `helpers.ts` `addVerse` and every spec that drove the old `<select>`/number inputs (`verses.spec`, `offline-backup-sync.spec`) now go through new picker helpers (`pickRef`, `pickRange`, `pickVerse`, `tapNumber`) — same flows and assertions. (2) The "validates the form" test used to type an end verse (15) before the start (16) and expect an error; that state can no longer be produced, so it now asserts the equivalent guarantee (tapping an earlier verse just moves the start). (3) New `picker.spec.ts` (flow, ranges + highlight, fresh-start rule, resets, filters, counts, ＋, Back/Escape/focus, no keyboard, edit mode, scroll-to-selected, keyboard operation, phone ergonomics) and `unit/book-groups.test.ts`.

### Picker fit fix (v1.5.1)
- **Cause of the cut-off:** the sheet was capped at 86% of the screen height, and for chapters whose verse count is a multiple of 6 (John 3 has 36) the "＋" button started a whole extra row. Fixed by letting the sheet use all the height below the status bar, moving "＋" into the Done bar (no extra row), and slightly tighter buttons on short screens (≤ 700 px tall). Very long chapters (e.g. Psalm 119) still scroll inside the grid; Done stays pinned.
- **Tests:** new fit tests at 390×780, 375×667 and 430×932 (Psalm 23, John 3, Genesis 1, Matthew 5): sheet inside the viewport, Done visible, last verse fully visible, and no scrolling needed. I confirmed they **fail on the 1.5.0 code** (≈65 px of forced scrolling on Matthew 5) and pass now. The old "quick filters" e2e test and `unit/book-groups.test.ts` were removed along with the feature; a new test asserts the Book popup is just the 66 books in canonical order.
- **Also noticed (not changed):** the Home freeze banner still has the original, firmer wording ("Progress is paused. You've gone more than 3 days…"). My v1.3.0 notes claim gentler wording; that text replacement didn't apply. Small copy fix available on request.

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

## v1.5.2 — owner-requested tweaks (cooldown options, colour, streak rule)
- **Time between Daily reviews**: Settings offers No wait, 30 min, 1–4 h and Custom minutes (0–720). Same stored value (`prefs.spacingHours`, already validated 0–12 and fractional-safe), so no migration. Tests: unit (0 / 0.5 / 0.75 h) + `tests/e2e/spacing.spec.ts`.
- **Gentle colour**: soft fixed teal/warm wash on the page background, pile-tinted pile tiles, tinted current tab. CSS only; contrast test still green.
- **Streak rule changed (owner's request — a core-rule change)**: a day counts when every due verse got at least ONE counted review (3/day is still the Daily goal and still drives graduation progress, the ring and "all done"). Practising on a day where nothing was due (e.g. the very first day) also earns the flame; verses added/moved that day still never count against you. A due verse with zero reviews still breaks the streak. Already-settled ledger days are not rewritten.
- **Test changes (rule change, reviewed)**: `schedule.test.ts` — the "at risk until last review" test now expects the flame after the first review; "partly finished day breaks the streak" replaced by "one of three keeps it" + "a due verse with no review breaks it"; new first-day-flame test. `motivation.spec.ts` — the 7-day milestone now appears as soon as today's first reviews are in, so the test dismisses it up front instead of after the session.
- Rollback point before the streamline pass: tag `v1.5.1-stable`.

## v1.6.0 — Today screen + progress rings (streamline pass, stages A+B)
**Audit — Today (Home)**: before = greeting, streak chip, freeze banners, ring card with 4-way mode picker, four tall pile cards with blurbs, backup nudge, bottom "Review N ready" button (disabled when nothing ready). Serves practising + progress, but the mode picker and pile blurbs were noise and the disabled button was a dead end. After = date/greeting + compact streak ("best N" only when it differs), one card (ring, headline "N verses to review", list of today's verses with ready/waiting/done marks, mode tucked in `<details>`), 2×2 pile grid, bottom "Start today's reviews · N" only when something is ready. Everything still reachable: mode picker one tap down; pile pages via the grid; the freeze/backup banners unchanged.
**Concept 1 – one-tap start.** Chosen: reuse the existing `?today=1` review queue (now `core/today.ts` `buildTodayQueue`: Daily → Weekly → Monthly → Yearly, longest in pile first, only verses `verseStatus` says are ready). Counting is untouched (each verse still goes through `recordReview`); unit test proves queue order/one-at-a-time give identical reviews/ledger/streak. Last-used mode = the existing `defaultMode` setting, updated whenever the picker is used. When nothing is ready the button disappears and the card says "Done for now" / "All done for today!" + "Next review in 1 hr 20 min" / "tomorrow" / a date (`nextReviewInfo`). Alternatives considered: a separate queue screen (more taps), a disabled button with a countdown (the dead end the owner wanted gone), a new session-state store (unneeded; the queue is a pure function of the data).
**Concept 2 – progress ring.** Chosen: SVG ring (`ProgressRing`, `core/today.ts` `progressRing`) on each verse card in the pile colour, number of days inside, label "Day N of T toward <next pile>"; frozen = dashed, dimmer, with a pause glyph (no alarm colours); Yearly = soft ring with a tick, no target. Replaced the old progress bar and "N days in pile" text (the ring says the same). Alternatives: keep the bar plus ring (duplicate), percentage text (not glanceable), conic-gradient CSS ring (no accessible text, harder to dash for frozen).
**Test changes**: `pile-session.spec.ts` now opens the "Mode:" disclosure before choosing Type (picker moved, still one tap). New: `tests/unit/today.test.ts`, `tests/e2e/today.spec.ts`.
**Moved**: review-mode picker on Today → behind the "Mode:" line. Pile blurbs / "Longest: N days" on pile tiles removed (still on each pile page).

## v1.7.0 — tap-to-reveal flashcards (concept 4)
Chosen: the whole verse is laid out from the start with unrevealed words transparent (soft tinted blocks), so nothing reflows or jumps and long verses simply scroll inside the verse area (only if the newest words fall out of view). Primary button "Uncover next phrase" (also: tap the text); small "Show all" (keeps testid `flip`), "Start over", and "By phrase / By word" toggle (phrases end at punctuation or 6 words: `revealGroups`, unit-tested). Grade buttons appear only once everything is uncovered; grading, mistakes and counting are unchanged. The word/phrase choice is remembered while the app is open (not stored: no data/Settings change). Alternatives: reveal word-only (too many taps on long verses), hold-to-peek (awkward on touch), a bottom sheet of controls (extra layer).
**Test changes**: `review.spec.ts` flashcard test — the old assertion "verse text is hidden before flipping" (getByText hidden) became "no word is uncovered (.rw.on count 0)" because covered words now stay in the DOM (transparent) to keep the layout steady. Other flashcard flows are untouched since "Show all" keeps the `flip` testid. New unit + e2e tests for phrase/word reveal, start over, show all.

## v1.7.0 — flashcards like Quizlet, Type-it-out forgiveness, day-one flame (owner requests; supersede the tap-to-reveal-only design above)
- **Flashcard**: front = reference card; tap it (or "Flip") to see the verse; tap again to flip back. Grades are only **Nailed it** (counts) and **Needs work** (restarts that verse; same as the old "Missed it"). "Almost" removed. **Reference recall removed for flashcards only** — this changes a documented rule ("every mode ends with reference recall"), so it is recorded in CLAUDE.md; the other three modes still end with it. Open question: remove it everywhere? The tap-to-reveal work above is kept as an opt-in "Uncover bit by bit" (phrase/word, Show all, Start over). Flip uses a 0.28 s tilt that is off under prefers-reduced-motion.
- **Type it out**: a wrong letter still costs one slip (3 on Daily, 0 elsewhere, so strict piles still restart) but now reveals the word, marks it with a soft dotted underline and moves on.
- **Mode picker**: back in the open on Today (the "Mode:" disclosure from v1.6.0 was reverted at the owner's request).
- **Day-one celebration**: streak milestone 1 added (small card, no confetti), plus the existing 3/7/… ones. It also appears after the first practice on the very first day.
- **Test changes**: flashcard flows no longer answer the reference (`finishFlashcard` helper); tests that exercise reference recall now reach it through Fill-in-the-blank (`completeBlanks`, made robust against render timing and case); tests unrelated to celebrations auto-close the milestone card (`autoDismissMilestones`, a Playwright locator handler); the Type-it-out e2e test now expects the missed word to be shown and the run to continue; `stats.test.ts` asserts milestone 1. The "fresh-attempt" and flashcard-front assertions were reworded as described in the v1.7.0 stage notes.


## Streamline pass — summary, audit, ideas not built, open questions (v1.5.2 – v1.7.0)
**Tags / rollback**: `v1.5.1-stable` (before the pass), `v1.6.0-today`, `v1.7.0-flashcards`. To undo the whole pass, roll Cloudflare back to the v1.5.1 deployment or `git revert --no-commit v1.5.1-stable..main` (see README, "Rolling back"). No stored-data shape changed in this pass (no migration needed; `migration.test.ts` fixtures still green).
**Screen audit** (serves practising = P, progress = G):
- Today — P+G. Streamlined (v1.6.0): one primary button, what's left listed, calm done state.
- Piles / pile page — P (browse + per-pile review). Kept; per-pile review is secondary to Today's button.
- Verse detail — P (review modes) + management. Kept as is.
- Add — setup, one primary action (picker). Kept.
- Stats — G. Kept.
- Settings — setup; rarely used. Kept (not yet collapsed — see below).
**Not done / deliberately conservative**: the tab bar still has Today · Piles · Add · Stats · Settings (a 3-tab restructure would touch most e2e tests and every move needs logging; the Today screen, which is where the owner lives, is already down to one action). Settings sections are not yet collapsed. Streak milestones list still has extras (14/60/150/200/500/730/1000) beyond the requested 1/7/30/100/365. Scaled celebrations already exist (one verse = result card; all of today = all-done card; graduation / Yearly / 100+ streaks = confetti). Candidates for a follow-up.
**Ideas not built** (non-goals): AI chat or AI-suggested verses, groups/leaderboards/social features, mascots/pets (a calm avatar with seeds was added in v1.13.0 at the owner's request), guilt-based notifications, lock-screen widgets, new accounts or paid services.
**Open questions**: (1) Remove reference recall from the other three modes too? (2) Apply the Home freeze-banner softer wording? (still the older firm text). (3) Move to a 3-tab bar (Today | Verses | Progress, settings behind a gear)?


## v1.8.0 — three-tab navigation (owner approved)
**Moves** (nothing removed): tab "Piles" → **Verses** (same screen, plus a "+ Add verse" button for the old Add tab; `/add` still opens the Add screen and the Verses tab stays highlighted); tab "Stats" → **Progress** (same screen); tab "Settings" → **gear** icon at the top right of Today, Verses and Progress (Settings, About, Backup/Import, Sync, Reminders all live where they did, one tap further). Tab bar is 3 equal, 44 px+ targets.
**Test changes**: tab-name lookups updated (`Piles`→`Verses`, `Stats`→`Progress`; the Settings link is now the gear with the same accessible name "Settings"); the "tap centres are not blocked" test waits for the "verse added" message to fade first, because that message sits over the top-right corner (where the gear is) for a few seconds; new e2e proves every screen is still reachable from the 3 tabs + gear + "+ Add verse".
**Known tradeoff**: the top message can briefly cover the gear. Only its own button takes taps; everything else passes through.


## v1.8.1 — five tabs restored (owner reversed the v1.8.0 decision)
The three-tab bar (v1.8.0, tag `v1.8.0-nav`) was reverted at the owner's request: Today · Piles · Add · Stats · Settings are back exactly as in v1.7.1, and the gear / "+ Add verse" button / Verses & Progress tab names are gone. The change was a clean `git revert` of PR #14's code and tests (the v1.8.0 notes above stay as history). All 13 streak milestones are kept, so the open question about trimming them is closed: **no trimming**. The three-tab proposal is closed too.

## v1.8.2 — data-safety audit (overnight project 1)
**Method**: seeded random histories (30 days of adds, reviews, edits, moves, deletes/restores on several "devices") fed through the sync merge, export→import, and a corruption fuzzer (300 randomly damaged copies). Tests live in `tests/unit/data-safety.test.ts` (fast: ~6 s) and `services.test.ts`.
**Held up (no change needed)**: merge is commutative, associative and idempotent on random histories; no review, verse, reviewed day or longest-streak is ever lost by a merge; deletes win; a full export→import round trip is byte-for-byte equal and self-merge is a no-op; every randomly damaged input either throws a clean `BackupError` or normalises into data the app can settle/merge without crashing; syncing keeps changes made while a sync is in flight (store merges into *current* data).
**Found and fixed**:
1. A backup/sync blob containing a verse with the id `__proto__` replaced the verses object's prototype (so e.g. `verses['text']` returned a string). Low severity (needs a hostile file or someone who knows your sync code) but trivial to close: such data is now rejected (`reserved id`), and a `__proto__` key in `reviewsByDevice` is ignored.
2. If neither the main nor the previous copy of the data could be read (e.g. data written by a *newer* app version after a rollback), the app started empty and the next saves would eventually overwrite the only copy. It now writes the unreadable text to its own `unreadable:<time>` key before starting empty (later saves never touch that key) and shows a quiet message pointing at Settings → Backup. Test: unreadable data is kept across later saves; normal first launch is unaffected.
**Not changed (noted)**: `addVerse` does not itself check `end >= start` (the Add screen and import validation do). One corrupt verse makes an import fail as a whole rather than skipping it — deliberate (all-or-nothing is the safe choice).

## v1.8.3 — iPhone/Safari review (overnight project 2)
No real iPhone or WebKit is available in this environment (Playwright runs Chromium only), so this was a code review against known Safari/iOS pitfalls, not a device test. **Still needs your phone**: see the checklist in `docs/IOS-CHECKLIST.md`.
**Already fine**: all text fields/selects are ≥16 px (no zoom-on-focus); `touch-action: manipulation` and no tap-highlight; hover styles only for real pointers; safe-area insets; viewport tracks the keyboard (`visualViewport`); `overscroll-behavior: none`; update check on every return to the app.
**Changed**: (1) build target lowered from `es2022` to `safari14` so iPhones older than iOS 16.4 can still run the bundle (es2022 syntax such as class static blocks / regex lookbehind would not even parse there); (2) a tiny `structuredClone` fallback for iOS < 15.4, which the app uses for every change (unit-tested); (3) the covered-word blocks in flashcard "Uncover bit by bit" now have a plain-colour fallback for iOS < 16.2 where `color-mix()` is unsupported (other `color-mix` uses degrade harmlessly to "no tint").
**Not changed / suspected but unverifiable here**: sticky `:active` highlight after taps; iOS keyboard needing a tap to reopen in Type it out (already listed in CLAUDE.md); Web Speech behaviour in home-screen apps.

## v1.8.4 — celebration accuracy + small empty-state polish (overnight project 3)
- **Bug fixed (caused by the v1.5.2 streak rule)**: after a session in which each due verse got just one review, the end-of-session screen said "All done for today" even though two more Daily reviews were still to come. It now says **All done for today** (with a small confetti burst in Full celebrations mode; none in Calm) only when every review of the day is finished, and otherwise **Nice work** + your streak, followed by the existing "N more due today" note.
- Empty Weekly/Monthly/Yearly pile pages now say verses arrive there by themselves.
- **Evaluated and skipped**: collapsing Settings into sections. It would touch ~25 e2e steps for a screen that is not part of practising or progress, so the risk outweighs the gain; revisit if Settings keeps growing. Graduation (level-up) and streak-milestone celebrations already scale small → large and were left as they are (all 13 milestones kept at the owner's request).

**Flake watch (v1.8.4 run)**: `picker.spec.ts › works with the keyboard…` (phone) failed once in a full local run (an `expect().toBeVisible()` timeout) but passed 3/3 alone and 40/40 with `--repeat-each=40 --workers=6`. Nothing was skipped or loosened. If it recurs in CI, treat it as real and capture a trace.

## v1.8.5 — speed & offline (overnight project 4)
- **Measured**: the whole app is one 138 KB JS file (≈49 KB gzipped), 23 KB CSS, 16 precached files (299 KB total). Nothing to trim; a bundle splitter would add requests for no gain. Start-up is dominated by reading the saved data, which is a single small IndexedDB read.
- **Added**: when the device has no connection, Today shows a quiet line under the greeting ("Offline. Reviewing and your progress all work as normal."), so being offline never feels like a problem. It disappears as soon as the connection returns. e2e test: `today.spec.ts › with no connection…`.
- **Already in place**: the service worker precaches everything (offline start tested on every release), the Update bar only appears when a new version is ready and never interrupts a review, and the app looks for updates whenever you come back to it.


## v1.9.0 — "Take a break" (overnight project 5, a scheduling-rule addition)
**What**: Settings → *Take a break* (3 days / a week / 2 weeks / a month). While it lasts: nothing is due, nothing can be missed (the streak waits, no lapse days, no freeze), and no progress days are earned (so nothing graduates while you are away). Reviewing anyway is always possible ("Review anyway" button) and counts as a normal day. The break can be ended early from Settings or Today. Weekly/Monthly/Yearly due dates are **not** moved (a verse that fell due during the break is simply ready when you return, with no penalty).
**Design choice**: no progress during a break was chosen over "progress continues", so a long holiday cannot graduate verses nobody has practised. Alternative considered: shifting every due date by the length of the break (more machinery and two more sync edge cases; skipped).
**Stored data**: additive optional fields only: `AppData.pause` (`{from, until, at}`) and ledger `p: 1`. `schema` stays 1 because older data simply has neither; older app versions would drop them on read (a rollback ends the break, nothing else is lost). Merge: pause = last decision wins (`at`, deterministic tie-break), `p` = OR; commutative/associative/idempotent (tested, and the fuzz generator now creates pauses too). New fixture `tests/fixtures/backup-v1.9.0-pause.json` + migration tests; the v1.1.0 fixtures still pass unchanged.
**Tests (written first)**: `tests/unit/pause.test.ts` (10: streak waits, no freeze, no graduation, reviewing anyway earns the day, partial days never break the streak, ending early, merge laws, backup round trip, garbage values dropped), e2e `pause.spec.ts` (start, rest state, review anyway, end, survives reload).
**Open for the owner**: should a break also appear as a quiet band on the heatmap (paused days currently look like rest days)? Should the break be startable from Today too?


## v1.10.0 — "Start partway" slider + Open-in-Bible button size
- **Start partway** (owner-requested): an optional slider (0 to just under the graduation target) in the Move-to-pile dialog and on the Add screen, for verses you already know. It only back-dates `pileSince`; progress, graduation and due dates then follow the existing rules. No stored-data change. Caveats recorded: it is an honour system (sliding to 89 lets a verse graduate after a day of practice) and a verse added with history becomes an obligation today. Undo restores the exact previous pile and date. Tests: `tests/unit/days-in-pile.test.ts` (9, written first) and `tests/e2e/days-in-pile.spec.ts`.
- **Bug fixed**: the "Open in Bible" button was 82 px tall because its icon had no size and wrapped under the text; icons inside any `.btn` are now 18 px, so every button in that grid is 48 px. e2e test compares its height with the Edit button.


## v1.11.0 — stationary blanks, reference + topic as multiple-choice blanks
- **Words no longer jump**: an empty blank used to be an estimated-width box and shrank/grew to the real word when filled, refitting the line. Now every blank contains its real word, invisibly (screen readers get "blank"), so widths never change; the current blank also only scrolls into view when it is nearly off-screen (it used to re-centre every time). e2e test measures every word's left edge/width/line before and after six answers.
- **Reference as blanks** (Fill-in-the-blank only): after the verse's blanks, the reference line at the top becomes `[Book] [chapter]:[verse]` blanks answered from options (book: mostly same-testament books; chapter/verse: nearby real numbers inside the book/chapter; ranges are one blank, e.g. 16–18; one-chapter books skip the chapter question). Option counts follow the difficulty (3/4/5) and Weekly+ is always hard. Wrong picks are slips like any blank. Type it out and Speak it keep the typed reference (nothing to choose from). Tests: `tests/unit/ref-steps.test.ts` (8, written first).
- **Topic is quizzed** in Fill-in-the-blank (a topic blank after the reference), Type it out and Speak it (a multiple-choice step after the typed reference), only when the verse has a topic; options are your other topics padded with common ones. Flashcards never ask.
- **Real bug found and fixed along the way (the intermittent picker-keyboard test failure)**: `Overlay` re-ran its focus effect whenever its parent re-rendered (parents pass a new `onClose` each time), and the cleanup returned focus to the opener — so any re-render behind an open dialog kicked keyboard focus out of it (a keyboard user's Enter/Space would hit the box behind). It now sets up once, reads the latest `onClose` from a ref, and only restores focus if focus is not already somewhere deliberate. Reproduced under CPU load (2/80 failures) and fixed (0/80); regression test `keyboard focus stays on the item you focused…` fails on the old code.
- **Test changes**: tests that exercised the *typed* reference step now use Type it out (`typeWholeVerse`) because Fill-in-the-blank no longer has one; new helpers `finishBlankReference`, and `completeBlanks` also waits for the reference blanks.


## v1.12.0 — Type it out asks for the reference by typing (owner request, "do the same with Type it out")
- After the last word's letter, the top line becomes the hidden reference and you type **the first letter of the book, then chapter:verse** (`J3:16`, `j316`, `J3:16-18`). Numbered books need the number and the letter (`1J4:8`); multi-word names such as Song of Solomon need just the first letter. Colon/dash are optional (any of `: . - – — , ;` are accepted, or just carry on with the next digit). Any book starting with that letter is accepted (that is what "first letter" means; John/Judges/Joshua are indistinguishable by design). A wrong character is a slip, is shown, and typing carries on (a separator that is skipped goes with the next character), like the words. `Reveal` works there too. The on-screen keyboard switches to the numeric pad once the book letter is typed (best effort on iOS).
- If the verse has a topic, Type it out then asks for it as multiple choice (`topicOnly` mode of `RefRecall`); **Speak it keeps the typed book/chapter/verse screen** (a voice mode cannot type letters); Fill-in-the-blank is unchanged.
- Tests: `tests/unit/ref-typing.test.ts` (8, written first); the e2e that used Type it out as the way to reach the typed-reference screen now use Speak it with the pretend microphone (`speakToReference`, which waits for the recogniser's second half before pressing Done).


## v1.13.0 — Avatar and seeds (owner request)
**What:** a customizable avatar (outfit, hair, hair colour, skin, extras, hat, scene, companion) and **seeds** you earn by reviewing and spend on items. Earn items free by achievements (streak, review count, level-ups, a Yearly verse).
**Seeds are derived, never stored:** 1 per counted review, 5 per finished day, 25 per level-up, plus bonuses the first time the longest streak reaches 3/7/14/30/... Balance = earned − cost of owned items, never below 0. Owned items only grow (union on merge); the look is last-writer-wins. Extra practice and "Start partway" earn nothing, so seeds can't be farmed.
**Calm by design:** nothing is ever taken away, no timers, no loot boxes; a missed day costs nothing. Settings → "Avatar and seeds" hides it all.
**Data:** additive optional `avatar` field, `schema` stays 1; fixture `backup-v1.13.0-avatar.json`.
**Ideas not built:** gifting, daily-login rewards, shop rotation, seed decay, leaderboards (all conflict with the calm goals).
**Open question for the owner:** want more items, or seeds shown in the review result only on finished days?

## v1.14.0 — Knight avatar and the armor of God (owner request)
**What:** the avatar became a knight. Free: skin, hair style/colour, eyes, beard, glasses, tunic colour, so it can look like the owner. The armor of God (Eph 6:14-17: belt of truth, breastplate of righteousness, shoes of peace, shield of faith, helmet of salvation, sword of the Spirit) comes in seven tiers per piece: Leather 20, Iron 60, Steel 150, Royal blue 350 seeds; Silver (streaks 40-100), Gold (120-250) and Radiant (300-1000) unlock by longest streak, so the coolest armor is the hardest to get. Wearing all six gives a soft golden glow and a "Full armor of God" label (no extra seeds). Also capes, crowns, extras, companions and scenes, a mix of seeds and streak unlocks.
**Data:** no shape change. Old item ids that no longer exist (or are now free) are simply ignored, and since seeds are derived, anything bought earlier is refunded automatically. Wearing an unknown or unowned id falls back to the default.
**Not built:** a seed bonus for full armor, selling items back, random rewards, time-limited items.
**Open question for the owner:** are the prices and streak lengths right? They are all in one place (`BOUGHT_TIERS` / `EARNED_TIERS` in `core/avatar.ts`).

## v1.15.0 — Ten armor sets from the owner's concept art
**What:** the Leather/Iron/Steel/Royal/Silver/Gold/Radiant tiers became ten sets named and styled after the concept sheet (Initiate, Soldier, Vanguard, Paladin, Warden, Ranger, Crusader, Shadow, Storm, Legend). Per piece: 15, 35, 70, 120, 190, 280, 400, 560, 780, 1100 seeds (a whole set is six pieces). Shadow, Storm and Legend need a 90/180/365-day streak first. Pieces can be mixed; wearing a whole set shows its name and motto.
**How it is drawn:** the pieces are the owner's painted art, cut from `design/armor-sheet.webp` by `design/cut-armor.py` into `public/armor/<slot>-<set>.webp` (60 files, about 0.7 MB, precached for offline) and placed on the vector knight in fixed boxes (`ui/ArmorArt.tsx`), so any piece mixes with any other. A first attempt at redrawing them as vector shapes looked too tacky and was dropped. Limits: the pieces are small (about 100 px), so they soften on very large or high-density screens; a higher-resolution sheet would fix that. The painted helmets and hoods are closed, so a worn helmet hides the face and hair; pick "None" to see them. The face, hair, capes, crowns and companions stay in the simpler vector style.
**Data:** no shape change. Old tier item ids are ignored; since seeds are derived, whatever was bought is refunded automatically.
**Open question for the owner:** prices (a full Legend set is 6,600 seeds, roughly two years of daily reviewing) and the streak gates are guesses and live in `ARMOR_SETS`.

## v1.15.2 — A slimmer, more human knight (owner request)
**What:** the first knight had big-head, short-body "chibi" proportions that looked chubby. The face is now drawn at half size on a taller body (about 5 heads tall): narrower shoulders, longer legs, human-length arms. The painted armor pieces keep their art but sit in new boxes in `ui/ArmorArt.tsx`; neck and chest extras (scarf, bow tie, medal, sash) are scaled to fit; the "face" crop used for the Today bubble and the You tiles was re-aimed.
**Limits:** the face, hair and extras are still the simple cartoon style next to the painted armor.

## v1.15.1 — Armor free while the owner tests (TEMPORARY)
**What:** `testing.armorFree` in `core/avatar.ts` makes every armor piece wearable without seeds or a streak. Nothing is bought or recorded (the `owned` list and seeds are untouched), so switching it off cannot leave debts or lost seeds; unearned armor simply stops being worn (the look falls back to the default for anything not owned).
**To end the test:** set `armorFree: false` (one line) and delete the banner in `ui/AvatarScreen.tsx`. Unit and e2e tests that check the real prices switch it off themselves.

## v1.16.0 — Speak it: read along or from memory (owner request)
**What:** a switch on the Speak it screen (before Start) chooses between "Read along" (the words are visible, highlighted as you speak) and "From memory" (nothing shown until you tap "I'm done", then the usual word-by-word feedback). Remembered per device as `settings.speakWords` (default: read along, which is what the screen showed before). Mistakes, slips allowed, and the reference-recall step that follows are unchanged in both modes.
**Why a device setting and not part of the verse:** it is a preference about how you like to practise, not about the verse, and it needs no change to the synced data.
**Open question for the owner:** should From memory be the default for the Weekly/Monthly/Yearly piles (where no slips are allowed)?

## v1.17.0 — A swappable painted knight (owner request)
**What:** the owner scrapped the character-design avatar. Everyone now starts in the same free basic steel armor and every piece can be swapped, because the new painted sheet (`design/armor-sheet.webp`) draws every piece to one scale. The old ten "sets" and vector body, hair, beard and skin options are removed.
**Prices:** breastplate, arms and legs share seven colourways at 0, 15, 35, 60, 100, 180 (Shadow, 90-day streak) and 320 (Gold, 365-day streak) seeds each. Helmets 0, 25, 70, 120, 180, 260 (180-day streak), 400 (365). Shields 15, 30, 60, 100, 160, 240 (180). Weapons 20, 30, 50, 70, 100, 150, 200 (Dark sword, 90) and 350 (Golden sword, 365). Capes 30-200 (Black needs 90). Plumes 20-40, pouch 20, lantern 45, banners 55. All in `core/avatar.ts` (`COLOURWAYS`, `ITEMS`).
**How it is built:** each piece is a small picture placed at a fixed spot on the knight (`ui/ArmorArt.tsx`), back to front: cape, legs, arms, breastplate, plume, helmet, shield, weapon. The breastplate is drawn over the arms piece, so a mixed colour (a blue breastplate over crimson arms) works. Alignment was tuned by eye against the sheet's own assembled examples.
**Data:** no shape change. Old ids are ignored (the look falls back to the default) and, since seeds are derived, anything bought is refunded automatically.
**Open question for the owner:** the pieces are small (about 100 px each), so they soften on very large screens; a higher-resolution sheet would fix that. Prices and streak gates are my guesses.

## v1.18.0 — New equipment sheet and six armor categories (owner request)
**What:** the owner supplied a new painted sheet (`design/armor-sheet.webp`, background removed) and asked for six armor categories: helmet, chest plate, boots, shield, sword and belt, with no separate arms. Capes and accessories stay as bonus extras.
**Sets and prices:** twelve matching sets for helmet, chest plate, belt, boots and cape. Chest plate prices 0, 15, 30, 50, 75, 105, 140, 180, 230, 290, 350, 420; helmets cost the same, belts 40% and boots 50% of that, capes 60% plus 10. Sets 8-12 also need a 30/60/90/180/365-day streak. Shields (6) cost 20-240 (spiked needs 180 days); weapons (11) 20-350 (dark sword 90 days, golden sword 365). All in `core/avatar.ts` (`SETS`, `ITEMS`).
**Decisions I made (please check):** the sheet has a Leg Armor row that is not one of the six categories, so `legs-N` is drawn automatically with `chest-N` instead of being a choice. The sheet has no plumes, so plumes were dropped (helmet 6 has its own painted plume). The Shoulders/Arms row is unused. The weapon and bow labels on the sheet were cut off; set names and piece names are my guesses.
**Data:** no shape change. Old ids are ignored and, since seeds are derived, anything bought is refunded automatically; the avatar returns to the basic armor.
**Still on:** `testing.armorFree` (all painted pieces free to wear) until the owner says testing is done.

## v1.18.1 — Legs follow the boots, belt at the waist, two tabs (owner request)
**What:** `legs-N` is drawn with `boots-N` instead of `chest-N`; the belt is smaller and moved up to cover the belt painted on the chest plate; the Weapons tab is gone and its shield and sword sit in the Armor tab with the other four pieces.
**Note:** the belt is placed at one fixed height, so it lines up best with chest plates whose painted belt is at the usual spot; if one looks off on your phone, tell me which.

## v1.18.2 — Belt front only, legs and boots as one piece (owner request)
**What:** belts are cut to the front band (the top rim and the turned-away ends are removed in `design/cut-armor.py`). `boots-N` now uses the sheet's Leg Armor picture, which already includes the boots, so there is no separate legs layer and the sheet's Boots row is unused.
**Note:** the picture shown for each Boots choice is therefore the full leg-and-boot piece. Prices are unchanged.
**Also (same PR):** belt scale 0.85 -> 0.78, helmet 0.85 -> 0.80, and a plain grey `Underlayer` behind the armor in `ui/ArmorArt.tsx` fills the gaps (no detail, just a filler shape).
**And:** shield scale 1.0 -> 1.55; the two bows (`weapon-8`, `weapon-11`) have their pale smudge/checkerboard cleared in the cut script (`BOW_CLEAN`). The scimitar (`weapon-9`) is complete as drawn on the sheet: its art is a blade with no hilt, so I left it; a version with a hilt would need new art.
**Also:** chest plate scale 0.85 -> 0.95 (`CHEST_S`) so its sides extend past the legs.
**Removed:** the grey `Underlayer` behind the armor was tried and taken out again at the owner's request; nothing is drawn behind the armor now.

## v1.18.3 — Smaller shield, no glowing red eyes (owner request)
**What:** shield scale 1.55 -> 1.3; the dark pieces with a red glow are flipped from red to blue by the cut script (`BLUE_FLIP` in `design/cut-armor.py`, hue only, so gold and metal are untouched), and the eye area of helmets 4 and 7 is made dark (`EYES`) so there are no glowing eyes of any colour: helmets 4 and 7, chest 4, belt 3, boots 3 and 12, cape 6, shield 5, weapon 3. The genuinely red pieces (the Crimson set, the red lion capes) stay red.
**Swapping art:** new art with the same size and layout as the sheet only needs `design/armor-sheet.webp` replaced (with its background removed) and `python3 design/cut-armor.py` run again; if any piece moves, edit its box in that script.

## v1.19.0 — Type it out without the input box (owner request)
**What:** the visible input is now a 1px transparent field inside the bottom dock (still `data-testid="type-input"`), so the keyboard types straight in and the box no longer takes room. It sits in the dock rather than off-screen so iOS does not scroll the page to reveal it. The typed reference slots moved below the verse. The topic step moved from reference recall into `TypeIt`: typing narrows the options (case-insensitive prefix), a unique match or an exact match is chosen at once, no match is a slip, and the buttons still work. The `topicOnly` prop is gone.
**Needs a real-phone check:** whether the keyboard opens on tapping the text on iOS, and that a wrong letter in the topic step feels fair. **Reveal** in the topic step counts a slip and greys out one wrong choice.

## v1.20.0 — Speak it at 85%, seeds at the end of a run (owner request)
**Speak it:** `speechAccuracy` = words heard right / words in the verse (extra words you say do not count against you); 85% or better (`SPEECH_PASS`) continues without charging slips. Below 85% the old rule still applies (each missed word is a slip; Weekly/Monthly/Yearly allow none, so they restart; Daily allows 3). So nothing that passed before fails now. This is a change to when a Speak attempt counts, so it has unit tests; it does not touch scheduling.
**Seeds:** I took "save the sprout adding to the end of the mass practice" to mean the "+N seeds 🌱" line on the per-verse result card: in a run of more than one verse it is hidden, the totals are added up, and the summary shows `+N seeds` once. A single verse still shows it on its own result card. Seeds themselves are unchanged (still derived, never lost); only when they are shown moved. Tell me if you meant something else.

## v1.21.0 — "Hearth" look (owner choice)
**What:** the owner picked Hearth from five previews (Hearth, Midnight, Manuscript, Moss, Editorial). All tokens in `src/styles.css` changed (light, "follow the system" dark and forced dark blocks, still identical where they must be); `tests/unit/contrast.test.ts` passes unchanged, so every text pair is at least 4.5:1 in both modes. Fonts: Fraunces 400/600/700 and Nunito 400/600/700, latin subset only, in `public/fonts` (about 105 KB) and in the service worker's precache (`woff2` added to `globPatterns`). Headings are Fraunces 600, `--radius` 22px, buttons are pills. Also changed to match: `theme-color` and the manifest colours, the confetti colours and the update bar's button text.
**Not changed:** the app icon and the apple-touch icon are still the old teal; the avatar and its scenes are untouched. Rare characters outside the latin subset fall back to the system font.
**Undo:** roll back to `v1.20.0-speak-85`.
**Test change:** `tests/e2e/comfort.spec.ts` ("theme follows the system by default") hardcoded the old palette's background and text colours; it now expects Hearth's (light `#f4e9dc` / `#3b2a22`, dark `#1a1411` / `#f1e6d8`). It still checks the same behaviour (follows the system; an explicit choice overrides it).

## v1.22.0 — Old colours back, a bare Today (owner request)
**Colours:** every colour token, `theme-color`, the manifest colours, the confetti colours and the update bar are back to their pre-Hearth values (copied from v1.20.0). I kept Hearth's fonts (Fraunces, Nunito), the 22px card radius and the pill buttons because the owner said "colours"; if the fonts and shapes should go too, that is a small follow-up. `tests/e2e/comfort.spec.ts` expects the old colours again.
**Today:** removed the date and greeting, the progress ring (the `0/3` count stays as plain text, same test id), the "Aim for three a day" and "Newly added verses…" filler lines, the mode description under the picker (only on Today; other places keep it) and the "Your piles" heading. The verse list rows are bigger (serif, 52px tall, divided by hairlines); the four pile cards became one row of `dot Name count` buttons (same test ids). `tests/e2e/offline-smoke.spec.ts` no longer looks for the greeting on Today; it looks for the headline instead. New e2e test: Today has no date, greeting, ring or pile cards.
**Not changed:** the other screens (Verses, Stats, Settings, review modes). Say which to simplify next.
**Test change:** `tests/e2e/motivation.spec.ts` looked for the ring's `done` state after the last review of the day; with the ring gone, the same moment is now the count turning green (`.today-count.done`). Same behaviour checked: Today shows that the day is finished.

## v1.23.0 — New armor sheet, eleven sets (owner request)
**What:** the old numbered armour (twelve sets) is replaced by the owner's new sheet, cut by `design/armor-v2/` (README and REPORT there). Eleven sets, not twelve, because the sheet has eleven. Ids are now `<slot>-<set-id>`; `SETS` in `core/avatar.ts`. The first set is free and is the default look.
**Guesses to confirm:** prices (0, 15, 30, 50, 75, 105, 140, 180, 230, 310, 420 seeds) and streak gates (30 / 60 / 180 / 365 days on the last four) are mine; shield and sword prices are fractions of the set price as before.
**Old purchases:** old ids are unknown to the catalog, so they cost nothing and the seeds come back automatically (seeds are derived). A saved look with an old id falls back to the default piece. No data shape change; schema stays 1.
**Placement:** the sheet's loose pieces are not on the finished figure's scale, so belt, cape, sword and shield positions are hand-set in `design/armor-v2/placement.json` and verified on assembled previews. The sword is turned upright.
**Test changes:** `tests/unit/avatar.test.ts` and `tests/e2e/avatar.spec.ts` use the new ids and prices (same behaviours checked). `testing.armorFree` is still on.
**Undo:** roll back to `v1.22.0-bare-today`.

## v1.23.1 — Sword hilt in the hand (owner request)
**What:** sword placement in `design/armor-v2/placement.json` dx 48 -> 36, y -4 -> -14 (upright, same scale), so the grip overlaps the hand. Compared four positions on assembled previews first. No code or test changes.
**Undo:** roll back to `v1.23.0-armor-v2`.

## v1.24.0 — Extras tab removed (owner request)
**What:** removed accessories, crowns, companions and scenes (items, drawings, the nine `ex-*` pictures, `design/cut-armor.py` and the old `armor-sheet.webp` use). Capes stay and now sit with the armor pieces; the screen has no tabs. `Slot` is now seven values; the background is one fixed morning sky. I kept the Wings of light cape (it is a cape) at its 500-day streak.
**Old data:** unknown ids cost nothing, so seeds spent on removed items come back automatically, and a saved look with a removed id falls back to the default. No shape change; schema stays 1.
**Test changes:** the unit test about the two tabs now checks the seven slots; the e2e test that opened the Extras tab and the Crown of life now opens the cape slot and the Wings of light (500-day streak hint). Merge/sync tests use a cape instead of a scene.
**Left alone:** `design/armor-sheet.webp` (old art) is still in the repo; say if you want it deleted. The `Unlock` kinds `reviews`, `levelups` and `yearly` are now unused.
**Undo:** roll back to `v1.23.1-sword-hand`.

## v1.25.0 — Armor prices and gates (owner approved the table)
**What:** `SETS` now run plainest to finest with whole-set prices 0/200/400/600/900/1200/1600/2200/3000/4000/5500; each piece is a fixed share (helmet 20%, chest 25%, shield 18%, sword 18%, boots 8%, belt 6%, cape 5%), rounded to 5. Iron Bulwark replaces Knight's Oath as the free start (`defaultLook()`), so Knight's Oath is now a 600-seed set. Gates: verses added 5/10/15/20/30/45/60 from Stormcaller up; streak 30/60/180/365 on the last four. New `Unlock` kind `verses` (live, undeleted verses); `Item.requires` is now a list.
**Order:** sets are not locked behind each other; the gates make the order. I recommended this to the owner; say if you want a strict order.
**Old data:** nobody loses anything. Someone wearing Knight's Oath now just owns nothing there; the item is unowned so their look falls back to Iron Bulwark, and any seeds they had spent on armor are recalculated at the new prices (balance never below zero, nothing is taken back).
**Still on:** `testing.armorFree`, so none of these prices apply until it is turned off.
**Test changes:** unit tests use the new default and new ids, the streak-gate test now also needs 60 verses, and two new tests check the price table and the verse gates; the e2e avatar test uses Iron Bulwark as the free helmet and Silver Vanguard's helmet at 40 seeds.
**Undo:** roll back to the v1.24.0 tag.

## v1.25.0 (addition) — Armor free-for-testing is off; first sword and shield are rewards (owner request)
**What:** `testing.armorFree` now defaults to false (the switch and banner stay for tests). The Iron Bulwark sword unlocks free when the first verse is added (`verses` 1) and the Iron Bulwark shield when the longest streak reaches 3 days. I read "first streak" as 3 days (a streak of 1 is just one day, and the first milestone beyond it is 3); it is one number in `REWARD` in `core/avatar.ts` if you want 1 or something else. Other sets' swords and shields are still bought.
**"Take away all my sets":** nothing was ever recorded while the free switch was on, so turning it off removes all that armor from your knight by itself. I can't reach your phone's data: if you bought any armor while testing, those purchases are still owned (owned items only ever grow and sync), so tell me and I will add a one-time reset.
**Test changes:** the "while testing" e2e test turns the switch on itself (it is off by default now); unit tests restore it to off; new unit test for the two rewards and an e2e check on the avatar screen.

## v1.25.0 (addition) — Reset my armor, shield at a 1-day streak (owner request)
**Shield:** the Iron Bulwark shield now unlocks at a longest streak of 1 (the day the flame lights), not 3.
**Reset:** Settings has a "Reset my armor" button (with a confirmation) that clears `data.avatar.owned` and `look` on this device; seeds are derived, so every seed spent comes back, and verses and progress are untouched. It is a button, not a one-time automatic action, so it is safe and can be used again. Limit: owned items normally only grow and merge as a union, so if sync is on and another device still owns armor, merging will bring it back; reset there too (or turn sync off). The reset keeps `lookAt` moving forward so the cleared look wins the sync merge. This is a deliberate exception to "never remove anything", asked for by the owner. A snapshot of the earlier data is kept by the usual daily snapshots.
**Tests:** unit test for `resetAvatar`; e2e buys a helmet, resets, and checks the start look and the seed balance.

## v1.26.0 — Seeds become gold coins (owner request)
**What:** the currency is now drawn as a gold coin with a square hole (a new `Coin` SVG, sized to the text, no emoji) and called coins in every screen, toast and setting ("Avatar and coins"). Nothing else changed: same earning rules, same prices, same saved data. Internal names (`seedsBalance`, `seeds-chip` test ids, `data-testid`s, the Seeds comments) are deliberately unchanged so the code and the saved data stay stable; only what people see changed.
**Not changed:** the 🌱 on the Progress screen's empty state is decoration, not the currency, so it stays. The "+N seeds" lines on result cards are now "+N coins" with the coin.
**Test changes:** e2e checks that looked for the 🌱 text or the word seed now look for the price number or the word coin (same behaviour checked).
**Undo:** roll back to `v1.25.0-armor-prices`.

## v1.27.0 — Armor costs four times as much (owner request)
**What:** every set's whole-set price is multiplied by 4 (0/800/1,600/2,400/3,600/4,800/6,400/8,800/12,000/16,000/22,000). The owner said people memorizing a lot will have tens of thousands of coins in a year, so the old table (19,600 for everything) would be bought out. Piece shares, gates and rewards are unchanged. Rough pace: 1 coin per review, 5 per finished day, so someone with 20 verses in Daily earns about 65 a day (about 24,000 a year plus milestone bonuses), someone with 5 verses about 20 a day (about 7,000 a year). The top set is therefore about a year for a heavy user and out of reach for a light one by design; say if that is too steep and I will pick a different multiple.
**Old data:** anything already bought is re-priced (balance never goes below zero, nothing is taken).
**Test changes:** price-table unit test and the e2e avatar tests use the new numbers (Silver Vanguard helmet 160).
**Undo:** roll back to `v1.26.0` tag (the coins release).

## v1.28.0 — Wings of light removed (owner request)
**What:** removed the `cape-wings` item (the 500-day-streak reward) and its drawing. The cape slot is now only the set capes and "None". Saved data that owned or wore it just falls back to no cape (unknown ids cost nothing and fall back). Nothing else changed; milestone seeds for long streaks still pay out.
**Test changes:** the e2e "earned items explain how to get them" test no longer opens the cape slot to check the 500-day hint (the sword's 365-day hint and the shield's first-streak hint still cover locked items); the "only painted pieces are free" assertion in the armor-free unit test had only the wings as an example, so it is gone.
**Undo:** roll back to the `v1.27.0` tag.

## v1.28.1 — Avatar tiles tidied (owner request, laptop screenshot)
**What:** tiles are a little wider (112px), the name takes two lines of height so the bottom line always starts at the same place, and the status (Wearing / Owned / what it needs / the price) is pinned to the bottom. The price is its own no-wrap unit (coin + number, with a thousands comma); each requirement is one short line ("30-day streak", "20 verses") under a lock. The coin was also being drawn as a block inside the Today avatar bubble and on tiles (an old rule for pictures), so it stacked over its number; it is now inline there too.
**Test changes:** none; the checks that look for the price number or the lock text still match.
**Undo:** roll back to the `v1.28.0-no-wings` tag.

## v1.29.0 — Verse requirements only on the last four sets (owner request)
**What:** the verse-count gate (a new `Unlock` kind from v1.25.0) was on Stormcaller and up (5/10/15/20/30/45/60). It is now only on the four sets that also have a streak gate: Crimson Legion 10, Shadowblade 20, Golden Paladin 30, Sulestial 50. Stormcaller, Frostborn and Ember Knight are coins only. I asked which sets; the owner said "only the last 4 unlocks require streaks and verse counts, start with 10 at Crimson".
**Old data:** nothing is removed; anything already owned stays owned.
**Test changes:** the gate test now checks the six early sets have no requirements and the last four have the new streak and verse pairs (a deleted verse still does not count); the Sulestial sword test needs 50 verses.
**Undo:** roll back to the `v1.28.1-tidy-tiles` tag.

## v1.30.0 — Practice order: when the topic and the citation are asked (owner request)
**What:** a device setting `practice = {before, after}` (see CLAUDE.md "Practice order"). I first asked the owner which options they wanted; they replied with the Navigators' Topical Memory System as the example ("Christ the Center. Galatians 2:20. 'I have been crucified…' Galatians 2:20.") and asked for the methods to be highly configurable about when or whether the topic is asked and where the citation goes.
**Design choices (tell me if you want them different):**
- Before the verse, any of topic and citation in either order (each once). After the verse, citation then topic only, because Type it out and Fill in the blank run that tail in a fixed order inside their own flows (typed characters, choice blanks). Citation both before and after is allowed (the sandwich). Topic both before and after is also allowed.
- A question before the verse needs something to tell you which verse is meant. Built first with the first five words, then the whole verse; the owner clarified what they meant: show just the citation. So the cue is the other one of the pair: asked for the topic, you see the citation ("Romans 1:16" at the top, then type "witnessing" in the topic box and the citation hides); asked for the citation first, you see the topic, or the first five words when the verse has none. The cue hides at the first entry (a letter typed, a choice made right or wrong, a book tapped, a chapter or verse typed), stays hidden for the remaining before-the-verse questions, and keeps its space so nothing jumps. The topic is typed in a box where the letters narrow the choices (as in Type it out), and can also be tapped.
- Before-the-verse questions use the same shared form in every mode (book picker, chapter, verse; topic as choices). After the verse, each mode keeps its own style. A wrong answer anywhere is a mistake and restarts like every other mistake; "I don't remember" restarts the verse.
- Settings are for this device only (like the speak-it option); the default is exactly the old order, so nothing changes until you pick something.
- One order for all piles and modes (Flashcards never quiz, as before). Per-pile or per-mode orders would be a follow-up.
**Test changes:** none to existing tests; new `tests/unit/practice.test.ts` and `tests/e2e/practice-order.spec.ts` (every preset, all three modes, a verse with no topic, wrong answers, remembered after reload).
**Undo:** roll back to the `v1.29.0-verse-gates` tag.

## v1.31.0 — Review type bar at the top of Today; swap the type mid review (owner request)
**What:** `ModePicker` now sits at the top of the Today card (above the headline) instead of at the bottom. In a review, the type name in the header is a button (`data-testid="switch-mode"`) that opens a sheet with the four types; choosing another remounts the current verse in that type and the rest of the session uses it. If the verse's result card is showing, the swap just applies to the next verse.
**Choices (tell me if you want them different):** the swap is for this session only and never changes the saved default type. A swap is a fresh attempt at the same verse: slips from the abandoned try do not carry over (the same as the restart that happens after too many slips). It does not count as a review or a mistake. I first misread "the review page" as the single-verse page and moved its card; the owner sent a screenshot of the Today bar, so that change was undone.
**Test changes:** none to existing tests; new `tests/e2e/mode-switch.spec.ts` (position on Today, swapping mid review, cancel, same type, swapping on the result card).
**Undo:** roll back to the `v1.30.0-practice-order` tag.

## v1.32.0 — Shuffle button (owner request)
**What:** `settings.shuffle` (device-only, default off) and a 46px icon button inside `ModePicker`, so it sits beside the Flashcard / Blanks / Type / Speak bar everywhere that bar appears (Today, a pile page, Settings). With it on, `Review` shuffles the queue for sessions started from Today or a pile (`shuffled`, Fisher–Yates over `Math.random`). A session for one chosen verse (`?verse=`) is never shuffled. The Today list itself keeps its normal order; only the order a session visits the verses in changes.
**Rules:** the "longest in the pile first" ordering is still the default and still how lists are ordered. Shuffle is presentation only: what is due, what counts and the streak never read it.
**Choices (tell me if you want them different):** one switch for Daily, Weekly, Monthly and Yearly together (a Today session mixes piles, so shuffle mixes them too); no separate setting per pile.
**Test changes:** none to existing tests; new `shuffled` unit tests and `tests/e2e/shuffle.spec.ts` (button beside the bar and remembered; a shuffled session visits every verse once in a known different order with a fixed random source; off restores the usual order; one chosen verse stays one).
**Undo:** roll back to the `v1.31.0-mode-switch` tag.

## v1.33.0 — Progress follows the calendar; fewer weeks and months; move down (owner request)
**What:** (1) A verse only earns progress when it is up to date (no more freeze). Daily: one counted review that day. Weekly/Monthly: a review any time in the calendar week (Sun–Sat) or month earns that whole period; a skipped period never counts. (2) Weekly/Monthly/Yearly are calendar-based: covered until the next period starts, due on its last day (the only day a miss breaks the streak). (3) Targets are now 90 days Daily, 15 reviewed weeks Weekly, 6 reviewed months Monthly (rings say "Week 7 of 15"). (4) Only Daily→Weekly gets a free arrival week; Monthly and Yearly must be reviewed in the month/year they arrive. (5) After a review that took two restarts in Weekly/Monthly/Yearly the result card offers a move down one pile (owner's choice, Undo, never automatic).
**Choices (tell me if you want them different):** The arrival month counts toward the 6 months. A verse moved up on a period's last day is exempt that day (like any verse moved today). Reviews made on the move day belong to the old pile. Existing progress is carried over as it was (days → distinct weeks/months), so nobody loses anything; older devices keep the old rule until updated. Start partway limits are now 89 days Daily, 91 Weekly, 120 Monthly. Extra practice never counts for progress.
**Data:** additive `Verse.prog` (optional); schema stays 1; fixture `backup-v1.33.0-progress.json`.
**Test changes:** freeze tests removed (the freeze no longer exists); due-date, graduation and cascade tests rewritten for calendar periods and the new targets; e2e specs that built a 90-day-old verse now start it a day earlier and mark it as older data; new `tests/unit/progress-days.test.ts`, `tests/e2e/easier-pile.spec.ts`.
**Undo:** roll back to the `v1.32.0-shuffle` tag.

## v1.34.0 — Guided tour, shield and sword rewards (owner request)
**What:** a seven-lesson interactive tour (about five minutes), hands-on on the real screens with throw-away practice verses, a "Watch it happen" simulator, spotlight coach marks, auto-start for new users, replay from Settings/About/empty Today. Finishing it earns the Shield of Faith; the Sword of the Spirit now needs a first verse added AND practised.
**Choices (tell me if you want them different):** (1) The tour runs in an in-memory sandbox: your data and settings are set aside and come back untouched; sync, saving, backup, import and erase are off during it, and a reload mid-tour just returns the real data. (2) The shield is also still earned by a 1-day streak, so nobody who already had it loses it; the sword stays for anyone with a verse and a counted review. (3) Finishing the tour gives no coins, only the shield. (4) "Not now" on the welcome skips the tour for good; it stays one tap away. (5) The simulator uses a pretend date and the real schedule functions, so it can never disagree with the app.
**Data:** additive `AppData.tourAt` (max-merged), device `settings.tour.done`; schema stays 1; fixture `backup-v1.34.0-tour.json`.
**Test changes:** avatar reward test rewritten for the new sword and shield rules; new `tests/unit/tour.test.ts`, `tests/e2e/tour.spec.ts` (walks every lesson, nothing saved, sandbox leave/reload, simulator, card on screen, sword), migration fixture test.
**Undo:** roll back to the `v1.33.0-progress-days` tag.

## v1.35.0 — Fifteen free backgrounds (owner request)
**What:** a new Background choice on the avatar screen with the owner's fifteen painted pictures (the Sunlit Castle is the default; the old drawn morning sky was removed at the owner's request). The cape and the background sit together under an Extras heading on the avatar screen, apart from the six armor pieces. All free, nothing to earn. The picture is drawn behind the knight on Today, the avatar screen and the tiles.
**Choices (tell me if you want them different):** the names are mine (Sunlit Castle, Frost Keep, Seaside Palace, Ember Fortress, Forest Falls, Moonlit Keep, Twilight Lake, Frozen Peak, Sunset Ruins, Sky Islands, Moonlit Ruins, Harbor Town, Mountain Lake, Marble Court, Island Castle); the pictures are cropped to a square from the middle and kept at their original size (about 36 KB each, saved for offline use). The faint "glow" behind a full set of armor went with the sky. Prices can be added later per picture.
**Data:** no new fields: the choice is stored in the existing worn-items list. Schema stays 1; an older version that does not know a picture falls back to the sky.
**Test changes:** the avatar offline test now waits for the offline copy before cutting the network (this also removes the occasional flake); the "avatar screen lists ..." unit test now expects the Background slot; new unit tests (fifteen free pictures, files exist, wearing and fallback) and `tests/e2e/backgrounds.spec.ts`.
**Undo:** roll back to the `v1.34.0-tour` tag.
