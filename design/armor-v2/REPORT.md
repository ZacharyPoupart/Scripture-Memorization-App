# Armor sheet v2: report

**Result:** 11 sets x 7 slots = 77 cropped RGBA PNGs plus 11 reference figures, `manifest.json` `review_flags: []` (nothing flagged).

## Things that differ from the brief
- The sheet has **11 sets, not 12**. They are named in `layout.json` (Knight's Oath, Silver Vanguard, Iron Bulwark, Forest Guardian, Stormcaller, Frostborn, Ember Knight, Crimson Legion, Shadowblade, Golden Paladin, Sulestial).
- The finished character drawings are at the **top** of each column, not the bottom. The banners/labels are skipped.
- The sheet is small: pieces are only about 70-125 px wide, so the PNGs are low resolution. They were not upscaled or redrawn.

## Known limitations
- Where the original art has white-on-white edges (silver highlights against the white checker squares) the edge is slightly softer; I checked every slot's contact sheet at 4x and found no stray specks, but a human eye on `out/contact-*.png` is the best final check.
- The figure is a separate drawing about 0.96x the size of the loose pieces, so matching it by pixels was unreliable. Belt, cape, sword and shield positions were set by hand (`placement.json`) and checked on the assembled previews, including random mix-and-match.
- The sword is drawn point-down on the sheet; the app turns it 180 degrees so the knight holds it point-up.
- The chest-and-arms label pill touches Knight's Oath's arm and is excluded by rectangle; Ember Knight's helmet and chest touch and are split with a cut line.
- The app (a PWA) serves lossless WebP copies of the PNGs, not the PNGs themselves.
