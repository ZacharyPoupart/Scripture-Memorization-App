#!/usr/bin/env python3
"""Cuts the owner's 11-set knight armor sheet into clean RGBA PNGs, one per slot and set.

The sheet (source/armor-sheet-v2.webp, never modified) has a checkerboard BAKED INTO its pixels (it is an RGB image, no alpha),
so the background is removed here. Nothing is redrawn: every output pixel is a pixel of the sheet.

    python3 design/armor-v2/extract.py --detect     work out layout.json from the sheet (refuses to overwrite hand edits without --force)
    python3 design/armor-v2/extract.py --preview    draw the detected rows/columns/pieces on the sheet (out/preview-layout.png)
    python3 design/armor-v2/extract.py              extract everything: assets/<slot>/<set>.png, reference/<set>.png, manifest.json
    python3 design/armor-v2/extract.py --runtime    also write the lossless WebP copies the app serves (public/armor/...) and src/ui/armorLayout.json

layout.json is meant to be edited: fix a crop there, re-run, no code changes needed. Needs Pillow and numpy.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
LAYOUT = os.path.join(HERE, 'layout.json')
OUT = os.path.join(HERE, 'out')
ASSETS = os.path.join(HERE, 'assets')
REFERENCE = os.path.join(HERE, 'reference')

# What the owner's six armor categories and extras are called in the sheet, in drawing order from the top.
SLOTS = ['helmet', 'chest', 'legs', 'belt', 'cape', 'sword', 'shield']


def load_layout() -> dict:
    with open(LAYOUT) as f:
        return json.load(f)


def load_sheet(layout: dict) -> np.ndarray:
    return np.array(Image.open(os.path.join(HERE, layout['source'])).convert('RGB'))


# ----------------------------------------------------------------------------------------------- background removal


def _flood(seed: np.ndarray, allowed: np.ndarray) -> np.ndarray:
    """Grow `seed` through 4-connected `allowed` pixels."""
    bg = seed & allowed
    while True:
        nb = bg.copy()
        nb[1:] |= bg[:-1]
        nb[:-1] |= bg[1:]
        nb[:, 1:] |= bg[:, :-1]
        nb[:, :-1] |= bg[:, 1:]
        nb &= allowed
        if (nb == bg).all():
            return bg
        bg = nb


def background_mask(rgb: np.ndarray, cfg: dict) -> np.ndarray:
    """True where a pixel is checkerboard.

    Pass 1: light, colourless pixels connected to the sheet's border through other such pixels (the two checker tones).
    Pass 2: grow that region into slightly darker, still colourless pixels that touch it (the checker's shaded squares and the
    pixels beside the artwork), so no light specks are left stranded next to the artwork. Both passes only travel through
    light colourless pixels, so they stop at every dark outline: light pixels INSIDE an outline (white cloth, silver
    highlights) are never reached and are kept."""
    a = rgb.astype(int)
    mn, mx = a.min(2), a.max(2)
    h, w = mn.shape
    light = (mn >= cfg['min_channel']) & ((mx - mn) <= cfg['max_spread'])
    seed = np.zeros((h, w), bool)
    seed[0, :], seed[-1, :] = light[0, :], light[-1, :]
    seed[:, 0] |= light[:, 0]
    seed[:, -1] |= light[:, -1]
    bg = _flood(seed, light)
    loose = (mn >= cfg['grow_min_channel']) & ((mx - mn) <= cfg['grow_max_spread'])
    return _flood(bg, loose | bg)


def shift_or(m: np.ndarray, r: int) -> np.ndarray:
    """Dilate a boolean mask by r pixels (square)."""
    out = m.copy()
    for _ in range(r):
        n = out.copy()
        n[1:] |= out[:-1]
        n[:-1] |= out[1:]
        n[:, 1:] |= out[:, :-1]
        n[:, :-1] |= out[:, 1:]
        n[1:, 1:] |= out[:-1, :-1]
        n[:-1, :-1] |= out[1:, 1:]
        n[1:, :-1] |= out[:-1, 1:]
        n[:-1, 1:] |= out[1:, :-1]
        out = n
    return out


def erode(m: np.ndarray, r: int) -> np.ndarray:
    return ~shift_or(~m, r)


def _box_sum(a: np.ndarray, radius: int) -> np.ndarray:
    """Sum over a (2r+1)x(2r+1) window, using an integral image (zero outside the sheet)."""
    k = 2 * radius + 1
    p = np.pad(a, ((radius + 1, radius), (radius + 1, radius)))
    c = p.cumsum(0).cumsum(1)
    return c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]


def box_mean(img: np.ndarray, weight: np.ndarray, radius: int) -> np.ndarray:
    """Weighted local mean of an RGB image over a box, where weight is 0/1. Pixels with no weighted neighbour get NaN."""
    w = weight.astype(float)
    den = _box_sum(w, radius)
    out = np.empty(img.shape, float)
    with np.errstate(invalid='ignore', divide='ignore'):
        for c in range(3):
            out[..., c] = _box_sum(img[..., c] * w, radius) / den
    out[den < 0.5] = np.nan
    return out


def soft_alpha(rgb: np.ndarray, bg: np.ndarray, cfg: dict) -> tuple[np.ndarray, np.ndarray]:
    """Alpha and un-matted colour for the whole sheet.

    Inside the artwork alpha is 1. Along the edge (within two pixels of the background) each pixel is treated as a mix of its
    nearby artwork colour and the nearby checkerboard colour, which gives a soft antialiased edge and removes the light halo."""
    f = ~bg
    img = rgb.astype(float)
    core = erode(f, 2)
    bgcore = erode(bg, 1)
    fc = box_mean(img, core, 4)
    bc = box_mean(img, bgcore, 4)
    band_f = f & shift_or(bg, 2)  # artwork pixels hugging the background
    band_b = bg & shift_or(f, 1)  # background pixels hugging the artwork (they may hold a little coverage)
    band = band_f | band_b
    alpha = np.where(f, 1.0, 0.0)
    out = img.copy()
    ys, xs = np.nonzero(band)
    for y, x in zip(ys, xs):
        b, fg = bc[y, x], fc[y, x]
        if np.isnan(b).any() or np.isnan(fg).any():
            continue
        d = b - fg
        dd = float(d @ d)
        if dd < cfg['min_contrast'] ** 2:  # artwork as light as the checkerboard: cannot tell them apart, keep the hard edge
            continue
        al = float(np.clip((b - img[y, x]) @ d / dd, 0.0, 1.0))
        if al < cfg['min_alpha']:
            alpha[y, x] = 0.0
            continue
        alpha[y, x] = al
        if al < 1.0:
            out[y, x] = np.clip((img[y, x] - (1 - al) * b) / al, 0, 255)
    return alpha, out


# ---------------------------------------------------------------------------------------------------- pieces


def label_components(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if lab[y, x]:
            continue
        n += 1
        q = deque([(y, x)])
        lab[y, x] = n
        while q:
            cy, cx = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                        lab[ny, nx] = n
                        q.append((ny, nx))
    return lab


def slot_of(y: float, bands: dict) -> str | None:
    for slot, (a, b) in bands.items():
        if a <= y < b:
            return slot
    return None


def assign_pieces(layout: dict, fg: np.ndarray) -> dict[tuple[str, str], np.ndarray]:
    """Boolean mask for every (slot, set id). Whole connected pieces are assigned by where their centre is; pieces that touch
    each other in the lower rows (cape, sword, shield) are cut at the y lines in layout.json."""
    fg = fg.copy()
    for x0, y0, x1, y1 in layout['exclude_rects']:
        fg[y0:y1, x0:x1] = False
    lab = label_components(fg)
    sets = layout['sets']
    cxs = np.array([s['cx'] for s in sets], float)
    bands = {k: tuple(v) for k, v in layout['centroid_bands'].items()}
    cut_y0 = layout['lower_rows']['from_y']
    cuts = layout['lower_rows']['cuts']  # [cape|sword, sword|shield]
    lower_names = layout['lower_rows']['slots']  # ['cape', 'sword', 'shield']
    out: dict[tuple[str, str], np.ndarray] = {}
    h, w = fg.shape

    def put(slot: str, si: int, m: np.ndarray):
        key = (slot, sets[si]['id'])
        out[key] = out.get(key, np.zeros((h, w), bool)) | m

    for i in range(1, lab.max() + 1):
        m = lab == i
        n = int(m.sum())
        if n < layout['min_piece_pixels']:
            continue
        ys, xs = np.nonzero(m)
        cy, cx = float(ys.mean()), float(xs.mean())
        if xs.max() < layout['label_strip_max_x']:
            continue  # the "HELMET / CHEST + ARMS ..." label pills on the left edge
        if ys.min() < layout['figure_cut_min_y'] and cy < layout['figure_cut_max_y']:
            # the banner on top of the reference figure: they touch, cut them apart at that column's quietest row
            si = int(np.abs(cxs - cx).argmin())
            cut = sets[si]['banner_cut_y']
            put('figure', si, m & (np.arange(h)[:, None] >= cut))
            continue
        si = int(np.abs(cxs - cx).argmin())
        if ys.min() >= cut_y0:
            yy = np.arange(h)[:, None]
            put(lower_names[0], si, m & (yy < cuts[0]))
            put(lower_names[1], si, m & (yy >= cuts[0]) & (yy < cuts[1]))
            put(lower_names[2], si, m & (yy >= cuts[1]))
            continue
        merged = layout.get('touching_pieces', {}).get(sets[si]['id'])
        if merged and ys.min() < bands['helmet'][1] - 10 and ys.max() > bands['chest'][0] + 60:
            # a helmet whose chin touches the chest plate's collar: cut the helmet off along a line, only near the middle
            yy, xx = np.arange(h)[:, None], np.arange(w)[None, :]
            helm = m & (yy < merged['cut_y']) & (np.abs(xx - sets[si]['cx']) <= merged['half_width'])
            put('helmet', si, helm)
            put('chest', si, m & ~helm)
            continue
        slot = slot_of(cy, bands)
        if slot is None:
            print(f'  ! piece at ({cx:.0f},{cy:.0f}) with {n} px is in no slot band; ignored', file=sys.stderr)
            continue
        put(slot, si, m)
    return out


def bbox_of(m: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(m)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


# ------------------------------------------------------------------------------------------------------ detect


def detect(layout_path: str, force: bool) -> None:
    if os.path.exists(layout_path) and not force:
        sys.exit(f'{layout_path} exists (it may hold hand edits). Pass --force to overwrite it.')
    base = {
        'source': 'source/armor-sheet-v2.webp',
        'source_sha256': hashlib.sha256(open(os.path.join(HERE, 'source/armor-sheet-v2.webp'), 'rb').read()).hexdigest(),
        'background': {'min_channel': 222, 'max_spread': 10, 'grow_min_channel': 196, 'grow_max_spread': 16, 'min_contrast': 40, 'min_alpha': 0.04},
        'edge': {},
    }
    rgb = np.array(Image.open(os.path.join(HERE, base['source'])).convert('RGB'))
    bg = background_mask(rgb, base['background'])
    fg = ~bg
    h, w = fg.shape
    # columns: the 11 name banners along the top
    pb = fg[0:78, 70:].sum(0)
    runs, inb = [], False
    for x, v in enumerate(pb):
        if v > 0 and not inb:
            s, inb = x, True
        if v == 0 and inb:
            runs.append((s + 70, x + 70))
            inb = False
    runs = [r for r in runs if r[1] - r[0] > 40]
    names = ["Knight's Oath", 'Silver Vanguard', 'Golden Paladin', 'Crimson Legion', 'Stormcaller', 'Iron Bulwark', 'Forest Guardian', 'Ember Knight', 'Frostborn', 'Shadowblade', 'Sulestial']
    ids = ['knights-oath', 'silver-vanguard', 'golden-paladin', 'crimson-legion', 'stormcaller', 'iron-bulwark', 'forest-guardian', 'ember-knight', 'frostborn', 'shadowblade', 'sulestial']
    if len(runs) != len(names):
        sys.exit(f'expected {len(names)} banners, found {len(runs)}: {runs}')
    sets = []
    for (a, b), n, i in zip(runs, names, ids):
        # centre = middle of the reference figure under the banner (symmetric artwork)
        fig = fg[90:318, a - 10 : b + 10]
        xs = np.nonzero(fig.any(0))[0]
        cx = int(round(a - 10 + (xs.min() + xs.max() + 1) / 2))
        p = fg[60:100, a:b].sum(1)
        sets.append({'id': i, 'name': n, 'cx': cx, 'banner_cut_y': 60 + int(p[16:30].argmin()) + 16})
    base['sets'] = sets
    base['centroid_bands'] = {'helmet': [300, 376], 'chest': [376, 501], 'legs': [501, 601], 'belt': [601, 634]}
    base['lower_rows'] = {'from_y': 630, 'cuts': [757, 900], 'slots': ['cape', 'sword', 'shield']}
    base['figure_cut_min_y'] = 30
    base['figure_cut_max_y'] = 320
    base['label_strip_max_x'] = 70
    base['min_piece_pixels'] = 25
    # the CHEST + ARMS label pill touches the first chest's arm, so it is cut away by hand
    base['exclude_rects'] = [[0, 410, 65, 462]]
    base['canvas_padding'] = 3
    base['touching_pieces'] = {}
    # the reference figure is not quite centred like the loose pieces are, so each set gets two centres
    for s in base['sets']:
        s['figure_cx'] = s['cx']
    pieces = assign_pieces(base, fg)
    for s in base['sets']:
        centres = []
        for slot in ('helmet', 'chest', 'belt', 'cape', 'sword', 'shield'):
            m = pieces.get((slot, s['id']))
            if m is not None:
                x0, _, x1, _ = bbox_of(m)
                centres.append((x0 + x1) / 2)
        s['cx'] = int(round(float(np.median(centres))))
    with open(layout_path, 'w') as f:
        json.dump(base, f, indent=1)
    print('wrote', layout_path)


# ------------------------------------------------------------------------------------------------------ preview


def preview_layout(layout: dict, rgb: np.ndarray, pieces: dict) -> None:
    os.makedirs(OUT, exist_ok=True)
    im = Image.fromarray(rgb).convert('RGB')
    d = ImageDraw.Draw(im)
    colors = {'helmet': (230, 40, 40), 'chest': (30, 140, 30), 'legs': (30, 60, 230), 'belt': (200, 120, 0), 'cape': (160, 0, 200), 'sword': (0, 150, 170), 'shield': (200, 0, 120), 'figure': (90, 90, 90)}
    for (slot, sid), m in pieces.items():
        x0, y0, x1, y1 = bbox_of(m)
        d.rectangle([x0 - 1, y0 - 1, x1, y1], outline=colors[slot], width=1)
    for s in layout['sets']:
        d.line([(s['cx'], 0), (s['cx'], im.height)], fill=(255, 0, 255), width=1)
        d.text((s['cx'] - 18, 2), s['id'][:9], fill=(0, 0, 0))
    for y in layout['centroid_bands'].values():
        d.line([(0, y[0]), (im.width, y[0])], fill=(150, 150, 255), width=1)
    for y in layout['lower_rows']['cuts']:
        d.line([(0, y), (im.width, y)], fill=(150, 150, 255), width=1)
    im.save(os.path.join(OUT, 'preview-layout.png'))
    print('wrote out/preview-layout.png')


# ------------------------------------------------------------------------------------------------------ extract


def extract(layout: dict, write_runtime: bool) -> None:
    rgb = load_sheet(layout)
    bg = background_mask(rgb, layout['background'])
    alpha, color = soft_alpha(rgb, bg, layout['background'])
    fg = ~bg
    pieces = assign_pieces(layout, fg)
    sets = layout['sets']
    pad = layout['canvas_padding']
    os.makedirs(OUT, exist_ok=True)
    problems: list[str] = []
    union_all = np.zeros(fg.shape, bool)
    for m in pieces.values():
        union_all |= m

    # every (slot, set) must exist exactly once
    for slot in SLOTS + ['figure']:
        for s in sets:
            if (slot, s['id']) not in pieces:
                problems.append(f'MISSING {slot}/{s["id"]}')
    if problems:
        print('\n'.join(problems), file=sys.stderr)

    # canvas per slot: the same size for every set, centred on each set's own column centre (never on the piece's bounding box)
    canvas: dict[str, dict] = {}
    for slot in SLOTS + ['figure']:
        l = r = 0
        top, bot = 10**9, -(10**9)
        for s in sets:
            m = pieces.get((slot, s['id']))
            if m is None:
                continue
            x0, y0, x1, y1 = bbox_of(m)
            c0 = s['figure_cx'] if slot == 'figure' else s['cx']
            l, r = max(l, c0 - x0), max(r, x1 - c0)
            top, bot = min(top, y0), max(bot, y1)
        half = max(l, r) + pad
        canvas[slot] = {'half': half, 'width': 2 * half, 'top': top - pad, 'height': (bot + pad) - (top - pad)}

    manifest: dict = {
        'source': layout['source'],
        'source_sha256': layout['source_sha256'],
        'sets': [{'id': s['id'], 'name': s['name'], 'cx': s['cx'], 'figure_cx': s['figure_cx']} for s in sets],
        'slots': {},
        'items': [],
        'notes': [
            'Canvas size is identical for every set of a slot. Each canvas is centred on its set\'s column centre (cx) and starts at the slot\'s fixed row top, so pieces keep the sheet\'s own relative positions.',
            'anchor = the point of the canvas that sits on the set\'s column centre line (x) and the slot\'s row top (y).',
        ],
    }
    for slot, c in canvas.items():
        manifest['slots'][slot] = {'canvas': [c['width'], c['height']], 'anchor': [c['half'], 0], 'sheet_row_top': c['top']}

    for slot in SLOTS + ['figure']:
        folder = os.path.join(REFERENCE if slot == 'figure' else os.path.join(ASSETS, slot))
        os.makedirs(folder, exist_ok=True)
        c = canvas[slot]
        for s in sets:
            m = pieces.get((slot, s['id']))
            if m is None:
                continue
            x_left = (s['figure_cx'] if slot == 'figure' else s['cx']) - c['half']
            y_top = c['top']
            ok = shift_or(m, 1) & (alpha > 0)
            # a pixel belongs to this piece if it is in the piece, or is a soft edge pixel next to it that no other piece owns
            others = union_all & ~m
            ok &= ~others
            ys, xs = np.mgrid[y_top : y_top + c['height'], x_left : x_left + c['width']]
            inb = (ys >= 0) & (ys < rgb.shape[0]) & (xs >= 0) & (xs < rgb.shape[1])
            yc, xc = np.clip(ys, 0, rgb.shape[0] - 1), np.clip(xs, 0, rgb.shape[1] - 1)
            a = np.where(inb & ok[yc, xc], alpha[yc, xc], 0.0)
            px = np.zeros((c['height'], c['width'], 4), np.uint8)
            px[..., :3] = np.clip(color[yc, xc], 0, 255).astype(np.uint8)
            px[..., 3] = np.round(a * 255).astype(np.uint8)
            px[px[..., 3] == 0, :3] = 0
            path = os.path.join(folder, f'{s["id"]}.png')
            Image.fromarray(px, 'RGBA').save(path, optimize=True)
            x0, y0, x1, y1 = bbox_of(m)
            item = {
                'id': f'{slot}-{s["id"]}',
                'set': s['id'],
                'set_name': s['name'],
                'slot': slot,
                'file': os.path.relpath(path, HERE).replace(os.sep, '/'),
                'canvas': [c['width'], c['height']],
                'anchor': [c['half'], 0],
                'source_crop': [x_left, y_top, x_left + c['width'], y_top + c['height']],
                'piece_bbox_in_sheet': [x0, y0, x1, y1],
                'piece_bbox_in_canvas': [x0 - x_left, y0 - y_top, x1 - x_left, y1 - y_top],
            }
            manifest['items'].append(item)
            # flags for review
            if x0 - x_left < 1 or x1 > x_left + c['width'] - 1 or y0 - y_top < 1 or y1 > y_top + c['height'] - 1:
                problems.append(f'TOUCHES CANVAS EDGE {slot}/{s["id"]}')
            edge_cx = (x0 + x1) / 2 - (s['figure_cx'] if slot == 'figure' else s['cx'])
            if slot in ('helmet', 'chest', 'belt', 'cape', 'shield', 'sword', 'legs') and abs(edge_cx) > 3:
                problems.append(f'OFF-CENTRE by {edge_cx:+.1f}px {slot}/{s["id"]}')
    pl_path = os.path.join(HERE, 'placement.json')
    if os.path.exists(pl_path):
        manifest['placement'] = json.load(open(pl_path))
    manifest['review_flags'] = problems
    with open(os.path.join(HERE, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=1)
    print(f'wrote {len(manifest["items"])} images and manifest.json')
    for p in problems:
        print('  FLAG', p)
    write_expo_index(manifest)
    if write_runtime:
        sys.path.insert(0, HERE)
        import runtime_export  # noqa: E402

        runtime_export.run(manifest)


def write_expo_index(manifest: dict) -> None:
    """expo/armorAssets.ts: static require() references for React Native / Expo (Metro needs literal paths)."""
    folder = os.path.join(HERE, 'expo')
    os.makedirs(folder, exist_ok=True)
    lines = ['// Generated by design/armor-v2/extract.py. Do not edit; re-run the script.', '// Static require() paths so Metro can bundle every image.', '', 'export const armorAssets = {']
    for slot in SLOTS:
        lines.append(f'  {slot}: {{')
        for it in [i for i in manifest['items'] if i['slot'] == slot]:
            key = it['set'].replace('-', '_')
            lines.append(f"    {key}: require('../assets/{slot}/{it['set']}.png'),")
        lines.append('  },')
    lines.append('} as const;')
    lines.append('')
    lines.append('export const armorSets = ' + json.dumps([{'id': s['id'], 'name': s['name']} for s in manifest['sets']], indent=2) + ' as const;')
    lines.append('')
    with open(os.path.join(folder, 'armorAssets.ts'), 'w') as f:
        f.write('\n'.join(lines))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--detect', action='store_true')
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--preview', action='store_true')
    ap.add_argument('--runtime', action='store_true')
    args = ap.parse_args()
    if args.detect:
        detect(LAYOUT, args.force)
        return
    layout = load_layout()
    if args.preview:
        rgb = load_sheet(layout)
        bg = background_mask(rgb, layout['background'])
        preview_layout(layout, rgb, assign_pieces(layout, ~bg))
        return
    extract(layout, args.runtime)


if __name__ == '__main__':
    main()
