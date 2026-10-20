# Cuts design/armor-sheet.webp (the owner's painted equipment sheet on a transparent background) into one picture per piece:
# public/armor/<id>.webp, plus src/ui/armorSizes.json (each picture's width and height, used to place it on the knight).
# Run:  python3 design/cut-armor.py   (needs Pillow). The boxes below are where each piece sits on the sheet.
# Twelve matching sets run across the sheet: helmet-1..12, chest-1..12, belt-1..12, boots-1..12 and cape-1..12. The sheet's Leg Armor
# row already includes the boots, so each boots-N picture is that whole leg-and-boot piece (the sheet's separate Boots row is not used).
# Belts are painted as a full ring; only the front band is kept (see BELT_FRONT); then weapon-1..11, shield-1..6 and the accessories. (The sheet's shoulders/arms
# row is not used: the chest pieces already have sleeves.)
from PIL import Image
import colorsys, json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'armor')
SIZES = os.path.join(HERE, '..', 'src', 'ui', 'armorSizes.json')

BELT_FRONT = (0.08, 0.36, 0.92)  # left, top and right of the front band, as fractions of the belt picture
BOW_CLEAN = {'weapon-8': 120, 'weapon-11': 175}  # the two bows, and how bright a colourless pixel must be to be cleared
# The dark pieces with red glow (including the helmets' glowing eyes) are flipped from red to blue
BLUE_FLIP = ['helmet-4', 'helmet-7', 'chest-4', 'belt-3', 'boots-3', 'boots-12', 'cape-6', 'shield-5', 'weapon-3']
ACCESSORIES = ['ring', 'amulet', 'gloves', 'scroll', 'pouch', 'lantern', 'charm', 'banner', 'medal']

BOXES = {
    'helmet': [[48, 12, 116, 110], [174, 12, 241, 111], [296, 9, 365, 110], [418, 10, 487, 109], [529, 10, 627, 111], [670, 5, 745, 112], [791, 14, 868, 113], [920, 11, 985, 111], [1048, 10, 1118, 112], [1177, 11, 1248, 112], [1295, 10, 1387, 111], [1434, 11, 1501, 110]],
    'chest': [[19, 139, 129, 245], [146, 138, 258, 246], [275, 140, 381, 246], [395, 139, 506, 245], [520, 139, 633, 246], [646, 139, 758, 245], [773, 139, 884, 245], [899, 139, 1012, 245], [1028, 142, 1137, 246], [1154, 139, 1266, 245], [1283, 141, 1395, 246], [1410, 139, 1522, 246]],
    'legs': [[32, 393, 113, 507], [162, 393, 242, 507], [290, 392, 368, 507], [413, 392, 491, 507], [539, 393, 614, 507], [662, 392, 741, 507], [790, 394, 866, 507], [917, 395, 990, 507], [1044, 395, 1117, 507], [1168, 392, 1248, 507], [1296, 393, 1376, 507], [1424, 394, 1504, 508]],
    'belt': [[30, 548, 113, 583], [156, 548, 233, 584], [283, 549, 362, 584], [408, 548, 487, 584], [534, 549, 615, 583], [660, 548, 741, 585], [788, 548, 868, 584], [913, 547, 994, 585], [1041, 548, 1121, 584], [1166, 547, 1254, 585], [1293, 548, 1380, 583], [1420, 547, 1504, 584]],
    'boots': [[28, 752, 110, 819], [156, 751, 235, 819], [283, 752, 355, 819], [409, 752, 481, 820], [536, 752, 613, 819], [665, 751, 736, 820], [789, 751, 863, 820], [919, 749, 989, 817], [1046, 752, 1120, 819], [1178, 753, 1250, 818], [1308, 754, 1378, 819], [1433, 755, 1500, 819]],
    'cape': [[29, 610, 111, 725], [154, 610, 237, 726], [282, 610, 364, 725], [407, 610, 490, 726], [533, 611, 617, 726], [658, 611, 742, 726], [786, 611, 868, 727], [912, 611, 994, 727], [1040, 612, 1122, 726], [1170, 612, 1251, 727], [1297, 612, 1380, 726], [1419, 611, 1502, 726]],
    'weapon': [[49, 845, 80, 953], [139, 847, 169, 953], [240, 844, 273, 953], [336, 845, 366, 953], [393, 851, 443, 951], [464, 862, 500, 951], [545, 854, 562, 952], [654, 857, 683, 953], [765, 853, 808, 936], [858, 852, 871, 952], [907, 847, 953, 953]],
    'shield': [[1030, 852, 1085, 929], [1163, 859, 1210, 928], [1243, 859, 1290, 928], [1322, 858, 1372, 930], [1392, 855, 1442, 930], [1462, 875, 1512, 926]],
    'acc': [[1021, 960, 1054, 993], [1086, 954, 1114, 995], [1139, 962, 1182, 996], [1202, 964, 1249, 992], [1277, 951, 1312, 999], [1337, 952, 1363, 997], [1383, 958, 1409, 995], [1428, 950, 1455, 1001], [1477, 954, 1505, 994]],
}

names = {}
for slot in ['helmet', 'chest', 'belt', 'cape', 'weapon', 'shield']:
    for i, box in enumerate(BOXES[slot]):
        names[f'{slot}-{i + 1}'] = box
for i, box in enumerate(BOXES['legs']):
    names[f'boots-{i + 1}'] = box
for key, box in zip(ACCESSORIES, BOXES['acc']):
    names[f'ex-{key}'] = box

sheet = Image.open(os.path.join(HERE, 'armor-sheet.webp')).convert('RGBA')
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    if f.endswith('.webp'):
        os.remove(os.path.join(OUT, f))
sizes = {}
for name, box in sorted(names.items()):
    piece = sheet.crop(tuple(box))
    if name in BLUE_FLIP:
        px = piece.load()
        for y in range(piece.height):
            for x in range(piece.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                if sat > 0.35 and (h < 0.045 or h > 0.94):  # a strong red: turn it to blue, keeping its brightness and depth
                    r, g, b = (round(c * 255) for c in colorsys.hsv_to_rgb(0.6, sat, v))
                    px[x, y] = (r, g, b, a)
    if name in BOW_CLEAN:
        # the sheet leaves a pale smudge (and a checkerboard) between the wood and the string: clear every pale, colourless pixel
        floor = BOW_CLEAN[name]
        px = piece.load()
        for y in range(piece.height):
            for x in range(piece.width):
                r, g, b, a = px[x, y]
                if a and min(r, g, b) > floor and max(r, g, b) - min(r, g, b) < 28:
                    px[x, y] = (r, g, b, 0)
    if name.startswith('belt-'):
        # keep just the front band: drop the top rim (the inside of the back of the ring) and the ends where the ring turns away
        w, h = piece.size
        piece = piece.crop((round(w * BELT_FRONT[0]), round(h * BELT_FRONT[1]), round(w * BELT_FRONT[2]), h))
        bbox = piece.getbbox()
        if bbox:
            piece = piece.crop(bbox)
    piece.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=92, method=6)
    sizes[name] = [piece.width, piece.height]
json.dump(sizes, open(SIZES, 'w'), indent=1, sort_keys=True)
print(len(names), 'pieces')
