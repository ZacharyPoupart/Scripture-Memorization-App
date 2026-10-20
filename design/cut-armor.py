# Cuts design/armor-sheet.webp (the owner's painted equipment sheet on a transparent background) into one picture per piece:
# public/armor/<id>.webp, plus src/ui/armorSizes.json (each picture's width and height, used to place it on the knight).
# Run:  python3 design/cut-armor.py   (needs Pillow). The boxes below are where each piece sits on the sheet.
# Twelve matching sets run across the sheet: helmet-1..12, chest-1..12, legs-1..12 (worn automatically with the chest of the same
# number), belt-1..12, boots-1..12 and cape-1..12; then weapon-1..11, shield-1..6 and the accessories. (The sheet's shoulders/arms
# row is not used: the chest pieces already have sleeves.)
from PIL import Image
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'armor')
SIZES = os.path.join(HERE, '..', 'src', 'ui', 'armorSizes.json')

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
for slot in ['helmet', 'chest', 'legs', 'belt', 'boots', 'cape', 'weapon', 'shield']:
    for i, box in enumerate(BOXES[slot]):
        names[f'{slot}-{i + 1}'] = box
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
    piece.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=92, method=6)
    sizes[name] = [piece.width, piece.height]
json.dump(sizes, open(SIZES, 'w'), indent=1, sort_keys=True)
print(len(names), 'pieces')
