"""Turn the painted armor and backgrounds into pixel art (v1.75.0, owner-requested).

Reads the painted originals kept in design/pixel/painted/ (a copy of public/armor and public/scenes as they were in v1.74.3) and
writes public/armor (at twice the size, same proportions) and public/scenes, so nothing about placement changes: each picture is cut into CELL x CELL
blocks on one shared grid (the grid is lined up with the knight's own coordinates, so the pieces' pixels meet cleanly), each block
gets one colour from a small palette, and the silhouette gets a dark outline.

  python3 design/pixel/pixelate.py            # writes public/
  python3 design/pixel/pixelate.py --preview  # also writes design/pixel/preview.png
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/pixel/painted'
UP = 2            # the painted pieces are small, so they are enlarged first (files are written at UP times the size)
CELL = 3          # one art pixel = 3 x 3 of the enlarged pixels, i.e. 1.5 painted pixels: four times the detail of the first try
COLOURS = 22      # palette per armor piece
SCENE_CELL, SCENE_COLOURS = 2, 44
OUTLINE = (34, 30, 38, 255)

def pixelate(im: Image.Image, cell: int, colours: int, ox: int = 0, oy: int = 0, outline: bool = True) -> Image.Image:
    im = im.convert('RGBA')
    w, h = im.size
    # pad so the block grid starts at a multiple of `cell` in the knight's coordinates
    px, py = ox % cell, oy % cell
    W, H = -(-(w + px) // cell), -(-(h + py) // cell)
    big = Image.new('RGBA', (W * cell, H * cell), (0, 0, 0, 0))
    big.paste(im, (px, py))
    # average each block, weighting colour by alpha so see-through edges do not darken it
    pm = big.convert('RGBa').resize((W, H), Image.BOX).convert('RGBA')
    alpha = pm.getchannel('A').point(lambda a: 255 if a >= 110 else 0)
    rgb = pm.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    small = Image.merge('RGBA', (*rgb.split(), alpha))
    if outline:
        a = alpha.load(); s = small.load()
        edge = []
        for y in range(H):
            for x in range(W):
                if a[x, y] and any(not (0 <= x + dx < W and 0 <= y + dy < H) or not a[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge.append((x, y))
        for x, y in edge:
            r, g, b, _ = s[x, y]
            s[x, y] = tuple(int(c * 0.38 + o * 0.62) for c, o in zip((r, g, b), OUTLINE[:3])) + (255,)
    out = small.resize((W * cell, H * cell), Image.NEAREST).crop((px, py, px + w, py + h))
    return out

def main():
    layout = json.loads((ROOT / 'src/ui/armorLayout.json').read_text())
    by_dir = {s['dir']: s for s in layout['slots'].values()}
    n = 0
    for f in sorted((SRC / 'armor').glob('*/*.webp')):
        at = by_dir.get(f.parent.name, {'x': 0, 'y': 0})
        im = Image.open(f).convert('RGBA')
        im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS)
        out = pixelate(im, CELL, COLOURS, int(at['x']) * UP, int(at['y']) * UP)
        dst = ROOT / 'public/armor' / f.parent.name / f.name
        out.save(dst, 'WEBP', lossless=True, method=6)
        n += 1
    for f in sorted((SRC / 'scenes').glob('*.webp')):
        out = pixelate(Image.open(f), SCENE_CELL, SCENE_COLOURS, outline=False).convert('RGB')
        out.save(ROOT / 'public/scenes' / f.name, 'WEBP', lossless=True, method=6)
        n += 1
    print('wrote', n, 'pictures')

if __name__ == '__main__':
    main()
