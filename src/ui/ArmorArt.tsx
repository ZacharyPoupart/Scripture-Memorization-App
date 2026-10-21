// The painted armor (public/armor/<slot>/<set>.webp, cut from the owner's sheet by design/armor-v2) drawn onto the knight.
// Every piece was painted to one scale and has the same canvas size for every set, so any piece can be swapped for another and
// still fit. Where each slot sits comes from armorLayout.json (written by design/armor-v2 from placement.json), in the sheet's
// own pixels; AvatarFigure draws the knight 250 units tall, so everything is scaled by U to fit that.
import type { Look } from '../core/avatar.ts';
import layout from './armorLayout.json';
import sizes from './armorSizes.json';

const SIZE = sizes as unknown as Record<string, [number, number]>;
type SlotLayout = { prefix: string; dir: string; w: number; h: number; x: number; y: number; rotate?: number; tilt?: number; pivot?: [number, number] };
const SLOT_LAYOUT = layout.slots as unknown as Record<string, SlotLayout>;
const BY_PREFIX = Object.fromEntries(Object.values(SLOT_LAYOUT).map((s) => [s.prefix, s]));
const U = 250 / layout.frame.height;
const TOP = layout.frame.top; // the top of the helmet is y = 0, the soles of the boots are y = 250

/** The picture for an item id ("helmet-knights-oath" is public/armor/helmet/knights-oath.webp; accessories are public/armor/ex-*.webp). */
export function armorUrl(id: string): string | null {
  if (!SIZE[id]) return null;
  const base = import.meta.env.BASE_URL;
  if (id.startsWith('ex-')) return `${base}armor/${id}.webp`;
  const dash = id.indexOf('-');
  const slot = BY_PREFIX[id.slice(0, dash)];
  return slot ? `${base}armor/${slot.dir}/${id.slice(dash + 1)}.webp` : null;
}

interface Spot {
  /** scale of the painting */
  s: number;
  /** centre x */
  cx?: number;
  top: number;
}

/** An accessory, placed by its centre and top. */
function Piece({ id, spot }: { id: string; spot: Spot }) {
  const url = armorUrl(id);
  const size = SIZE[id];
  if (!url || !size) return null;
  const w = size[0] * spot.s;
  const h = size[1] * spot.s;
  return <image href={url} x={(spot.cx ?? 0) - w / 2} y={spot.top} width={w} height={h} />;
}

/** A piece of the armor, drawn where its slot sits on the knight. */
function Slot({ slot, id }: { slot: keyof typeof SLOT_LAYOUT; id: string }) {
  const url = armorUrl(id);
  const at = SLOT_LAYOUT[slot];
  if (!url || !at) return null;
  const x = at.x * U;
  const y = (at.y - TOP) * U;
  const w = at.w * U;
  const h = at.h * U;
  const turn = at.rotate ? `rotate(${at.rotate} ${x + w / 2} ${y + h / 2})` : '';
  const tilt = at.tilt && at.pivot ? `rotate(${at.tilt} ${at.pivot[0] * U} ${(at.pivot[1] - TOP) * U}) ` : ''; // around the hand
  return <image href={url} x={x} y={y} width={w} height={h} transform={`${tilt}${turn}` || undefined} />;
}

const A = 1.2 * U; // accessories were drawn for a smaller knight
const CHEST_TOP = (SLOT_LAYOUT.chest.y - TOP) * U;
const HIP = (150 - TOP) * U;
const HAND_Y = (165 - TOP) * U;

/** All the painted layers, back to front. */
export function ArmorLayers({ look }: { look: Look }) {
  return (
    <g>
      <Slot slot="cape" id={look.cape} />
      <Slot slot="legs" id={look.boots} />
      <Slot slot="chest" id={look.chest} />
      <Slot slot="belt" id={look.belt} />
      {look.extra === 'ex-amulet' && <Piece id="ex-amulet" spot={{ s: 0.9 * A, top: CHEST_TOP + 6 }} />}
      {look.extra === 'ex-medal' && <Piece id="ex-medal" spot={{ s: 0.8 * A, cx: -22, top: CHEST_TOP + 26 }} />}
      {look.extra === 'ex-pouch' && <Piece id="ex-pouch" spot={{ s: 0.8 * A, cx: 40, top: HIP }} />}
      {look.extra === 'ex-scroll' && <Piece id="ex-scroll" spot={{ s: 0.85 * A, cx: -38, top: HIP }} />}
      {look.extra === 'ex-charm' && <Piece id="ex-charm" spot={{ s: 0.75 * A, cx: -36, top: HIP }} />}
      {look.extra === 'ex-gloves' && <Piece id="ex-gloves" spot={{ s: 0.8 * A, cx: 36, top: HIP }} />}
      {look.extra === 'ex-ring' && <Piece id="ex-ring" spot={{ s: 0.7 * A, cx: 54 * U, top: HAND_Y - 8 }} />}
      <Slot slot="helmet" id={look.helmet} />
      <Slot slot="shield" id={look.shield} />
      <Slot slot="sword" id={look.weapon} />
    </g>
  );
}

/** Things that stand beside the knight rather than being worn: a lantern and a banner. */
export function ArmorExtras({ look }: { look: Look }) {
  if (look.extra === 'ex-lantern') return <Piece id="ex-lantern" spot={{ s: 1.1 * U, cx: 108, top: 96 }} />;
  if (look.extra === 'ex-banner') return <Piece id="ex-banner" spot={{ s: 1.35 * U, cx: 116, top: 18 }} />;
  return null;
}
