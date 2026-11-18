// The games' own pixel pictures, drawn from little maps (one square a letter), and the small pieces built from them.
import { useEffect, useRef } from 'preact/hooks';

/** The gate the goblins march on. */
export const GATE = ['kk.kk.kk.kk', 'kskkskkskks', 'ksssssssssk', 'kssbbbbbssk', 'ksbbkbkbbsk', 'ksbkbkbkbsk', 'ksbbkbkbbsk', 'ksbkbkbkbsk', 'ksbbkbkbbsk', 'kkkkkkkkkkk'];
export const SHIELD_ICON = ['kkkkkkk', 'kyyyyyk', 'kywkwyk', 'kyywyyk', '.kyyyk.', '..kyk..', '...k...'];
/** A burrow: a dark mouth in a mound of earth. */
export const HOLE = ['...bbbbbbbbb...', '.bbbsssssssbbb.', 'bbsskkkkkkkssbb', 'bbskkkkkkkkksbb', '.bbbbbbbbbbbbb.'];
export const HEART = ['.kk.kk.', 'krrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
export const STAR = ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', '.kykyk.', 'kk...kk'];
export const TOWER = ['k.k.k', 'kkkkk', 'ksssk', 'ksssk', 'ksksk', 'ksksk'];
export const FLAME = ['..oo....', '.oyyoo..', 'oyywyyoo', '.oyyoo..', '..oo....'];
export const SPARK = ['..w..', '.wyw.', 'wyyyw', '.wyw.', '..w..'];
export const ARROWHEAD = ['..k..', '.kwk.', 'kwwkk', '.kwk.', '..k..'];
const INK: Record<string, string> = { k: '#221e26', g: '#3f8f5b', d: '#2c6a43', y: '#e8c66a', r: '#c8463c', w: '#f4efe2', s: '#a9a394', o: '#e2792f', b: '#7a5230' };

// Each map is drawn once into a small SVG picture and cached, so a sprite costs one <img> however often the game redraws.
const CACHE = new Map<string, { url: string; w: number; h: number }>();
function picture(map: string[]) {
  const key = map.join('|');
  let pic = CACHE.get(key);
  if (!pic) {
    const w = map[0].length;
    const h = map.length;
    const rects = map.flatMap((row, y) => [...row].map((c, x) => (c === '.' || !INK[c] ? '' : `<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${INK[c]}"/>`))).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${rects}</svg>`;
    pic = { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, w, h };
    CACHE.set(key, pic);
  }
  return pic;
}

export function Pixels({ map, size, dim, label }: { map: string[]; size: number; dim?: boolean; label?: string }) {
  const pic = picture(map);
  return (
    <img
      class="px"
      src={pic.url}
      width={size}
      height={Math.round((size * pic.h) / pic.w)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : 'true'}
      draggable={false}
      style={{ opacity: dim ? 0.22 : 1, display: 'block' }}
    />
  );
}

// The goblins and the dragon are painted and pixelated like the knight (design/pixel/creatures.py, public/creatures/*.webp).
const CREATURES = { 'goblin-a': [120, 140], 'goblin-b': [120, 140], 'goblin-up': [120, 120], 'goblin-bonk': [120, 120], 'dragon-up': [240, 160], 'dragon-down': [240, 160] } as const;
type Creature = keyof typeof CREATURES;
const creatureUrl = (name: Creature) => `${import.meta.env.BASE_URL}creatures/${name}.webp`;
const heightOf = (name: Creature, size: number) => Math.round((size * CREATURES[name][1]) / CREATURES[name][0]);

function Painted({ name, size }: { name: Creature; size: number }) {
  return <img class="px creature" src={creatureUrl(name)} width={size} height={heightOf(name, size)} alt="" aria-hidden="true" draggable={false} />;
}

/** Two pictures shown in turn (a flap, a step). */
function Frames({ a, b, size, label, cls }: { a: Creature; b: Creature; size: number; label: string; cls: string }) {
  return (
    <span class={`sprite-flap ${cls}`} role="img" aria-label={label} style={{ width: `${size}px`, height: `${heightOf(a, size)}px` }}>
      <span class="frame-a">
        <Painted name={a} size={size} />
      </span>
      <span class="frame-b">
        <Painted name={b} size={size} />
      </span>
    </span>
  );
}

/** The dragon, flapping. */
export function Dragon({ size }: { size: number }) {
  return <Frames a="dragon-up" b="dragon-down" size={size} label="The dragon" cls="dragon-flap" />;
}

/** A goblin: marching (facing left, a step each frame), up out of a burrow with its hands raised, or bonked. */
export function Goblin({ size, pose = 'march', label }: { size: number; pose?: 'march' | 'still' | 'up' | 'bonk'; label?: string }) {
  if (pose === 'march') return <Frames a="goblin-a" b="goblin-b" size={size} label={label ?? 'A goblin'} cls="goblin-step" />;
  const name: Creature = pose === 'still' ? 'goblin-a' : pose === 'up' ? 'goblin-up' : 'goblin-bonk';
  return label ? (
    <span role="img" aria-label={label} style={{ display: 'block' }}>
      <Painted name={name} size={size} />
    </span>
  ) : (
    <Painted name={name} size={size} />
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
