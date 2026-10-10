// The ten armor sets are painted pieces (public/armor/<slot>-<set>.webp, cut from design/armor-sheet.webp by
// design/cut-armor.py). Each is drawn onto the knight in a fixed box, so any piece can be mixed with any other.
import { itemById } from "../core/avatar.ts";

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
  fit?: "meet" | "slice";
  align?: string;
}
const BOX: Record<string, Box> = {
  helmet: { x: 44, y: 15, w: 32, h: 47 },
  breastplate: { x: 34, y: 58, w: 52, h: 50 },
  belt: { x: 42, y: 88, w: 36, h: 32 },
  shoes: { x: 44, y: 96, w: 32, h: 22, fit: "slice", align: "xMidYMax" },
  shield: { x: 3, y: 53, w: 42, h: 48 },
  sword: { x: 82, y: 36, w: 20, h: 64 },
};

/** One piece of armor, or nothing if the slot is empty. */
export function ArmorPiece({
  slot,
  id,
}: {
  slot: keyof typeof BOX;
  id: string;
}) {
  const url = armorUrl(id);
  if (!url) return null;
  const b = BOX[slot];
  return (
    <image
      href={url}
      x={b.x}
      y={b.y}
      width={b.w}
      height={b.h}
      preserveAspectRatio={`${b.align ?? "xMidYMid"} ${b.fit ?? "meet"}`}
    />
  );
}
