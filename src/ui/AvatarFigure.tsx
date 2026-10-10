import type { ComponentChildren } from 'preact';
import { ARMOR_SLOTS, armorWorn, itemById, type Look } from '../core/avatar.ts';

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
    case 'bg-castle':
      return (
        <g>
          {base}
          <rect y="70" width="120" height="50" fill="#a9adb8" />
          {[0, 24, 48, 72, 96].map((x) => (
            <rect key={x} x={x} y="62" width="14" height="12" fill="#a9adb8" />
          ))}
          {[[8, 84], [40, 90], [72, 84], [100, 92]].map(([x, y]) => (
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

function HairBack({ id, color }: { id: string; color: string }) {
  if (id === 'hair-long') return <path d="M33 50 C28 80 34 96 42 100 L78 100 C86 96 92 80 87 50 Z" fill={color} />;
  if (id === 'hair-wave') return <path d="M33 50 C30 70 33 80 40 84 C44 78 48 74 60 74 C72 74 76 78 80 84 C87 80 90 70 87 50 Z" fill={color} />;
  if (id === 'hair-ponytail') return <path d="M80 40 C102 42 104 72 92 84 C90 72 88 58 80 52 Z" fill={color} />;
  if (id === 'hair-afro')
    return (
      <g fill={color}>
        {[[34, 44], [40, 30], [52, 22], [68, 22], [80, 30], [86, 44], [31, 58], [89, 58]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="12" />
        ))}
      </g>
    );
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
    case 'hair-afro':
      return <path d="M38 46 C40 34 50 30 60 30 C70 30 80 34 82 46 C76 40 70 37 60 37 C50 37 44 40 38 46 Z" fill={color} />;
    case 'hair-wave':
    case 'hair-long':
    case 'hair-ponytail':
      return <path d="M35 52 C33 32 46 25 60 25 C74 25 87 32 85 52 C82 42 76 36 66 35 C58 40 46 40 35 52 Z" fill={color} />;
    default: // short
      return <path d="M36 50 C36 32 47 25 60 25 C73 25 84 32 84 50 C78 40 70 36 60 36 C50 36 42 40 36 50 Z" fill={color} />;
  }
}


function Companion({ id }: { id: string }) {
  const g = (children: ComponentChildren) => <g transform="translate(2 86)">{children}</g>;
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
// ---------------------------------------------------------------- the knight

const tierOf = (id: string) => id.split('-').slice(1).join('-');
interface Metal {
  c: string;
  dark: string;
  light: string;
  trim: string;
  rad: boolean;
}
function metal(id: string): Metal {
  const c = col(id, '#9aa3ae');
  const tier = tierOf(id);
  return {
    c,
    dark: shade(c, -0.32),
    light: shade(c, 0.45),
    trim: tier === 'royal' ? '#e2b53c' : tier === 'radiant' ? '#ffd45a' : shade(c, -0.32),
    rad: tier === 'radiant',
  };
}
/** A path in a metal's colours; the Radiant tier also gets a soft golden glow around it. */
function Piece({ d, m, extra }: { d: string; m: Metal; extra?: ComponentChildren }) {
  return (
    <g>
      {m.rad && <path d={d} fill="none" stroke="#ffe27a" stroke-width="4.5" stroke-linejoin="round" opacity="0.55" />}
      <path d={d} fill={m.c} stroke={m.dark} stroke-width="1.3" stroke-linejoin="round" />
      {extra}
    </g>
  );
}
const none = (id: string) => id.endsWith('-none');

function Cape({ id }: { id: string }) {
  if (none(id)) return null;
  if (id === 'cape-wings')
    return (
      <g fill="#fffaf0" stroke="#e3dcc8" stroke-width="1">
        <path d="M44 72 C20 58 4 62 6 88 C14 80 20 84 22 92 C28 86 34 90 38 98 C40 90 42 82 46 78 Z" />
        <path d="M76 72 C100 58 116 62 114 88 C106 80 100 84 98 92 C92 86 86 90 82 98 C80 90 78 82 74 78 Z" />
      </g>
    );
  const c = col(id, '#b5483f');
  return (
    <g>
      <path d="M40 70 C26 90 26 108 32 118 L88 118 C94 108 94 90 80 70 Z" fill={c} stroke={shade(c, -0.3)} stroke-width="1.2" />
      <path d="M60 72 L60 118" stroke={shade(c, -0.25)} stroke-width="1.2" opacity="0.6" />
      {id === 'cape-gold' && <path d="M36 112 L84 112" stroke="#fff0b8" stroke-width="3" opacity="0.8" />}
    </g>
  );
}

function Beard({ id, color }: { id: string; color: string }) {
  const hole = <ellipse cx="60" cy="67" rx="7.5" ry="3.6" />;
  switch (id) {
    case 'beard-stubble':
      return <path d="M37 56 C37 82 83 82 83 56 C80 68 72 72 60 72 C48 72 40 68 37 56 Z" fill={color} opacity="0.28" />;
    case 'beard-moustache':
      return <path d="M49 63 C53 59 58 60 60 63 C62 60 67 59 71 63 C67 67 62 65 60 65.5 C58 65 53 67 49 63 Z" fill={color} />;
    case 'beard-goatee':
      return <path d="M53 71 C54 82 66 82 67 71 C64 74 56 74 53 71 Z" fill={color} />;
    case 'beard-short':
      return <path fill-rule="evenodd" d={`M36 54 C34 82 86 82 84 54 C82 62 76 64 72 64 L48 64 C44 64 38 62 36 54 Z M52.5 67 a7.5 3.6 0 1 0 15 0 a7.5 3.6 0 1 0 -15 0`} fill={color} />;
    case 'beard-full':
      return (
        <g>
          <path fill-rule="evenodd" d="M35 52 C32 92 88 92 85 52 C83 62 77 64 72 64 L48 64 C43 64 37 62 35 52 Z M52.5 68 a7.5 3.6 0 1 0 15 0 a7.5 3.6 0 1 0 -15 0" fill={color} />
        </g>
      );
    default:
      void hole;
      return null;
  }
}

function Glasses({ id }: { id: string }) {
  if (id === 'gl-round')
    return (
      <g fill="none" stroke={INK} stroke-width="2">
        <circle cx="50" cy="54" r="8" />
        <circle cx="70" cy="54" r="8" />
        <path d="M58 54 L62 54" />
      </g>
    );
  if (id === 'gl-square')
    return (
      <g fill="none" stroke={INK} stroke-width="2">
        <rect x="41" y="48" width="16" height="12" rx="3" />
        <rect x="63" y="48" width="16" height="12" rx="3" />
        <path d="M57 54 L63 54" />
      </g>
    );
  return null;
}

/** Helmet of salvation: an open-face knight's helm (so the face and beard still show). Higher tiers get a plume. */
function Helmet({ id }: { id: string }) {
  if (none(id)) return null;
  const m = metal(id);
  const tier = tierOf(id);
  const plume = tier === 'royal' || tier === 'gold' || tier === 'radiant' || tier === 'silver';
  return (
    <g>
      {plume && <path d="M54 26 C54 10 74 8 82 14 C74 14 68 18 66 26 Z" fill={tier === 'royal' ? '#e2b53c' : tier === 'radiant' ? '#fff6c9' : '#b5483f'} stroke={m.dark} stroke-width="1" />}
      <Piece d="M33 50 C33 22 87 22 87 50 Z" m={m} />
      <path d="M33 44 L87 44 L87 50 L33 50 Z" fill={m.trim} opacity="0.9" />
      <Piece d="M33 48 L41 48 L41 66 L35 62 Z" m={m} />
      <Piece d="M87 48 L79 48 L79 66 L85 62 Z" m={m} />
      <path d="M58.5 44 L61.5 44 L61.5 58 L58.5 58 Z" fill={m.c} stroke={m.dark} stroke-width="1" />
      <path d="M48 36 C54 30 66 30 72 36" fill="none" stroke={m.light} stroke-width="2" stroke-linecap="round" opacity="0.8" />
    </g>
  );
}

function Crown({ id, lift }: { id: string; lift: number }) {
  if (none(id)) return null;
  if (id === 'crown-halo') return <ellipse cx="60" cy={18 - lift} rx="17" ry="5" fill="none" stroke="#f2c94c" stroke-width="3.5" />;
  return (
    <g transform={`translate(0 ${-lift})`}>
      {id === 'crown-flower' && (
        <g transform="translate(79 32)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="0" cy="-5" rx="3.4" ry="5" fill="#f2b8c6" transform={`rotate(${a})`} />
          ))}
          <circle r="3" fill="#f2c94c" />
        </g>
      )}
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
          <path d="M38 38 L36 16 L47 27 L54 10 L60 24 L66 10 L73 27 L84 16 L82 38 Z" fill="#fff0b8" stroke="#e2b53c" stroke-width="1.8" stroke-linejoin="round" />
          {[[60, 18, '#c4647a'], [46, 31, '#5b8fc7'], [74, 31, '#5fae6f']].map(([x, y, f]) => (
            <circle key={String(x)} cx={Number(x)} cy={Number(y)} r="2.4" fill={String(f)} stroke="#e2b53c" stroke-width="0.8" />
          ))}
          <path d="M60 6 L61.6 10 L66 10.4 L62.6 13 L63.6 17 L60 14.8 L56.4 17 L57.4 13 L54 10.4 L58.4 10 Z" fill="#fff6c9" opacity="0.95" />
        </g>
      )}
      {id === 'crown-laurel' && (
        <g fill="#6f9a5a">
          {[-66, -50, -34, -18].map((a, i) => {
            const cx = 60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) - 2;
            const cy = 46 + 24 * Math.sin(((a - 90) * Math.PI) / 180);
            return <ellipse key={i} cx={cx} cy={cy} rx="2.6" ry="5.4" transform={`rotate(${a} ${cx} ${cy})`} />;
          })}
          {[66, 50, 34, 18].map((a, i) => {
            const cx = 60 + 24 * Math.cos(((a - 90) * Math.PI) / 180) + 2;
            const cy = 46 + 24 * Math.sin(((a - 90) * Math.PI) / 180);
            return <ellipse key={i} cx={cx} cy={cy} rx="2.6" ry="5.4" transform={`rotate(${a} ${cx} ${cy})`} />;
          })}
        </g>
      )}
    </g>
  );
}

/** Things worn at the neck or head (inside the head group) and things that float or stand beside the knight. */
function ExtraHead({ id }: { id: string }) {
  if (id === 'ex-headphones')
    return (
      <g>
        <path d="M33 56 C31 28 89 28 87 56" fill="none" stroke="#3b3b44" stroke-width="4" stroke-linecap="round" />
        <rect x="29" y="50" width="9" height="16" rx="4" fill="#3b3b44" />
        <rect x="82" y="50" width="9" height="16" rx="4" fill="#3b3b44" />
      </g>
    );
  return null;
}
function ExtraBody({ id }: { id: string }) {
  switch (id) {
    case 'ex-bowtie':
      return (
        <g fill="#c4647a">
          <path d="M60 72 L50 67 L50 77 Z" />
          <path d="M60 72 L70 67 L70 77 Z" />
          <circle cx="60" cy="72" r="2.6" fill="#a24a5f" />
        </g>
      );
    case 'ex-scarf':
      return (
        <g fill="#c4647a">
          <path d="M46 66 C52 74 68 74 74 66 L76 74 C68 80 52 80 44 74 Z" />
          <path d="M68 76 L74 94 L66 92 L62 78 Z" fill="#a24a5f" />
        </g>
      );
    case 'ex-medal':
      return (
        <g>
          <path d="M54 70 L60 82 L66 70" fill="none" stroke="#c4647a" stroke-width="2.6" />
          <circle cx="60" cy="86" r="5" fill="#f2c94c" stroke="#c9962c" stroke-width="1.3" />
        </g>
      );
    case 'ex-scholar':
      return (
        <g>
          <path d="M44 72 L76 98" stroke="#f2c94c" stroke-width="4" stroke-linecap="round" opacity="0.9" />
          <path d="M44 72 L76 98" stroke="#2f3e63" stroke-width="1.4" stroke-linecap="round" opacity="0.5" />
        </g>
      );
    case 'ex-lantern':
      return (
        <g transform="translate(94 12)">
          <circle cx="8" cy="12" r="12" fill="#ffe9a0" opacity="0.35" />
          <path d="M3 4 Q8 -2 13 4" fill="none" stroke="#6b5a3a" stroke-width="1.6" />
          <rect x="3" y="4" width="10" height="14" rx="2.5" fill="#f2c94c" stroke="#8a6a2a" stroke-width="1.3" />
          <rect x="6" y="8" width="4" height="6" rx="2" fill="#fff6c9" />
        </g>
      );
    case 'ex-butterfly':
      return (
        <g transform="translate(96 20)">
          <ellipse cx="-4" cy="-2" rx="5" ry="4" fill="#9b8be0" transform="rotate(-20 -4 -2)" />
          <ellipse cx="4" cy="-2" rx="5" ry="4" fill="#b7a8ee" transform="rotate(20 4 -2)" />
          <ellipse cx="-3" cy="4" rx="3.4" ry="3" fill="#f2b8c6" />
          <ellipse cx="3" cy="4" rx="3.4" ry="3" fill="#f2b8c6" />
          <rect x="-0.8" y="-4" width="1.6" height="10" rx="0.8" fill="#4a4040" />
        </g>
      );
    case 'ex-star':
      return <path transform="translate(96 22)" d="M0 -10 L3 -3 L10 -3 L4.4 1.6 L6.4 9 L0 4.6 L-6.4 9 L-4.4 1.6 L-10 -3 L-3 -3 Z" fill="#f2c94c" stroke="#c9962c" stroke-width="1.2" stroke-linejoin="round" />;
    case 'ex-scroll':
      return (
        <g transform="translate(88 12) rotate(12)">
          <rect x="0" y="2" width="22" height="14" rx="2" fill="#f4efe6" stroke="#c9b88f" stroke-width="1" />
          <rect x="-2" y="0" width="4" height="18" rx="2" fill="#c9a66b" />
          <rect x="20" y="0" width="4" height="18" rx="2" fill="#c9a66b" />
          <path d="M5 7 H18 M5 11 H15" stroke="#b9a678" stroke-width="1.3" stroke-linecap="round" />
        </g>
      );
    case 'ex-banner':
      return (
        <g>
          <rect x="106" y="50" width="2.2" height="68" fill="#6b5a3a" />
          <path d="M108 52 L120 58 L108 66 Z" fill="#b5483f" />
          <path d="M111 58 L115 58 M113 56 L113 61" stroke="#fff0b8" stroke-width="1.2" />
        </g>
      );
    default:
      return null;
  }
}

function Shoes({ id }: { id: string }) {
  const m = none(id) ? null : metal(id);
  const d = (x: number, dir: 1 | -1) => `M${x} 108 L${x + 10 * dir} 108 L${x + 10 * dir} 114 C${x + 16 * dir} 114 ${x + 18 * dir} 117 ${x + 16 * dir} 119 L${x - 1 * dir} 119 Z`;
  return (
    <g>
      {m ? (
        <>
          <Piece d={d(47, -1)} m={m} />
          <Piece d={d(73, 1)} m={m} />
        </>
      ) : (
        <>
          <ellipse cx="50" cy="115" rx="7" ry="3.6" fill="#d9b59a" />
          <ellipse cx="70" cy="115" rx="7" ry="3.6" fill="#d9b59a" />
        </>
      )}
    </g>
  );
}

function Belt({ id }: { id: string }) {
  if (none(id)) return null;
  const m = metal(id);
  return (
    <g>
      {m.rad && <rect x="40" y="93" width="40" height="8" rx="2" fill="none" stroke="#ffe27a" stroke-width="4" opacity="0.5" />}
      <rect x="40.5" y="93.5" width="39" height="7" rx="2" fill={m.c} stroke={m.dark} stroke-width="1.2" />
      <rect x="55.5" y="92" width="9" height="10" rx="2" fill={m.trim === m.dark ? '#e2b53c' : m.trim} stroke={m.dark} stroke-width="1" />
      <rect x="58" y="95" width="4" height="4" rx="1" fill={m.dark} opacity="0.6" />
    </g>
  );
}

function Breastplate({ id }: { id: string }) {
  if (none(id)) return null;
  const m = metal(id);
  return (
    <g>
      <Piece d="M44 72 C50 67 70 67 76 72 L79 94 L41 94 Z" m={m} />
      <circle cx="41" cy="73" r="6.5" fill={m.c} stroke={m.dark} stroke-width="1.3" />
      <circle cx="79" cy="73" r="6.5" fill={m.c} stroke={m.dark} stroke-width="1.3" />
      <path d="M48 74 C54 72 66 72 72 74" fill="none" stroke={m.light} stroke-width="2" stroke-linecap="round" opacity="0.8" />
      <path d="M60 76 V90 M54 81 H66" stroke={m.trim === m.dark ? m.light : m.trim} stroke-width="2.6" stroke-linecap="round" />
    </g>
  );
}

function Shield({ id }: { id: string }) {
  if (none(id)) return null;
  const m = metal(id);
  return (
    <g>
      <Piece d="M17 60 H43 V74 C43 84 37 90 30 94 C23 90 17 84 17 74 Z" m={m} />
      <path d="M21 63 H39 V74 C39 81 35 86 30 89 C25 86 21 81 21 74 Z" fill="none" stroke={m.light} stroke-width="1" opacity="0.7" />
      <path d="M30 65 V84 M23.5 72 H36.5" stroke={m.trim === m.dark ? m.light : m.trim} stroke-width="3" stroke-linecap="round" />
    </g>
  );
}

function Sword({ id }: { id: string }) {
  if (none(id)) return null;
  const m = metal(id);
  const blade = 'M86.5 84 L86.5 52 L89.5 44 L92.5 52 L92.5 84 Z';
  return (
    <g>
      <Piece d={blade} m={{ ...m, c: shade(m.c, 0.1) }} />
      <path d="M89.5 48 V82" stroke={m.light} stroke-width="1" opacity="0.8" />
      <rect x="82" y="83" width="15" height="3.4" rx="1.4" fill={m.trim === m.dark ? '#c9a24f' : m.trim} stroke={m.dark} stroke-width="1" />
      <rect x="88" y="86" width="3" height="7" fill="#6b4a2a" />
      <circle cx="89.5" cy="95" r="2" fill={m.trim === m.dark ? '#c9a24f' : m.trim} stroke={m.dark} stroke-width="0.8" />
    </g>
  );
}

/** The knight: drawn from simple shapes so it works offline, scales sharply and follows the theme. */
export function AvatarFigure({ look, size = 120, title, view = 'full' }: { look: Look; size?: number; title?: string; view?: 'full' | 'face' }) {
  const skin = col(look.skin, '#efc09a');
  const hair = col(look.hairColor, '#6a4630');
  const eye = col(look.eyes, '#5a3a24');
  const tunic = col(look.tunic, '#2a6569');
  const hose = shade(tunic, -0.4);
  const helmeted = !none(look.helmet);
  const full = armorWorn(look) === ARMOR_SLOTS.length;
  return (
    <svg viewBox={view === 'face' ? '26 4 68 68' : '0 0 120 120'} width={size} height={size} role="img" aria-label={title ?? 'Your avatar'} data-look={JSON.stringify(look)} data-armor={armorWorn(look)} style={{ display: 'block' }}>
      <defs>
        <clipPath id={`avc-${view}${size}`}>
          {view === 'face' ? <rect x="26" y="4" width="68" height="68" rx="15" /> : <rect width="120" height="120" rx="26" />}
        </clipPath>
      </defs>
      <g clip-path={`url(#avc-${view}${size})`}>
        <Background id={look.background} />
        {full && <circle cx="60" cy="66" r="50" fill="#fff6c9" opacity="0.4" />}
        <Cape id={look.cape} />
        <Companion id={look.companion} />
        <g transform="translate(60 41) scale(0.86) translate(-60 -52)">
          <HairBack id={look.hair} color={hair} />
        </g>
        {/* legs and shoes */}
        <rect x="47" y="98" width="10" height="14" rx="3" fill={hose} />
        <rect x="63" y="98" width="10" height="14" rx="3" fill={hose} />
        <Shoes id={look.shoes} />
        {/* arms, torso, neck */}
        <path d="M44 74 L34 86" stroke={tunic} stroke-width="8" stroke-linecap="round" />
        <path d="M76 74 L88 84" stroke={tunic} stroke-width="8" stroke-linecap="round" />
        <path d="M40 100 C40 76 48 68 60 68 C72 68 80 76 80 100 Z" fill={tunic} />
        <rect x="55" y="58" width="10" height="13" rx="4" fill={shade(skin, -0.1)} />
        <Belt id={look.belt} />
        <Breastplate id={look.breastplate} />
        <ExtraBody id={look.extra} />
        <circle cx="33.5" cy="87" r="3.6" fill={skin} />
        <circle cx="89" cy="86" r="3.6" fill={skin} />
        <Shield id={look.shield} />
        <Sword id={look.sword} />
        {/* head (drawn big and friendly, then scaled down onto the body) */}
        <g transform="translate(60 41) scale(0.86) translate(-60 -52)">
          <circle cx="35" cy="55" r="4.4" fill={skin} />
          <circle cx="85" cy="55" r="4.4" fill={skin} />
          <circle cx="60" cy="52" r="25" fill={skin} />
          {!helmeted && <HairFront id={look.hair} color={hair} />}
          {helmeted && look.hair !== 'hair-none' && <path d="M44 46 C50 42 70 42 76 46 C70 44 50 44 44 46 Z" fill={hair} />}
          <circle cx="51" cy="54" r="3.2" fill={eye} />
          <circle cx="69" cy="54" r="3.2" fill={eye} />
          <circle cx="51" cy="54" r="1.5" fill={INK} />
          <circle cx="69" cy="54" r="1.5" fill={INK} />
          <circle cx="52" cy="52.8" r="0.9" fill="#fff" />
          <circle cx="70" cy="52.8" r="0.9" fill="#fff" />
          <circle cx="45" cy="62" r="4" fill="#e58f8f" opacity="0.35" />
          <circle cx="75" cy="62" r="4" fill="#e58f8f" opacity="0.35" />
          <Beard id={look.beard} color={hair} />
          <path d="M52 64 Q60 72 68 64" fill="none" stroke={INK} stroke-width="2.2" stroke-linecap="round" />
          <Glasses id={look.glasses} />
          <Helmet id={look.helmet} />
          <ExtraHead id={look.extra} />
          <Crown id={look.crown} lift={helmeted ? 6 : 0} />
        </g>
      </g>
    </svg>
  );
}
