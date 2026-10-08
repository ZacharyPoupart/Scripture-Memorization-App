import { useRef, useState } from 'preact/hooks';

/** Scroll `el` to the middle of `container` (only the container scrolls, never the page). */
export function centerIn(container: HTMLElement | null, el: HTMLElement | null, smooth = true) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const delta = e.top - c.top - (c.height / 2 - e.height / 2);
  if (Math.abs(delta) < 4) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: container.scrollTop + delta, behavior: smooth && !reduce ? 'smooth' : 'auto' });
}

/** Scroll only when `el` is (nearly) out of view inside `container`; otherwise leave the text exactly where it is. */
export function keepInView(container: HTMLElement | null, el: HTMLElement | null) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  const margin = Math.min(48, c.height / 5);
  if (e.top >= c.top + margin && e.bottom <= c.bottom - margin) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  container.scrollTo({ top: container.scrollTop + e.top - c.top - c.height / 2 + e.height / 2, behavior: reduce ? 'auto' : 'smooth' });
}

/** A "shake" class that can be re-triggered without remounting anything (remounting would drop focus and hide the keyboard). */
export function useShake(): [string, () => void] {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const trigger = () => {
    clearTimeout(timer.current);
    setOn(false);
    requestAnimationFrame(() => {
      setOn(true);
      timer.current = setTimeout(() => setOn(false), 300);
    });
  };
  return [on ? 'shake' : '', trigger];
}
