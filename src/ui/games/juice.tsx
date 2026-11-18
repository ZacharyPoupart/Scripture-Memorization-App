// "Juice" for the games (v1.76.0, from the game-feel research): the small, fast reactions that make a right answer feel good.
// One flat-pixel particle canvas, screen shake through the Web Animations API (no re-render), a hit-stop (the game freezes for a
// few frames on a big hit), and score text that pops. Everything decorative is off under reduced motion; sound is separate
// (services/feedback.ts) and stays under its own setting.
import { forwardRef } from 'preact/compat';
import { useEffect, useImperativeHandle, useRef } from 'preact/hooks';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The palette the particles use (the same inks as the sprites; flat squares, no glow). */
export const SPARKS = ['#f4efe2', '#e8c66a', '#e2792f'];
export const GOO = ['#3f8f5b', '#2c6a43', '#e8c66a'];
export const DUST = ['#a9a394', '#7a5230', '#5b5246'];

/**
 * Shake an element by `trauma` (0 to 1): the offset grows with the square of it, so small hits barely move and a final blow
 * really rattles. Runs on the compositor; nothing re-renders.
 */
export function shake(el: Element | null | undefined, trauma: number) {
  if (!el || reducedMotion() || !('animate' in el)) return;
  const t = Math.max(0, Math.min(1, trauma)) ** 2;
  const frames = Array.from({ length: 6 }, (_, i) => {
    const fall = 1 - i / 6;
    const x = (Math.random() * 2 - 1) * 9 * t * fall;
    const y = (Math.random() * 2 - 1) * 9 * t * fall;
    const r = (Math.random() * 2 - 1) * 1.6 * t * fall;
    return { transform: `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)` };
  });
  (el as HTMLElement).animate([...frames, { transform: 'none' }], { duration: 120 + 280 * Math.sqrt(t), easing: 'linear' });
}

/** A short pop on an element (a combo counter, a score): scale up and settle. */
export function punch(el: Element | null | undefined, scale = 1.4, ms = 160) {
  if (!el || reducedMotion() || !('animate' in el)) return;
  (el as HTMLElement).animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration: ms, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

/** A hit-stop: `freeze(ms)` pauses the game's clock (the ticker eats the time) and the CSS animations on the stage. */
export function useHitStop(stage: { current: HTMLElement | null }) {
  const left = useRef(0);
  return {
    freeze(ms: number) {
      if (reducedMotion()) return;
      left.current = Math.max(left.current, ms);
      stage.current?.classList.add('frozen');
    },
    /** Call first in the game's tick: true while frozen (the tick should do nothing). */
    eat(dt: number) {
      if (left.current <= 0) return false;
      left.current -= dt;
      if (left.current <= 0) stage.current?.classList.remove('frozen');
      return true;
    },
  };
}

// ---------------------------------------------------------------- particles and floating text on one canvas

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
}

export interface FxHandle {
  /** A burst of `n` flat squares at (x, y) in the stage's pixels. */
  burst(x: number, y: number, n: number, colors?: string[], speed?: number): void;
  /** Text that pops and rises (a score, "x5"). */
  text(x: number, y: number, s: string, big?: boolean): void;
}

/** Sits over a game's stage (position it absolute, inset 0). Draws only while something is flying. */
export const Fx = forwardRef<FxHandle, {}>(function Fx(_props, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const parts = useRef<P[]>([]);
  const raf = useRef(0);
  const last = useRef(0);

  const loop = (t: number) => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    const dt = Math.min(50, t - (last.current || t)) / 1000;
    last.current = t;
    const dpr = c.width / Math.max(1, c.clientWidth);
    g.clearRect(0, 0, c.width, c.height);
    const keep: P[] = [];
    for (const p of parts.current) {
      p.life += dt * 1000;
      if (p.life >= p.max) continue;
      keep.push(p);
      const k = 1 - p.life / p.max;
      if (p.text) {
        p.y -= 46 * dt;
        const grow = p.life < 90 ? 0.6 + (p.life / 90) * 0.6 : 1.2 - Math.min(0.2, (p.life - 90) / 300);
        g.save();
        g.globalAlpha = Math.min(1, k * 2);
        g.font = `700 ${Math.round(p.size * grow * dpr)}px Fraunces, serif`;
        g.textAlign = 'center';
        g.lineWidth = 4 * dpr;
        g.strokeStyle = '#221e26';
        g.fillStyle = p.color;
        g.strokeText(p.text, p.x * dpr, p.y * dpr);
        g.fillText(p.text, p.x * dpr, p.y * dpr);
        g.restore();
      } else {
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const s = Math.max(1, p.size * k) * dpr;
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x * dpr - s / 2), Math.round(p.y * dpr - s / 2), Math.round(s), Math.round(s));
      }
    }
    parts.current = keep;
    raf.current = keep.length ? requestAnimationFrame(loop) : 0;
    if (!keep.length) last.current = 0;
  };
  const kick = () => {
    const c = canvas.current;
    if (c) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(c.clientWidth * dpr);
      const h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) ((c.width = w), (c.height = h));
    }
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useImperativeHandle(ref, () => ({
    burst(x, y, n, colors = SPARKS, speed = 1) {
      if (reducedMotion()) return;
      for (let i = 0; i < n && parts.current.length < 90; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (120 + Math.random() * 200) * speed;
        parts.current.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, life: 0, max: 350 + Math.random() * 250, size: 3 + Math.round(Math.random()), color: colors[i % colors.length] });
      }
      kick();
    },
    text(x, y, s, big = false) {
      parts.current.push({ x, y, vx: 0, vy: 0, life: 0, max: big ? 900 : 650, size: big ? 30 : 20, color: big ? '#e8c66a' : '#f4efe2', text: s });
      kick();
    },
  }));
  return <canvas class="game-fx" ref={canvas} aria-hidden="true" />;
});

/** Where an element is, in its stage's pixels (to aim a burst at it). */
export function centerIn(el: Element | null | undefined, stage: Element | null | undefined): [number, number] {
  if (!el || !stage) return [0, 0];
  const a = el.getBoundingClientRect();
  const b = stage.getBoundingClientRect();
  return [a.left + a.width / 2 - b.left, a.top + a.height / 2 - b.top];
}

/**
 * The word you just recalled flies from where you struck to its place in the verse (v1.77.0, from the research: it ties the
 * reward to the text). `from` is where it starts (the thing struck); `to` is the gap it fills. The word in the verse waits for it
 * (`.w.fresh` lands a beat later). Nothing flies under reduced motion.
 */
export function flyWord(text: string, from: Element | DOMRect | null | undefined, to: Element | null | undefined) {
  if (!from || !to || reducedMotion() || typeof document === 'undefined') return;
  const a = from instanceof Element ? from.getBoundingClientRect() : from;
  const b = to.getBoundingClientRect();
  if (!b.width && !b.height) return;
  const el = document.createElement('span');
  el.className = 'fly-word';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = text;
  document.body.appendChild(el);
  const fx = a.left + a.width / 2;
  const fy = a.top + a.height / 2;
  const tx = b.left + b.width / 2;
  const ty = b.top + b.height / 2;
  const lift = Math.min(70, Math.abs(tx - fx) * 0.25 + 30); // a little arc
  const at = (x: number, y: number, s: number) => `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`;
  const anim = el.animate(
    [
      { transform: at(fx, fy, 1.35), opacity: 0.2 },
      { transform: at((fx + tx) / 2, Math.min(fy, ty) - lift, 1.15), opacity: 1, offset: 0.45 },
      { transform: at(tx, ty, 1), opacity: 1 },
    ],
    { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  const done = () => el.remove();
  anim.onfinish = done;
  anim.oncancel = done;
  setTimeout(done, 800);
}

/** The gap the next word fills in a game's verse line (call before the screen updates). */
export const gapIn = (testid: string) => (typeof document === 'undefined' ? null : document.querySelector(`[data-testid="${testid}"] .w.cur`));
