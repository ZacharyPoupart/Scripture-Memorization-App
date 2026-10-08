# iPhone checklist (things automated tests can't see)

The automated tests run in Chromium, which behaves differently from iPhone Safari in exactly the ways that have bitten before. Run through this on a real iPhone after each release (use the Cloudflare preview link for a pull request, or the live site after merging). Takes about 10 minutes. **Back up first** (Settings → Export backup): deleting a home-screen app on iOS also deletes its stored data.

## Install and offline
- [ ] Open the link in **Safari** → Share → **Add to Home Screen**. It opens full screen (no Safari address bar).
- [ ] With Wi-Fi on, open the app once and use it for a moment (this lets it save itself for offline).
- [ ] Turn on **Airplane Mode**, swipe the app away completely, reopen it from the home screen. It must **start and be tappable**, with your verses visible. No login, no blank screen, no spinner that never ends.
- [ ] Offline: open every tab (Today, Piles, Add, Stats, Settings), add a verse by typing the text, and finish a review. The “look up text” step should politely say you're offline.
- [ ] Turn Airplane Mode off and back on once more while the app is open: nothing breaks.

## Keyboard (the page must not jump or hide your text)
- [ ] **Type it out:** tap the text to bring up the keyboard. The verse and the current word stay on screen, the page doesn't scroll or jump, the typing field and Reveal button sit just above the keyboard. Type a whole verse; the current word stays in view. (After finishing one verse in a session you may need to tap the text once to bring the keyboard back — known iOS limit.)
- [ ] **Where is this verse found?** step: tap Chapter, then Verse: the fields stay visible above the keyboard and the verse text stays readable.
- [ ] **Add a verse:** type in the long text box and the Topic field; the page scrolls normally, nothing is hidden by the keyboard.
- [ ] **Search** (All verses): the keyboard opens without the page jumping; tapping outside dismisses it.
- [ ] Rotate to landscape and back during a review: layout adjusts, nothing is cut off by the notch or home bar.

## Taps (no stuck highlights, nothing blocked)
- [ ] Tap buttons, chips, verse cards and the tab bar: after you lift your finger **no button stays highlighted/greyed**.
- [ ] In fill-in-the-blank, tap options quickly: each tap registers once; a wrong option greys out and the others stay tappable.
- [ ] Add a verse and watch the message at the top: **after it fades, tap things where it was** (the Review button area, tabs). Nothing should be blocked by an invisible layer.
- [ ] Open and close each dialog (Move to pile, Delete, Rename topic, Import, walkthrough, celebration): afterwards the page behind responds to taps immediately.
- [ ] Double-tap on a button does not zoom the page.

## Updates and the service worker
- [ ] After a new version is deployed: open the app (online). Within a few seconds an **Update** bar appears; tap it. The app reloads; **About → version** shows the new number.
- [ ] After updating, repeat the Airplane Mode start test above. It must still open offline.
- [ ] If the app ever seems stuck on an old version or won't start offline: export a backup, then remove the app from the home screen, re-add it from Safari, and **Import backup**. (Report it — that should not be needed.)

## Adding a verse (picker)
- [ ] Add → tap **Book**: a grid of the 66 books slides up (scroll for the rest). Tap a book → the **chapter** grid opens by itself → tap a chapter → the **verse** grid opens by itself → tap a verse → tap **Done**. No keyboard appears at any point.
- [ ] Range: in the verse grid tap a first verse, then a later one: the verses between are tinted and the grid closes.
- [ ] Buttons are easy to hit with a thumb; **Done** is on screen without scrolling and an ordinary chapter's verse grid (John 3, Matthew 5) fits with no scrolling; Psalms (150 chapters) and Psalm 119 scroll smoothly and reopening jumps to your current choice.

## Look and feel
- [ ] Switch iPhone between Light and Dark (Settings → Display): the app follows. Check Settings → Appearance → Light/Dark overrides.
- [ ] Text is comfortable to read for a few minutes; the verse looks like the main thing on screen.
- [ ] The tab bar and the green/teal bottom button clear the home indicator; nothing sits under the notch.
- [ ] Settings → Celebrations: Full shows confetti on a level-up, Calm doesn't.

## Optional features
- [ ] Settings → **Quiet sounds** on: a soft tone after correct answers (ringer/volume permitting). Off by default.
- [ ] **Vibration** switch is greyed out with an explanation (iPhone web apps can't vibrate).
- [ ] **Daily reminders:** set times, tap *Add reminders to Calendar*, choose Add All. If nothing happens, open the page in Safari (not the home-screen app) and try again. Alerts then come from Calendar.
- [ ] **Speak it** (experimental): the microphone prompt appears; words colour as you speak. If it can't work in the home-screen app, the screen offers Type mode instead.
- [ ] **Sync** (needs the Cloudflare KV setup): link a second device with the code; changes appear on both.
- [ ] **Export backup** and **Import backup** work from the Files / share sheet.

## Today, rings and flashcards (v1.6–1.7)
- [ ] Today: one big **Start today's reviews** button at the bottom; the list above it shows what is ready / waiting / done. After finishing, the button disappears and the card says when the next review unlocks (no greyed-out button).
- [ ] The mode choice (Flashcard / Blanks / Type / Speak) is visible on Today and sticks.
- [ ] Verse cards show a small ring ("Day N of 90 toward Weekly"); a verse in a frozen period looks dashed and paused; Yearly shows a tick.
- [ ] Flashcard: tap the card (or **Flip**) to turn it; tap again to flip back; **Nailed it** / **Needs work** only; no reference-entry step afterwards.
- [ ] **Uncover bit by bit**: tapping the covered text or the big button reveals a phrase at a time; **By word**, **Show all**, **Start over** work; the page never jumps and a long verse (Psalm 23:1-6) scrolls inside its area.
- [ ] Type it out: a wrong letter shows the missed word (dotted underline) and carries on; the keyboard stays up.
- [ ] First day: add a verse, review it once: a small **Day one** card appears after you return to Today. Tapping Thank you dismisses it.
- [ ] Settings → Time between Daily reviews: No wait / 30 minutes / hours / Custom.

## Navigation
- [ ] The bottom bar has five tabs: Today · Piles · Add · Stats · Settings. Each responds to a single tap and clears the home indicator.

## Take a break (v1.9)
- [ ] Settings → Take a break → Start break: Today says **On a break**, the main button reads **Review anyway**, and there is no freeze banner.
- [ ] End the break from Today (or Settings): Today returns to normal.
- [ ] After a real break, your streak number is the same as before it.
