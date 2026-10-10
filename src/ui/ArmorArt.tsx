// The ten armor sets (see ARMOR_SETS in core/avatar.ts), drawn from simple shapes. Each set is a style; the six
// renderers below read the style, so every set works for every piece and pieces can be mixed freely.
import type { ComponentChildren } from 'preact';
import { itemById } from '../core/avatar.ts';

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, '0')).join('')}`;
}

type Helm = 'bucket' | 'visor' | 'crest' | 'hood' | 'great' | 'crown';
type Chest = 'tunic' | 'leather' | 'plate' | 'quilt' | 'surcoat' | 'fur' | 'ornate';
type Boots = 'leather' | 'steel' | 'gold' | 'dark';
interface Style {
  plate: string;
  cloth: string;
  trim: string;
  leather: string;
  helm: Helm;
  chest: Chest;
  boots: Boots;
  plume?: string;
  sash?: string;
  cross?: string;
  /** shield: body, rim, lion */
  shield: [string, string, string];
  blade?: string;
  guard?: string;
  glow?: boolean;
  /** colour of the arms (sleeves) */
  sleeve: string;
}

const LEATHER = '#8a5a3a';
const STYLES: Record<string, Style> = {
  initiate: { plate: '#9aa3ae', cloth: '#3f62a8', trim: '#9aa3ae', leather: LEATHER, helm: 'bucket', chest: 'tunic', boots: 'leather', shield: ['#3f62a8', '#c9ccd2', '#f4efe6'], sleeve: '#3f62a8' },
  soldier: { plate: '#a6adb8', cloth: '#2f4f8f', trim: '#7f8996', leather: LEATHER, helm: 'bucket', chest: 'plate', boots: 'steel', shield: ['#2f5fb8', '#b9c0ca', '#f4efe6'], sleeve: '#2f4f8f' },
  vanguard: { plate: '#c4ccd8', cloth: '#3f62a8', trim: '#d9b44a', leather: LEATHER, helm: 'visor', chest: 'quilt', boots: 'steel', shield: ['#2f5fb8', '#d9b44a', '#f4efe6'], sleeve: '#3f62a8' },
  paladin: { plate: '#f1eee2', cloth: '#2f5fb8', trim: '#e2b53c', leather: '#7a5a2a', helm: 'crest', chest: 'plate', boots: 'gold', cross: '#e2b53c', plume: '#e2b53c', shield: ['#2f5fb8', '#e2b53c', '#f4efe6'], sleeve: '#f1eee2' },
  warden: { plate: '#4a4348', cloth: '#a8332f', trim: '#a8332f', leather: '#3a3034', helm: 'crest', chest: 'plate', boots: 'dark', plume: '#c4372f', sash: '#a8332f', shield: ['#3a3538', '#6b6468', '#f4efe6'], sleeve: '#4a4348' },
  ranger: { plate: '#4f7a4a', cloth: '#4f7a4a', trim: '#35563a', leather: '#6b4a2a', helm: 'hood', chest: 'leather', boots: 'leather', shield: ['#4f7a4a', '#c9ccd2', '#f4efe6'], sleeve: '#4f7a4a' },
  crusader: { plate: '#c4ccd8', cloth: '#f1eee2', trim: '#b5483f', leather: LEATHER, helm: 'great', chest: 'surcoat', boots: 'steel', cross: '#b5483f', shield: ['#b5483f', '#c9ccd2', '#f4efe6'], sleeve: '#c4ccd8' },
  shadow: { plate: '#34303d', cloth: '#5b3f86', trim: '#7a5aa8', leather: '#2a2530', helm: 'hood', chest: 'plate', boots: 'dark', shield: ['#2d2a36', '#6b6572', '#f4efe6'], sleeve: '#34303d' },
  storm: { plate: '#b9c3d0', cloth: '#3f62a8', trim: '#e8edf4', leather: LEATHER, helm: 'crest', chest: 'fur', boots: 'steel', plume: '#3f62a8', shield: ['#2f5fb8', '#b9c3d0', '#f4efe6'], sleeve: '#3f62a8' },
  legend: { plate: '#e2b53c', cloth: '#2f5fb8', trim: '#ffe27a', leather: '#7a5a2a', helm: 'crown', chest: 'ornate', boots: 'gold', cross: '#ffe27a', shield: ['#2f5fb8', '#e2b53c', '#ffe27a'], glow: true, sleeve: '#2f5fb8' },
};

const styleOf = (id: string): Style | null => {
  const key = itemById(id)?.set;
  return key ? (STYLES[key] ?? null) : null;
};
export const sleeveOf = (breastplateId: string): string | null => styleOf(breastplateId)?.sleeve ?? null;

const gid = (c: string) => `ag${c.slice(1)}`;
/** A soft light-to-dark gradient for a colour, so plates look rounded rather than flat. */
function Grad({ c }: { c: string }) {
  return (
    <defs>
      <linearGradient id={gid(c)} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color={shade(c, 0.38)} />
        <stop offset="0.5" stop-color={c} />
        <stop offset="1" stop-color={shade(c, -0.3)} />
      </linearGradient>
    </defs>
  );
}
const fillOf = (c: string) => `url(#${gid(c)})`;

/** A shaded shape with an outline; the Legend set also glows. */
function Piece({ d, fill, line, glow, children }: { d: string; fill: string; line?: string; glow?: boolean; children?: ComponentChildren }) {
  return (
    <g>
      <Grad c={fill} />
      {glow && <path d={d} fill="none" stroke="#ffe27a" stroke-width="4.5" stroke-linejoin="round" opacity="0.5" />}
      <path d={d} fill={fillOf(fill)} stroke={line ?? shade(fill, -0.4)} stroke-width="1.2" stroke-linejoin="round" />
      {children}
    </g>
  );
}
function Rivets({ pts, c, r = 0.9 }: { pts: number[][]; c: string; r?: number }) {
  return (
    <g>
      {pts.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y + 0.3} r={r} fill={shade(c, -0.45)} opacity="0.6" />
          <circle cx={x} cy={y} r={r} fill={shade(c, 0.5)} />
        </g>
      ))}
    </g>
  );
}

const bootColor = (s: Style) => ({ leather: s.leather, steel: s.plate === '#e2b53c' ? '#e2b53c' : '#a6adb8', gold: '#e2b53c', dark: '#34303d' })[s.boots];
const edge = (s: Style) => (s.trim === s.plate ? shade(s.plate, 0.5) : s.trim);

// ---------------------------------------------------------------- helmet (drawn in the head's coordinates)

export function Helmet({ id }: { id: string }) {
  const s = styleOf(id);
  if (!s) return null;
  const dark = shade(s.plate, -0.4);
  const light = shade(s.plate, 0.55);
  const g = !!s.glow;
  if (s.helm === 'hood') {
    const dk = shade(s.cloth, -0.4);
    return (
      <g>
        <Grad c={s.cloth} />
        <path d="M60 16 C66 12 74 14 74 20 C70 17 66 19 64 23 Z" fill={s.cloth} stroke={dk} stroke-width="1" />
        <path d="M29 58 C26 8 94 8 91 58 C91 70 86 78 80 80 L80 62 C80 40 40 40 40 62 L40 80 C34 78 29 70 29 58 Z" fill={fillOf(s.cloth)} stroke={dk} stroke-width="1.3" stroke-linejoin="round" />
        <path d="M40 62 C40 42 80 42 80 62" fill="none" stroke={dk} stroke-width="3.4" opacity="0.5" />
        <path d="M33 56 C32 30 52 22 66 24 M86 50 C86 36 78 28 68 25" fill="none" stroke={shade(s.cloth, 0.4)} stroke-width="1.6" stroke-linecap="round" opacity="0.7" />
        <path d="M31 62 C32 70 36 76 40 78 M89 62 C88 70 84 76 80 78" fill="none" stroke={s.trim} stroke-width="1" stroke-dasharray="2 2" opacity="0.9" />
        <path d="M36 44 C42 34 52 30 60 30" fill="none" stroke={dk} stroke-width="1" opacity="0.6" />
        <circle cx="60" cy="80" r="2.6" fill={s.trim === s.cloth ? '#c9a24f' : s.trim} stroke={dk} stroke-width="1" />
      </g>
    );
  }
  const dome = s.helm === 'great' ? 'M33 50 L33 29 C33 25 37 24 40 24 L80 24 C83 24 87 25 87 29 L87 50 Z' : 'M33 50 C33 16 87 16 87 50 Z';
  const band = edge(s);
  return (
    <g>
      {s.plume && s.helm === 'crest' && (
        <g>
          <path d="M56 24 C54 4 86 0 96 20 C84 13 72 17 66 27 Z" fill={s.plume} stroke={shade(s.plume, -0.4)} stroke-width="1" />
          <path d="M60 22 C62 10 78 6 90 16 M62 25 C66 15 78 12 86 19" fill="none" stroke={shade(s.plume, 0.45)} stroke-width="1.2" stroke-linecap="round" opacity="0.8" />
        </g>
      )}
      {s.helm === 'crown' && (
        <g>
          <Grad c="#e2b53c" />
          <path d="M35 33 L34 12 L45 23 L53 6 L60 21 L67 6 L75 23 L86 12 L85 33 Z" fill={fillOf('#e2b53c')} stroke="#9a7420" stroke-width="1.2" stroke-linejoin="round" />
          <circle cx="53" cy="10" r="1.7" fill="#ffe9a8" />
          <circle cx="67" cy="10" r="1.7" fill="#ffe9a8" />
          <circle cx="60" cy="27" r="2.2" fill="#6fa8ff" stroke="#9a7420" stroke-width="0.8" />
          <circle cx="46" cy="29" r="1.6" fill="#e58f8f" stroke="#9a7420" stroke-width="0.6" />
          <circle cx="74" cy="29" r="1.6" fill="#e58f8f" stroke="#9a7420" stroke-width="0.6" />
        </g>
      )}
      <Piece d={dome} fill={s.plate} glow={g}>
        <path d="M44 33 C52 26 68 26 76 33" fill="none" stroke={light} stroke-width="2.4" stroke-linecap="round" opacity="0.85" />
        <path d="M60 24 V44" stroke={dark} stroke-width="1.2" opacity="0.5" />
      </Piece>
      {s.helm === 'great' && (
        <g>
          <path d="M60 28 V43 M52.5 35 H67.5" stroke={s.cross} stroke-width="3.6" stroke-linecap="round" />
          <Rivets pts={[[38, 29], [82, 29], [38, 38], [82, 38]]} c={s.plate} />
        </g>
      )}
      {s.helm === 'visor' && (
        <g>
          <path d="M36 47 C40 33 80 33 84 47 L84 51 L36 51 Z" fill={fillOf(shade(s.plate, 0.2))} stroke={dark} stroke-width="1" />
          <path d="M42 40 H55 M65 40 H78" stroke={dark} stroke-width="1.3" stroke-linecap="round" />
        </g>
      )}
      {s.helm === 'crest' && <path d="M60 22 C60 28 60 36 60 44" stroke={s.trim === s.cloth ? dark : s.trim} stroke-width="2.4" opacity="0.9" />}
      <path d="M33 42.5 L87 42.5 L87 50 L33 50 Z" fill={band} stroke={shade(band, -0.4)} stroke-width="1" />
      <Rivets pts={[[38, 46.2], [48, 46.2], [72, 46.2], [82, 46.2]]} c={band} />
      <Piece d="M33 48 L41 48 L41 66 L35 62 Z" fill={s.plate} glow={g}>
        <path d="M35 53 H40 M35 57 H40" stroke={dark} stroke-width="0.9" opacity="0.6" />
      </Piece>
      <Piece d="M87 48 L79 48 L79 66 L85 62 Z" fill={s.plate} glow={g}>
        <path d="M80 53 H85 M80 57 H85" stroke={dark} stroke-width="0.9" opacity="0.6" />
      </Piece>
      <path d="M58.2 43 L61.8 43 L61.2 59 L58.8 59 Z" fill={fillOf(s.plate)} stroke={dark} stroke-width="1" />
    </g>
  );
}

// ---------------------------------------------------------------- body pieces (drawn in the figure's coordinates)

export function Breastplate({ id }: { id: string }) {
  const s = styleOf(id);
  if (!s) return null;
  const dark = shade(s.plate, -0.4);
  const light = shade(s.plate, 0.5);
  const g = !!s.glow;
  const torso = 'M44 72 C50 67 70 67 76 72 L79 94 L41 94 Z';
  const trim = edge(s);
  const pauldron = (x: number) => (
    <g>
      <Grad c={s.plate} />
      <circle cx={x} cy="73" r="6.8" fill={fillOf(s.plate)} stroke={dark} stroke-width="1.2" />
      <path d={`M${x - 5.6} 74.5 C${x - 3} 70 ${x + 3} 70 ${x + 5.6} 74.5`} fill="none" stroke={trim} stroke-width="1.1" opacity="0.9" />
      <path d={`M${x - 4.4} 77 C${x - 2} 74 ${x + 2} 74 ${x + 4.4} 77`} fill="none" stroke={dark} stroke-width="0.9" opacity="0.6" />
      <Rivets pts={[[x, 72.2]]} c={s.plate} r={1} />
    </g>
  );
  switch (s.chest) {
    case 'tunic':
    case 'leather': {
      const dk = shade(s.cloth, -0.35);
      return (
        <g>
          <Piece d={torso} fill={s.cloth}>
            <path d="M46 80 C50 83 53 85 52 92 M74 80 C70 83 67 85 68 92 M60 84 V93" fill="none" stroke={dk} stroke-width="1" opacity="0.45" />
          </Piece>
          {/* laced collar */}
          <path d="M54 70 L60 78 L66 70" fill="none" stroke={shade(s.cloth, 0.35)} stroke-width="1.4" />
          <path d="M56.5 72 L63.5 72 M57.5 74.5 L62.5 74.5 M58.8 77 L61.2 77" stroke={s.leather} stroke-width="0.9" />
          <path d="M45 72 L75 94" stroke={s.leather} stroke-width="3.4" stroke-linecap="round" />
          <path d="M45 72 L75 94" stroke={shade(s.leather, 0.45)} stroke-width="0.9" stroke-dasharray="2 2" opacity="0.7" />
          <rect x="56" y="80" width="5" height="5" rx="1" transform="rotate(36 58.5 82.5)" fill="#c9a24f" stroke={shade(s.leather, -0.4)} stroke-width="0.8" />
          <circle cx="41" cy="74" r="4.8" fill={s.leather} stroke={shade(s.leather, -0.4)} stroke-width="1" />
          <circle cx="79" cy="74" r="4.8" fill={s.leather} stroke={shade(s.leather, -0.4)} stroke-width="1" />
          <Rivets pts={[[41, 74], [79, 74]]} c={s.leather} />
        </g>
      );
    }
    case 'surcoat':
      return (
        <g>
          {pauldron(41)}
          {pauldron(79)}
          <Piece d={torso} fill={s.cloth} line={shade(s.cloth, -0.3)}>
            <path d="M47 80 C50 85 50 90 49 94 M73 80 C70 85 70 90 71 94 M57 86 L56 94 M63 86 L64 94" fill="none" stroke={shade(s.cloth, -0.25)} stroke-width="1" opacity="0.6" />
            <path d="M60 73 V92 M52 80 H68" stroke={shade(s.cross ?? '#b5483f', -0.35)} stroke-width="5.4" stroke-linecap="round" />
            <path d="M60 73 V92 M52 80 H68" stroke={s.cross} stroke-width="3.8" stroke-linecap="round" />
          </Piece>
          <path d="M52 71 C56 75 64 75 68 71" fill="none" stroke={dark} stroke-width="2.4" stroke-linecap="round" />
        </g>
      );
    default: {
      const quilt = s.chest === 'quilt';
      const base = quilt ? '#e9edf3' : s.plate;
      return (
        <g>
          <Piece d={torso} fill={base} glow={g} line={dark}>
            {/* overlapping plates across the belly */}
            <path d="M43 86 C52 89 68 89 77 86 M42 90 C52 93 68 93 78 90" fill="none" stroke={dark} stroke-width="1" opacity="0.5" />
            <path d="M44 73 C50 69 70 69 76 73" fill="none" stroke={light} stroke-width="2" stroke-linecap="round" opacity="0.8" />
            <path d="M44.5 76 L47 91 M75.5 76 L73 91" stroke={trim} stroke-width="1.1" opacity="0.9" />
          </Piece>
          {quilt && (
            <g>
              <path d="M48 72 L66 92 M54 70 L72 90 M72 72 L54 92 M66 70 L48 90" stroke="#9aa5b5" stroke-width="1" opacity="0.85" />
              <Rivets pts={[[57, 77], [63, 77], [60, 81], [51, 81], [69, 81], [57, 85], [63, 85]]} c="#e9edf3" r={0.8} />
            </g>
          )}
          {pauldron(41)}
          {pauldron(79)}
          {s.chest === 'fur' && (
            <g fill="#f8f4ea" stroke="#d6cfbe" stroke-width="0.8">
              {[[40, 72], [46, 68], [53, 66.5], [60, 66], [67, 66.5], [74, 68], [80, 72]].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="5.4" />
              ))}
              {[[43, 75], [51, 71], [69, 71], [77, 75]].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="3.6" fill="#efe9da" />
              ))}
            </g>
          )}
          {/* the cloth tabard over the plate */}
          {s.chest !== 'quilt' && s.chest !== 'fur' && (
            <g>
              <path d="M52.5 76 H67.5 L69 96 H51 Z" fill={s.cloth} stroke={shade(s.cloth, -0.35)} stroke-width="1" />
              <path d="M52.5 76 H67.5 L67.8 80 H52.2 Z" fill={shade(s.cloth, 0.2)} opacity="0.6" />
              <path d="M52 93.5 H68" stroke={trim} stroke-width="1.1" />
            </g>
          )}
          {s.chest === 'fur' && <path d="M54 78 H66 L67.5 96 H52.5 Z" fill={s.cloth} stroke={shade(s.cloth, -0.35)} stroke-width="1" />}
          {s.chest === 'quilt' && <path d="M56 74 H64 L65.5 96 H54.5 Z" fill={s.cloth} stroke={shade(s.cloth, -0.35)} stroke-width="1" />}
          {s.sash && (
            <g>
              <path d="M45 71 L77 94" stroke={shade(s.sash, -0.4)} stroke-width="5.4" stroke-linecap="round" />
              <path d="M45 71 L77 94" stroke={s.sash} stroke-width="4" stroke-linecap="round" />
              <path d="M74 92 L78 100 M77 91 L82 97" stroke={s.sash} stroke-width="1.6" stroke-linecap="round" />
            </g>
          )}
          {s.cross && (
            <g>
              <path d="M60 80 V92 M55 84.5 H65" stroke={shade(s.cross, -0.4)} stroke-width="4" stroke-linecap="round" />
              <path d="M60 80 V92 M55 84.5 H65" stroke={s.cross} stroke-width="2.6" stroke-linecap="round" />
              {s.chest === 'ornate' && <Rivets pts={[[60, 84.5]]} c="#6fa8ff" r={1.1} />}
            </g>
          )}
          {s.chest === 'ornate' && (
            <path d="M47 78 C50 82 50 88 48 92 M73 78 C70 82 70 88 72 92 M54 95 C57 97 63 97 66 95" fill="none" stroke="#ffe27a" stroke-width="1.1" stroke-linecap="round" />
          )}
          {/* gorget (neck guard) */}
          <path d="M51 70 C55 74.5 65 74.5 69 70" fill="none" stroke={dark} stroke-width="3.2" stroke-linecap="round" />
          <path d="M51 70 C55 74.5 65 74.5 69 70" fill="none" stroke={trim} stroke-width="1.1" stroke-linecap="round" />
        </g>
      );
    }
  }
}

export function Belt({ id }: { id: string }) {
  const s = styleOf(id);
  if (!s) return null;
  const dark = s.plate === '#34303d' || s.plate === '#4a4348';
  const belt = dark ? '#2a2530' : s.leather;
  const buckle = s.trim === s.plate || s.trim === '#a8332f' ? '#c9a24f' : s.trim;
  return (
    <g>
      {/* the cloth that hangs from the belt, with a hem and a fold */}
      <Grad c={s.cloth} />
      <path d="M49 99 H71 L70.5 111 H49.5 Z" fill={fillOf(s.cloth)} stroke={shade(s.cloth, -0.4)} stroke-width="1" />
      <path d="M60 100 V110.5 M54 100 L53 110 M66 100 L67 110" stroke={shade(s.cloth, -0.35)} stroke-width="0.8" opacity="0.5" />
      <path d="M49.7 108.8 H70.3" stroke={edge(s)} stroke-width="1.4" />
      {s.glow && <rect x="40" y="93" width="40" height="8" rx="2" fill="none" stroke="#ffe27a" stroke-width="4" opacity="0.5" />}
      <Grad c={belt} />
      <rect x="40.5" y="93.5" width="39" height="7" rx="2" fill={fillOf(belt)} stroke={shade(belt, -0.5)} stroke-width="1.2" />
      <path d="M43 97 H55 M65 97 H77" stroke={shade(belt, 0.45)} stroke-width="0.8" stroke-dasharray="1.6 1.6" opacity="0.8" />
      <Rivets pts={[[44, 97], [76, 97]]} c={buckle} r={0.8} />
      {/* pouch */}
      <rect x="70.5" y="98" width="7" height="8" rx="1.8" fill={belt} stroke={shade(belt, -0.5)} stroke-width="1" />
      <path d="M71 100.5 H77" stroke={shade(belt, 0.45)} stroke-width="0.8" />
      <rect x="55" y="92" width="10" height="10" rx="2.2" fill={buckle} stroke={shade(belt, -0.5)} stroke-width="1" />
      <rect x="57.4" y="94.4" width="5.2" height="5.2" rx="1.2" fill="none" stroke={shade(buckle, -0.4)} stroke-width="0.9" />
      <path d="M60 94.4 V99.6" stroke={shade(buckle, -0.4)} stroke-width="0.9" />
    </g>
  );
}

export function Shoes({ id }: { id: string }) {
  const s = styleOf(id);
  const foot = (x: number, dir: 1 | -1) => `M${x} 108 L${x + 10 * dir} 108 L${x + 10 * dir} 114 C${x + 16 * dir} 114 ${x + 18 * dir} 117 ${x + 16 * dir} 119 L${x - 1 * dir} 119 Z`;
  if (!s) {
    return (
      <g>
        <ellipse cx="50" cy="115" rx="7" ry="3.6" fill="#d9b59a" />
        <ellipse cx="70" cy="115" rx="7" ry="3.6" fill="#d9b59a" />
      </g>
    );
  }
  const c = bootColor(s);
  const metal = s.boots !== 'leather';
  const dk = shade(c, -0.45);
  const leg = (x: number, dir: 1 | -1) => (
    <g>
      <Piece d={`M${x} 99 H${x + 11} V113 H${x} Z`} fill={c} />
      {metal ? (
        <g>
          <circle cx={x + 5.5} cy="100.5" r="3.4" fill={fillOf(shade(c, 0.1))} stroke={dk} stroke-width="1" />
          <path d={`M${x + 5.5} 104 V112`} stroke={shade(c, 0.5)} stroke-width="1.2" opacity="0.8" />
          <path d={`M${x + 1} 108 H${x + 10}`} stroke={dk} stroke-width="0.9" opacity="0.7" />
        </g>
      ) : (
        <g>
          <path d={`M${x + 1.5} 102 L${x + 9.5} 105 M${x + 9.5} 102 L${x + 1.5} 105 M${x + 1.5} 106 L${x + 9.5} 109`} stroke={shade(c, 0.5)} stroke-width="0.8" opacity="0.8" />
        </g>
      )}
      <rect x={x - 0.5} y="108" width="12" height="3.2" rx="1.2" fill={shade(c, 0.12)} stroke={dk} stroke-width="0.9" />
      <rect x={x + 3.5} y="108.4" width="4" height="2.4" rx="0.6" fill="#c9a24f" opacity={metal ? 0 : 1} />
      <Piece d={foot(x + (dir === -1 ? 0 : 0), dir)} fill={c} glow={s.glow}>
        <path d={`M${x + 8 * dir} 116 H${x + 15 * dir}`} stroke={dk} stroke-width="1" opacity="0.7" />
      </Piece>
    </g>
  );
  return (
    <g>
      {leg(46.5, -1)}
      {leg(62.5, 1)}
    </g>
  );
}

function Lion({ cx, cy, color, face }: { cx: number; cy: number; color: string; face: string }) {
  return (
    <g>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <circle key={i} cx={(cx + 6.2 * Math.cos(a)).toFixed(1)} cy={(cy + 6.2 * Math.sin(a)).toFixed(1)} r="2.2" fill={color} />;
      })}
      <circle cx={cx} cy={cy} r="6" fill={color} />
      <circle cx={cx} cy={cy + 0.5} r="4" fill={face} />
      <circle cx={cx - 3} cy={cy - 3.2} r="1.3" fill={color} />
      <circle cx={cx + 3} cy={cy - 3.2} r="1.3" fill={color} />
      <circle cx={cx - 1.5} cy={cy - 0.4} r="0.75" fill={color} />
      <circle cx={cx + 1.5} cy={cy - 0.4} r="0.75" fill={color} />
      <path d={`M${cx - 1} ${cy + 1.2} h2 l-1 1.2 Z`} fill={color} />
      <path d={`M${cx} ${cy + 2.4} v0.8 M${cx - 1.4} ${cy + 3.4} q1.4 1 2.8 0`} stroke={color} stroke-width="0.6" fill="none" stroke-linecap="round" />
    </g>
  );
}

export function Shield({ id }: { id: string }) {
  const s = styleOf(id);
  if (!s) return null;
  const [body, rim, lion] = s.shield;
  return (
    <g>
      <Piece d="M16.5 59.5 H43.5 V74 C43.5 84 37.5 90.5 30 95 C22.5 90.5 16.5 84 16.5 74 Z" fill={body} line={shade(rim, -0.35)} glow={s.glow}>
        <path d="M20.5 63 H39.5 V74 C39.5 81.5 35.5 86.5 30 90 C24.5 86.5 20.5 81.5 20.5 74 Z" fill="none" stroke={rim} stroke-width="1.5" />
        <path d="M17.5 60.5 H42.5" stroke={rim} stroke-width="2.2" />
        <path d="M21 64 L38 64 L24 86 C22 82 21 78 21 74 Z" fill="#fff" opacity="0.14" />
      </Piece>
      <Rivets pts={[[19.5, 62], [40.5, 62], [18.6, 71], [41.4, 71], [30, 93]]} c={rim} r={0.9} />
      <Lion cx={30} cy={74} color={lion} face={body} />
    </g>
  );
}

export function Sword({ id }: { id: string }) {
  const s = styleOf(id);
  if (!s) return null;
  const blade = s.blade ?? '#d4dae3';
  const guard = s.guard ?? (s.trim === s.plate || s.trim === '#a8332f' || s.trim === '#7a5aa8' ? '#a8843f' : s.trim);
  const gem = s.cross ?? (s.trim === '#a8332f' ? '#e58f8f' : '#6fa8ff');
  return (
    <g>
      {s.glow && <path d="M86.5 84 L86.5 52 L89.5 44 L92.5 52 L92.5 84 Z" fill="none" stroke="#ffe27a" stroke-width="4.5" stroke-linejoin="round" opacity="0.5" />}
      <path d="M86.5 84 L86.5 52 L89.5 44 L92.5 52 L92.5 84 Z" fill={blade} stroke="#7f8996" stroke-width="1.2" stroke-linejoin="round" />
      <path d="M89.5 44 L92.5 52 L92.5 84 L89.5 84 Z" fill="#9aa5b5" opacity="0.7" />
      <path d="M89.5 49 V81" stroke="#fff" stroke-width="1" opacity="0.8" />
      <path d="M87.4 54 L87.4 82" stroke="#fff" stroke-width="0.6" opacity="0.6" />
      <Grad c={guard} />
      <path d="M80 86.5 C82 82.5 86 83 89.5 84 C93 83 97 82.5 99 86.5 C96 85.6 93 86.6 89.5 86.8 C86 86.6 83 85.6 80 86.5 Z" fill={fillOf(guard)} stroke={shade(guard, -0.45)} stroke-width="1" />
      <circle cx="79.6" cy="86.6" r="1.5" fill={guard} stroke={shade(guard, -0.45)} stroke-width="0.8" />
      <circle cx="99.4" cy="86.6" r="1.5" fill={guard} stroke={shade(guard, -0.45)} stroke-width="0.8" />
      <rect x="88" y="86.8" width="3" height="7" fill={s.leather} />
      <path d="M88 88.5 H91 M88 90.5 H91 M88 92.5 H91" stroke={shade(s.leather, 0.5)} stroke-width="0.7" />
      <circle cx="89.5" cy="95.2" r="2.3" fill={guard} stroke={shade(guard, -0.45)} stroke-width="0.8" />
      <circle cx="89.5" cy="95.2" r="1" fill={gem} />
    </g>
  );
}
