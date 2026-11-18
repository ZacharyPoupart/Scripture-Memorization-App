"""Paint the games' goblins and dragon in the knight's style (v1.80.0, owner-requested: "make the goblins and dragon match the knight's pixel art").

The knight is a shaded painting turned into pixel art by pixelate.py. The creatures are made the same way, from shapes instead of a
painting: each part is filled and lit from the top left (a rounded part like a ball, a flat part with a soft ramp), drawn at a
large size, then shrunk to the art grid, cut down to a small palette and given the same dark outline. Frames:

  goblin-a / goblin-b   marching, facing left (legs and arms swap)
  goblin-up             facing out of a burrow, both hands up (the page draws the word's sign over them)
  goblin-bonk           squashed, eyes shut
  dragon-up / dragon-down  facing left, wings up and down

  python3 design/pixel/creatures.py            # writes public/creatures/*.webp
  python3 design/pixel/creatures.py --preview  # also writes design/pixel/creatures-preview.png
"""
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).parent))
from pixelate import OUTLINE  # noqa: E402

SS = int(__import__('os').environ.get('CREATURE_SS', 8))  # painted at SS x the art grid, then shrunk
LIGHT = np.array([-0.55, -0.65, 0.52])
LIGHT = LIGHT / np.linalg.norm(LIGHT)

def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], float)

# the games' palette (sprites.tsx INK), with a light and a dark for each
SKIN, SKIN_D = hexrgb('#4f9d5f'), hexrgb('#2c6a43')
LEATHER = hexrgb('#7a5230')
LEATHER_D = hexrgb('#553620')
WOOD = hexrgb('#8a5d33')
IRON = hexrgb('#a9a394')
BONE = hexrgb('#f4efe2')
GOLD = hexrgb('#e8c66a')
RED = hexrgb('#c8463c')
EMBER = hexrgb('#e2792f')
INKC = hexrgb('#221e26')
SCALE, SCALE_D = hexrgb('#3f8f5b'), hexrgb('#24563a')
WING, WING_D = hexrgb('#2c6a43'), hexrgb('#1c4630')


class Canvas:
    """Drawn in design units (w x h); the art grid is k art pixels a unit."""
    def __init__(self, w, h, k):
        self.w, self.h = round(w * k), round(h * k)
        self.f = SS * k
        self.W, self.H = self.w * SS, self.h * SS
        self.rgb = np.zeros((self.H, self.W, 3), float)
        self.a = np.zeros((self.H, self.W), float)
        ys, xs = np.mgrid[0:self.H, 0:self.W]
        self.X = (xs + 0.5) / self.f
        self.Y = (ys + 0.5) / self.f
        # grain: one random shade per art pixel, a little either way
        rng = np.random.default_rng(7)
        g = rng.normal(1, 0.045, (self.h, self.w)).clip(0.88, 1.12)
        self.grain = np.repeat(np.repeat(g, SS, 0), SS, 1)
        self.edge_px = 2 * SS + 1

    def put(self, mask, col, edge=True):
        """Lay a part down. Like the knight's painted pieces, each part gets a thin dark edge where it meets what is behind it,
        and a little painterly grain (one shade a pixel), so the pixelated result reads as painted rather than rendered."""
        if col.ndim == 1:
            col = np.broadcast_to(col, self.rgb.shape)
        col = col * self.grain[..., None]
        if edge and mask.any():
            img = Image.fromarray((mask * 255).astype(np.uint8))
            inner = np.asarray(img.filter(ImageFilter.MinFilter(self.edge_px))) > 127
            rim = mask & ~inner
            col = np.where(rim[..., None], col * 0.42 + INKC * 0.45, col)
        m = mask.astype(float)
        self.rgb = self.rgb * (1 - m[..., None]) + col * m[..., None]
        self.a = np.maximum(self.a, m)

    def blob(self, cx, cy, rx, ry, base, dark=None, rot=0.0, glint=0.35, clip=None):
        """A lit ellipse (a ball seen from the front): lambert shading from the top left, a darker colour in the shadow."""
        c, s = math.cos(rot), math.sin(rot)
        dx, dy = self.X - cx, self.Y - cy
        u = (dx * c + dy * s) / rx
        v = (-dx * s + dy * c) / ry
        r2 = u * u + v * v
        mask = r2 <= 1
        if clip is not None:
            mask &= clip
        nz = np.sqrt(np.clip(1 - r2, 0, 1))
        # back to screen space for the normal
        nx = u * c - v * s
        ny = u * s + v * c
        lam = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
        self.put(mask, shade(base, dark, lam, glint))
        return mask

    def poly(self, pts, base, dark=None, glint=0.2, flat=False):
        """A flat part: lit by how far along the light it lies (top left light, bottom right dark)."""
        img = Image.new('L', (self.W, self.H), 0)
        ImageDraw.Draw(img).polygon([(x * self.f, y * self.f) for x, y in pts], fill=255)
        mask = np.asarray(img) > 127
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        t = -((self.X - x0) / max(1e-6, x1 - x0) - 0.5) * 0.6 - ((self.Y - y0) / max(1e-6, y1 - y0) - 0.5) * 0.9
        lam = np.clip(0.55 + t, 0, 1) if not flat else np.full_like(self.X, 0.6)
        self.put(mask, shade(base, dark, lam, glint))
        return mask

    def limb(self, pts, width, base, dark=None, glint=0.25):
        """A rounded tube along a path (arms, legs, tails, horns): lit across its width."""
        out = np.zeros_like(self.a, bool)
        for (x0, y0, w0), (x1, y1, w1) in zip(pts, pts[1:]):
            dx, dy = x1 - x0, y1 - y0
            L2 = dx * dx + dy * dy or 1e-6
            t = np.clip(((self.X - x0) * dx + (self.Y - y0) * dy) / L2, 0, 1)
            px, py = x0 + t * dx, y0 + t * dy
            r = (w0 + (w1 - w0) * t) * width / 2
            ex, ey = self.X - px, self.Y - py
            d = np.sqrt(ex * ex + ey * ey)
            m = d <= r
            nx, ny = ex / np.maximum(r, 1e-6), ey / np.maximum(r, 1e-6)
            nz = np.sqrt(np.clip(1 - nx * nx - ny * ny, 0, 1))
            lam = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
            m &= ~out
            self.put(m, shade(base, dark, lam, glint))
            out |= m
        return out

    def ink(self, pts, width, col=INKC):
        img = Image.new('L', (self.W, self.H), 0)
        ImageDraw.Draw(img).line([(x * self.f, y * self.f) for x, y in pts], fill=255, width=max(1, int(width * self.f)), joint='curve')
        self.put(np.asarray(img) > 127, col, edge=False)

    def dot(self, cx, cy, r, col):
        self.put((self.X - cx) ** 2 + (self.Y - cy) ** 2 <= r * r, col, edge=False)

    def image(self, colours=32):
        rgba = np.dstack([self.rgb * self.a[..., None], self.a * 255]).clip(0, 255).astype(np.uint8)
        big = Image.fromarray(rgba, 'RGBa').convert('RGBA')
        return finish(big, self.w, self.h, colours)


def shade(base, dark, lam, glint):
    dark = base * 0.45 + INKC * 0.2 if dark is None else dark
    dark = dark * 0.8 + INKC * 0.2
    lam = lam[..., None]
    t = np.clip(lam * 1.3, 0, 1)
    col = dark + (base * 1.08 - dark) * (t * t * (3 - 2 * t))  # a firmer turn from light to shadow
    hi = np.clip((lam - 0.74) / 0.2, 0, 1) * (glint + 0.15)
    return np.clip(col + (255 - col) * hi * 0.7, 0, 255)


def finish(big, w, h, colours):
    """The knight's pixel step (pixelate.py): average each block, cut the edge by alpha, a small palette, a dark outline."""
    pm = big.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')
    alpha = pm.getchannel('A').point(lambda a: 255 if a >= 110 else 0)
    rgb = pm.convert('RGB').quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    small = Image.merge('RGBA', (*rgb.split(), alpha))
    a = alpha.load(); s = small.load()
    edge = [(x, y) for y in range(h) for x in range(w)
            if a[x, y] and any(not (0 <= x + dx < w and 0 <= y + dy < h) or not a[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        r, g, b, _ = s[x, y]
        s[x, y] = tuple(int(c * 0.38 + o * 0.62) for c, o in zip((r, g, b), OUTLINE[:3])) + (255,)
    return small


# ---------------------------------------------------------------- the goblin (design units: 48 x 56, feet on y = 55)

def goblin_head(c, cx, cy, look=-1, shut=False, squash=1.0):
    """The head, ears, cap and face. look = -1 faces left (three quarters), 0 faces out."""
    ry = 9.5 * squash
    # ears: long and pointed, behind the head
    if look:
        c.poly([(cx + 7, cy - 3), (cx + 22, cy - 11), (cx + 9, cy + 3)], SKIN, SKIN_D)
        c.poly([(cx + 11, cy - 4), (cx + 19, cy - 9), (cx + 11, cy)], SKIN_D * 0.9, flat=True)
        c.poly([(cx - 6, cy - 3), (cx - 19, cy - 10), (cx - 7, cy + 2)], SKIN, SKIN_D)
    else:
        for sx in (-1, 1):
            c.poly([(cx + sx * 7, cy - 3), (cx + sx * 21, cy - 9), (cx + sx * 8, cy + 3)], SKIN, SKIN_D)
            c.poly([(cx + sx * 10, cy - 3), (cx + sx * 18, cy - 7), (cx + sx * 10, cy + 1)], SKIN_D * 0.9, flat=True)
    c.blob(cx, cy, 10, ry, SKIN, SKIN_D)
    # a dented iron cap
    cap = c.blob(cx + 0.5, cy - 2.5 * squash, 10.6, 8.6 * squash, IRON * 0.82, IRON * 0.32, glint=0.5, clip=c.Y < cy - 3.2 * squash)
    c.limb([(cx - 10.5, cy - 3.4 * squash, 1), (cx + 11, cy - 3.4 * squash, 1)], 1.8, IRON * 0.8, IRON * 0.4)
    c.dot(cx + 0.5, cy - 9.5 * squash, 1.3, IRON * 0.55)
    fx = cx + look * 4.5
    ey = cy + 0.5 * squash
    if shut:
        c.ink([(fx - 6, ey), (fx - 2.5, ey + 1.2)], 1.1)
        c.ink([(fx + 1.5, ey + 1.2), (fx + 5, ey)], 1.1)
    else:
        for ex, r in ((fx - 3.6, 2.1 if look else 2.4), (fx + 3.6, 2.5 if look else 2.4)):
            c.blob(ex, ey, r, r * 0.9, GOLD, GOLD * 0.6, glint=0.6)
            c.dot(ex + look * 0.6, ey + 0.3, r * 0.42, RED * 0.7)
        # cross brows
        c.ink([(fx - 6.2, ey - 3.6), (fx - 1.6, ey - 2.2)], 1.1)
        c.ink([(fx + 1.6, ey - 2.2), (fx + 6.2, ey - 3.6)], 1.1)
    # nose: long and hooked, pointing the way it looks
    if look:
        c.blob(fx - 6.8, cy + 4.2, 4.2, 2.6, SKIN * 1.12, SKIN_D * 0.8, rot=0.4, glint=0.5)
        c.ink([(fx - 9.5, cy + 6.2), (fx - 4.5, cy + 6.6)], 0.7, SKIN_D * 0.6)
    else:
        c.blob(fx, cy + 4, 2.4, 3.0, SKIN * 1.12, SKIN_D * 0.8, glint=0.5)
    # grin and fangs
    my = cy + 7 * squash
    c.ink([(fx - 4.5, my - 0.4), (fx - 1, my + 0.6), (fx + 3.5, my - 0.2)], 1.0)
    c.poly([(fx - 3.4, my), (fx - 2.2, my), (fx - 2.8, my + 2.0)], BONE, flat=True)
    c.poly([(fx + 1.6, my + 0.2), (fx + 2.8, my), (fx + 2.2, my + 2.0)], BONE, flat=True)


def club(c, hx, hy, tx, ty):
    c.limb([(hx + (hx - tx) * 0.12, hy + (hy - ty) * 0.12, 0.7), (hx, hy, 0.8), (tx, ty, 1.5)], 3.4, WOOD, WOOD * 0.45, glint=0.3)
    for t in (0.6, 0.78, 0.92):
        c.dot(hx + (tx - hx) * t + 0.9, hy + (ty - hy) * t - 0.4, 0.75, IRON)


def goblin_march(c, step):
    bob = -1.2 if step else 0
    # far leg and arm first (darker), then the body, then the near ones
    far = (31, 53) if step == 0 else (17, 53)
    near = (16, 53) if step == 0 else (30, 53)
    def leg(hip, foot, dim):
        k = 0.72 if dim else 1
        kx = (hip[0] + foot[0]) / 2 - 2
        c.limb([(hip[0], hip[1], 1), (kx, 46.5 + bob * 0.5, 0.85), (foot[0], foot[1] - 1.2, 0.8)], 4.6, SKIN * k, SKIN_D * k)
        c.blob(foot[0] - 1.4, foot[1] - 0.6, 3.8, 2.0, LEATHER * k, LEATHER_D * k)
    leg((26, 41 + bob), far, True)
    arm_far = [(27, 29 + bob, 1), (31 if step == 0 else 22, 35 + bob, 0.9), (33 if step == 0 else 19, 39 + bob, 0.8)]
    c.limb(arm_far, 3.6, SKIN * 0.72, SKIN_D * 0.72)
    # body: a rough leather tunic with a belt
    c.poly([(16, 27 + bob), (31, 27 + bob), (34, 43 + bob), (31, 41.5 + bob), (28, 44 + bob), (24, 41.8 + bob), (20, 44 + bob), (16.5, 41.5 + bob), (13.5, 43 + bob)], LEATHER, LEATHER_D)
    c.blob(23.5, 31 + bob, 7.6, 5.5, LEATHER, LEATHER_D, glint=0.15, clip=c.Y < 35 + bob)
    c.poly([(14.5, 36.2 + bob), (33, 36.2 + bob), (33.4, 38.6 + bob), (14.2, 38.6 + bob)], LEATHER_D, LEATHER_D * 0.6)
    c.poly([(19, 35.6 + bob), (22.4, 35.6 + bob), (22.4, 39.2 + bob), (19, 39.2 + bob)], GOLD, GOLD * 0.55, glint=0.6)
    c.ink([(23, 29 + bob), (24.5, 34 + bob)], 0.6, LEATHER_D * 0.7)
    leg((21, 41 + bob), near, False)
    # near arm holds the club over its shoulder, swinging a little with the step
    hx, hy = (15, 33 + bob) if step == 0 else (16.5, 34.5 + bob)
    c.limb([(21, 29 + bob, 1), (17.5, 33.5 + bob, 0.9), (hx, hy, 0.85)], 4.0, SKIN, SKIN_D)
    goblin_head(c, 21, 17.5 + bob)
    club(c, hx, hy, hx - 3 - step, hy - 17)
    c.blob(hx, hy, 2.3, 2.1, SKIN, SKIN_D)


def goblin_up(c):
    """Out of a burrow, facing out, both hands up to hold the word's sign."""
    cx = 24
    for sx in (-1, 1):
        c.limb([(cx + sx * 7, 33, 1), (cx + sx * 15, 27, 0.9), (cx + sx * 16, 15, 0.85)], 4.0, SKIN, SKIN_D)
        c.blob(cx + sx * 16, 13.5, 2.5, 2.4, SKIN, SKIN_D)
        for f in (-1, 0, 1):
            c.limb([(cx + sx * 16 + f * 1.3, 12, 1), (cx + sx * 16 + f * 1.6, 9.8, 0.8)], 1.3, SKIN, SKIN_D)
    c.poly([(cx - 9, 30), (cx + 9, 30), (cx + 11, 48), (cx - 11, 48)], LEATHER, LEATHER_D)
    c.blob(cx, 34, 9, 5.5, LEATHER, LEATHER_D, glint=0.15, clip=c.Y < 38)
    c.poly([(cx - 10.5, 40), (cx + 10.5, 40), (cx + 10.8, 42.5), (cx - 10.8, 42.5)], LEATHER_D, LEATHER_D * 0.6)
    c.poly([(cx - 1.8, 39.4), (cx + 1.8, 39.4), (cx + 1.8, 43.2), (cx - 1.8, 43.2)], GOLD, GOLD * 0.55, glint=0.6)
    goblin_head(c, cx, 21, look=0)


def goblin_bonk(c):
    """Struck: squashed into its tunic, eyes shut, a little star."""
    cx = 24
    c.poly([(cx - 12, 37), (cx + 12, 37), (cx + 13, 48), (cx - 13, 48)], LEATHER, LEATHER_D)
    c.poly([(cx - 12.5, 41), (cx + 12.5, 41), (cx + 12.8, 43.4), (cx - 12.8, 43.4)], LEATHER_D, LEATHER_D * 0.6)
    for sx in (-1, 1):
        c.limb([(cx + sx * 10, 39, 1), (cx + sx * 15, 44, 0.9)], 4.0, SKIN, SKIN_D)
    goblin_head(c, cx, 30.5, look=0, shut=True, squash=0.78)
    for x, y, r in ((cx - 13, 17, 2.2), (cx + 12, 15, 1.7)):
        c.poly([(x, y - r * 1.6), (x + r * 0.5, y - r * 0.5), (x + r * 1.6, y), (x + r * 0.5, y + r * 0.5), (x, y + r * 1.6),
                (x - r * 0.5, y + r * 0.5), (x - r * 1.6, y), (x - r * 0.5, y - r * 0.5)], GOLD, GOLD * 0.7, glint=0.6)


# ---------------------------------------------------------------- the dragon (design units: 120 x 80, facing left, feet on y = 77)

def wing(c, up, dim):
    k = 0.66 if dim else 1
    sx, sy = (62, 40) if not dim else (70, 38)
    if up:
        wrist = (sx - 8, sy - 30)
        tips = [(sx + 2, sy - 38), (sx + 20, sy - 34), (sx + 36, sy - 22), (sx + 44, sy - 8)]
    else:
        wrist = (sx + 2, sy + 18)
        tips = [(sx + 12, sy + 30), (sx + 26, sy + 28), (sx + 38, sy + 20), (sx + 44, sy + 8)]
    back = (sx + 26, sy + 4)
    # membrane: shoulder, wrist, then each finger tip with the skin sagging between them, back to the body
    pts = [(sx, sy), wrist, tips[0]]
    for a, b in zip(tips + [back], tips[1:] + [back]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        pts += [(mx + (wrist[0] - mx) * 0.2, my + (wrist[1] - my) * 0.2), b]
    c.poly(pts, WING * k, WING_D * k, glint=0.1)
    # the bones: arm up to the wrist, a finger from the wrist to each tip, a claw on the wrist
    c.limb([(sx, sy, 1), (wrist[0], wrist[1], 0.75)], 4.0, SCALE * k, SCALE_D * k)
    for t in tips:
        c.limb([(wrist[0], wrist[1], 1), (t[0], t[1], 0.35)], 2.2, SCALE * k, SCALE_D * k)
    dy = -1 if up else 1
    c.poly([(wrist[0] - 1, wrist[1]), (wrist[0] - 5, wrist[1] + dy * 3), (wrist[0] + 1, wrist[1] + dy * 1.5)], BONE * k, flat=True)


def dragon(c, up):
    wing(c, up, dim=True)
    # tail: a long taper curling up at the end, with a spade
    c.limb([(80, 56, 1), (96, 64, 0.8), (108, 62, 0.6), (115, 52, 0.42), (113, 42, 0.3)], 11, SCALE, SCALE_D)
    c.poly([(113, 44), (106, 36), (114, 30), (119, 38)], SCALE_D, SCALE_D * 0.6)
    # far legs
    c.limb([(80, 58, 1), (84, 68, 0.75), (80, 76, 0.6)], 8, SCALE * 0.7, SCALE_D * 0.7)
    c.limb([(52, 58, 1), (54, 69, 0.7), (51, 76, 0.6)], 6.5, SCALE * 0.7, SCALE_D * 0.7)
    # body and belly
    c.blob(68, 50, 23, 15, SCALE, SCALE_D, glint=0.3)
    belly = c.blob(64, 58, 19, 8.5, GOLD, GOLD * 0.55, glint=0.4, clip=c.Y > 53)
    for x in range(50, 82, 5):
        c.ink([(x, 54), (x - 1, 64)], 0.7, GOLD * 0.5)
    # back spines
    for x, y, h in ((50, 37, 4), (58, 34, 5.5), (67, 34, 6), (76, 35, 5.5), (85, 39, 4.5), (93, 45, 3.5)):
        c.poly([(x - 3, y + 2), (x + 1.5, y - h), (x + 3, y + 2.5)], EMBER, EMBER * 0.5, glint=0.4)
    # near hind leg: a heavy thigh, a foot with claws
    c.blob(80, 58, 9, 10, SCALE, SCALE_D)
    c.limb([(80, 62, 1), (78, 72, 0.7), (72, 75.5, 0.6)], 7, SCALE, SCALE_D)
    for dx in (-5, -1.5, 2):
        c.poly([(72 + dx, 75), (69 + dx, 78), (73.5 + dx, 76.5)], BONE, flat=True)
    # neck and head
    c.limb([(54, 46, 1), (44, 36, 0.85), (36, 30, 0.7)], 15, SCALE, SCALE_D)
    for x, y in ((47, 31), (40, 26)):
        c.poly([(x - 2.5, y + 2), (x + 1, y - 4), (x + 2.5, y + 2.5)], EMBER, EMBER * 0.5)
    # front leg, raised a little, claws out
    c.limb([(52, 56, 1), (46, 64, 0.8), (40, 66, 0.6)], 6.5, SCALE, SCALE_D)
    for dy in (-2, 0.5, 3):
        c.poly([(39, 64 + dy), (34.5, 66 + dy), (39, 66.5 + dy)], BONE, flat=True)
    # horns, swept back
    c.limb([(30, 19, 1), (38, 12, 0.6), (46, 10, 0.25)], 4.2, BONE, BONE * 0.55, glint=0.5)
    c.limb([(25, 19, 1), (30, 11, 0.55), (35, 6, 0.25)], 3.6, BONE * 0.8, BONE * 0.45, glint=0.4)
    # skull, snout and jaw
    c.blob(28, 26, 10.5, 8.5, SCALE, SCALE_D)
    c.poly([(22, 20), (6, 25), (3, 29), (8, 31.5), (24, 31)], SCALE, SCALE_D)
    c.poly([(22, 31), (8, 31.5), (6, 35), (22, 37), (30, 33)], SCALE_D, SCALE_D * 0.6)
    c.ink([(5, 31.4), (22, 31.8), (27, 30)], 0.9)
    for x in (9, 13, 17):
        c.poly([(x, 31.5), (x + 1.4, 31.5), (x + 0.7, 33.6)], BONE, flat=True)
    c.dot(6.5, 25.8, 0.9, INKC)
    # brow ridge and eye: gold with a red slit
    c.blob(25, 23, 3.2, 2.4, GOLD, GOLD * 0.55, glint=0.8)
    c.poly([(24.4, 21), (25.6, 21), (25.6, 25), (24.4, 25)], RED * 0.7, flat=True)
    c.poly([(19, 20.6), (31, 18.6), (30, 21), (21, 21.6)], SCALE_D, SCALE_D * 0.5)
    wing(c, up, dim=False)


FRAMES = {
    # name: (design w, h, art pixels a unit, painter)
    'goblin-a': (48, 56, 2.5, lambda c: goblin_march(c, 0)),
    'goblin-b': (48, 56, 2.5, lambda c: goblin_march(c, 1)),
    'goblin-up': (48, 48, 2.5, goblin_up),
    'goblin-bonk': (48, 48, 2.5, goblin_bonk),
    'dragon-up': (120, 80, 2.0, lambda c: dragon(c, True)),
    'dragon-down': (120, 80, 2.0, lambda c: dragon(c, False)),
}


def main():
    out = ROOT / 'public/creatures'
    out.mkdir(exist_ok=True)
    pics = {}
    for name, (w, h, k, paint) in FRAMES.items():
        c = Canvas(w, h, k)
        paint(c)
        pics[name] = c.image()
        pics[name].save(out / f'{name}.webp', 'WEBP', lossless=True, method=6)
        print(name, pics[name].size)
    if '--preview' in sys.argv:
        sheet = Image.new('RGBA', (sum(p.width for p in pics.values()) + 20 * len(pics), max(p.height for p in pics.values())), (243, 239, 228, 255))
        x = 0
        for p in pics.values():
            sheet.alpha_composite(p, (x, 0)); x += p.width + 20
        sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(Path(__file__).parent / 'creatures-preview.png')


if __name__ == '__main__':
    main()
