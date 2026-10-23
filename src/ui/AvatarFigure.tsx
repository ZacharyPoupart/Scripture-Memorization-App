import { armorWorn, sceneUrl, type Look } from '../core/avatar.ts';
import { ArmorLayers } from './ArmorArt.tsx';

/** A painted background if one is chosen, otherwise one calm morning sky behind the knight. */
function Background({ scene }: { scene: string }) {
  const url = sceneUrl(scene);
  if (url) return <image href={url} x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid slice" />;
  return (
    <g>
      <rect width="120" height="120" fill="#cfe6ea" />
      <ellipse cx="26" cy="26" rx="14" ry="6" fill="#fff" opacity="0.7" />
      <ellipse cx="94" cy="40" rx="12" ry="5" fill="#fff" opacity="0.6" />
    </g>
  );
}

/**
 * The knight. The painted pieces are placed in "figure units" (centred on x = 0, boots at y = 250); this scales them to fit the
 * 120 x 120 picture. The sky is the simple drawn style.
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
        <Background scene={look.scene} />
        {full && !sceneUrl(look.scene) && <circle cx="60" cy="62" r="54" fill="#fff6c9" opacity="0.4" />}
        <g transform={`translate(60 ${116 - 250 * K}) scale(${K})`}>
          <ArmorLayers look={look} />
        </g>
      </g>
    </svg>
  );
}
