import type { ComponentChildren } from 'preact';
import { itemById, type Look } from '../core/avatar.ts';

const col = (id: string, fallback: string) => itemById(id)?.color ?? fallback;
const INK = '#2b2522';

/** A shade of `hex`, darker (negative) or lighter (positive), for simple shading without extra colours in the catalog. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

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
          {[[14, 16], [40, 10], [96, 14], [108, 40], [20, 44], [84, 30]].map(([x, y], i) => (
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
                <rect key={x} x={x} y={y + (i % 3) * 2} width={i % 2 ? 7 : 9} height={14 - (i % 3) * 2} fill={['#a6574b', '#5b7aa6', '#7d9a5b', '#c9a24f', '#8a6aa6'][i % 5]} />
              ))}
            </g>
          ))}
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

function HairBack({ id, color }: { id: string; color: string }) {
  if (id === 'hair-long') return <path d="M33 50 C28 80 34 96 42 100 L78 100 C86 96 92 80 87 50 Z" fill={color} />;
  if (id === 'hair-wave') return <path d="M33 50 C30 70 33 80 40 84 C44 78 48 74 60 74 C72 74 76 78 80 84 C87 80 90 70 87 50 Z" fill={color} />;
  return null;
}

function HairFront({ id, color }: { id: string; color: string }) {
  switch (id) {
    case 'hair-none':
      return null;
    case 'hair-buzz':
      return <path d="M37 48 C37 32 47 27 60 27 C73 27 83 32 83 48 C77 40 70 38 60 38 C50 38 43 40 37 48 Z" fill={color} opacity="0.85" />;
    case 'hair-curly':
      return (
        <g fill={color}>
          {[[40, 38], [50, 29], [62, 26], [74, 29], [83, 38], [36, 50], [84, 50]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="9" />
          ))}
        </g>
      );
    case 'hair-bun':
      return (
        <g fill={color}>
          <circle cx="60" cy="19" r="9" />
          <path d="M36 50 C36 32 47 26 60 26 C73 26 84 32 84 50 C78 40 70 36 60 36 C50 36 42 40 36 50 Z" />
        </g>
      );
    case 'hair-spiky':
      return <path d="M36 50 L39 28 L48 37 L54 19 L62 35 L70 21 L74 36 L82 27 L84 50 C76 41 68 37 60 37 C52 37 44 41 36 50 Z" fill={color} />;
    case 'hair-wave':
    case 'hair-long':
      return <path d="M35 52 C33 32 46 25 60 25 C74 25 87 32 85 52 C82 42 76 36 66 35 C58 40 46 40 35 52 Z" fill={color} />;
    default: // short
      return <path d="M36 50 C36 32 47 25 60 25 C73 25 84 32 84 50 C78 40 70 36 60 36 C50 36 42 40 36 50 Z" fill={color} />;
  }
}

function Outfit({ id }: { id: string }) {
  const c = col(id, '#2a6569');
  const dark = shade(c, -0.25);
  const light = shade(c, 0.35);
  const torso = <path d="M20 122 C20 94 38 84 60 84 C82 84 100 94 100 122 Z" fill={c} />;
  switch (id) {
    case 'out-hoodie-plum':
    case 'out-hoodie-sky':
      return (
        <g>
          {torso}
          <path d="M42 86 C46 94 74 94 78 86 C74 82 46 82 42 86 Z" fill={dark} />
          <rect x="48" y="106" width="24" height="12" rx="4" fill={dark} opacity="0.55" />
          <line x1="56" y1="92" x2="56" y2="102" stroke={light} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="64" y1="92" x2="64" y2="102" stroke={light} strokeWidth="1.6" strokeLinecap="round" />
        </g>
      );
    case 'out-overalls':
      return (
        <g>
          <path d="M20 122 C20 94 38 84 60 84 C82 84 100 94 100 122 Z" fill="#f2efe6" />
          <path d="M42 120 L46 96 L74 96 L78 120 Z" fill={c} />
          <rect x="44" y="86" width="6" height="14" fill={c} />
          <rect x="70" y="86" width="6" height="14" fill={c} />
          <circle cx="47" cy="100" r="1.8" fill="#f2c94c" />
          <circle cx="73" cy="100" r="1.8" fill="#f2c94c" />
        </g>
      );
    case 'out-cardigan-rose':
      return (
        <g>
          {torso}
          <path d="M60 84 L60 122" stroke={dark} strokeWidth="2" />
          {[96, 104, 112].map((y) => (
            <circle key={y} cx="57" cy={y} r="1.6" fill={light} />
          ))}
          <path d="M48 85 L60 100 L72 85 L66 84 L60 92 L54 84 Z" fill="#f4efe6" />
        </g>
      );
    case 'out-tunic-olive':
      return (
        <g>
          {torso}
          <rect x="22" y="104" width="76" height="5" fill={dark} />
          <path d="M50 84 C54 92 66 92 70 84 Z" fill={light} />
        </g>
      );
    case 'out-robe-cream':
    case 'out-robe-gold':
      return (
        <g>
          {torso}
          <path d="M48 84 L60 106 L72 84 L66 83 L60 96 L54 83 Z" fill={id === 'out-robe-gold' ? '#fff0b8' : dark} opacity="0.9" />
          <line x1="60" y1="106" x2="60" y2="122" stroke={dark} strokeWidth="2" />
          <rect x="20" y="112" width="80" height="4" fill={id === 'out-robe-gold' ? '#fff0b8' : shade(c, -0.12)} opacity="0.8" />
        </g>
      );
    case 'out-scholar':
      return (
        <g>
          {torso}
          <path d="M46 84 L60 100 L74 84 L68 83 L60 92 L52 83 Z" fill="#f4efe6" />
          <rect x="56" y="100" width="8" height="22" fill="#f2c94c" opacity="0.9" />
        </g>
      );
    default: // tees
      return (
        <g>
          {torso}
          <path d="M50 84 C54 91 66 91 70 84 C66 82 54 82 50 84 Z" fill={dark} />
        </g>
      );
  }
}

function Accessory({ id }: { id: string }) {
  switch (id) {
    case 'acc-glasses-round':
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <circle cx="50" cy="54" r="8" />
          <circle cx="70" cy="54" r="8" />
          <path d="M58 54 L62 54" />
        </g>
      );
    case 'acc-glasses-square':
      return (
        <g fill="none" stroke={INK} strokeWidth="2">
          <rect x="41" y="48" width="16" height="12" rx="3" />
          <rect x="63" y="48" width="16" height="12" rx="3" />
          <path d="M57 54 L63 54" />
        </g>
      );
    case 'acc-bowtie':
      return (
        <g fill="#c4647a">
          <path d="M60 87 L48 81 L48 93 Z" />
          <path d="M60 87 L72 81 L72 93 Z" />
          <circle cx="60" cy="87" r="3" fill="#a24a5f" />
        </g>
      );
    case 'acc-scarf':
      return (
        <g fill="#c4647a">
          <path d="M40 80 C50 90 70 90 80 80 L82 90 C70 98 50 98 38 90 Z" />
          <path d="M70 90 L78 112 L68 110 L64 94 Z" fill="#a24a5f" />
        </g>
      );
    case 'acc-book':
      return (
        <g transform="translate(78 92) rotate(-12)">
          <rect width="26" height="20" rx="2.5" fill="#8a4f3c" />
          <rect x="3" y="2.5" width="21" height="15" rx="1.5" fill="#f4efe6" />
          <line x1="13.5" y1="2.5" x2="13.5" y2="17.5" stroke="#d9cfb8" strokeWidth="1" />
        </g>
      );
    case 'acc-headphones':
      return (
        <g>
          <path d="M33 56 C31 28 89 28 87 56" fill="none" stroke="#3b3b44" strokeWidth="4" strokeLinecap="round" />
          <rect x="29" y="50" width="9" height="16" rx="4" fill="#3b3b44" />
          <rect x="82" y="50" width="9" height="16" rx="4" fill="#3b3b44" />
        </g>
      );
    case 'acc-medal':
      return (
        <g>
          <path d="M52 86 L60 100 L68 86" fill="none" stroke="#c4647a" strokeWidth="3" />
          <circle cx="60" cy="104" r="6" fill="#f2c94c" stroke="#c9962c" strokeWidth="1.5" />
          <path d="M60 100.5 L61.2 103 L64 103.3 L62 105.2 L62.5 108 L60 106.6 L57.5 108 L58 105.2 L56 103.3 L58.8 103 Z" fill="#c9962c" />
        </g>
      );
    default:
      return null;
  }
}

function Hat({ id }: { id: string }) {
  switch (id) {
    case 'hat-cap':
      return (
        <g>
          <path d="M36 42 C36 24 84 24 84 42 Z" fill="#3f6ea8" />
          <path d="M50 42 L96 44 C96 49 56 50 50 46 Z" fill="#2f5382" />
        </g>
      );
    case 'hat-beanie':
      return (
        <g>
          <path d="M35 42 C35 18 85 18 85 42 Z" fill="#c4647a" />
          <rect x="34" y="38" width="52" height="8" rx="4" fill="#a24a5f" />
          <circle cx="60" cy="17" r="5" fill="#f4efe6" />
        </g>
      );
    case 'hat-flower':
      return (
        <g transform="translate(79 32)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3.4" ry="5" fill="#f2b8c6" transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill="#f2c94c" />
        </g>
      );
    case 'hat-sunhat':
      return (
        <g>
          <ellipse cx="60" cy="38" rx="42" ry="9" fill="#e6c98a" />
          <path d="M40 38 C40 16 80 16 80 38 Z" fill="#e6c98a" />
          <rect x="40" y="31" width="40" height="5" fill="#c4647a" />
        </g>
      );
    case 'hat-crown':
      return (
        <g>
          <path d="M40 38 L40 20 L50 29 L60 14 L70 29 L80 20 L80 38 Z" fill="#f2c94c" stroke="#c9962c" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="60" cy="22" r="2.4" fill="#c4647a" />
          <circle cx="45" cy="30" r="1.8" fill="#5b8fc7" />
          <circle cx="75" cy="30" r="1.8" fill="#5b8fc7" />
        </g>
      );
    case 'hat-laurel':
      return (
        <g fill="#6f9a5a">
          {[-66, -50, -34, -18].map((a, i) => (
            <ellipse key={i} cx={60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) - 2} cy={46 + 24 * Math.sin(((a - 90) * Math.PI) / 180)} rx="2.6" ry="5.4" transform={`rotate(${a} ${60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) - 2} ${46 + 24 * Math.sin(((a - 90) * Math.PI) / 180)})`} />
          ))}
          {[66, 50, 34, 18].map((a, i) => (
            <ellipse key={i} cx={60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) + 2} cy={46 + 24 * Math.sin(((a - 90) * Math.PI) / 180)} rx="2.6" ry="5.4" transform={`rotate(${a} ${60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) + 2} ${46 + 24 * Math.sin(((a - 90) * Math.PI) / 180)})`} />
          ))}
        </g>
      );
    case 'hat-halo':
      return <ellipse cx="60" cy="15" rx="17" ry="5" fill="none" stroke="#f2c94c" strokeWidth="3.5" />;
    default:
      return null;
  }
}

function Companion({ id }: { id: string }) {
  const g = (children: ComponentChildren) => <g transform="translate(2 86)">{children}</g>;
  switch (id) {
    case 'pet-sprout':
      return g(
        <g>
          <path d="M8 34 L10 26 L24 26 L26 34 Z" fill="#b87c52" />
          <path d="M17 26 C17 18 17 14 17 10" stroke="#5f9a70" strokeWidth="2.4" fill="none" />
          <path d="M17 14 C10 14 8 8 9 5 C15 5 17 9 17 14 Z" fill="#7fb98a" />
          <path d="M17 12 C24 12 27 6 25 3 C19 3 17 7 17 12 Z" fill="#8fc19e" />
        </g>,
      );
    case 'pet-lamb':
      return g(
        <g>
          {[[10, 24], [18, 20], [26, 24], [14, 28], [22, 28]].map(([x, y], i) => (
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
    default:
      return null;
  }
}

/** The avatar: a friendly figure drawn from simple shapes, so it works offline, scales sharply and follows the theme. */
export function AvatarFigure({ look, size = 120, title }: { look: Look; size?: number; title?: string }) {
  const skin = col(look.skin, '#efc09a');
  const hair = col(look.hairColor, '#6a4630');
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={title ?? 'Your avatar'} data-look={JSON.stringify(look)} style={{ display: 'block' }}>
      <defs>
        <clipPath id={`avc-${size}`}>
          <rect width="120" height="120" rx="26" />
        </clipPath>
      </defs>
      <g clip-path={`url(#avc-${size})`}>
        <Background id={look.background} />
        <HairBack id={look.hair} color={hair} />
        <Outfit id={look.outfit} />
        <rect x="53" y="68" width="14" height="20" rx="5" fill={shade(skin, -0.08)} />
        <circle cx="35" cy="55" r="4.4" fill={skin} />
        <circle cx="85" cy="55" r="4.4" fill={skin} />
        <circle cx="60" cy="52" r="25" fill={skin} />
        <HairFront id={look.hair} color={hair} />
        <circle cx="51" cy="54" r="2.8" fill={INK} />
        <circle cx="69" cy="54" r="2.8" fill={INK} />
        <circle cx="51.9" cy="53" r="0.9" fill="#fff" />
        <circle cx="69.9" cy="53" r="0.9" fill="#fff" />
        <circle cx="45" cy="62" r="4" fill="#e58f8f" opacity="0.35" />
        <circle cx="75" cy="62" r="4" fill="#e58f8f" opacity="0.35" />
        <path d="M52 64 Q60 72 68 64" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
        <Accessory id={look.accessory} />
        <Hat id={look.hat} />
        <Companion id={look.companion} />
      </g>
    </svg>
  );
}
