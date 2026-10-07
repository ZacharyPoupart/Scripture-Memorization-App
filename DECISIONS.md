# DECISIONS.md — autonomous improvement pass

Living log for the overnight/long-running improvement pass (started 2026-10-07). If the session is cut off, **read "Resume here" first**.

## Resume here
- **Current stage:** Phase 0 merged (PR #2 save fix v1.1.1, PR #3 baseline). Workstream 1 (visual design, v1.2.0) in review; Workstream 2 (motivation/stats, v1.3.0) in progress on `feature/motivation`.
- **Plan:** merge PR #2 (save-race fix, v1.1.1) → Workstream 1 (visual design, v1.2.0) → Workstream 2 (motivation & stats, v1.3.0) → Workstream 3 (product features, v1.4.0) → final docs/checklist.
- **Rule:** every stage = branch → PR → CI green → merge → stage tag. Never merge red/skipped. Last green state is always `main`.
- **Rollback to before this whole pass:** `git checkout v1.1.0-stable` (see "Rollback" below).

## Tags (rollback points)
| Tag | Meaning |
|---|---|
| `v1.0.0` | first release |
| `v1.1.0` | NIV lookup via API.Bible |
| `v1.1.0-stable` | **last known-good before this pass** (same commit as `v1.1.0`, `d588f84`) |
| `vX.Y.Z` | auto-tagged by `release.yml` when a version bump merges to `main` |
| `vX.Y.Z-<stage>` | stage tags added after each workstream (see below) |

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

### Workstream 2 — motivation and feedback (v1.3.0) _(in progress)_

## Open questions for you
_(none yet)_

## Needs a closer look
_(none yet)_

## Rollback
```bash
git fetch --tags
git checkout v1.1.0-stable        # inspect the old version
# to put it live: Cloudflare dashboard -> Deployments -> the deployment for v1.1.0 -> "Rollback to this deployment"
# or revert in git: git checkout -b fix/rollback main && git revert --no-commit v1.1.0-stable..main && git commit -m "Roll back to v1.1.0-stable" && git push -u origin fix/rollback   # then PR + merge
```
Your verses live on the phone, so a rollback never touches them.
