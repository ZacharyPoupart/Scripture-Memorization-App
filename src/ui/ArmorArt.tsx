// The painted armor (public/armor/<id>.webp, cut from design/armor-sheet.webp by design/cut-armor.py) drawn onto the knight.
// Every piece was painted to the same scale, so any piece can be swapped for another and still fit. Positions are in "figure
// units": the knight is centred on x = 0, his boots end at y = 250, and AvatarFigure scales that into the picture.
import { itemById, type Look } from '../core/avatar.ts';
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

const BODY = 0.86; // breastplate and arms
const LEGS = 0.95;
const HELM = 0.58;
const HELM_BOTTOM = 82;
const SHOULDER = 64; // where the top of the breastplate and arms sits
const HAND_Y = 150;
/** Where each weapon is held, as a fraction of its length from the top. */
const GRIP: Record<string, number> = { sword: 0.8, darksword: 0.8, goldsword: 0.8, axe: 0.72, mace: 0.75, spear: 0.7, bow: 0.5, staff: 0.72 };

/** All the painted layers, back to front. */
export function ArmorLayers({ look }: { look: Look }) {
  const helmH = SIZE[look.helmet]?.[1] ?? 106;
  const helmTop = HELM_BOTTOM - helmH * HELM;
  const weaponKind = look.weapon.replace('weapon-', '');
  const weaponH = (SIZE[look.weapon]?.[1] ?? 160) * 0.9;
  const shieldH = (SIZE[look.shield]?.[1] ?? 110) * 0.8;
  return (
    <g>
      <Piece id={look.cape} spot={{ s: 0.95, top: SHOULDER - 4 }} />
      <Piece id={look.legs} spot={{ s: LEGS, bottom: 250 }} />
      <Piece id={look.arms} spot={{ s: BODY, top: SHOULDER }} />
      <Piece id={look.chest} spot={{ s: BODY, top: SHOULDER }} />
      {look.extra === 'ex-medal' && <Piece id="ex-medal" spot={{ s: 0.7, top: 92 }} />}
      {look.extra === 'ex-pouch' && <Piece id="ex-pouch" spot={{ s: 0.75, cx: 34, top: 126 }} />}
      {look.extra === 'ex-scroll' && <Piece id="ex-scroll" spot={{ s: 0.8, cx: -32, top: 134 }} />}
      <Piece id={look.plume} spot={{ s: 0.6, cx: 0, top: helmTop - (SIZE[look.plume]?.[1] ?? 59) * 0.6 + 10 }} />
      <Piece id={look.helmet} spot={{ s: HELM, bottom: HELM_BOTTOM }} />
      <Piece id={look.shield} spot={{ s: 0.8, cx: -52, top: HAND_Y - shieldH / 2 }} />
      <Piece id={look.weapon} spot={{ s: 0.9, cx: 48, top: HAND_Y + 4 - (GRIP[weaponKind] ?? 0.75) * weaponH }} />
    </g>
  );
}

/** Things that stand beside the knight rather than being worn: a lantern and banners. */
export function ArmorExtras({ look }: { look: Look }) {
  const item = itemById(look.extra);
  if (!item?.art) return null;
  if (look.extra === 'ex-lantern') return <Piece id="ex-lantern" spot={{ s: 0.9, cx: 84, top: 80 }} />;
  if (look.extra.startsWith('ex-banner-')) return <Piece id={look.extra} spot={{ s: 1.0, cx: 96, top: 14 }} />;
  return null;
}
