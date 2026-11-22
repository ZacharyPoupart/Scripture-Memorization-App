// A medallion for an achievement (v1.85.0; a round medallion rather than a medal on a ribbon since v1.85.1, owner-requested "more
// like medallions than medals"): a scalloped edge, a ring of beads, a raised centre and the achievement's line pictogram engraved in
// the middle, all in bronze, silver or gold; an outline when not earned yet. Flat colours only (no glow, no gradient), like the rest
// of the app. The class names still say medal, like the code and the data.
import type { Achievement, Tier } from '../core/achievements.ts';
import { MARK_PATHS } from './marks.tsx';

const C = 32; // the centre of the 64-unit picture
const at = (angle: number, r: number) => `${(C + r * Math.sin(angle)).toFixed(2)} ${(C - r * Math.cos(angle)).toFixed(2)}`;
const turn = (i: number, n: number) => (i / n) * 2 * Math.PI;

/** The scalloped edge: eighteen small bumps around the rim. */
const SCALLOPS = 18;
const EDGE = (() => {
  let d = `M${at(0, 27)}`;
  for (let i = 0; i < SCALLOPS; i++) d += ` Q${at((turn(i, SCALLOPS) + turn(i + 1, SCALLOPS)) / 2, 32)} ${at(turn(i + 1, SCALLOPS), 27)}`;
  return `${d}Z`;
})();

/** A ring of beads between the edge and the raised centre, one under each bump. */
const BEADS = Array.from({ length: SCALLOPS }, (_, i) => at(turn(i + 0.5, SCALLOPS), 23.4).split(' ').map(Number));

/** The pictograms are drawn on 48 units; engraved at this size they fill the centre. */
const MARK = 0.6;

export function Medal({ achievement, tier, size = 48 }: { achievement: Achievement; tier: Tier | null; size?: number }) {
  const cls = tier ? `medal medal-${tier}` : 'medal medal-none';
  const shift = C - (48 * MARK) / 2;
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path class="medal-edge" d={EDGE} />
      {BEADS.map(([x, y], i) => (
        <circle key={i} class="medal-bead" cx={x} cy={y} r="1.15" />
      ))}
      <circle class="medal-disc" cx={C} cy={C} r="19.5" />
      <circle class="medal-rim" cx={C} cy={C} r="16.8" />
      <g transform={`translate(${shift} ${shift}) scale(${MARK})`}>
        <path class="medal-mark" d={MARK_PATHS[achievement.mark]} />
      </g>
    </svg>
  );
}
