#!/usr/bin/env python3
"""Checks and previews for the extracted armor: where each piece sits on the knight, contact sheets, assembled previews.

    python3 design/armor-v2/assemble.py     contact sheets, assembled previews and a before/after of the background removal (out/*.png)

placement.json says where each slot's canvas sits on the knight (hand-set against the reference figure, because the figure is
a separate drawing and pixel matching it was too unreliable): x is a shift from the centre line, y is from the top of the
figure; one value per slot, shared by every set.
"""
from __future__ import annotations

import argparse
import json
import os

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PLACEMENT = os.path.join(HERE, 'placement.json')
SLOTS = ['helmet', 'chest', 'legs', 'belt', 'cape', 'sword', 'shield']
DRAW_ORDER = ['cape', 'legs', 'chest', 'belt', 'helmet', 'shield', 'sword']  # back to front


def manifest() -> dict:
    return json.load(open(os.path.join(HERE, 'manifest.json')))


def load(m: dict, slot: str, set_id: str) -> Image.Image:
    it = next(i for i in m['items'] if i['slot'] == slot and i['set'] == set_id)
    return Image.open(os.path.join(HERE, it['file'])).convert('RGBA')


def checker(w: int, h: int, a: int = 8) -> Image.Image:
    yy, xx = np.mgrid[0:h, 0:w]
    v = np.where(((xx // a) + (yy // a)) % 2 == 0, 214, 236).astype(np.uint8)
    return Image.fromarray(np.stack([v, v, v], -1), 'RGB')


# ------------------------------------------------------------------------------------------------ assembly


def placement() -> dict:
    return json.load(open(PLACEMENT))


def assemble(m: dict, pl: dict, parts: dict[str, str], size=(300, 330), centre_x=150, shield_sword=True) -> Image.Image:
    """Layer pieces from different sets. parts maps slot -> set id (missing slots are left out)."""
    im = Image.new('RGBA', size, (0, 0, 0, 0))
    for slot in DRAW_ORDER:
        sid = parts.get(slot)
        if not sid:
            continue
        p = load(m, slot, sid)
        pos = pl['slots'][slot]
        sc = pos.get('scale', 1)
        if sc != 1:
            p = p.resize((round(p.width * sc), round(p.height * sc)), Image.LANCZOS)
        if pos.get('rotate'):
            p = p.rotate(pos['rotate'], expand=True)
        half = m['slots'][slot]['anchor'][0] * sc
        im.alpha_composite(p, (round(centre_x - half + pos.get('dx', 0)), pos['y'] + 20))
    return im


def on_checker(im: Image.Image, scale: int = 1) -> Image.Image:
    bg = checker(im.width, im.height).convert('RGBA')
    bg.alpha_composite(im)
    return bg.resize((bg.width * scale, bg.height * scale), Image.NEAREST) if scale != 1 else bg


def contact_sheets(m: dict) -> None:
    for slot in SLOTS + ['figure']:
        items = [i for i in m['items'] if i['slot'] == slot]
        w, h = items[0]['canvas']
        cols = 11
        sheet = Image.new('RGBA', (cols * (w + 8) + 8, h + 28), (0, 0, 0, 0))
        base = checker(sheet.width, sheet.height).convert('RGBA')
        d = ImageDraw.Draw(base)
        for k, it in enumerate(items):
            x = 8 + k * (w + 8)
            im = Image.open(os.path.join(HERE, it['file'])).convert('RGBA')
            base.alpha_composite(im, (x, 20))
            d.rectangle([x - 1, 19, x + w, 20 + h], outline=(255, 0, 255))
            d.text((x, 4), it['set'][:14], fill=(0, 0, 0))
        base.save(os.path.join(OUT, f'contact-{slot}.png'))
    print('wrote contact-<slot>.png')


def before_after(m: dict) -> None:
    src = Image.open(os.path.join(HERE, m['source'])).convert('RGB')
    rows = []
    picks = [('helmet', 'silver-vanguard'), ('chest', 'sulestial'), ('legs', 'golden-paladin'), ('cape', 'iron-bulwark'), ('shield', 'frostborn'), ('sword', 'knights-oath')]
    Z = 4
    tiles = []
    for slot, sid in picks:
        it = next(i for i in m['items'] if i['slot'] == slot and i['set'] == sid)
        x0, y0, x1, y1 = it['source_crop']
        before = src.crop((x0, y0, x1, y1)).resize(((x1 - x0) * Z, (y1 - y0) * Z), Image.NEAREST)
        after = Image.open(os.path.join(HERE, it['file'])).convert('RGBA')
        after_big = after.resize((after.width * Z, after.height * Z), Image.NEAREST)
        dark = Image.new('RGBA', after_big.size, (255, 0, 255, 255))  # a harsh colour, so any halo or fringe shows
        dark.alpha_composite(after_big)
        tiles.append((slot + ' / ' + sid, before, dark))
    W = max(t[1].width for t in tiles) * 2 + 30
    Hh = sum(max(t[1].height, t[2].height) + 18 for t in tiles)
    # lay out in two columns of three tiles to keep the image a sensible shape
    colw = max(t[1].width + t[2].width for t in tiles) + 30
    rowh = max(t[1].height for t in tiles) + 24
    sheet = Image.new('RGB', (colw * 2, rowh * 3), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    for k, (label, b, a) in enumerate(tiles):
        cx0, cy0 = (k % 2) * colw, (k // 2) * rowh
        d.text((cx0 + 4, cy0 + 4), f'{label}   before (sheet)  |  after (on magenta)', fill=(0, 0, 0))
        sheet.paste(b, (cx0 + 4, cy0 + 20))
        sheet.paste(a.convert('RGB'), (cx0 + 14 + b.width, cy0 + 20))
    sheet.save(os.path.join(OUT, 'before-after.png'))
    print('wrote before-after.png')


def assembled_previews(m: dict, pl: dict) -> None:
    ids = [s['id'] for s in m['sets']]
    # 1) every set assembled, next to its own reference figure from the sheet
    cell_w, cell_h = 300, 330
    sheet = Image.new('RGBA', (cell_w * 6, cell_h * 4), (0, 0, 0, 0))
    for k, sid in enumerate(ids):
        parts = {slot: sid for slot in SLOTS}
        a = assemble(m, pl, parts)
        ref = load(m, 'figure', sid)
        s = pl['figure_scale']
        refs = ref.resize((round(ref.width / s), round(ref.height / s)), Image.LANCZOS)
        f = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        f.alpha_composite(refs, (150 - refs.width // 2, 20))
        for j, im in enumerate((a, f)):
            idx = k * 2 + j
            sheet.alpha_composite(im, ((idx % 6) * cell_w, (idx // 6) * cell_h))
    on_checker(sheet).convert('RGB').save(os.path.join(OUT, 'assembled-vs-reference.png'))
    # 2) mix and match: different sets for different slots
    import random

    rng = random.Random(7)
    mix = Image.new('RGBA', (cell_w * 6, cell_h * 2), (0, 0, 0, 0))
    for k in range(12):
        parts = {slot: rng.choice(ids) for slot in SLOTS}
        mix.alpha_composite(assemble(m, pl, parts), ((k % 6) * cell_w, (k // 6) * cell_h))
    on_checker(mix).convert('RGB').save(os.path.join(OUT, 'assembled-mixed.png'))
    # 3) overlay of assembled over the reference (50%) for each set, to see misalignment
    ov = Image.new('RGBA', (cell_w * 6, cell_h * 2), (0, 0, 0, 0))
    for k, sid in enumerate(ids[:12]):
        parts = {slot: sid for slot in ('legs', 'chest', 'belt', 'helmet')}
        a = assemble(m, pl, parts)
        ref = load(m, 'figure', sid)
        s = pl['figure_scale']
        refs = ref.resize((round(ref.width / s), round(ref.height / s)), Image.LANCZOS)
        f = Image.new('RGBA', (cell_w, cell_h), (0, 0, 0, 0))
        f.alpha_composite(refs, (150 - refs.width // 2, 20))
        r, g, b, al = f.split()
        f.putalpha(al.point(lambda v: v // 2))
        base = Image.new('RGBA', (cell_w, cell_h), (240, 240, 240, 255))
        base.alpha_composite(f)
        base.alpha_composite(a)
        if k < 12:
            ov.alpha_composite(base, ((k % 6) * cell_w, (k // 6) * cell_h))
    ov.convert('RGB').save(os.path.join(OUT, 'assembled-overlay.png'))
    print('wrote assembled-*.png')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    m = manifest()
    pl = placement()
    contact_sheets(m)
    before_after(m)
    assembled_previews(m, pl)
