import { useEffect, useState } from 'preact/hooks';
import { Coin } from './common.tsx';

const COUNT_MS = 750; // counting up to what was earned
const PAUSE_MS = 350; // before the multiplier arrives
const GROW_MS = 700; // counting on from there to the total

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Coins that count up to what a review earned and, on a streak, are then multiplied: "+6", a "×1.25" chip pops in, and the number climbs to the total. */
export function CoinCount({ base, total, multiplier, testid }: { base: number; total: number; multiplier: number; testid?: string }) {
  const multiplied = multiplier > 1 && total > base;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(reduce ? total : 0);
  const [chip, setChip] = useState(reduce && multiplied);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = (from: number, to: number, ms: number, done: () => void) => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / ms);
        setShown(Math.round(from + (to - from) * ease(p)));
        if (p < 1) raf = requestAnimationFrame(tick);
        else done();
      };
      raf = requestAnimationFrame(tick);
    };
    run(0, multiplied ? base : total, COUNT_MS, () => {
      if (!multiplied) return;
      timer = setTimeout(() => {
        setChip(true);
        timer = setTimeout(() => {
          setPulse(true);
          run(base, total, GROW_MS, () => setShown(total));
        }, 450);
      }, PAUSE_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, []);

  const word = (n: number) => `coin${n === 1 ? '' : 's'}`;
  return (
    <p class="seeds-gain coin-count" data-testid={testid}>
      <span class="sr-only">
        +{total} {word(total)}
        {multiplied ? `, with your streak bonus ×${multiplier}` : ''}
      </span>
      <span aria-hidden="true" class={pulse && shown < total ? 'counting' : ''}>
        +{shown} {word(shown)} <Coin />
        {chip && <span class="mult-chip">×{multiplier}</span>}
      </span>
    </p>
  );
}
