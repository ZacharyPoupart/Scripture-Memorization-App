import { armorWorn, type Look } from '../core/avatar.ts';
import { ArmorLayers } from './ArmorArt.tsx';

/** One calm morning sky behind the knight. */
function Background() {
  return (
    <g>
      <rect width="120" height="120" fill="#cfe6ea" />
      <ellipse cx="26" cy="26" rx="14" ry="6" fill="#fff" opacity="0.7" />
      <ellipse cx="94" cy="40" rx="12" ry="5" fill="#fff" opacity="0.6" />
    </g>
  );
}

/** Wings of light: drawn behind the knight, from his shoulders. */
function Wings() {
  return (
    <g fill="#fffaf0" stroke="#e3dcc8" stroke-width="1" transform="translate(0 -38)">
      <path d="M44 72 C20 58 4 62 6 88 C14 80 20 84 22 92 C28 86 34 90 38 98 C40 90 42 82 46 78 Z" />
      <path d="M76 72 C100 58 116 62 114 88 C106 80 100 84 98 92 C92 86 86 90 82 98 C80 90 78 82 74 78 Z" />
    </g>
  );
}

/**
 * The knight. The painted pieces are placed in "figure units" (centred on x = 0, boots at y = 250); this scales them to fit the
 * 120 x 120 picture. The sky and the wings are the simple drawn style.
 */
export function AvatarFigure({ look, size = 120, title, view = 'full' }: { look: Look; size?: number; title?: string; view?: 'full' | 'face' }) {
  const full = armorWorn(look) === 6;
  const face = view === 'face';
  const K = 0.448;
  return (
    <svg
      viewBox={face ? '30 2 60 60' : '0 0 120 120'}
      width={size}
      height={size}
      role="img"
      aria-label={title ?? 'Your knight'}
      data-look={JSON.stringify(look)}
      data-armor={armorWorn(look)}
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`avc-${view}${size}`}>{face ? <rect x="30" y="2" width="60" height="60" rx="13" /> : <rect width="120" height="120" rx="26" />}</clipPath>
      </defs>
      <g clip-path={`url(#avc-${view}${size})`}>
        <Background />
        {full && <circle cx="60" cy="62" r="54" fill="#fff6c9" opacity="0.4" />}
        {look.cape === 'cape-wings' && <Wings />}
        <g transform={`translate(60 ${116 - 250 * K}) scale(${K})`}>
          <ArmorLayers look={look} />
        </g>
      </g>
    </svg>
  );
}
