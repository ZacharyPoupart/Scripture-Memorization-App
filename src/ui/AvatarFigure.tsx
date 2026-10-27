import { armorWorn, sceneUrl, type Look } from '../core/avatar.ts';
import { bannerFromScene } from '../core/banner.ts';
import { ArmorLayers } from './ArmorArt.tsx';
import { BannerBackground } from './Banner.tsx';

/** The painted background behind the knight. */
function Background({ scene }: { scene: string }) {
  const banner = bannerFromScene(scene);
  if (banner) return <BannerBackground banner={banner} />;
  const url = sceneUrl(scene);
  return url ? <image href={url} x="0" y="0" width="120" height="120" preserveAspectRatio="xMidYMid slice" /> : <rect width="120" height="120" fill="#cfe6ea" />;
}

/**
 * The knight. The painted pieces are placed in "figure units" (centred on x = 0, boots at y = 250); this scales them to fit the
 * 120 x 120 picture. The background is a painted picture.
 */
export function AvatarFigure({ look, size = 120, title, view = 'full' }: { look: Look; size?: number; title?: string; view?: 'full' | 'face' }) {
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
        <g transform={`translate(60 ${116 - 250 * K}) scale(${K})`}>
          <ArmorLayers look={look} />
        </g>
      </g>
    </svg>
  );
}
