# DECISIONS.md — autonomous improvement pass

Living log for the overnight/long-running improvement pass (started 2026-10-07). If the session is cut off, **read "Resume here" first**.

## Resume here
- **Current stage:** Phase 0 (safety + baseline) — PR open.
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
_(none yet that modify existing tests — new tests only)_

## Decisions
_(filled in per workstream)_

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
