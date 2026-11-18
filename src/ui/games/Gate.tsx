// Hold the Gate: goblins march on the gate, one per word; tap the FIRST LETTER of the next word to strike each one down.
// The rules are the simulation in core/gate.ts; this draws it every frame and adds the juice (ui/games/juice.tsx).
import { useEffect, useRef, useState } from 'preact/hooks';
import { isComboTier } from '../../core/games.ts';
import { GATE_HEARTS, gateStep, gateTap, newGate, type GateEvent } from '../../core/gate.ts';
import { feedback } from '../../services/feedback.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { DUST, flyWord, Fx, gapIn, GOO, punch, shake, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import { GATE, GOBLIN, Hearts, Pixels, SHIELD_ICON, useTicker } from './sprites.tsx';
import type { GameProps } from './types.ts';

const GATE_X = 30; // % where the gate stands; the goblins start at the far right
const START_X = 92;

export function Gate({ verse, seed, look, backdrop, onDone }: GameProps) {
  const game = useRef(newGate(verse.text, seed + verse.text.length));
  const s = game.current;
  const stage = useRef<HTMLDivElement>(null);
  const goblin = useRef<HTMLDivElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const fx = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const [, redraw] = useState(0);
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const [shown, setShown] = useState<number[]>([]); // words that got through and were shown
  const [wrongKey, setWrongKey] = useState<{ k: string; n: number } | null>(null);
  const [fresh, setFresh] = useState(0); // restarts the new goblin's entrance
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const rest = (): KnightPose => (game.current.over === 'won' ? 'cheer' : game.current.over === 'lost' ? 'fall' : 'idle');
  const act = (name: KnightPose, ms: number) => {
    setPose((p) => ({ name, n: p.n + 1 }));
    later(ms, () => setPose((p) => (p.name === name ? { name: rest(), n: p.n + 1 } : p)));
  };
  const at = () => {
    const st = stage.current;
    const g = goblin.current;
    if (!st || !g) return [st ? st.clientWidth * 0.6 : 0, 120] as [number, number];
    const a = g.getBoundingClientRect();
    const b = st.getBoundingClientRect();
    return [a.left + a.width / 2 - b.left, a.top + a.height / 2 - b.top] as [number, number];
  };

  const handle = (events: GateEvent[]) => {
    for (const e of events) {
      if (e.type === 'strike') {
        flyWord(e.word.raw, goblin.current, gapIn('gate-text'));
        const [x, y] = at();
        fx.current?.burst(x, y, isComboTier(e.combo) ? 26 : 12, GOO);
        fx.current?.burst(x, y, 6, SPARKS, 0.7);
        fx.current?.text(x, y - 30, `+${e.points}`);
        if (isComboTier(e.combo)) {
          fx.current?.text(x - 20, y - 70, `×${e.combo}!`, true);
          feedback.game('tier');
        }
        feedback.game('hit', e.combo - 1);
        stop.freeze(isComboTier(e.combo) ? 110 : 60);
        shake(stage.current, isComboTier(e.combo) ? 0.45 : 0.22);
        punch(comboEl.current);
        act('attack', 380);
        setFresh((n) => n + 1);
      }
      if (e.type === 'miss') {
        setWrongKey((w) => ({ k: e.letter, n: (w?.n ?? 0) + 1 }));
        feedback.game('slip');
      }
      if (e.type === 'breach') {
        const [x, y] = at();
        fx.current?.burst(x, y, 14, DUST, 0.8);
        setShown((list) => [...list, e.word.index]);
        feedback.game('slip');
        shake(stage.current, 0.6);
        act('hurt', 420);
        setFresh((n) => n + 1);
      }
      if (e.type === 'block') {
        const [x, y] = at();
        fx.current?.burst(x - 30, y, 10, SPARKS);
        feedback.game('block');
        act('block', 420);
        if (e.word) {
          setShown((list) => [...list, e.word!.index]);
          setFresh((n) => n + 1);
        }
      }
      if (e.type === 'shield') {
        const st = stage.current;
        fx.current?.text((st?.clientWidth ?? 300) * 0.22, 80, 'Shield!', true);
        feedback.game('tier');
      }
      if (e.type === 'miss' && game.current.hearts < GATE_HEARTS && !events.some((x) => x.type === 'block')) {
        shake(stage.current, 0.5);
        act('hurt', 420);
      }
    }
    if (game.current.over) {
      setPose((p) => ({ name: game.current.over === 'won' ? 'cheer' : 'fall', n: p.n + 1 }));
      if (game.current.over === 'won') stop.freeze(180);
      later(1300, () => onDone({ won: game.current.over === 'won', slips: game.current.slips, score: game.current.score }));
    }
  };
  const tap = (k: string) => {
    feedback.unlock();
    handle(gateTap(game.current, k));
    redraw((n) => n + 1);
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    handle(gateStep(game.current, dt));
    redraw((n) => n + 1);
  }, !s.over);
  // a hardware keyboard works too (on a computer)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !/^[a-z0-9]$/i.test(e.key)) return;
      tap(e.key.toUpperCase());
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  const x = GATE_X + 6 + (1 - Math.min(1, s.x)) * (START_X - GATE_X - 6);
  const near = s.x > 0.72 && !s.over;
  return (
    <>
      <div class="verse-area stack">
        <div class={`game-stage gate-stage ${s.over ?? ''}`} style={backdrop} ref={stage} data-testid="gate-stage" data-next={s.next}>
          <div class="game-hud">
            <Hearts n={s.hearts} of={GATE_HEARTS} testid="gate-hearts" />
            <div class="hud-right">
              {s.shield && (
                <span class="hud-shield" title="Shield ready: the next slip is blocked" data-testid="gate-shield">
                  <Pixels map={SHIELD_ICON} size={22} label="Shield ready" />
                </span>
              )}
              <b class="game-score" data-testid="game-score">
                {s.score}
              </b>
            </div>
          </div>
          <div class="game-ground" />
          <div class="gate-wall">
            <Pixels map={GATE} size={70} />
          </div>
          <div class={`gate-knight pose-${pose.name}`}>
            <AvatarFigure look={look} size={124} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
          </div>
          {!s.over && (
            <div class={`gate-goblin ${near ? 'near' : ''}`} style={{ left: `${x}%` }} ref={goblin} key={`g${fresh}`}>
              <span class="march">
                <Pixels map={GOBLIN} size={52} label="A goblin" />
              </span>
            </div>
          )}
          {s.combo >= 2 && (
            <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
              ×{s.combo}
            </b>
          )}
          <Fx ref={fx} />
        </div>
        <p class="verse-text duel-text" data-testid="gate-text">
          {s.words.map((w, i) => (
            <span key={i}>
              <span class={`w ${i < s.next ? (shown.includes(i) ? 'missed' : 'ok') : i === s.next ? 'cur gap' : 'gap'} ${i === s.next - 1 ? 'fresh' : ''}`}>{i < s.next ? w.raw : ' '.repeat(Math.max(3, Math.min(8, w.raw.length)))}</span>{' '}
            </span>
          ))}
        </p>
      </div>
      <div class="dock">
        <div class="dock-inner">
          <div class="letter-keys" data-testid="gate-keys">
            {s.keys.map((k) => (
              <button
                key={`${s.next}-${k}`}
                class={`letter-key ${wrongKey?.k === k ? 'shake' : ''}`}
                onPointerDown={(e) => (e.preventDefault(), tap(k))}
                onClick={(e) => e.detail === 0 && tap(k)}
                disabled={!!s.over}
                data-right={s.words[s.next] && k === s.words[s.next].key[0]?.toUpperCase() ? 'yes' : undefined}
                aria-label={`Letter ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
          <p class="muted small center" style={{ margin: 'var(--sp-2) 0 0' }}>
            The first letter of the next word.
          </p>
        </div>
      </div>
    </>
  );
}
