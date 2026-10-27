import { useState } from 'preact/hooks';
import { BANNER_COLORS, BANNER_DESIGNS, bannerSpec, colorHex, type Banner, type BannerDesign } from '../core/banner.ts';
import { CloseX, Overlay } from './common.tsx';

/** The shield outline every banner is drawn in (a 100 x 124 picture). */
const SHIELD = 'M10 10 H90 V70 C90 98 70 113 50 120 C30 113 10 98 10 70 Z';

/** One design in the pattern colour, in the shield's own coordinates (they run past its edges; the shield clips them). */
function Pattern({ design, color }: { design: BannerDesign; color: string }) {
  switch (design) {
    case 'pale':
      return <rect x="50" y="0" width="50" height="130" fill={color} />;
    case 'fess':
      return <rect x="0" y="65" width="100" height="70" fill={color} />;
    case 'bend':
      return <polygon points="0,0 0,130 100,130" fill={color} />;
    case 'chevron':
      return <polygon points="0,48 50,84 100,48 100,72 50,108 0,72" fill={color} />;
    case 'cross':
      return (
        <g fill={color}>
          <rect x="40" y="0" width="20" height="130" />
          <rect x="0" y="44" width="100" height="20" />
        </g>
      );
    case 'saltire':
      return <path d="M0 0 L100 130 M100 0 L0 130" stroke={color} stroke-width="18" fill="none" />;
    case 'quarters':
      return (
        <g fill={color}>
          <rect x="50" y="0" width="50" height="65" />
          <rect x="0" y="65" width="50" height="65" />
        </g>
      );
    case 'chief':
      return <rect x="0" y="0" width="100" height="42" fill={color} />;
    case 'bars':
      return (
        <g fill={color}>
          <rect x="0" y="30" width="100" height="14" />
          <rect x="0" y="58" width="100" height="14" />
          <rect x="0" y="86" width="100" height="14" />
        </g>
      );
    case 'stripes':
      return (
        <g fill={color}>
          <rect x="22" y="0" width="12" height="130" />
          <rect x="44" y="0" width="12" height="130" />
          <rect x="66" y="0" width="12" height="130" />
        </g>
      );
    case 'diamond':
      return <polygon points="50,30 78,66 50,102 22,66" fill={color} />;
    case 'circle':
      return <circle cx="50" cy="64" r="24" fill={color} />;
    case 'pall':
      return <path d="M0 0 L50 66 L100 0 M50 66 V130" stroke={color} stroke-width="16" fill="none" stroke-linejoin="miter" />;
    case 'border':
      return <path d="M18 18 H82 V70 C82 94 66 105 50 111 C34 105 18 94 18 70 Z" stroke={color} stroke-width="7" fill="none" stroke-linejoin="round" />;
    default:
      return null;
  }
}

/** The painted light and shade over the colours: bright at the top, darker at the bottom, so it reads like the knights' armor and not flat shapes. */
function Shade({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.26" />
      <stop offset="0.42" stop-color="#fff" stop-opacity="0" />
      <stop offset="1" stop-color="#000" stop-opacity="0.34" />
    </linearGradient>
  );
}

/** A banner as a little shield with a gold edge and crest. `size` is its width. */
export function BannerFigure({ banner, size = 34, title }: { banner: Banner; size?: number; title?: string }) {
  const spec = bannerSpec(banner);
  const clip = `bnc-${spec}`;
  const shade = `bns-${spec}`;
  return (
    <svg viewBox="0 0 100 124" width={size} height={Math.round(size * 1.24)} role="img" aria-label={title ?? 'Group banner'} data-banner={spec} style={{ display: 'block', flex: 'none' }}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
        <Shade id={shade} />
      </defs>
      <path d={SHIELD} fill="#000" opacity="0.22" transform="translate(0 3)" />
      <g clip-path={`url(#${clip})`}>
        <rect x="0" y="0" width="100" height="130" fill={colorHex(banner.field)} />
        <Pattern design={banner.design} color={colorHex(banner.pattern)} />
        <rect x="0" y="0" width="100" height="130" fill={`url(#${shade})`} />
        <ellipse cx="34" cy="26" rx="28" ry="14" fill="#fff" opacity="0.13" />
      </g>
      <path d={SHIELD} fill="none" stroke="#7a4f12" stroke-width="7" stroke-linejoin="round" />
      <path d={SHIELD} fill="none" stroke="#e3b23c" stroke-width="4.4" stroke-linejoin="round" />
      <path d={SHIELD} fill="none" stroke="#f7e0a0" stroke-width="1.2" stroke-linejoin="round" opacity="0.85" transform="translate(0 -0.6)" />
      <rect x="33" y="1" width="34" height="13" rx="4.5" fill="#e3b23c" stroke="#7a4f12" stroke-width="1.6" />
      <rect x="37" y="4" width="26" height="3" rx="1.5" fill="#f7e0a0" opacity="0.8" />
    </svg>
  );
}

/** A little flag stand for the avatar picture (120 x 120), on the knight's right: a pole on the ground with the banner hanging from a crossbar. */
export function FlagStand({ banner }: { banner: Banner }) {
  const spec = bannerSpec(banner);
  const clip = `fsc-${spec}`;
  const shade = `fss-${spec}`;
  const soft = `fsb-${spec}`;
  const tight = `fst-${spec}`;
  const fold = `fsf-${spec}`;
  const ball = `fsg-${spec}`;
  return (
    <g data-testid="flag-stand" data-flag={spec}>
      <defs>
        <clipPath id={clip}>
          <path d={SHIELD} />
        </clipPath>
        <Shade id={shade} />
        <filter id={soft} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={tight} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <radialGradient id={ball} cx="0.65" cy="0.3" r="0.8">
          <stop offset="0" stop-color="#f7e0a0" />
          <stop offset="0.45" stop-color="#e3b23c" />
          <stop offset="1" stop-color="#9a6a14" />
        </radialGradient>
        <linearGradient id={fold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity="0.34" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </linearGradient>
      </defs>
      {/* on the ground: a soft pool under the pole and a longer shadow it throws to the left */}
      <ellipse cx="102" cy="113.5" rx="11" ry="3" fill="#000" opacity="0.6" filter={`url(#${soft})`} />
      <ellipse cx="92" cy="114.2" rx="17" ry="2.6" fill="#000" opacity="0.45" filter={`url(#${soft})`} />
      {/* the pole's own shadow on the scene behind it */}
      <rect x="96.4" y="20.5" width="3.6" height="93.5" rx="1.4" fill="#000" opacity="0.6" filter={`url(#${tight})`} />
      <rect x="100.6" y="18" width="2.8" height="95" rx="1.2" fill="#8a6a2a" stroke="#5a4416" stroke-width="0.6" />
      {/* the pole's lit side is on the right, its left side is in shade */}
      <rect x="100.6" y="18" width="1.2" height="95" rx="0.6" fill="#000" opacity="0.28" />
      <circle cx="100" cy="19" r="3.2" fill="#000" opacity="0.6" filter={`url(#${tight})`} />
      <circle cx="102" cy="17" r="3" fill={`url(#${ball})`} stroke="#7a4f12" stroke-width="0.8" />
      <rect x="85" y="24" width="34" height="2.8" rx="1.2" fill="#000" opacity="0.3" filter={`url(#${tight})`} />
      <rect x="85" y="22" width="34" height="2.8" rx="1.2" fill="#8a6a2a" stroke="#5a4416" stroke-width="0.6" />
      {/* the banner throws a soft shadow onto the scene behind it */}
      <g transform="translate(83 29.8) scale(0.3)" opacity="0.75" filter={`url(#${soft})`}>
        <path d={SHIELD} fill="#000" />
      </g>
      <g transform="translate(87 24.8) scale(0.3)">
        <g clip-path={`url(#${clip})`}>
          <rect x="0" y="0" width="100" height="130" fill={colorHex(banner.field)} />
          <Pattern design={banner.design} color={colorHex(banner.pattern)} />
          <rect x="0" y="0" width="100" height="130" fill={`url(#${shade})`} />
          {/* the crossbar shades the top of the cloth */}
          <rect x="0" y="0" width="100" height="26" fill={`url(#${fold})`} />
        </g>
        <path d={SHIELD} fill="none" stroke="#7a4f12" stroke-width="7" stroke-linejoin="round" />
        <path d={SHIELD} fill="none" stroke="#e3b23c" stroke-width="4.4" stroke-linejoin="round" />
      </g>
    </g>
  );
}

/** The leader's editor: pick a design and two colours, see it as you go. */
export function BannerEditor({ initial, onSave, onClose }: { initial: Banner; onSave: (b: Banner) => Promise<boolean> | boolean; onClose: () => void }) {
  const [b, setB] = useState<Banner>(initial);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await onSave(b);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Overlay onClose={onClose} center label="Group banner">
      <div class="modal stack banner-editor" data-testid="banner-editor">
        <CloseX onClick={onClose} />
        <h2 style={{ margin: 0, textAlign: 'center' }}>Group banner</h2>
        <div class="banner-preview">
          <BannerFigure banner={b} size={70} title="Banner preview" />
        </div>
        <div class="muted small">Design</div>
        <div class="banner-designs" role="group" aria-label="Design">
          {BANNER_DESIGNS.map((d) => (
            <button key={d.id} class={`banner-pick ${b.design === d.id ? 'on' : ''}`} aria-pressed={b.design === d.id} aria-label={d.name} onClick={() => setB({ ...b, design: d.id })} data-testid={`banner-design-${d.id}`}>
              <BannerFigure banner={{ ...b, design: d.id }} size={34} title={d.name} />
            </button>
          ))}
        </div>
        <div class="muted small">Main color</div>
        <div class="banner-colors" role="group" aria-label="Main color">
          {BANNER_COLORS.map((c) => (
            <button key={c.id} class={`banner-swatch ${b.field === c.id ? 'on' : ''}`} style={{ background: c.hex }} aria-pressed={b.field === c.id} aria-label={c.name} onClick={() => setB({ ...b, field: c.id })} data-testid={`banner-field-${c.id}`} />
          ))}
        </div>
        <div class="muted small">Pattern color</div>
        <div class="banner-colors" role="group" aria-label="Pattern color">
          {BANNER_COLORS.map((c) => (
            <button key={c.id} class={`banner-swatch ${b.pattern === c.id ? 'on' : ''}`} style={{ background: c.hex }} aria-pressed={b.pattern === c.id} aria-label={c.name} onClick={() => setB({ ...b, pattern: c.id })} data-testid={`banner-pattern-${c.id}`} />
          ))}
        </div>
        <button class="btn primary block" disabled={busy} onClick={() => void save()} data-testid="banner-save">
          Save banner
        </button>
      </div>
    </Overlay>
  );
}
