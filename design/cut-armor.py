# Cuts design/armor-sheet.webp (the owner's painted armor pieces on a transparent background) into one picture per piece:
# public/armor/<id>.webp, plus src/ui/armorSizes.json (each picture's width and height, used to place it on the knight).
# Run:  python3 design/cut-armor.py   (needs Pillow). The boxes below are where each piece sits on the sheet.
from PIL import Image
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'armor')
SIZES = os.path.join(HERE, '..', 'src', 'ui', 'armorSizes.json')

HELMETS = ['steel', 'gold', 'shadow', 'horned', 'winged', 'spiked', 'cross']
COLOURWAYS = ['knight', 'gold', 'shadow', 'forest', 'azure', 'iron', 'crimson']  # chest, arms and legs come in these seven
CAPES = ['blue', 'red', 'green', 'black', 'purple', 'white']
SHIELDS = ['lion', 'dragon', 'sun', 'tree', 'spiked', 'round']
WEAPONS = ['sword', 'darksword', 'goldsword', 'axe', 'mace', 'spear', 'bow', 'staff']
PLUMES = ['blue', 'red', 'green', 'white', 'purple']
BANNERS = ['lion', 'dragon', 'tree', 'sun']
EXTRAS = ['pouch', 'lantern', 'medal', 'scroll']

BOXES = {
    'helmet': [[183, 52, 254, 158], [281, 52, 353, 157], [384, 53, 454, 157], [472, 55, 578, 158], [593, 28, 694, 162], [715, 53, 791, 160], [815, 57, 884, 159]],
    'chest': [[172, 211, 281, 325], [282, 211, 384, 325], [392, 211, 496, 326], [498, 211, 600, 319], [600, 211, 703, 324], [710, 211, 810, 323], [813, 211, 912, 324]],
    'arms': [[21, 368, 139, 486], [156, 369, 274, 491], [287, 368, 406, 491], [418, 369, 531, 490], [544, 369, 662, 491], [672, 369, 788, 490], [800, 369, 916, 491]],
    'legs': [[37, 542, 125, 671], [172, 543, 258, 671], [302, 543, 388, 671], [431, 543, 518, 671], [559, 542, 645, 671], [685, 543, 771, 671], [810, 542, 896, 671]],
    'cape': [[958, 51, 1055, 224], [1068, 51, 1163, 221], [959, 237, 1055, 403], [1069, 237, 1170, 405], [958, 418, 1055, 596], [1073, 418, 1162, 587]],
    'shield': [[960, 641, 1035, 751], [1048, 641, 1122, 752], [1136, 641, 1211, 752], [1225, 641, 1298, 753], [1315, 640, 1392, 752], [1404, 640, 1498, 742]],
    'weapon': [[1242, 50, 1289, 220], [1320, 50, 1377, 228], [1397, 50, 1447, 218], [1233, 237, 1310, 401], [1347, 248, 1406, 410], [1446, 209, 1474, 418], [1267, 386, 1334, 597], [1408, 394, 1434, 593]],
    'plume': [[942, 824, 992, 883], [996, 824, 1044, 882], [1048, 824, 1095, 882], [1099, 824, 1146, 882], [1150, 824, 1199, 882]],
    'banner': [[942, 904, 994, 997], [1008, 904, 1059, 997], [1071, 904, 1123, 997], [1135, 903, 1188, 997]],
    'extra': [[1224, 917, 1268, 978], [1288, 907, 1325, 978], [1343, 911, 1384, 962], [1395, 927, 1450, 965]],
}

names = {}
for slot, keys in [('helmet', HELMETS), ('chest', COLOURWAYS), ('arms', COLOURWAYS), ('legs', COLOURWAYS), ('cape', CAPES), ('shield', SHIELDS),
                   ('weapon', WEAPONS), ('plume', PLUMES)]:
    for key, box in zip(keys, BOXES[slot]):
        names[f'{slot}-{key}'] = box
for key, box in zip(BANNERS, BOXES['banner']):
    names[f'ex-banner-{key}'] = box
for key, box in zip(EXTRAS, BOXES['extra']):
    names[f'ex-{key}'] = box

sheet = Image.open(os.path.join(HERE, 'armor-sheet.webp')).convert('RGBA')
os.makedirs(OUT, exist_ok=True)
sizes = {}
for name, box in sorted(names.items()):
    piece = sheet.crop(tuple(box))
    piece.save(os.path.join(OUT, f'{name}.webp'), 'WEBP', quality=92, method=6)
    sizes[name] = [piece.width, piece.height]
json.dump(sizes, open(SIZES, 'w'), indent=1, sort_keys=True)
print(len(names), 'pieces')
