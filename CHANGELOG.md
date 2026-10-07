# Changelog

All notable changes to Memorize For Life. Versions follow MAJOR.MINOR.PATCH.
Add notes for the next release under **Unreleased**; `npm run release -- patch|minor|major` rolls them into a dated version.

## [Unreleased]

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
