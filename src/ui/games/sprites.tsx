// The games' own pixel pictures, drawn from little maps (one square a letter), and the small pieces built from them.
import { useEffect, useRef } from 'preact/hooks';

const W = 26;
const pad = (rows: string[]) => rows.map((r) => r.padEnd(W, '.'));
/** The dragon, wings up and wings folded: shown in turn, so it flaps. */
export const DRAGON_UP = pad([
  '..............kk......kk',
  '.............kddk....kddk',
  '......kk....kddddk..kdddk',
  '.....kwk...kdddddkkkddddk',
  '..kkkkgkk..kddddddddddddk',
  '.kgggggggkkkgdddddddddgk',
  'kgrgggggggggggggddddggk',
  'kggggggggggggggggggggk',
  'kwkwkgggggyyyygggggggk',
  '.k.k.kkggyyyyyyggggggk',
  '......kggyyyyyyygggggkk',
  '......kgyyyyyyyygggggggk',
  '......kggyyyyyygggkkgggk',
  '.....kgggkkkkkgggk..kggk',
  '.....kggk....kggk....kgk',
  '....kkkkk...kkkkk....kkk',
]);
export const DRAGON_DOWN = pad([
  '',
  '',
  '......kk',
  '.....kwk',
  '..kkkkgkk..kkkkkkkkkkkkkk',
  '.kgggggggkkkddddddddddddk',
  'kgrggggggggggdddddddddgk',
  'kggggggggggggggggggggk',
  'kwkwkgggggyyyygggggggk',
  '.k.k.kkggyyyyyyggggggk',
  '......kggyyyyyyygggggkk',
  '......kgyyyyyyyygggggggk',
  '......kggyyyyyygggkkgggk',
  '.....kgggkkkkkgggk..kggk',
  '.....kggk....kggk....kgk',
  '....kkkkk...kkkkk....kkk',
]);
/** A goblin archer, facing left, bow in hand. */
export const GOBLIN = [
  '.....kkkk....',
  '.k..kggggk.k.',
  'kgkkgggggkkgk',
  '.kggrggrggk..',
  '..kgggggggk..',
  '.w.kgwwwgk...',
  'w..kkbbbkk...',
  'w.kbbbbbbbk..',
  'wkkbkbbbkbk..',
  'w..kbbbbbk...',
  '.w.kbbkbbk...',
  '...kbk.kbk...',
  '..kkk..kkk...',
];
export const HEART = ['.kk.kk.', 'krrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
export const STAR = ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', '.kykyk.', 'kk...kk'];
export const TOWER = ['k.k.k', 'kkkkk', 'ksssk', 'ksssk', 'ksksk', 'ksksk'];
export const FLAME = ['..oo....', '.oyyoo..', 'oyywyyoo', '.oyyoo..', '..oo....'];
export const SPARK = ['..w..', '.wyw.', 'wyyyw', '.wyw.', '..w..'];
export const ARROWHEAD = ['..k..', '.kwk.', 'kwwkk', '.kwk.', '..k..'];
const INK: Record<string, string> = { k: '#221e26', g: '#3f8f5b', d: '#2c6a43', y: '#e8c66a', r: '#c8463c', w: '#f4efe2', s: '#a9a394', o: '#e2792f', b: '#7a5230' };

export function Pixels({ map, size, dim, label }: { map: string[]; size: number; dim?: boolean; label?: string }) {
  const w = map[0].length;
  const h = map.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shape-rendering="crispEdges" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} style={{ opacity: dim ? 0.22 : 1, display: 'block' }}>
      {map.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={INK[c]} />)))}
    </svg>
  );
}

/** The dragon, flapping (two pictures shown in turn). */
export function Dragon({ size }: { size: number }) {
  return (
    <span class="sprite-flap" role="img" aria-label="The dragon" style={{ width: `${size}px`, height: `${(size * 16) / W}px` }}>
      <span class="frame-a">
        <Pixels map={DRAGON_UP} size={size} />
      </span>
      <span class="frame-b">
        <Pixels map={DRAGON_DOWN} size={size} />
      </span>
    </span>
  );
}

export function Hearts({ n, of, testid }: { n: number; of: number; testid?: string }) {
  return (
    <div class="game-hearts" role="img" aria-label={`${n} of ${of} hearts`} data-testid={testid} data-hearts={n}>
      {Array.from({ length: of }, (_, i) => (
        <span key={`${i}-${i >= n}`} class={i >= n ? 'gone' : ''}>
          <Pixels map={HEART} size={22} dim={i >= n} />
        </span>
      ))}
    </div>
  );
}

export function Stars({ n }: { n: number }) {
  return (
    <div class="game-stars" role="img" aria-label={`${n} of 3 stars`} data-testid="game-stars" data-stars={n}>
      {[1, 2, 3].map((i) => (
        <span key={i} class={i <= n ? 'on' : ''} style={{ animationDelay: `${0.15 * i}s` }}>
          <Pixels map={STAR} size={40} dim={i > n} />
        </span>
      ))}
    </div>
  );
}

/** Calls `tick(dt)` every frame while `on` (dt in ms, never more than 50, so a paused tab does not jump ahead). */
export function useTicker(tick: (dt: number) => void, on: boolean) {
  const fn = useRef(tick);
  fn.current = tick;
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(50, t - last);
      last = t;
      if (dt > 0) fn.current(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}
