# Changelog

All notable changes to Memorize For Life. Versions follow MAJOR.MINOR.PATCH.
Add notes for the next release under **Unreleased**; `npm run release -- patch|minor|major` rolls them into a dated version.

## [Unreleased]

### Changed
- The bottom bar now has three tabs: **Today**, **Verses** and **Progress**. **Settings** (and About, backup, sync) are behind the small gear at the top right of those screens, and **+ Add verse** is at the top of Verses.

## [1.7.1] - 2026-10-08

## [1.7.0] - 2026-10-08

### Changed
- Flashcards work like Quizlet: tap the card to flip it. Afterwards there are just two buttons, "Nailed it" and "Needs work". There is no reference-entry step after a flashcard any more (the other modes still end with it). Prefer to build the verse slowly? "Uncover bit by bit" shows it a phrase or word at a time, with "Show all" and "Start over".
- Type it out: a wrong letter now shows the word you missed (still one slip) and lets you carry on, instead of waiting on that word.
- Today: the review-mode choice is back out in the open.

### Added
- A small "Day one" celebration when your streak begins.

### Changed
- Flashcards are now tap-to-reveal: recite the verse in your head, then tap (or press "Uncover next phrase") to uncover it a phrase at a time. Switch to one word at a time, "Show all", or "Start over" any time. When everything is uncovered you grade yourself exactly as before.

## [1.6.0] - 2026-10-08

### Changed
- Today screen is calmer: one big "Start today's reviews" button for everything ready (Daily, Weekly, Monthly, Yearly together), a short list of today's verses showing what is ready / waiting / done, and a plain "Done for now / All done for today" state that says when the next review unlocks. The review-mode choice is tucked behind a quiet "Mode:" line; piles are a compact 2×2 grid.
- Each verse card shows a small progress ring toward its next pile (e.g. "Day 47 of 90 toward Weekly"), a paused look when progress is frozen, and a finished tick for Yearly. The ring replaces the old bar and the "N days in pile" text.

## [1.5.2] - 2026-10-08

### Changed
- Streak: a day now counts when every due verse got at least one counted review (three a day is still the goal). Practising on the very first day also earns a flame; verses added that day still never count against you. A little more colour: soft tinted background, pile-coloured tiles and a highlighted current tab.

### Added
- More choices for the time between Daily reviews: No wait, 30 minutes, 1–4 hours, or a custom number of minutes (Settings → Reviewing). Existing settings are unchanged (same stored value, hours).

## [1.5.1] - 2026-10-08

### Changed
- The Book / Chapter / Verse pickers now use all the room on screen, so an ordinary chapter (e.g. John 3, Genesis 1, Matthew 5) fits without scrolling and the Done button is always visible.
- Removed the quick-filter shortcuts (Law, History, Gospels & Acts…) from the Book picker; it is now just the 66 books in Bible order.
- The "＋" (more verse numbers) moved next to Done so it no longer adds an extra row to the grid.

## [1.5.0] - 2026-10-08

### Changed
- **Adding a verse is now a quick tap-through instead of a long list:** three boxes — Book, Chapter, Verse — each open a compact grid of big buttons, and each pick opens the next box by itself (John 3:16 is Book → John → 3 → 16 → Done). A row of quick filters (Law, History, Wisdom, Prophets, Gospels & Acts, Letters & Revelation) narrows the 66 books to a handful. No search box and no typing, so the keyboard never appears.
- **Ranges are picked in the same grid:** tap the first verse, then the last — the verses in between are highlighted. (The separate "To" box is gone.)
- A "＋" at the end of the verse grid reveals a few more numbers for translations that number more verses than the common list (e.g. 3 John 15).
- Dialogs no longer put the cursor in the first text field when they open (that raised the phone keyboard); fields that should take focus ask for it explicitly.

## [1.4.0] - 2026-10-07

### Added
- **Search, sort and filter** on All verses and every pile (words, topics, references like "jn 3:16"; sort by longest in pile, Bible order, newest or due soonest; "Ready now"). Searching never changes what a pile review contains.
- **Topic management:** rename, merge or remove a topic everywhere, with Undo.
- **Daily reminders** through your Calendar app (a downloadable calendar file with up to three repeating alerts) — the honest way to remind on iPhone without a server.
- A calm error screen if a screen ever fails to draw (your data is untouched), and **Undo** after "Erase all data".
- A gentle backup nudge on Home (only with 3+ verses, no sync and no recent export; "Not now" waits two weeks).

### Improved
- Keyboard and screen-reader support: dialogs trap and restore focus and close with Escape; each screen has a page title.

## [1.3.0] - 2026-10-07

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
