# Armor sheet v2: extraction pipeline

Turns `source/armor-sheet-v2.webp` (a copy of the owner's sprite sheet, never modified) into individually cropped RGBA PNGs.

    python3 design/armor-v2/extract.py            # PNGs, manifest.json, Expo index  (assets/, reference/, manifest.json, expo/)
    python3 design/armor-v2/extract.py --preview  # out/preview-layout.png: detected pieces drawn on the sheet
    python3 design/armor-v2/extract.py --runtime  # the app's lossless WebP copies + src/ui/armorLayout.json + armorSizes.json
    python3 design/armor-v2/assemble.py           # contact sheets, before/after, assembled previews (out/)

Needs Python 3, Pillow and numpy only.

## Files
- `layout.json` – the coordinate config: background thresholds, the 11 sets (name, centre column), slot bands, cut lines, exclusion rectangles. Edit this, then rerun. (`--detect --force` rewrites it and drops the hand-added `touching_pieces` entry; re-add it.)
- `placement.json` – where each slot's canvas sits on the knight (shared by every set). Hand-set against the reference figure.
- `assets/<slot>/<set-id>.png` – the deliverables. Slots: helmet, chest (with both arms), legs (with both boots), belt (front), cape, sword, shield. All sets of a slot share one canvas size and one anchor, so any set can be swapped for any other.
- `reference/<set-id>.png` – the finished character drawings, for comparison only.
- `manifest.json` – ids, set names, slots, source crop boxes, canvas, anchors, placement, review flags.
- `expo/armorAssets.ts` – static `require(...)` map (Expo/React Native friendly).
- `out/` – contact sheets on a checkerboard, assembled previews, before/after, layout preview.

## Method
1. The sheet has the checkerboard painted into the pixels. It is removed by flooding inward from the border through light, colourless pixels only, so armour that is white or silver but not connected to the outside is never touched. A second, gentler pass catches slightly darker checker squares touching the first.
2. Edges get a 1-2 px soft alpha and colour decontamination so no pale fringe remains. Nothing is redrawn or filled.
3. Pieces are found as connected components and assigned to a slot by where their centre sits; the cape, sword and shield rows touch, so they are cut at fixed y lines. One touching pair (Ember Knight helmet and chest) has its own cut.
4. Each slot gets one canvas, sized to the biggest piece plus 3 px padding. Pieces sit by their column centre and top edge, never by their own bounding box.

## Limitations
See `REPORT.md`.
