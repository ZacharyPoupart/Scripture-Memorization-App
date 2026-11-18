// The games' pictures (cut from the owner's sheet) and the small pieces built from them.
import { useEffect, useRef } from 'preact/hooks';
import CREATURES from './creatures.json';

// The goblins, the dragon, their effects and the game pieces come from the owner's sheet (design/creatures/sheet.webp), cut by
// design/creatures/cut.py into one strip a picture or animation (public/creatures/<name>.webp; sizes in creatures.json).
export type SpriteName = keyof typeof CREATURES;
export const stripUrl = (name: SpriteName) => `${import.meta.env.BASE_URL}creatures/${name}.webp`;

/**
 * A strip from the sheet at `scale` CSS pixels a sheet pixel (so pictures of one creature share a size). With several
 * frames it plays at `fps`, looping, or once and holding the last (`once`); `frame` shows one frame and stands still.
 */
export function Sprite({ name, scale, fps = 8, once, frame, label, flip }: { name: SpriteName; scale: number; fps?: number; once?: boolean; frame?: number; label?: string; flip?: boolean }) {
  const m = CREATURES[name];
  const w = m.w * scale;
  const h = m.h * scale;
  const still = m.n === 1 || frame !== undefined;
  const at = m.n === 1 ? 0 : ((frame ?? 0) / (m.n - 1)) * 100;
  return (
    <span
      class={`sprite ${flip ? 'flip' : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      data-sprite={name}
      style={{
        width: `${w}px`,
        height: `${h}px`,
        backgroundImage: `url(${stripUrl(name)})`,
        backgroundSize: `${m.n * w}px ${h}px`,
        backgroundPosition: `${at}% 0`,
        animation: still ? undefined : `sprite-play ${m.n / fps}s steps(${m.n}, jump-none) ${once ? '1 forwards' : 'infinite'}`,
      }}
    />
  );
}

export type DragonState = 'idle' | 'charge' | 'breath' | 'hurt' | 'sleep';
/** The dragon: flapping, drawing breath, breathing fire, struck, or asleep once beaten. `scale` as for Sprite. */
export function Dragon({ scale, state = 'idle' }: { scale: number; state?: DragonState }) {
  return <Sprite name={`dragon-${state}`} scale={scale} fps={6} label="The dragon" />;
}

/** A small picture from the sheet sized by its width (hearts, stars, the shield, the tower, the flame). */
export function Pic({ name, size, label }: { name: SpriteName; size: number; label?: string }) {
  return <Sprite name={name} scale={size / CREATURES[name].w} label={label} />;
}

export function Hearts({ n, of, testid }: { n: number; of: number; testid?: string }) {
  return (
    <div class="game-hearts" role="img" aria-label={`${n} of ${of} hearts`} data-testid={testid} data-hearts={n}>
      {Array.from({ length: of }, (_, i) => (
        <span key={`${i}-${i >= n}`} class={i >= n ? 'gone' : ''}>
          <Pic name={i >= n ? 'heart-empty' : 'heart'} size={22} />
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
          <Pic name={i > n ? 'star-empty' : 'star'} size={40} />
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
