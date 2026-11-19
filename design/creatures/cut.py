"""Cut the owner's creature sheet (design/creatures/sheet.webp, v1.80.0) into the games' sprites.

Every animation becomes one horizontal strip (public/creatures/<name>.webp): its frames on one shared canvas, lined up on the
feet (bottom) and the body's middle (the centre of mass), so the sprite stays put while it moves. src/ui/games/creatures.json
records each strip's frame size and count for the page. Pieces (gate, burrow, cliff, river, icons) are single-frame strips.

  python3 design/creatures/cut.py            # writes public/creatures and src/ui/games/creatures.json
  python3 design/creatures/cut.py --preview  # also writes design/creatures/preview.png
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SHEET = np.asarray(Image.open(ROOT / 'design/creatures/sheet.webp').convert('RGBA')).copy()
A = SHEET[..., 3]
LAB, N = ndimage.label(A > 20)
OBJS = ndimage.find_objects(LAB)

# frame boxes on the sheet (x0, y0, x1, y1): a frame is every blob whose middle lies in its box
G = [(25, 20, 170, 180), (180, 20, 312, 180), (318, 20, 441, 180), (442, 20, 600, 180), (605, 20, 720, 180),
     (725, 20, 890, 180), (891, 20, 1058, 180), (1060, 20, 1210, 180), (1212, 20, 1360, 180), (1362, 20, 1490, 180)]
B = [(15, 185, 190, 325), (192, 185, 375, 325), (377, 185, 558, 325), (560, 185, 730, 325), (731, 185, 890, 325),
     (891, 185, 1040, 325), (1042, 185, 1200, 325), (1202, 185, 1385, 325)]
D = [(12, 330, 205, 545), (206, 330, 403, 545), (404, 330, 610, 545), (611, 330, 805, 545), 'd5', 'd6', (1170, 330, 1338, 545), (1339, 330, 1495, 545)]
BOX = {
    'fire': [(40, 550, 195, 650), (205, 550, 345, 650), (355, 550, 500, 650)],
    'spark': [(555, 545, 650, 650), (655, 545, 720, 650), (735, 545, 840, 650)],
    'smoke': [(880, 545, 990, 655), (1010, 545, 1120, 655), (1140, 545, 1250, 655), (1265, 545, 1385, 655)],
    'gate': [(4, 648, 266, 880)], 'gate-broken': [(268, 648, 512, 880)],
    'mound': [(515, 784, 740, 870)], 'cliff': [(1020, 645, 1245, 885)], 'river': [(1246, 735, 1495, 885)],
    'heart': [(30, 885, 115, 980)], 'heart-empty': [(135, 885, 220, 980)], 'star': [(270, 885, 355, 980)], 'star-empty': [(370, 885, 455, 980)],
    'shield': [(500, 885, 570, 980)], 'tower': [(595, 885, 665, 980)], 'flame': [(695, 885, 765, 980)],
}


def frame(box, flip=False):
    """The frame in `box` as an RGBA image cropped to its pixels."""
    if box in ('d5', 'd6'):
        return dragon_pair(box)
    x0, y0, x1, y1 = box
    keep = np.zeros_like(A, bool)
    for i, o in enumerate(OBJS, 1):
        cy, cx = (o[0].start + o[0].stop) / 2, (o[1].start + o[1].stop) / 2
        if x0 <= cx < x1 and y0 <= cy < y1:
            keep |= LAB == i
    return crop(keep, flip)


def dragon_pair(which):
    """Frames 5 and 6 touch (6's fire reaches 5's wing): split them at x = 972, giving the bright fire to frame 6."""
    blob = LAB == LAB[440, 1000]
    r, g, b = (SHEET[..., i].astype(int) for i in range(3))
    xs = np.arange(A.shape[1])[None, :]
    fire = (b < 35) & (r > 150)
    zone = (xs >= 952) & (xs < 995)
    mine = (xs < 972) & ~(zone & fire) if which == 'd5' else ((xs >= 972) | (zone & fire))
    lab, n = ndimage.label(blob & mine)
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    return crop(lab == 1 + int(np.argmax(sizes)), False)  # only the dragon itself, not a sliver of its neighbour


def crop(mask, flip):
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    px = SHEET[y0:y1, x0:x1].copy()
    a = np.where(mask[y0:y1, x0:x1], px[..., 3], 0)
    a = np.where(a < 48, 0, np.where(a > 200, 255, a))  # firm up the soft edge, drop the faint halo
    px[..., 3] = a
    im = Image.fromarray(px, 'RGBA')
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im


def strip(frames):
    """Frames on one canvas each, lined up on the bottom and the centre of mass."""
    cms = []
    for f in frames:
        a = np.asarray(f)[..., 3].astype(float)
        cms.append((a.sum(0) * np.arange(f.width)).sum() / a.sum())
    left = max(cms)
    right = max(f.width - c for f, c in zip(frames, cms))
    w, h = int(np.ceil(left + right)), max(f.height for f in frames)
    out = Image.new('RGBA', (w * len(frames), h), (0, 0, 0, 0))
    for i, (f, c) in enumerate(zip(frames, cms)):
        out.alpha_composite(f, (i * w + int(round(left - c)), h - f.height))
    return out, w, h


ANIMS = {
    # name: frames (goblins are drawn facing right; the game wants them facing left, toward the knight)
    'goblin-walk': [frame(G[i], True) for i in (0, 1, 2, 1)],
    'goblin-raise': [frame(G[4], True)],
    'goblin-swing': [frame(G[5], True), frame(G[6], True)],
    'goblin-down': [frame(G[7], True), frame(G[8], True), frame(G[9], True)],
    'burrow-pop': [frame(B[i]) for i in (0, 1, 2, 3)],
    'burrow-bonk': [frame(B[5]), frame(B[6])],
    'burrow-escape': [frame(B[7]), frame(B[0])],
    'dragon-idle': [frame(D[i]) for i in (0, 1, 2, 3)],
    'dragon-charge': [frame(D[4])],
    'dragon-breath': [frame(D[5])],
    'dragon-hurt': [frame(D[6])],
    'dragon-sleep': [frame(D[7])],
}
ANIMS.update({name: [frame(b) for b in boxes] for name, boxes in BOX.items()})


def near_cliff(cliff):
    """The sheet has one cliff, with the far tower on it: the near side is the same cliff turned round, the tower taken off
    (everything above a line drawn across the grass where the tower stood)."""
    px = np.asarray(cliff).copy()
    a = px[..., 3]
    top = lambda x: int(np.argmax(a[:, x] > 0))
    x0, x1 = 116, 176
    t0, t1 = top(x0), top(x1)
    for x in range(x0 + 1, x1):
        line = t0 + (t1 - t0) * (x - x0) / (x1 - x0)
        px[: int(line) + 2, x, 3] = 0
    # the tower's foot is still standing in the grass: paint grass over it, copied from the plateau to its left
    rgb = px[..., :3].astype(int)
    grey = (rgb.max(-1) - rgb.min(-1) < 28) & (rgb.max(-1) > 40)
    for x in range(x0 - 2, x1 + 2):
        for y in range(0, 96):
            if px[y, x, 3] and (grey[y, x] or rgb[y, x].max() < 40) and px[y, x - 58, 3]:
                px[y, x] = px[y, x - 58]
    return Image.fromarray(px, 'RGBA').transpose(Image.FLIP_LEFT_RIGHT)


ANIMS['cliff-near'] = [near_cliff(ANIMS['cliff'][0])]


def grass_tile(size=48, seed=3):
    """A seamless tile of meadow grass for Goblin Burrows (v1.81.0, owner-requested "add grass texture"): the field's green with
    short blades in a darker and two lighter greens, and a few seed heads, drawn wrapping round the edges so it repeats cleanly.
    Pixel art: one pixel a cell, shown at 2x with crisp pixels."""
    rng = np.random.default_rng(seed)
    base = np.array([108, 140, 61])
    px = np.tile(base, (size, size, 1)).astype(int)
    px += rng.integers(-6, 7, (size, size, 1))  # a little unevenness in the ground colour
    shades = [(77, 106, 43), (88, 120, 50), (143, 176, 79), (128, 160, 70)]
    for _ in range(int(size * size * 0.09)):
        x, y = rng.integers(0, size, 2)
        h = int(rng.integers(2, 5))
        lean = int(rng.choice([-1, 0, 0, 1]))
        dark = shades[int(rng.integers(0, 2))]
        light = shades[int(rng.integers(2, 4))]
        for k in range(h):
            xx, yy = (x + (lean if k >= h - 1 else 0)) % size, (y - k) % size
            px[yy, xx] = light if k >= h - 2 else dark  # the tip catches the light
    for _ in range(int(size * size * 0.004)):
        x, y = rng.integers(0, size, 2)
        px[y % size, x % size] = (226, 214, 150)  # a seed head
    rgba = np.dstack([px.clip(0, 255), np.full((size, size), 255)]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


ANIMS['grass'] = [grass_tile()]


def main():
    out = ROOT / 'public/creatures'
    out.mkdir(exist_ok=True)
    for old in out.glob('*.webp'):
        old.unlink()
    meta = {}
    sheets = []
    for name, frames in ANIMS.items():
        im, w, h = strip(frames)
        if name == 'grass':
            im.save(out / f'{name}.webp', 'WEBP', lossless=True, method=6)  # pixel art: crisp
        else:
            im.save(out / f'{name}.webp', 'WEBP', quality=88, alpha_quality=100, method=6)  # soft painted art: lossy is a quarter the size and looks the same
        meta[name] = {'w': w, 'h': h, 'n': len(frames)}
        sheets.append(im)
    (ROOT / 'src/ui/games/creatures.json').write_text(json.dumps(meta, indent=1) + '\n')
    print(len(meta), 'strips')
    if '--preview' in sys.argv:
        W = max(s.width for s in sheets)
        H = sum(s.height + 8 for s in sheets)
        prev = Image.new('RGBA', (W, H), (243, 239, 228, 255))
        y = 0
        for s in sheets:
            prev.alpha_composite(s, (0, y)); y += s.height + 8
        prev.save(ROOT / 'design/creatures/preview.png')


if __name__ == '__main__':
    main()
