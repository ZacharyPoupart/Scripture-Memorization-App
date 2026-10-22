"""Writes what the app serves, from the extracted PNGs (called by `extract.py --runtime`).

  public/armor/<slot>/<set-id>.webp   lossless WebP copies of assets/<slot>/<set-id>.png (same pixels, a bit smaller)
  src/ui/armorSizes.json              item id -> [width, height] (the accessories from the older sheet are kept)
  src/ui/armorLayout.json             where each slot sits on the knight (from placement.json) and the sets
"""
from __future__ import annotations

import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
PUBLIC = os.path.join(ROOT, 'public', 'armor')
SIZES = os.path.join(ROOT, 'src', 'ui', 'armorSizes.json')
LAYOUT = os.path.join(ROOT, 'src', 'ui', 'armorLayout.json')

# the sheet's slot names -> the app's item prefixes (the app calls the leg armor "boots" and the sword "weapon")
ITEM_PREFIX = {'helmet': 'helmet', 'chest': 'chest', 'legs': 'boots', 'belt': 'belt', 'cape': 'cape', 'sword': 'weapon', 'shield': 'shield'}


def run(manifest: dict) -> None:
    sizes: dict[str, list[int]] = {}
    total = 0
    for it in manifest['items']:
        if it['slot'] == 'figure':
            continue
        out_dir = os.path.join(PUBLIC, it['slot'])
        os.makedirs(out_dir, exist_ok=True)
        im = Image.open(os.path.join(HERE, it['file'])).convert('RGBA')
        path = os.path.join(out_dir, f"{it['set']}.webp")
        im.save(path, 'WEBP', lossless=True, quality=100, method=6)
        total += os.path.getsize(path)
        sizes[f"{ITEM_PREFIX[it['slot']]}-{it['set']}"] = [im.width, im.height]
    json.dump(sizes, open(SIZES, 'w'), indent=1, sort_keys=True)
    pl = json.load(open(os.path.join(HERE, 'placement.json')))
    layout = {'frame': {}, 'sets': [{'id': s['id'], 'name': s['name']} for s in manifest['sets']], 'slots': {}}
    for slot, pos in pl['slots'].items():
        w, h = manifest['slots'][slot]['canvas']
        half = manifest['slots'][slot]['anchor'][0]
        sc = pos.get('scale', 1)
        entry = {'prefix': ITEM_PREFIX[slot], 'dir': slot, 'w': round(w * sc, 2), 'h': round(h * sc, 2), 'x': round(pos.get('dx', 0) - half * sc, 2), 'y': pos['y']}
        if pos.get('rotate'):
            entry['rotate'] = pos['rotate']
        if pos.get('tilt'):
            # turn around the hand: the grip sits grip_from_pommel pixels from the pommel end, which is the bottom once the sword is turned over
            entry['tilt'] = pos['tilt']
            entry['pivot'] = [round(pos.get('dx', 0), 2), round(pos['y'] + h * sc - pos['grip_from_pommel'] * sc, 2)]
        layout['slots'][slot] = entry
    # the knight's own height: from the top of the helmet to the soles of the boots (the sword and shield may hang lower or higher)
    top = layout['slots']['helmet']['y']
    bottom = layout['slots']['legs']['y'] + layout['slots']['legs']['h']
    layout['frame'] = {'top': top, 'height': round(bottom - top, 2)}
    json.dump(layout, open(LAYOUT, 'w'), indent=1)
    print(f'wrote {len(manifest["items"]) - 11} WebP files ({total // 1024} KB), armorSizes.json, armorLayout.json')
