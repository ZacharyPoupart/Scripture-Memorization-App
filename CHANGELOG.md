# Changelog

All notable changes to Memorize For Life. Versions follow MAJOR.MINOR.PATCH.
Add notes for the next release under **Unreleased**; `npm run release -- patch|minor|major` rolls them into a dated version.

## [Unreleased]

## [1.68.2] - 2026-10-28

### Changed
- Stats: the practice squares are easier to tell apart: practiced, all done and full day are now three clearly different steps from pale to deep (the other way round in dark mode).

## [1.68.1] - 2026-10-28

### Fixed
- Type it out on iPhone: the keyboard now comes up by itself when a review starts or you swap to Type, and stays up from one verse to the next. (iPhone only raises it during a tap, so a hidden field takes it then and hands it to the real one.) Tap the text still brings it back.

## [1.68.0] - 2026-10-28

### Added
- A group's leader can hand the group to someone else: ⋯ → "Choose a new leader", pick a member, confirm. You stay in the group.
- When a leader leaves, the group goes to the member who has been in it longest. The leave confirmation now says who that will be.

## [1.67.0] - 2026-10-28

### Changed
- A group's goal reads in plain words: "85 of 315 reviews this week · 27%", how many are left to go and how long is left, with a "How does the goal work?" explanation.
- A little treasure chest shows the reward: shut with the coins it pays (25 each), padlocked with "Needs 2 people" for a group of one, and open and glowing once the goal is reached.
- The members list says what each number is: reviews this week (of that person's share of the goal) and their streak in days.

## [1.66.0] - 2026-10-28

### Changed
- The Friends tab is calmer. Friends and Groups are two halves you switch between, instead of one long page. Your name, the privacy note and "Stop sharing" are tucked under "Your sharing"; a group shows its goal and an Invite button, with the members list and the rename / banner / leave options a tap away; the code boxes only appear when you need them.
- Easier to use with a screen reader or keyboard: the two halves are proper tabs (arrow keys move between them), every folding section says whether it is open, buttons and links are at least 44 px tall, and the goal bar reads out its numbers.

## [1.65.2] - 2026-10-27

### Changed
- The group flag beside your knight looks more like a real banner: woven cloth with soft folds, stitching along the edge, two sewn loops over the crossbar and a little gold tassel, on a wooden pole and crossbar with grain. The cloth is a hair wider (the pole is not), and its shadow now lies on the ground beside the pole instead of straight behind it.

## [1.65.1] - 2026-10-27

### Changed
- The group flag beside your knight now casts soft shadows: on the scene behind it, down its pole and on the ground, and the gold ball on top is shaded. The banner you see in a group card is unchanged.

## [1.65.0] - 2026-10-27

### Changed
- The streak multiplier is gentler: x1.1 from 3 days, x1.25 from 7, x1.5 from 14, x1.75 from 30, x2 from 100, and x3 only at a full year (365 days). Coins you already earned are never taken away.

## [1.64.1] - 2026-10-27

### Changed
- The group flag now stands on the knight's right and is a bit bigger.

## [1.64.0] - 2026-10-27

### Added
- Names for people and groups are checked: rude or inappropriate names are turned down with a kind message, in the app and again on the server.

## [1.63.0] - 2026-10-27

### Added
- In a group: "Led by <name>", a members list you can tap (their knight, streak and week), a Leader tag, and each member's streak.
- The group shows its reward (25 coins each) and a countdown to the end of the week: whole days at first, then hours and minutes on the last day.

### Changed
- A group's weekly goal is now worked out once when the week starts and kept for that week. New verses and new members change next week's goal, not this one.

## [1.62.0] - 2026-10-27

### Changed
- A group's banner is now a **flag on a little stand** next to your knight (Avatar → Extras → Group flag), not the whole background. Friends see it too.
- The flag follows the group: when the leader redesigns the banner your flag changes, and if you leave the group it comes off.
- Anyone who had worn a banner as their background goes back to the normal background.

## [1.61.0] - 2026-10-27

### Added
- Tap your coins or the streak multiplier on the avatar screen for a small box explaining how coins are earned and why the multiplier is what it is (and what the next step is).

### Changed
- A full day now earns 10 coins (was 3) on top of the 5 for a finished day.

## [1.60.0] - 2026-10-27

### Fixed
- The colour the iPhone draws behind the clock now always matches the page. Before, it followed the phone's light/dark setting, so a phone in dark mode could show a black box above a light page (when the app's theme was set to Light).

## [1.59.0] - 2026-10-27

### Changed
- The "Longest in pile first" sort on your lists now stays on whatever you last picked, the next time you open a pile or the app, so you don't have to choose it again. Search and filters still start fresh.

## [1.58.0] - 2026-10-27

### Added
- On Today, tap any verse in the list to practice just that one, in the review type you last used. It works for verses that are ready, still waiting for their next review, or already done (those count as extra practice).

## [1.57.0] - 2026-10-27

### Added
- A day you finish all the way (every Daily verse reviewed 3 times, and the others reviewed too) is now a **full day**. The Stats page shows three shades: practiced, all done (every verse reviewed once, which keeps your streak) and full day (the deepest), and the line under the map counts each. A full day pays 3 coins on top of the usual 5. Days before this update stay as they were.

## [1.56.0] - 2026-10-27

### Added
- Group banners. Every group has a little painted shield next to its name. The leader can change it (Friends → the group → Edit banner): pick one of 15 simple designs and two of 12 colors. Members can wear their group's banner as their avatar background.

## [1.55.0] - 2026-10-27

### Changed
- The celebration pop-ups (level-up, streak milestone, streak saved, new item) no longer end with a "Thank you" / "Wonderful" / "Nice" button. They close with a small × in the corner, a tap outside, or Escape.

## [1.54.0] - 2026-10-27

### Added
- Streak saves. Once a month, a day you miss that would have broken your streak is forgiven: the streak carries on. The saved day adds nothing to your streak or to any verse's progress, and a short message tells you when it happens. On the Stats page the day shows in gold.

## [1.53.0] - 2026-10-27

### Added
- The leader of a group can rename it (Friends → the group → Rename group). Everyone in the group sees the new name.

### Changed
- You can be in up to 3 groups at once (it was 5). Anyone already in more keeps them; they just can't join or start another until they are in fewer than 3.

## [1.52.0] - 2026-10-27

### Added
- Tap a friend on the Friends tab to see their whole knight in a larger picture, with their streak, longest streak, reviews this week, pile counts and any group you share. You can cheer them from there too.

## [1.51.0] - 2026-10-26

### Changed
- Extra practice (reviewing a verse that is not due, or one you have already finished for the day or week) now counts toward your group's weekly goal and shows in your reviews this week. It still doesn't change the schedule, and it earns no coins.

## [1.50.0] - 2026-10-26

### Added
- Streak multipliers. The longer your streak, the more every coin is worth: x1.2 from 3 days, x1.5 from 7, x2 from 14, x2.5 from 30 and x3 from 100. It applies to the coins from a review, a finished day and a level-up, and your current multiplier shows beside your coins on the avatar screen. The one-time streak milestone coins are unchanged.

## [1.49.2] - 2026-10-26

### Removed
- The "Armor of God: 2 of 6 upgraded" line and its dots under the knight on the avatar screen.

## [1.49.1] - 2026-10-26

### Fixed
- The sword sits a little further right on the knight, so the grip is in the hand.

## [1.49.0] - 2026-10-26

### Changed
- The first two armor sets you can buy are cheaper: Silver Vanguard is 400 coins for the whole set (was 800) and Forest Guardian 1,000 (was 1,600). The prices of the later sets are unchanged, so it is easy to get started and the finest armor takes real saving. Anything you already bought stays yours, and the coins you spent on it are worked out at the new prices, so your balance goes up by the difference.

## [1.48.0] - 2026-10-26

### Changed
- A group's weekly goal is now the reviews its members have due that week added up (a Daily verse counts 3 a day, a Weekly verse once, and so on), rounded to the nearest 5, instead of a flat 25 each.

### Added
- 25 coins for every member of a group of two or more when the group reaches its weekly goal. You need at least one review of your own that week, and the coins arrive the next time you open Friends.

## [1.47.0] - 2026-10-26

### Changed
- The Weekly, Monthly and Yearly pile pages now always have a one-tap "Review all" button, even when nothing is due. It counts as extra practice and does not change the schedule.

## [1.46.0] - 2026-10-26

### Changed
- The four pile counts (Daily, Weekly, Monthly, Yearly) now sit at the top of Today, above the day's card.

## [1.45.1] - 2026-10-26

### Fixed
- On iPhone the last choices in the book, chapter and verse pickers (Revelation, the last verses) were hidden behind the bottom tab bar. Pop-up sheets now stop above the tab bar, so everything can be reached.

## [1.45.0] - 2026-10-26

### Changed
- When a Weekly, Monthly or Yearly verse that took many tries is moved back to Daily from the offer, it goes in with only a week to go (Day 83 of 90) instead of starting Daily from the beginning.

## [1.44.0] - 2026-10-24

### Fixed
- In Fill in the blank, names such as God, Jesus and Lord always keep their capital letter in the choices. They used to appear as "god" or "jesus" when the answer was a lowercase word.

## [1.43.0] - 2026-10-24

### Changed
- The hardest Fill in the blank hides every word of the verse and offers six choices, laid out in even rows. Weekly, Monthly and Yearly verses always use it.

## [1.42.0] - 2026-10-24

### Changed
- The "Default review mode" choice is gone from Settings. The app now simply stays on the review type you picked last, whether you picked it on Today, in a pile or in the middle of a review.

## [1.41.0] - 2026-10-24

### Changed
- Fewer words. Help text the tour already covers is gone from Settings (sync, break, practice order, reviewing and feedback), Today, the piles, Progress, a verse's page, Add a verse, the review result card, the level-up card, the avatar screen and Friends, and so are small disclaimers that explain themselves. The About page is a short summary and the welcome slides are one line each. Warnings that protect your data (erasing, replacing, deleting, keeping the sync code private) and the note asking children to check with a parent stay.

## [1.40.0] - 2026-10-23

### Changed
- With more than six topics, the row of topic buttons folds into one "Topic: all" button. It opens a searchable list (with how many verses each topic has); pick one and you can clear it or rename it from the same row. Six or fewer topics still show as buttons.

## [1.39.0] - 2026-10-23

### Changed
- Friends has its own tab in the bottom bar (between Add and Stats). The Friends button on Progress and the one in Settings are gone, since the tab replaces them.

## [1.38.0] - 2026-10-23

### Added
- When you buy or earn something for your knight (an armor piece, a cape, the sword or the shield), it now appears in the middle of the screen with a soft golden glow, turning rays and a few sparkles. Tap Nice (or Wear it, for something you have just earned) to carry on.

## [1.37.0] - 2026-10-23

### Added
- Friends. Settings → Friends and groups (or the Friends button on Progress): turn it on with your name, tap Invite a friend, and send the link or code. When they open it, you each see the other's knight, streak, how many verses are in each pile and how many reviews were done this week. Never the verses themselves. Only people you invite can see you, and either of you can remove the other, or stop sharing and delete your profile, at any time.
- Groups. Start a group (a youth group, a family, a study group), invite people with a code, and work together toward a shared weekly goal of reviews. Invite only, up to 30 people.
- Cheers. Tap 👏 on a friend to cheer them on once a day; they see it for a week.

## [1.36.0] - 2026-10-23

### Removed
- The Calm celebrations switch (celebrations always include the confetti), the Vibration switch, and the Daily reminders (Calendar file) card are gone from Settings. Quiet sounds, the avatar switch and everything else stay.

## [1.35.0] - 2026-10-23

### Added
- Fifteen painted backgrounds for your knight (a sunlit castle, a frost keep, a seaside palace, an ember fortress, a forest waterfall, moonlit ruins and more), all free. Pick one from the new Background button on the avatar screen; the cape and the background now sit together under "Extras" on the avatar screen. The old drawn morning sky is gone: everyone starts with the sunlit castle.

## [1.34.1] - 2026-10-23

### Fixed
- The tour is easier to read on iPhone: the rest of the screen is darker, the highlighted spot has rounded corners, the card has a clear outline, and the lesson list reads left to right and scrolls on small screens so Close is always reachable.

## [1.34.0] - 2026-10-23

### Added
- A guided tour of about five minutes in seven short lessons: the basics, your first review, the review types and practice order, piles and progress (with a little simulator where you watch a verse move up), streak and breaks, your knight, and backups and sync. It runs on the real screens with practice verses, so nothing you do in it is saved or counted. New users are offered it after the welcome; everyone can find it in Settings, About and the empty Today screen.
- The Shield of Faith is now earned by finishing the tour (people who had already lit their first flame keep it).

### Changed
- The Sword of the Spirit now needs you to add a verse and practice it (before, adding one was enough).

## [1.33.0] - 2026-10-23

### Changed
- Weekly, Monthly and Yearly verses now follow the calendar. Review a Weekly verse any day from Sunday to Saturday and it is covered until the next Sunday; Monthly covers the calendar month, Yearly the calendar year. Anything still undone on Saturday (or the last day of the month, or Dec 31) ends the streak that day.
- Progress moves only when a verse is up to date. A Daily verse earns a day with one counted review that day. A Weekly or Monthly review earns that whole week or month; a week or month that was skipped just doesn't count and is never made up. The "freeze" after three quiet days is gone, and progress already earned is kept.
- Moving up takes 15 reviewed weeks in Weekly and 6 reviewed months in Monthly (it used to be 90 and 365 days). The rings and Stats say "Week 7 of 15" and "Month 3 of 6".
- Only the week a verse arrives in from Daily is free. A verse that moves up to Monthly or Yearly has to be reviewed in the month or year it arrives.

### Added
- After a review that took a few tries in Weekly, Monthly or Yearly, the result card offers to move the verse down a pile so you see it more often. You choose; there is an Undo.

## [1.32.0] - 2026-10-22

### Added
- A small shuffle button beside the review type bar (on Today, a pile page and in Settings). Turn it on and a review session visits your verses in a random order instead of longest-held first. It is remembered on this device, and it only changes the order: what is due and what counts toward your streak and progress stays the same.

## [1.31.0] - 2026-10-22

### Changed
- On Today, the review type bar (Flashcard, Blanks, Type, Speak) is now at the top of the card instead of the bottom.

### Added
- Swap the review type in the middle of a review: tap the type's name at the top of the review screen and pick another. The verse you are on starts over in the new type, and the rest of the session uses it. Your saved default type does not change.

## [1.30.0] - 2026-10-22

### Added
- Choose your practice order (Settings → Reviewing). The topic and the citation can each be asked before the verse, after it, or both, in the order you like. Presets: Classic (what you had), Sandwich (topic, citation, verse, citation, like the Navigators' Topical Memory System), Citation first, and Verse only; or switch each piece on and off yourself. Before the verse you see a cue at the top: when you are asked for the topic you see the citation ("Romans 1:16"), and it hides as soon as you start typing; when you are asked for the citation you see the topic. The topic is typed in a box (or tapped). Flashcards are unchanged.

## [1.29.0] - 2026-10-22

### Changed
- Only the last four armor sets ask for verses now: Crimson Legion needs 10 verses (and a 30-day streak), Shadowblade 20 (60-day), Golden Paladin 30 (180-day) and Sulestial 50 (365-day). Every set before them just costs coins.

## [1.28.1] - 2026-10-22

### Fixed
- The armor tiles on the avatar screen are tidy: every price sits on the bottom line with its coin beside it (never split across lines), what a piece needs (a streak, a number of verses) is one short line each, and prices over 999 have a comma. The coin beside your balance on Today also stays on the line with its number.

## [1.28.0] - 2026-10-22

### Changed
- The Wings of light cape is gone for now. Capes are the eleven set capes (or none).

## [1.27.0] - 2026-10-22

### Changed
- Armor costs four times as much, so there is something to work toward all year: a whole set now runs from 800 coins (Silver Vanguard) up to 22,000 (Sulestial). The streak and verse requirements are the same.

## [1.26.0] - 2026-10-22

### Changed
- Seeds are now gold coins, drawn as a coin with a square hole in the middle. Everything is the same (1 per review, 5 for a finished day, 25 for a verse moving up) and anything you had stays: only the name and the picture changed.

## [1.25.0] - 2026-10-22

### Changed
- Real prices for the armor. Iron Bulwark is now the free starting set; the other ten cost from 200 seeds (Silver Vanguard) up to 5,500 (Sulestial) for a whole set, and each piece costs its share of that. Stormcaller and above also need a number of verses in your library (5 up to 60), and the last four need a 30, 60, 180 or 365-day streak as well. You can buy sets in any order once you reach them.
- Armor is no longer free for testing: you wear what you have earned or bought. The Iron Bulwark sword comes free when you add your first verse, and its shield when your streak first lights (day 1).

## [1.24.0] - 2026-10-22

### Changed
- The avatar screen no longer has an Extras tab. Capes stay (now next to the armor pieces); accessories, crowns, companions and scenes are gone, and the knight stands against one morning sky. Anything you owned there simply stops showing; seeds you spent on it come back.

## [1.23.1] - 2026-10-22

### Fixed
- The knight's sword now sits in the hand: moved in toward the body and up a little so the grip is held.

## [1.23.0] - 2026-10-21

### Changed
- The knight's armor is replaced with the new eleven sets: Knight's Oath (free, everyone starts in it), Silver Vanguard, Iron Bulwark, Forest Guardian, Stormcaller, Frostborn, Ember Knight, Crimson Legion, Shadowblade, Golden Paladin and Sulestial. Helmet, chest plate with arms, belt, boots, cape, shield and sword all mix and match. Armor you bought before is refunded as seeds; nothing is lost.

## [1.22.0] - 2026-10-21

### Changed
- Back to the original teal-and-paper colours (the warm Hearth colours are gone). The new fonts, rounder cards and pill buttons stay.
- Today is calmer and focused on the verses: no date or greeting, no progress ring, no filler lines, the verse list is bigger with more space between rows, and the four piles are one quiet row of names and counts instead of four cards.

## [1.21.0] - 2026-10-21

### Changed
- A new look, "Hearth": warm cream and terracotta in light mode, warm brown and amber in dark mode, Fraunces (a soft serif) for the verse and headings and Nunito for the rest, rounder cards and pill-shaped buttons. The fonts are bundled, so it looks the same offline. Every colour pair is still checked for contrast in both modes.

## [1.20.0] - 2026-10-20

### Changed
- Speak it: hearing 85% or more of the words right now passes, since the microphone sometimes mishears. Nothing is counted as a slip then, and the result says "Close enough". Below 85% the missed words count as slips like before.
- In a run of several verses, the seeds are saved for the end: no "+seeds" after each verse, so you can keep going quickly, and the total shows once on the summary.

## [1.19.0] - 2026-10-20

### Changed
- Type it out: the topic can be typed too (the letters you type narrow the choices, and it is chosen when one is left; tapping still works), so you no longer swap between typing and tapping.
- Type it out: the reference now appears below the verse instead of above it.
- Type it out: there is no input box any more. The keyboard just pops up and the letters go straight in, which frees up room on a phone. Tap the text to bring the keyboard back if it goes away.

## [1.18.3] - 2026-10-20

### Changed
- The shield is a bit smaller.
- The dark "shadow" pieces (shadow and spiked helmets, shadow chest plate, belt, boots and cape, the spiked shield and the dark sword) are blue instead of red, and the two helmets no longer have glowing eyes (the eye area is dark).

## [1.18.2] - 2026-10-20

### Changed
- The belt shows only its front band, not the whole ring.
- The boots are now the sheet's leg-and-boot pieces drawn as one picture, instead of boots laid over separate legs.
- The belt and helmet are a touch smaller.
- The chest plate is a little bigger, so its sides reach past the legs.
- The shield is much bigger, so it is in proportion with the knight.
- Both bows are re-cut so the gap between the wood and the string is clear.

## [1.18.1] - 2026-10-20

### Changed
- The leg armor now goes with the boots you choose (it used to follow the chest plate).
- The belt sits at the waist, over the belt painted on the chest plate.
- The avatar screen has two tabs: Armor holds all six pieces (helmet, chest plate, belt, boots, shield, sword) and Extras holds the cape, accessories, crown, companion and scene.

## [1.18.0] - 2026-10-20

### Changed
- New equipment sheet. The six armor categories are now helmet, chest plate, belt, boots, shield and sword (no separate arms; the chest plates already have sleeves). Helmets, chest plates, belts, boots and capes come in twelve matching sets that cost more and more, with the finest needing a long streak; there are 6 shields and 11 swords and weapons. Accessories (ring, amulet, gloves, pouch, lantern, charm, banner, medal, scroll) and capes stay as bonus extras.
- Leg armor is worn automatically with the matching chest plate. Plumes are gone (the new sheet has none).
- Anything bought from the old sheet is refunded automatically (seeds are derived), and the avatar falls back to the basic armor until you pick new pieces.

## [1.17.0] - 2026-10-20

### Changed
- The avatar is a new painted knight. The character designs (skin, hair, eyes, beard and so on) are gone: everyone starts in the same free basic steel armor, and every piece can be swapped for another because they are all painted to the same size.
- Swappable pieces: 7 helmets, 5 plumes, breastplate, arms & belt and legs & boots in 7 colourways, 6 capes, 6 shields and 8 weapons (swords, axe, mace, spear, longbow and a crystal staff), plus a pouch, lantern and four banners. Each piece costs more than the one before it; the finest (Shadow, Gold, the golden helm and sword, the winged helm and spiked shield) also need a long streak.
- Scenes, companions, wings and the royal crown, halo and crown of life stay. The flower and laurel crowns, the old scarf, bow tie, headphones, butterfly, star and sash, and the old character looks were retired; seeds spent on them are refunded automatically.

## [1.16.0] - 2026-10-10

### Added
- Speak it now has two modes, chosen with a switch above the Start button: "Read along" shows the verse's words so you can follow them as you speak, and "From memory" hides them until you finish (the word-by-word feedback then appears). The choice is remembered on this device.

## [1.15.2] - 2026-10-10

### Changed
- The knight is slimmer and more human: a smaller head, narrower body, longer arms and legs. The painted armor, shield, sword and boots were refitted to the new shape, and the face bubbles and tiles were re-cropped.

## [1.15.1] - 2026-10-10

### Changed
- Temporary, for testing: every piece of armor is free to wear (no seeds, no streak needed). A note on the avatar screen says so. Nothing is bought or recorded, so your seeds are untouched, and the unearned armor comes off again when this is switched off.

## [1.15.0] - 2026-10-10

### Changed
- The armor of God now comes in ten sets, from concept art: The Initiate, Soldier, Vanguard, Paladin, Warden, Ranger, Crusader, Shadow, Storm and Legend. Each set has a helmet (or hood), armor, belt, boots, shield and sword with its own look; mix and match or complete a whole set.
- Each set costs more than the one before (15 seeds a piece for the Initiate up to 1,100 for the Legend). The last three sets also ask for a streak first (90, 180 and 365 days).
- The armor is now the painted artwork itself (60 small pictures, about 0.7 MB in all, saved for offline use) placed on the knight, and the shop shows each piece as a picture. A closed helmet or hood covers the face; choose "None" for the helmet to see yourself.
- The earlier Leather / Iron / Steel / Silver / Gold / Radiant armor is replaced; seeds spent on it are refunded automatically.

## [1.14.0] - 2026-10-10

### Changed
- The avatar is now a knight who can put on the full armor of God (Ephesians 6): helmet of salvation, breastplate of righteousness, belt of truth, shoes of peace, shield of faith and sword of the Spirit. Everything that makes the knight look like you (skin, hair, hair colour, eyes, beard, glasses, tunic) is free.
- Armor comes in tiers: Leather, Iron, Steel and Royal blue are bought with seeds; Silver, Gold and Radiant are unlocked by streak length, and the Radiant set (up to a 1,000-day streak) is the hardest of all. Wear all six pieces for a golden glow.
- New capes (including Wings of light), crowns, extras (lantern, banner, butterfly, star, scroll and more), companions (eagle, baby dragon, guardian angel) and scenes (castle wall, mountain top).
- Items from the first avatar version that are now free are refunded automatically (seeds are worked out from your reviews, so nothing is lost).

## [1.13.1] - 2026-10-10

### Changed
- New app icon: a gold flame over an open book on deep blue (home-screen icon, installed app and browser tab). The master picture is in `design/app-icon-master.png`.

## [1.13.0] - 2026-10-10

### Added
- An avatar you can customize. Earn seeds by reviewing (1 per review, 5 for a finished day, 25 when a verse moves up, bonuses for streak milestones) and spend them on outfits, hair, hats, scenes and companions; some items unlock free from achievements. Seeds are never taken away. Turn it off in Settings.

## [1.12.0] - 2026-10-09

### Changed
- Type it out now asks for the reference too: after the verse, type the first letter of the book and then the chapter and verse (e.g. J3:16 or J316; the colon and dash are optional). A wrong character is shown and you carry on, like the words. Speak it still uses the typed reference screen.

## [1.11.0] - 2026-10-08

### Changed
- Fill in the blank no longer shifts as you answer: the words stay exactly where they are.
- Fill in the blank now asks for the reference as blanks too (book, chapter, verse, chosen from options) instead of typing it.
- If a verse has a topic, Fill in the blank, Type it out and Speak it ask for it as well (multiple choice). Flashcards do not.

### Fixed
- Keyboard focus no longer jumps out of an open dialog (like the verse picker) when something behind it refreshes.

## [1.10.0] - 2026-10-08

### Added
- **Start partway**: when you move a verse to another pile, or add one you already know, an optional slider lets you say how many days it has already been in that pile, so you do not repeat time you have already put in. Undo works as before.

### Fixed
- The "Open in Bible" button is now the same height as the other buttons on a verse.

## [1.9.0] - 2026-10-08

### Added
- **Take a break** (Settings): pause for 3 days, a week, 2 weeks or a month. Nothing is due, your streak waits, nothing freezes and nothing is lost; verses just do not move up while you are away. You can still review anyway, and end the break early from Settings or Today.

## [1.8.5] - 2026-10-08

### Added
- A calm "Offline" line on Today when there is no connection, so it is clear that reviewing and progress keep working.

## [1.8.4] - 2026-10-08

### Fixed
- The end-of-session screen no longer says "All done for today" when more reviews are still due; it says "Nice work" and shows your streak. Finishing everything for the day adds a small confetti burst (Full celebrations only).

## [1.8.3] - 2026-10-08

### Fixed
- Better support for older iPhones: the app is now built for iOS 14+ browsers, has a fallback for a feature missing before iOS 15.4, and the flashcard "uncover" blocks have a fallback colour before iOS 16.2.

## [1.8.2] - 2026-10-08

### Fixed
- Data safety: a damaged backup can no longer tamper with the data object (reserved `__proto__` ids are rejected), and if saved data ever cannot be read (for example after rolling back from a newer version) a copy of it is kept aside instead of being overwritten.

## [1.8.1] - 2026-10-08

## [1.8.0] - 2026-10-08

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
