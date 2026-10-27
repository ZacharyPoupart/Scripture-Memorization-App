export type ChestState = 'locked' | 'closed' | 'open';

/**
 * The reward chest of a group: shut while the goal is ahead, open and glowing once it is reached, and shut with a padlock while
 * the group is only one person (the reward is for a group of two or more). Painted in the same gold-edged style as the banners.
 */
export function TreasureChest({ state, size = 64 }: { state: ChestState; size?: number }) {
  const open = state === 'open';
  const id = `chest-${state}`;
  const label = open ? 'Treasure chest, open: the reward is yours' : state === 'locked' ? 'Treasure chest, locked until the group has two people' : 'Treasure chest, closed: reach the goal to open it';
  return (
    <svg viewBox="0 0 80 72" width={size} height={Math.round(size * 0.9)} role="img" aria-label={label} data-testid="guild-chest" data-state={state} style={{ display: 'block', flex: 'none', opacity: state === 'locked' ? 0.62 : 1 }}>
      <defs>
        <linearGradient id={`${id}-wood`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#b97a3c" />
          <stop offset="1" stop-color="#6e4220" />
        </linearGradient>
        <linearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#c88a46" />
          <stop offset="1" stop-color="#8a5628" />
        </linearGradient>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f7e0a0" />
          <stop offset="0.5" stop-color="#e3b23c" />
          <stop offset="1" stop-color="#b9831c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fff3b0" stop-opacity="0.95" />
          <stop offset="1" stop-color="#ffd966" stop-opacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d="M10 62 V30 C10 18 24 12 40 12 C56 12 70 18 70 30 V62 Z" />
        </clipPath>
      </defs>
      <ellipse cx="40" cy="66" rx="30" ry="4" fill="#000" opacity="0.28" />
      {open ? (
        <g>
          <circle cx="40" cy="26" r="30" fill={`url(#${id}-glow)`} />
          {/* the lid, tipped back */}
          <path d="M14 34 L11 10 C27 2 53 2 69 10 L66 34 Z" fill="#5a3a18" stroke="#3a2410" stroke-width="2" stroke-linejoin="round" />
          <path d="M20 32 L18 12 C30 7 50 7 62 12 L60 32 Z" fill="#7a4e24" />
          <rect x="35" y="5" width="10" height="26" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
          {/* the body, with the treasure heaped above its rim */}
          <path d="M10 36 H70 V62 H10 Z" fill={`url(#${id}-wood)`} stroke="#3a2410" stroke-width="2.4" stroke-linejoin="round" />
          <ellipse cx="40" cy="36" rx="30" ry="5" fill="#2a1608" />
          <g fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="0.9">
            <circle cx="22" cy="34" r="6" />
            <circle cx="34" cy="29" r="7" />
            <circle cx="47" cy="30" r="7" />
            <circle cx="58" cy="34" r="6" />
            <circle cx="40" cy="35" r="6" />
          </g>
          <g fill="#9a6a14" opacity="0.7">
            <rect x="32" y="26" width="4" height="4" rx="1" />
            <rect x="45" y="27" width="4" height="4" rx="1" />
            <rect x="20" y="32" width="3.4" height="3.4" rx="0.8" />
          </g>
          <g fill="#7a4f12" opacity="0.18">
            <rect x="12" y="46" width="56" height="1.4" />
          </g>
          <rect x="16" y="36" width="7" height="26" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
          <rect x="57" y="36" width="7" height="26" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
          {/* sparkles */}
          <g fill="#fff8d0">
            <path d="M12 16 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 z" />
            <path d="M66 8 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 z" />
            <path d="M40 2 l1.1 2.6 2.6 1.1 -2.6 1.1 -1.1 2.6 -1.1 -2.6 -2.6 -1.1 2.6 -1.1 z" />
          </g>
        </g>
      ) : (
        <g>
          <g clip-path={`url(#${id}-clip)`}>
            <rect x="10" y="10" width="60" height="54" fill={`url(#${id}-wood)`} />
            <rect x="10" y="10" width="60" height="24" fill={`url(#${id}-lid)`} />
            <g stroke="#3a2410" stroke-width="0.9" opacity="0.35">
              <path d="M10 46 H70 M10 54 H70" />
              <path d="M30 36 V62 M50 36 V62" />
              <path d="M28 14 C26 22 26 28 27 33 M52 14 C54 22 54 28 53 33" />
            </g>
            <rect x="16" y="10" width="7" height="54" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
            <rect x="57" y="10" width="7" height="54" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
            <rect x="10" y="32" width="60" height="4.5" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1" />
            <ellipse cx="30" cy="20" rx="14" ry="4" fill="#fff" opacity="0.14" />
          </g>
          <path d="M10 62 V30 C10 18 24 12 40 12 C56 12 70 18 70 30 V62 Z" fill="none" stroke="#3a2410" stroke-width="2.6" stroke-linejoin="round" />
          {/* the lock */}
          {state === 'locked' ? (
            <g>
              <path d="M35 34 V30 a5 5 0 0 1 10 0 V34" fill="none" stroke="#7a4f12" stroke-width="2.2" />
              <rect x="32" y="33" width="16" height="13" rx="3" fill="#8f98a3" stroke="#4b525c" stroke-width="1.2" />
              <circle cx="40" cy="38.5" r="1.9" fill="#2c3138" />
              <rect x="39.2" y="39" width="1.6" height="4" rx="0.6" fill="#2c3138" />
            </g>
          ) : (
            <g>
              <rect x="34" y="31" width="12" height="13" rx="2.5" fill={`url(#${id}-gold)`} stroke="#7a4f12" stroke-width="1.2" />
              <circle cx="40" cy="36.5" r="1.8" fill="#5a3a18" />
              <rect x="39.2" y="37" width="1.6" height="4" rx="0.6" fill="#5a3a18" />
            </g>
          )}
        </g>
      )}
    </svg>
  );
}
