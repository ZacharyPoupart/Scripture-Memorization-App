// The ten armor sets are painted pieces (public/armor/<slot>-<set>.webp, cut from design/armor-sheet.webp by
// design/cut-armor.py). Each is drawn onto the knight in a fixed box, so any piece can be mixed with any other.
import { itemById } from '../core/avatar.ts';

export const armorUrl = (id: string): string | null => {
  const item = itemById(id);
  return item?.set ? `${import.meta.env.BASE_URL}armor/${id}.webp` : null;
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 'slice' fills the box and crops the overflow (used to show just the feet of the boots). */
  fit?: 'meet' | 'slice';
  align?: string;
}
const BOX: Record<string, Box> = {
  helmet: { x: 46, y: 6, w: 28, h: 36 },
  breastplate: { x: 37, y: 36, w: 46, h: 45 },
  belt: { x: 46, y: 62, w: 28, h: 38 },
  shoes: { x: 44, y: 86, w: 32, h: 33, align: 'xMidYMax' },
  shield: { x: 7, y: 42, w: 32, h: 48 },
  sword: { x: 76, y: 16, w: 20, h: 68 },
};

/** One piece of armor, or nothing if the slot is empty. */
export function ArmorPiece({ slot, id }: { slot: keyof typeof BOX; id: string }) {
  const url = armorUrl(id);
  if (!url) return null;
  const b = BOX[slot];
  return <image href={url} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio={`${b.align ?? 'xMidYMid'} ${b.fit ?? 'meet'}`} />;
}
