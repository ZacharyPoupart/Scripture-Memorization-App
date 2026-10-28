import { useEffect, useState } from 'preact/hooks';
import { STREAK_MULTIPLIERS } from '../core/coins.ts';
import { Coin } from './common.tsx';

/**
 * Coins in the style of a slot machine. The number spins and lands on what the review earned; on a streak a second reel spins through
 * the multipliers and lands on yours, and then the number spins once more up to the new total (it stays put if the left-over part
 * of a coin did not come up). Reduced motion: the final number at once. Screen readers always get the final text.
 */
const LINE = 1.35; // em, the height of one row on a reel
const DIGIT_MS = 1000;
const STAGGER_MS = 160;
const MULT_AT = 1500; // when the multiplier reel starts
const MULT_MS = 1700;
const TOTAL_AT = MULT_AT + MULT_MS + 350;
const TOTAL_MS = 1100;
const MULTS = STREAK_MULTIPLIERS.map((m) => m.x);
const CYCLES = 6;

function Reel({ items, at, ms, delay, lit, cls }: { items: string[]; at: number; ms: number; delay: number; lit?: boolean; cls?: string }) {
  const rows = Array.from({ length: CYCLES }, () => items).flat();
  return (
    <span class={`reel ${cls ?? ''} ${lit ? 'lit' : ''}`} style={{ height: `${LINE}em` }}>
      <span class="reel-strip" style={{ transform: `translateY(${-at * LINE}em)`, transitionDuration: `${ms}ms`, transitionDelay: `${delay}ms` }}>
        {rows.map((t, i) => (
          <span key={i} style={{ height: `${LINE}em` }}>
            {t}
          </span>
        ))}
      </span>
    </span>
  );
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function CoinCount({ base, total, multiplier, testid }: { base: number; total: number; multiplier: number; testid?: string }) {
  const spinsMultiplier = multiplier > 1;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const digits = String(total).split('').map(Number);
  const n = digits.length;
  const baseDigits = String(base).padStart(n, ' ').split('').map((c) => (c === ' ' ? -1 : Number(c)));
  const multIdx = Math.max(0, MULTS.indexOf(multiplier as (typeof MULTS)[number]));

  // where each reel is stopped, counted in rows from the top of its strip
  const finalDigitAt = digits.map((d) => 40 + d); // reduced motion: straight to a row showing the final digit
  const [digitAt, setDigitAt] = useState<number[]>(reduce ? finalDigitAt : digits.map(() => 0));
  const [multAt, setMultAt] = useState(reduce ? CYCLES / 2 * MULTS.length + multIdx : 0);
  const [stage, setStage] = useState<'idle' | 'base' | 'mult' | 'total' | 'done'>(reduce ? 'done' : 'idle');

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    // 1. the number spins and lands on what the review earned (two full turns, left to right)
    const raf = requestAnimationFrame(() => {
      setStage('base');
      setDigitAt(baseDigits.map((d) => 20 + Math.max(0, d)));
    });
    const baseEnd = DIGIT_MS + STAGGER_MS * n;
    if (!spinsMultiplier) {
      later(baseEnd, () => setStage('done'));
    } else {
      // 2. the multiplier reel spins through the steps and lands on yours
      later(MULT_AT, () => {
        setStage('mult');
        setMultAt(3 * MULTS.length + multIdx);
      });
      // 3. the number spins once more, up to the total (or stays, when the left-over coin did not come up)
      later(TOTAL_AT, () => {
        setStage('total');
        setDigitAt((prev) => prev.map((p, i) => (digits[i] === Math.max(0, baseDigits[i]) && base === total ? p : p + 20 + ((digits[i] - Math.max(0, baseDigits[i]) + 10) % 10))));
      });
      later(TOTAL_AT + TOTAL_MS + STAGGER_MS * n, () => setStage('done'));
    }
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, []);

  const word = (c: number) => `coin${c === 1 ? '' : 's'}`;
  const done = stage === 'done';
  const won = total > base;
  return (
    <p class="seeds-gain coin-count" data-testid={testid}>
      <span class="sr-only">
        +{total} {word(total)}
        {spinsMultiplier ? `, with your streak bonus ×${multiplier}` : ''}
      </span>
      <span aria-hidden="true" class={`slot ${done ? 'slot-done' : ''}`} data-done={done ? 'true' : 'false'} data-total={total}>
        <span class="slot-plus">+</span>
        <span class="slot-number">
          {digits.map((_, i) => (
            <Reel
              key={i}
              items={DIGITS}
              at={digitAt[i]}
              ms={stage === 'total' || done ? TOTAL_MS : DIGIT_MS}
              delay={STAGGER_MS * i}
              lit={done && won}
              cls={baseDigits[i] < 0 && stage !== 'total' && !done ? 'unlit' : ''}
            />
          ))}
        </span>{' '}
        <span class="slot-word">{word(total)}</span> <Coin />
        {spinsMultiplier && (
          <span class={`mult-slot ${stage === 'idle' || stage === 'base' ? 'waiting' : ''} ${stage === 'total' || done ? 'landed' : ''}`} data-testid="mult-reel" data-value={multiplier} data-landed={stage === 'total' || done ? 'true' : 'false'}>
            <span class="mult-x">×</span>
            <Reel items={MULTS.map(String)} at={multAt} ms={MULT_MS} delay={0} cls="mult-reel" />
          </span>
        )}
      </span>
    </p>
  );
}
