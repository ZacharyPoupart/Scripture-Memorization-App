// The painted armor (public/armor/<id>.webp, cut from design/armor-sheet.webp by design/cut-armor.py) drawn onto the knight.
// Every piece was painted to the same scale, so any piece can be swapped for another and still fit. Positions are in "figure
// units": the knight is centred on x = 0, his boots end at y = 250, and AvatarFigure scales that into the picture.
import type { Look } from '../core/avatar.ts';
import sizes from './armorSizes.json';

const SIZE = sizes as unknown as Record<string, [number, number]>;

export const armorUrl = (id: string): string | null => (SIZE[id] ? `${import.meta.env.BASE_URL}armor/${id}.webp` : null);

interface Spot {
  /** scale of the painting */
  s: number;
  /** centre x */
  cx?: number;
  top?: number;
  bottom?: number;
}

function Piece({ id, spot }: { id: string; spot: Spot }) {
  const url = armorUrl(id);
  const size = SIZE[id];
  if (!url || !size) return null;
  const w = size[0] * spot.s;
  const h = size[1] * spot.s;
  const y = spot.top !== undefined ? spot.top : (spot.bottom ?? 0) - h;
  return <image href={url} x={(spot.cx ?? 0) - w / 2} y={y} width={w} height={h} />;
}

const S = 0.85; // every piece was painted to one scale, so one factor sizes them all
const HELM_S = 0.8;
const HELM_BOTTOM = 84;
const CHEST_S = 0.95; // a little bigger than the rest so its sides reach past the legs
const CHEST_TOP = 70; // where the top of the chest plate sits
const BELT_S = 0.78; // the front of the belt covers the belt painted on the chest plate
const BELT_TOP = 119;
const HIP = 146; // where pouches and the like hang
const HAND_Y = 138;
const SHIELD_S = 1.3; // a shield is about as wide as the body
/** Where each weapon is held, as a fraction of its length from the top. */
const GRIP: Record<string, number> = {
  'weapon-1': 0.82,
  'weapon-2': 0.82,
  'weapon-3': 0.82,
  'weapon-4': 0.82,
  'weapon-5': 0.7,
  'weapon-6': 0.72,
  'weapon-7': 0.62,
  'weapon-8': 0.5,
  'weapon-9': 0.8,
  'weapon-10': 0.7,
  'weapon-11': 0.5,
};

/** All the painted layers, back to front. */
export function ArmorLayers({ look }: { look: Look }) {
  const weaponH = (SIZE[look.weapon]?.[1] ?? 110) * 1.2;
  const shieldH = (SIZE[look.shield]?.[1] ?? 90) * SHIELD_S;
  return (
    <g>
      <Piece id={look.cape} spot={{ s: 1.2, top: CHEST_TOP - 4 }} />
      <Piece id={look.boots} spot={{ s: S, bottom: 250 }} />
      <Piece id={look.chest} spot={{ s: CHEST_S, top: CHEST_TOP }} />
      <Piece id={look.belt} spot={{ s: BELT_S, top: BELT_TOP }} />
      {look.extra === 'ex-amulet' && <Piece id="ex-amulet" spot={{ s: 0.8, top: CHEST_TOP + 10 }} />}
      {look.extra === 'ex-medal' && <Piece id="ex-medal" spot={{ s: 0.7, cx: -20, top: CHEST_TOP + 24 }} />}
      {look.extra === 'ex-pouch' && <Piece id="ex-pouch" spot={{ s: 0.75, cx: 34, top: HIP + 18 }} />}
      {look.extra === 'ex-scroll' && <Piece id="ex-scroll" spot={{ s: 0.8, cx: -32, top: HIP + 22 }} />}
      {look.extra === 'ex-charm' && <Piece id="ex-charm" spot={{ s: 0.7, cx: -30, top: HIP + 22 }} />}
      {look.extra === 'ex-gloves' && <Piece id="ex-gloves" spot={{ s: 0.75, cx: 32, top: HIP + 22 }} />}
      {look.extra === 'ex-ring' && <Piece id="ex-ring" spot={{ s: 0.7, cx: -46, top: HAND_Y + 6 }} />}
      <Piece id={look.helmet} spot={{ s: HELM_S, bottom: HELM_BOTTOM }} />
      <Piece id={look.shield} spot={{ s: SHIELD_S, cx: -58, top: HAND_Y - shieldH / 2 }} />
      <Piece id={look.weapon} spot={{ s: 1.2, cx: 50, top: HAND_Y + 4 - (GRIP[look.weapon] ?? 0.75) * weaponH }} />
    </g>
  );
}

/** Things that stand beside the knight rather than being worn: a lantern and a banner. */
export function ArmorExtras({ look }: { look: Look }) {
  if (look.extra === 'ex-lantern') return <Piece id="ex-lantern" spot={{ s: 1.0, cx: 84, top: 90 }} />;
  if (look.extra === 'ex-banner') return <Piece id="ex-banner" spot={{ s: 1.3, cx: 96, top: 30 }} />;
  return null;
}
