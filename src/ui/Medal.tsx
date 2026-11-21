// A medal for an achievement (v1.85.0): a disc in bronze, silver or gold on two ribbon tails, with the achievement's line pictogram
// in the middle; an outline when not earned yet. Flat colours only (no glow), like the rest of the app.
import type { Achievement, Tier } from '../core/achievements.ts';
import { MARK_PATHS } from './marks.tsx';

export function Medal({ achievement, tier, size = 48 }: { achievement: Achievement; tier: Tier | null; size?: number }) {
  const cls = tier ? `medal medal-${tier}` : 'medal medal-none';
  return (
    <svg class={cls} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path class="medal-ribbon" d="M22 4h8l6 20h-8zM34 4h8l-6 20h-8z" />
      <circle class="medal-disc" cx="32" cy="40" r="20" />
      <circle class="medal-rim" cx="32" cy="40" r="16" />
      <g transform="translate(20 28) scale(0.5)">
        <path class="medal-mark" d={MARK_PATHS[achievement.mark]} />
      </g>
    </svg>
  );
}
