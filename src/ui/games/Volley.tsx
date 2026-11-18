// Arrow Volley: goblin archers loose arrows that carry words; tap the one with the NEXT word of the verse to cut it down before it
// reaches the knight. The rules and the timing are the simulation in core/volley.ts; this draws it every frame.
import { useEffect, useRef, useState } from 'preact/hooks';
import { VOLLEY_HEARTS, VOLLEY_LANES, newVolley, shown, volleyStep, volleyTap, type VolleyEvent } from '../../core/volley.ts';
import { isComboTier } from '../../core/games.ts';
import { feedback } from '../../services/feedback.ts';
import { Fx, GOO, punch, shake, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import type { GameProps } from './types.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { ARROWHEAD, GOBLIN, Hearts, Pixels, useTicker } from './sprites.tsx';

const LANE_TOP = [20, 43, 66]; // % of the stage height
const KNIGHT_Y = 62;
/** Where an arrow is on the stage (%): it flies level, then drops toward the knight at the end. */
function place(x: number, lane: number) {
  const dive = Math.max(0, (x - 0.62) / 0.38);
  return { left: 86 - x * 66, top: LANE_TOP[lane] + (KNIGHT_Y - LANE_TOP[lane]) * dive * dive };
}

export function Volley({ verse, seed, look, backdrop, onDone }: GameProps) {
  const game = useRef(newVolley(verse.text, seed + verse.text.length));
  const s = game.current;
  const [, redraw] = useState(0);
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const fxr = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const scored = useRef(0); // the score shown so far, so each cut can pop its own points
  const [loosed, setLoosed] = useState<number[]>(() => Array(VOLLEY_LANES).fill(0)); // restarts each archer's recoil
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));

  const act = (name: KnightPose, ms: number) => {
    setPose((p) => ({ name, n: p.n + 1 }));
    later(ms, () => setPose((p) => (p.name === name ? { name: game.current.over === 'won' ? 'cheer' : game.current.over === 'lost' ? 'fall' : 'idle', n: p.n + 1 } : p)));
  };
  const handle = (events: VolleyEvent[]) => {
    for (const e of events) {
      if (e.type === 'spawn') setLoosed((l) => l.map((v, i) => (i === e.shot.lane ? v + 1 : v)));
      if (e.type === 'cut' || e.type === 'wrong' || e.type === 'struck') {
        const at = e.type === 'struck' ? { left: 20, top: KNIGHT_Y } : place(e.shot.x, e.shot.lane);
        const st = stage.current;
        const x = ((st?.clientWidth ?? 300) * at.left) / 100;
        const y = ((st?.clientHeight ?? 290) * at.top) / 100;
        if (e.type === 'cut') {
          const g = game.current;
          const last = g.over === 'won';
          fxr.current?.burst(x, y, isComboTier(g.combo) || last ? 26 : 12, SPARKS);
          fxr.current?.burst(x, y, 5, GOO, 0.5);
          fxr.current?.text(x, y - 26, `+${g.score - scored.current}`);
          scored.current = g.score;
          if (isComboTier(g.combo)) {
            fxr.current?.text(x, y - 64, `×${g.combo}!`, true);
            feedback.game('tier');
          }
          feedback.game('hit', g.combo - 1);
          stop.freeze(last ? 180 : isComboTier(g.combo) ? 110 : 60);
          shake(stage.current, last ? 0.8 : isComboTier(g.combo) ? 0.45 : 0.2);
          punch(comboEl.current);
          act('attack', 380);
        } else {
          fxr.current?.burst(x, y, 10, ['#c8463c', '#e2792f', '#221e26'], 0.7);
          feedback.game('slip');
          shake(stage.current, 0.55);
          act('hurt', 400);
        }
      }
    }
    if (game.current.over) {
      setPose((p) => ({ name: game.current.over === 'won' ? 'cheer' : 'fall', n: p.n + 1 }));
      later(1300, () => onDone({ won: game.current.over === 'won', slips: game.current.slips, score: game.current.score }));
    }
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    handle(volleyStep(game.current, dt));
    redraw((n) => n + 1);
  }, !s.over);

  const need = s.words[Math.min(s.next, s.words.length - 1)];
  return (
    <div class="verse-area stack">
      <div class={`game-stage volley-stage ${s.over ?? ''}`} style={backdrop} ref={stage} data-testid="volley-stage" data-next={s.next}>
        <div class="game-hud">
          <Hearts n={s.hearts} of={VOLLEY_HEARTS} testid="volley-hearts" />
          <b class="game-score" data-testid="game-score">
            {s.score}
          </b>
        </div>
        {s.combo >= 2 && (
          <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
            ×{s.combo}
          </b>
        )}
        <div class="game-ground" />
        <div class={`volley-knight ${pose.name}`}>
          <AvatarFigure look={look} size={132} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
        </div>
        {LANE_TOP.map((top, lane) => (
          <div class={`volley-archer ${s.over === 'won' ? 'flee' : ''}`} style={{ top: `${top}%` }} key={lane}>
            <span class="loose" key={loosed[lane]}>
              <Pixels map={GOBLIN} size={44} />
            </span>
          </div>
        ))}
        {s.shots.map((sh) => {
          const at = place(sh.x, sh.lane);
          return (
            <button
              key={sh.id}
              class="shot"
              style={{ left: `${at.left}%`, top: `${at.top}%` }}
              onPointerDown={(e) => {
                e.preventDefault();
                feedback.unlock();
                handle(volleyTap(game.current, sh.id));
                redraw((n) => n + 1);
              }}
              data-right={sh.key === need.key ? 'yes' : undefined}
              data-testid="shot"
            >
              <Pixels map={ARROWHEAD} size={16} />
              <span>{sh.word}</span>
            </button>
          );
        })}
        <Fx ref={fxr} />
      </div>
      <p class="verse-text duel-text" data-testid="volley-text">
        {s.words.map((w, i) => (
          <span key={i}>
            <span class={`w ${i < s.next ? 'ok' : i === s.next ? 'cur gap' : 'gap'} ${i === s.next - 1 ? 'fresh' : ''}`}>{i < s.next ? w.raw : ' '.repeat(Math.max(3, Math.min(8, shown(w).length)))}</span>{' '}
          </span>
        ))}
      </p>
      <p class="muted small center" style={{ margin: 0 }}>
        Tap the arrow carrying the next word.
      </p>
    </div>
  );
}
