# Cuts design/armor-sheet.webp (ten sets x six pieces, transparent background) into public/armor/<slot>-<set>.webp.
# Run:  python3 design/cut-armor.py   (needs Pillow + numpy). The sheet is laid out row by row, two sets per row.
from PIL import Image
import numpy as np, math, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'armor')
SETS = ['initiate', 'soldier', 'vanguard', 'paladin', 'warden', 'ranger', 'crusader', 'shadow', 'storm', 'legend']
SLOTS = ['helmet', 'breastplate', 'belt', 'shoes', 'shield', 'sword']
BANDS = [(12, 205), (217, 411), (424, 612), (623, 806), (810, 987)]
COLS = [(0, 748), (748, 1500)]

im = Image.open(os.path.join(HERE, 'armor-sheet.webp')).convert('RGBA')
alpha = np.asarray(im)[:, :, 3] > 30
os.makedirs(OUT, exist_ok=True)

def runs_of(mask):
    cols = mask.sum(0)
    out, s = [], None
    for x, v in enumerate(cols):
        if v > 0 and s is None: s = x
        if v == 0 and s is not None: out.append([s, x]); s = None
    if s is not None: out.append([s, len(cols)])
    merged = []
    for a, b in out:
        if merged and a - merged[-1][1] < 4: merged[-1][1] = b
        else: merged.append([a, b])
    return [(a, b) for a, b in merged if b - a > 8]

def upright_sword(piece):
    a = np.asarray(piece)[:, :, 3] > 30
    ys, xs = np.nonzero(a)
    cx, cy = xs.mean(), ys.mean()
    cov = np.cov(np.vstack([xs - cx, ys - cy]))
    w, v = np.linalg.eigh(cov)
    ax = v[:, 1]  # principal axis (x, y)
    ang = math.degrees(math.atan2(ax[0], ax[1]))  # angle from vertical
    def tidy(angle):
        t = piece.rotate(angle, resample=Image.BICUBIC, expand=True)
        b = np.asarray(t)[:, :, 3] > 30
        yy, xx = np.nonzero(b)
        return t, (xx.max() - xx.min()) / (yy.max() - yy.min())
    r = min((tidy(ang), tidy(-ang)), key=lambda t: t[1])[0]  # whichever direction stands the blade upright
    ra = np.asarray(r)[:, :, 3] > 30
    widths = ra.sum(1)
    rows = np.nonzero(widths)[0]
    top, bottom = rows.min(), rows.max()
    widest = rows[np.argmax(widths[rows])]
    if widest < (top + bottom) / 2:  # crossguard is at the top: flip so the tip points up
        r = r.rotate(180, resample=Image.BICUBIC, expand=True)
    return r

for si, key in enumerate(SETS):
    r, c = divmod(si, 2)
    y0, y1 = BANDS[r]
    x0, x1 = COLS[c]
    m = alpha[y0:y1, x0:x1].copy()
    # the coloured title banner is the first object at the top left; blank it up to the first empty row
    left = m[:, :270].any(1)
    y = 0
    while y < len(left) and not left[y]: y += 1
    while y < len(left) and left[y]: y += 1
    m[:y, :270] = False
    sheet_cell = (x0, y0, y)
    runs = runs_of(m)
    if len(runs) == 5:  # boots and shield touch on one sheet: split at the thinnest column between them
        a, b = runs[3]
        cols = m[:, a:b].sum(0)
        lo, hi = int((b - a) * 0.4), int((b - a) * 0.6)
        cut = a + lo + int(np.argmin(cols[lo:hi]))
        runs = runs[:3] + [(a, cut), (cut, b)] + runs[4:]
    assert len(runs) == 6, (key, runs)
    for slot, (a, b) in zip(SLOTS, runs):
        top = y if (a < 270) else 0
        sub = im.crop((x0 + a, y0 + top, x0 + b, y1))
        sa = np.asarray(sub)[:, :, 3]
        mask = sa > 30
        if slot == 'sword':
            sub = upright_sword(sub)
            sa = np.asarray(sub)[:, :, 3]
            mask = sa > 30
        ys, xs = np.nonzero(mask)
        sub = sub.crop((max(xs.min() - 2, 0), max(ys.min() - 2, 0), min(xs.max() + 3, sub.width), min(ys.max() + 3, sub.height)))
        sub.save(os.path.join(OUT, f'{slot}-{key}.webp'), 'WEBP', quality=92, method=6)
print('done')
