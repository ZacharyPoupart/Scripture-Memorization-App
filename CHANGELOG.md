# Changelog

All notable changes to Memorize For Life. Versions follow MAJOR.MINOR.PATCH.
Add notes for the next release under **Unreleased**; `npm run release -- patch|minor|major` rolls them into a dated version.

## [Unreleased]

### Added
- **Stats screen (Progress tab):** current and longest streak, reviews completed, a 26-week calendar heatmap, verses per pile, "nearly there" verses, and streak history. Missed days look like rest days (no blame).
- Review result card shows progress toward the next pile and today's due reviews; a calm "All done for today" moment ends a finished day.
- Streak milestones (3, 7, 14, 30, 60, 100 … days) with celebrations that scale with the achievement; Settings → Celebrations: Full or Calm.
- Optional quiet sounds and vibration on correct answers and finished reviews (both off by default; vibration is unavailable on iPhone web apps and says so).
- Streak chip on Home opens the Progress screen.

### Changed
- Gentler wording around freezes ("a short pause, nothing is lost").

### Fixed
- Screen readers announced segmented buttons ("Easy", "Flashcard"…) with the whole section label; they now have their own names inside a labelled group.

## [1.2.0] - 2026-10-07

### Changed
- New calmer look for long daily sessions: warm off-white / soft charcoal in light mode and a deep blue-grey in dark mode (no pure black or white), every text colour checked against WCAG AA; theme follows the system by default.
- Scripture text is the hero: larger serif type, ~65-character line length and generous line height.
- The main action ("Review N ready", "Start") now sits in a bar at the bottom within thumb reach. Messages (toasts) appear at the top so they never cover it.
- Tapping is more reliable on phones: no double-tap zoom, no sticky hover highlights, notices never block taps, safe-area support on all sides.

### Added
- Tests: colour-contrast guard, comfort/readability/overlay checks, and an offline smoke test that visits every screen with the network off.

## [1.1.1] - 2026-10-07

### Fixed
- Saving is now a single atomic write (new data, previous copy and daily snapshot together, with no read first), so closing or reloading the app a moment after finishing a review can no longer lose it.
- After recovering from a damaged save file, the good copy is kept as the "previous" copy instead of being overwritten by the damaged one.

## [1.1.0] - 2026-10-07

### Added
- NIV verse lookup through API.Bible via a server-side function (`/api/verse`) that keeps the API key secret; falls back to the previous source if not set up. Shows the NIV copyright note when NIV is selected.

## [1.0.0] - 2026-10-07

First release.

### Added
- Add single verses or ranges (book, chapter, verses) with automatic text lookup when online and manual typing/pasting always available, including offline. Translations: ESV, NIV, NLT, NASB, NKJV, CSB, KJV, WEB.
- Four spaced-repetition piles (Daily 3x/day with spacing, Weekly, Monthly, Yearly) with automatic graduation (90 / 90 / 365 days), celebration on level-up, manual moves with undo.
- Streak and longest streak, 3-day freeze that pauses progress without losing anything.
- Four review modes (flashcard, fill in the blank, type first letters, speak it) plus reference recall; mistakes allowed on Daily, perfect recall required later; whole-pile review sessions.
- Installable offline-first PWA, light/dark themes, first-run walkthrough, About page.
- Backup export/import (merge or replace) and automatic daily snapshots.
- Optional end-to-end encrypted sync between devices using a link code (no accounts).
- Unit tests for the scheduling rules; Playwright end-to-end tests (desktop, phone-sized, offline); GitHub Actions CI.
