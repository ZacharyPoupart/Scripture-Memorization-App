import type { ComponentChildren } from 'preact';
import { armorWorn, itemById, type Look } from '../core/avatar.ts';
import { ArmorExtras, ArmorLayers } from './ArmorArt.tsx';

const col = (id: string, fallback: string) => itemById(id)?.color ?? fallback;
const INK = '#2b2522';
const none = (id: string) => id.endsWith('-none');

function Background({ id }: { id: string }) {
  const c = col(id, '#cfe6ea');
  const base = <rect width="120" height="120" fill={c} />;
  switch (id) {
    case 'bg-meadow':
      return (
        <g>
          {base}
          <ellipse cx="30" cy="124" rx="70" ry="28" fill="#a9cf86" />
          <ellipse cx="100" cy="126" rx="60" ry="24" fill="#8fbf74" />
          <circle cx="92" cy="22" r="9" fill="#fff6c9" />
        </g>
      );
    case 'bg-sunrise':
      return (
        <g>
          {base}
          <rect y="70" width="120" height="50" fill="#f0b98c" />
          <circle cx="60" cy="74" r="26" fill="#fbe39a" />
          <rect y="90" width="120" height="30" fill="#e9a77b" />
        </g>
      );
    case 'bg-dusk':
      return (
        <g>
          {base}
          <rect y="60" width="120" height="60" fill="#a99ad0" />
          <circle cx="92" cy="26" r="9" fill="#fdf4d8" />
          <circle cx="96" cy="24" r="8" fill={c} />
        </g>
      );
    case 'bg-garden':
      return (
        <g>
          {base}
          <rect y="84" width="120" height="36" fill="#8fc19e" />
          {[14, 34, 98, 110].map((x, i) => (
            <g key={x}>
              <rect x={x - 0.8} y="88" width="1.6" height="14" fill="#5f9a70" />
              <circle cx={x} cy="86" r="4" fill={['#e58f8f', '#f4d06f', '#fff', '#b79bea'][i]} />
            </g>
          ))}
        </g>
      );
    case 'bg-night':
      return (
        <g>
          {base}
          {[
            [14, 16],
            [40, 10],
            [96, 14],
            [108, 40],
            [20, 44],
            [84, 30],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 2 ? 1.2 : 1.8} fill="#fff6c9" />
          ))}
          <circle cx="100" cy="18" r="8" fill="#fdf4d8" />
          <circle cx="104" cy="16" r="7" fill={c} />
        </g>
      );
    case 'bg-library':
      return (
        <g>
          {base}
          {[22, 52, 82].map((y) => (
            <g key={y}>
              <rect x="0" y={y + 14} width="120" height="3" fill="#8a6a45" />
              {[6, 16, 24, 36, 46, 58, 68, 80, 92, 104].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={y + (i % 3) * 2}
                  width={i % 2 ? 7 : 9}
                  height={14 - (i % 3) * 2}
                  fill={['#a6574b', '#5b7aa6', '#7d9a5b', '#c9a24f', '#8a6aa6'][i % 5]}
                />
              ))}
            </g>
          ))}
        </g>
      );
    case 'bg-castle':
      return (
        <g>
          {base}
          <rect y="70" width="120" height="50" fill="#a9adb8" />
          {[0, 24, 48, 72, 96].map((x) => (
            <rect key={x} x={x} y="62" width="14" height="12" fill="#a9adb8" />
          ))}
          {[
            [8, 84],
            [40, 90],
            [72, 84],
            [100, 92],
          ].map(([x, y]) => (
            <rect key={x} x={x} y={y} width="16" height="6" rx="1" fill="#8e929e" />
          ))}
          <rect x="84" y="20" width="2" height="22" fill="#6b6f7a" />
          <path d="M86 20 L102 26 L86 32 Z" fill="#b5483f" />
        </g>
      );
    case 'bg-mountain':
      return (
        <g>
          {base}
          <path d="M-10 120 L38 40 L66 84 L82 60 L130 120 Z" fill="#9db3c9" />
          <path d="M28 56 L38 40 L48 56 L42 52 L38 58 L34 52 Z" fill="#fff" />
          <path d="M-10 120 L20 86 L40 104 L70 80 L130 120 Z" fill="#7f9bb5" />
          <circle cx="96" cy="24" r="8" fill="#fff6c9" />
        </g>
      );
    case 'bg-gold':
      return (
        <g>
          {base}
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <polygon key={i} points="60,60 40,-20 80,-20" fill="#fff0b8" opacity="0.5" transform={`rotate(${i * 45} 60 60)`} />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {base}
          <ellipse cx="26" cy="26" rx="14" ry="6" fill="#fff" opacity="0.7" />
          <ellipse cx="94" cy="40" rx="12" ry="5" fill="#fff" opacity="0.6" />
        </g>
      );
  }
}

function Companion({ id }: { id: string }) {
  const g = (children: ComponentChildren) => <g transform="translate(2 88) scale(0.88)">{children}</g>;
  switch (id) {
    case 'pet-sprout':
      return g(
        <g>
          <path d="M8 34 L10 26 L24 26 L26 34 Z" fill="#b87c52" />
          <path d="M17 26 C17 18 17 14 17 10" stroke="#5f9a70" stroke-width="2.4" fill="none" />
          <path d="M17 14 C10 14 8 8 9 5 C15 5 17 9 17 14 Z" fill="#7fb98a" />
          <path d="M17 12 C24 12 27 6 25 3 C19 3 17 7 17 12 Z" fill="#8fc19e" />
        </g>,
      );
    case 'pet-lamb':
      return g(
        <g>
          {[
            [10, 24],
            [18, 20],
            [26, 24],
            [14, 28],
            [22, 28],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="7" fill="#f4efe6" />
          ))}
          <circle cx="28" cy="18" r="6" fill="#4a4040" />
          <circle cx="30" cy="17" r="1" fill="#fff" />
          <rect x="11" y="32" width="3" height="6" rx="1.2" fill="#4a4040" />
          <rect x="21" y="32" width="3" height="6" rx="1.2" fill="#4a4040" />
        </g>,
      );
    case 'pet-dove':
      return g(
        <g>
          <ellipse cx="17" cy="26" rx="12" ry="8" fill="#f4efe6" />
          <circle cx="27" cy="19" r="6" fill="#f4efe6" />
          <path d="M32 19 L37 20.5 L32 22 Z" fill="#e6a95a" />
          <circle cx="28.5" cy="18" r="1.1" fill={INK} />
          <path d="M8 24 C14 12 24 14 24 24 C18 26 12 26 8 24 Z" fill="#d9e3ec" />
        </g>,
      );
    case 'pet-kitten':
      return g(
        <g>
          <ellipse cx="16" cy="29" rx="11" ry="8" fill="#e6a35a" />
          <circle cx="17" cy="19" r="8" fill="#e6a35a" />
          <path d="M10 14 L11 7 L16 12 Z M24 14 L23 7 L18 12 Z" fill="#e6a35a" />
          <circle cx="14" cy="19" r="1.3" fill={INK} />
          <circle cx="20" cy="19" r="1.3" fill={INK} />
          <path d="M16 21.5 L17 22.8 L18 21.5 Z" fill="#c4647a" />
        </g>,
      );
    case 'pet-puppy':
      return g(
        <g>
          <ellipse cx="16" cy="29" rx="11" ry="8" fill="#c99a6a" />
          <circle cx="17" cy="19" r="8" fill="#c99a6a" />
          <ellipse cx="9" cy="19" rx="3.4" ry="6.5" fill="#8d6240" />
          <ellipse cx="25" cy="19" rx="3.4" ry="6.5" fill="#8d6240" />
          <circle cx="14" cy="18" r="1.3" fill={INK} />
          <circle cx="20" cy="18" r="1.3" fill={INK} />
          <ellipse cx="17" cy="22" rx="2.4" ry="1.7" fill={INK} />
        </g>,
      );
    case 'pet-owl':
      return g(
        <g>
          <ellipse cx="16" cy="26" rx="10" ry="12" fill="#8d6a4a" />
          <path d="M8 16 L9 9 L14 14 Z M24 16 L23 9 L18 14 Z" fill="#8d6a4a" />
          <circle cx="12" cy="21" r="4.6" fill="#f4efe6" />
          <circle cx="20" cy="21" r="4.6" fill="#f4efe6" />
          <circle cx="12" cy="21" r="2" fill={INK} />
          <circle cx="20" cy="21" r="2" fill={INK} />
          <path d="M16 24 L14.5 27 L17.5 27 Z" fill="#e6a95a" />
        </g>,
      );
    case 'pet-lion':
      return g(
        <g>
          <ellipse cx="16" cy="29" rx="11" ry="8" fill="#d9a85b" />
          <circle cx="17" cy="20" r="11" fill="#9b6a36" />
          <circle cx="17" cy="20" r="7.5" fill="#e0b46a" />
          <circle cx="14.4" cy="19" r="1.2" fill={INK} />
          <circle cx="19.6" cy="19" r="1.2" fill={INK} />
          <path d="M16 22 L17 23.2 L18 22 Z" fill="#c4647a" />
        </g>,
      );
    case 'pet-eagle':
      return g(
        <g>
          <ellipse cx="16" cy="28" rx="10" ry="11" fill="#7a5638" />
          <path d="M6 24 C-2 18 0 34 8 34 Z M26 24 C34 18 32 34 24 34 Z" fill="#5d4129" />
          <circle cx="17" cy="14" r="7" fill="#f4efe6" />
          <path d="M22 14 L29 16.5 L22 18.5 Z" fill="#e6a95a" />
          <circle cx="19" cy="12.5" r="1.3" fill={INK} />
          <path d="M12 38 L10 42 M22 38 L24 42" stroke="#e6a95a" stroke-width="2" stroke-linecap="round" />
        </g>,
      );
    case 'pet-dragon':
      return g(
        <g>
          <path d="M26 30 C36 28 38 18 34 14 C34 22 30 24 24 26 Z" fill="#4f9a62" />
          <ellipse cx="15" cy="29" rx="11" ry="8" fill="#5fae6f" />
          <circle cx="12" cy="17" r="8" fill="#5fae6f" />
          <path d="M7 12 L5 5 L11 9 Z M17 10 L19 3 L21 11 Z" fill="#e6a95a" />
          <path d="M20 24 C28 12 38 14 34 24 C30 22 24 24 20 24 Z" fill="#3f8250" />
          <circle cx="9.5" cy="16" r="1.4" fill={INK} />
          <circle cx="15" cy="16" r="1.4" fill={INK} />
          <circle cx="8" cy="20" r="0.9" fill="#3f8250" />
          <circle cx="12" cy="20" r="0.9" fill="#3f8250" />
        </g>,
      );
    case 'pet-angel':
      return g(
        <g>
          <path d="M4 22 C-2 12 6 6 12 18 Z M28 22 C34 12 26 6 20 18 Z" fill="#fffaf0" stroke="#e3dcc8" stroke-width="0.8" />
          <path d="M9 36 C9 24 23 24 23 36 Z" fill="#fffaf0" />
          <circle cx="16" cy="19" r="6" fill="#f6d6bd" />
          <ellipse cx="16" cy="11" rx="6" ry="1.8" fill="none" stroke="#f2c94c" stroke-width="1.6" />
          <circle cx="14" cy="19" r="0.9" fill={INK} />
          <circle cx="18" cy="19" r="0.9" fill={INK} />
        </g>,
      );
    default:
      return null;
  }
}

function Crown({ id, lift }: { id: string; lift: number }) {
  if (none(id)) return null;
  if (id === 'crown-halo') return <ellipse cx="60" cy={18 - lift} rx="17" ry="5" fill="none" stroke="#f2c94c" stroke-width="3.5" />;
  return (
    <g transform={`translate(0 ${-lift})`}>
      {id === 'crown-royal' && (
        <g>
          <path d="M40 38 L40 20 L50 29 L60 14 L70 29 L80 20 L80 38 Z" fill="#f2c94c" stroke="#c9962c" stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="60" cy="22" r="2.4" fill="#c4647a" />
          <circle cx="45" cy="30" r="1.8" fill="#5b8fc7" />
          <circle cx="75" cy="30" r="1.8" fill="#5b8fc7" />
        </g>
      )}
      {id === 'crown-life' && (
        <g>
          <path
            d="M38 38 L36 16 L47 27 L54 10 L60 24 L66 10 L73 27 L84 16 L82 38 Z"
            fill="#fff0b8"
            stroke="#e2b53c"
            stroke-width="1.8"
            stroke-linejoin="round"
          />
          {[
            [60, 18, '#c4647a'],
            [46, 31, '#5b8fc7'],
            [74, 31, '#5fae6f'],
          ].map(([x, y, f]) => (
            <circle key={String(x)} cx={Number(x)} cy={Number(y)} r="2.4" fill={String(f)} stroke="#e2b53c" stroke-width="0.8" />
          ))}
          <path d="M60 6 L61.6 10 L66 10.4 L62.6 13 L63.6 17 L60 14.8 L56.4 17 L57.4 13 L54 10.4 L58.4 10 Z" fill="#fff6c9" opacity="0.95" />
        </g>
      )}
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
 * 120 x 120 picture. Scenes, companions, wings and crowns are the simple drawn style.
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
        <Background id={look.background} />
        {full && <circle cx="60" cy="62" r="54" fill="#fff6c9" opacity="0.4" />}
        {look.cape === 'cape-wings' && <Wings />}
        <Companion id={look.companion} />
        <g transform={`translate(60 ${116 - 250 * K}) scale(${K})`}>
          <ArmorLayers look={look} />
          <ArmorExtras look={look} />
        </g>
        {!none(look.crown) && (
          <g transform="translate(60 10) scale(0.42) translate(-60 -26)">
            <Crown id={look.crown} lift={0} />
          </g>
        )}
      </g>
    </svg>
  );
}
