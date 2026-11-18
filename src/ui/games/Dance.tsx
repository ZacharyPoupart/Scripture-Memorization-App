// Sword Dance: a phrase at a time, the verse's words appear on goblin shields; cut through them in order before the fuse burns
// out. The knight dashes from shield to shield. Rules in core/dance.ts.
import { useEffect, useRef, useState } from 'preact/hooks';
import { DANCE_HEARTS, DANCE_SLOTS, danceStep, danceTap, newDance, type DanceEvent } from '../../core/dance.ts';
import { isComboTier } from '../../core/games.ts';
import { feedback } from '../../services/feedback.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { DUST, flyWord, Fx, gapIn, punch, shake, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import { BEARER, Hearts, Pixels, useTicker } from './sprites.tsx';
import type { GameProps } from './types.ts';

/** Where each of the six shields stands (% of the stage): two staggered rows. */
const SLOT_AT: [number, number][] = [
  [42, 38],
  [64, 30],
  [86, 40],
  [40, 76],
  [62, 70],
  [84, 78],
];
const HOME: [number, number] = [12, 72];

export function Dance({ verse, seed, look, backdrop, onDone }: GameProps) {
  const game = useRef(newDance(verse.text, seed + verse.text.length));
  const s = game.current;
  const stage = useRef<HTMLDivElement>(null);
  const shieldEls = useRef<(HTMLButtonElement | null)[]>([]);
  const comboEl = useRef<HTMLElement>(null);
  const fx = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const [, redraw] = useState(0);
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const [knightAt, setKnightAt] = useState<[number, number]>(HOME);
  const [ghost, setGhost] = useState<{ at: [number, number]; n: number } | null>(null);
  const [shown, setShown] = useState<number[]>([]);
  const [deal, setDeal] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const rest = (): KnightPose => (game.current.over === 'won' ? 'cheer' : game.current.over === 'lost' ? 'fall' : 'idle');
  const act = (name: KnightPose, ms: number) => {
    setPose((p) => ({ name, n: p.n + 1 }));
    later(ms, () => setPose((p) => (p.name === name ? { name: rest(), n: p.n + 1 } : p)));
  };
  const centre = (slot: number): [number, number] => {
    const st = stage.current;
    return st ? [(st.clientWidth * SLOT_AT[slot][0]) / 100, (st.clientHeight * SLOT_AT[slot][1]) / 100] : [0, 0];
  };

  const handle = (events: DanceEvent[]) => {
    for (const e of events) {
      if (e.type === 'phrase') {
        setDeal((n) => n + 1);
        setKnightAt(HOME);
        feedback.game('pop');
      }
      if (e.type === 'cut') {
        flyWord(e.shield.word.raw, shieldEls.current[e.shield.slot], gapIn('dance-text'));
        const [x, y] = centre(e.shield.slot);
        setKnightAt((at) => {
          setGhost((g) => ({ at, n: (g?.n ?? 0) + 1 }));
          return [SLOT_AT[e.shield.slot][0] - 9, SLOT_AT[e.shield.slot][1] + 2];
        });
        fx.current?.burst(x, y, e.last || isComboTier(e.combo) ? 24 : 12, SPARKS);
        fx.current?.burst(x, y, 6, DUST, 0.6);
        fx.current?.text(x, y - 34, `+${e.points}`);
        if (isComboTier(e.combo)) {
          fx.current?.text(x, y - 74, `×${e.combo}!`, true);
          feedback.game('tier');
        }
        feedback.game('hit', e.combo - 1);
        stop.freeze(e.last ? 110 : 50);
        shake(stage.current, e.last ? 0.4 : 0.18);
        punch(comboEl.current);
        act('attack', 300);
        if (e.last) later(380, () => setKnightAt(HOME));
      }
      if (e.type === 'wrong') {
        const [x, y] = centre(e.shield.slot);
        fx.current?.burst(x, y, 8, DUST, 0.6);
        feedback.game('slip');
        shake(stage.current, 0.5);
        act('hurt', 400);
      }
      if (e.type === 'fizzle') {
        setShown((list) => [...list, ...e.words.map((w) => w.index)]);
        feedback.game('slip');
        shake(stage.current, 0.55);
        act('hurt', 420);
        setKnightAt(HOME);
      }
    }
    if (game.current.over) {
      setPose((p) => ({ name: game.current.over === 'won' ? 'cheer' : 'fall', n: p.n + 1 }));
      if (game.current.over === 'won') stop.freeze(180);
      later(1300, () => onDone({ won: game.current.over === 'won', slips: game.current.slips, score: game.current.score }));
    }
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    handle(danceStep(game.current, dt));
    redraw((n) => n + 1);
  }, !s.over);
  const tap = (slot: number) => {
    feedback.unlock();
    handle(danceTap(game.current, slot));
    redraw((n) => n + 1);
  };

  const fuse = s.shields.length ? Math.max(0, s.fuse / s.fuseMax) : 1;
  return (
    <div class="verse-area stack">
      <div class={`game-stage dance-stage ${s.over ?? ''}`} style={backdrop} ref={stage} data-testid="dance-stage" data-next={s.next}>
        <div class="game-hud">
          <Hearts n={s.hearts} of={DANCE_HEARTS} testid="dance-hearts" />
          <div class={`dance-fuse ${fuse < 0.3 ? 'hot' : ''}`} role="img" aria-label="Time left for this phrase" data-testid="dance-fuse">
            <i style={{ width: `${fuse * 100}%` }} />
          </div>
          <b class="game-score" data-testid="game-score">
            {s.score}
          </b>
        </div>
        <div class="game-ground" />
        {ghost && (
          <div class="dance-ghost" key={`g${ghost.n}`} style={{ left: `${ghost.at[0]}%`, top: `${ghost.at[1]}%` }} aria-hidden="true">
            <AvatarFigure look={look} size={84} bare />
          </div>
        )}
        <div class="dance-knight" style={{ left: `${knightAt[0]}%`, top: `${knightAt[1]}%` }}>
          <AvatarFigure look={look} size={84} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
        </div>
        {Array.from({ length: DANCE_SLOTS }, (_, slot) => {
          const sh = s.shields.find((x) => x.slot === slot);
          if (!sh) return null;
          return (
            <button
              key={`${deal}-${slot}`}
              ref={(el) => void (shieldEls.current[slot] = el)}
              class={`dance-shield ${sh.broken ? 'broken' : ''}`}
              style={{ left: `${SLOT_AT[slot][0]}%`, top: `${SLOT_AT[slot][1]}%`, animationDelay: `${(slot % 3) * 50}ms` }}
              onPointerDown={(e) => (e.preventDefault(), tap(slot))}
              onClick={(e) => e.detail === 0 && tap(slot)}
              disabled={sh.broken || !!s.over}
              aria-label={sh.label}
              data-testid="dance-shield"
              data-right={!sh.broken && sh.word.key === s.words[s.next]?.key ? 'yes' : undefined}
            >
              <span class="bearer">
                <Pixels map={BEARER} size={40} />
              </span>
              <span class="round">{sh.label}</span>
            </button>
          );
        })}
        {s.combo >= 2 && (
          <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
            ×{s.combo}
          </b>
        )}
        <Fx ref={fx} />
      </div>
      <p class="verse-text duel-text" data-testid="dance-text">
        {s.words.map((w, i) => (
          <span key={i}>
            <span class={`w ${i < s.next ? (shown.includes(i) ? 'missed' : 'ok') : i === s.next ? 'cur gap' : 'gap'} ${i === s.next - 1 && !shown.includes(i) ? 'fresh' : ''}`}>{i < s.next ? w.raw : ' '.repeat(Math.max(3, Math.min(8, w.raw.length)))}</span>{' '}
          </span>
        ))}
      </p>
      <p class="muted small center" style={{ margin: 0 }}>
        Cut the words of the phrase in order.
      </p>
    </div>
  );
}
