# Cuts the ACCESSORIES (ring, amulet, gloves, scroll, pouch, lantern, charm, banner, medal) out of the older painted sheet,
# design/armor-sheet.webp, into public/armor/ex-<name>.webp, and records their sizes in src/ui/armorSizes.json.
# The armor itself (helmets, chest plates, legs and boots, belts, capes, swords and shields) comes from the newer sheet:
# see design/armor-v2/README.md.
# Run:  python3 design/cut-armor.py   (needs Pillow). The boxes below are where each accessory sits on the old sheet.
from PIL import Image
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public', 'armor')
SIZES = os.path.join(HERE, '..', 'src', 'ui', 'armorSizes.json')

ACCESSORIES = ['ring', 'amulet', 'gloves', 'scroll', 'pouch', 'lantern', 'charm', 'banner', 'medal']
BOXES = [[1021, 960, 1054, 993], [1086, 954, 1114, 995], [1139, 962, 1182, 996], [1202, 964, 1249, 992], [1277, 951, 1312, 999], [1337, 952, 1363, 997], [1383, 958, 1409, 995], [1428, 950, 1455, 1001], [1477, 954, 1505, 994]]

sheet = Image.open(os.path.join(HERE, 'armor-sheet.webp')).convert('RGBA')
os.makedirs(OUT, exist_ok=True)
sizes = json.load(open(SIZES)) if os.path.exists(SIZES) else {}
for key, box in zip(ACCESSORIES, BOXES):
    piece = sheet.crop(tuple(box))
    piece.save(os.path.join(OUT, f'ex-{key}.webp'), 'WEBP', quality=92, method=6)
    sizes[f'ex-{key}'] = [piece.width, piece.height]
json.dump(sizes, open(SIZES, 'w'), indent=1, sort_keys=True)
print(len(ACCESSORIES), 'accessories')
