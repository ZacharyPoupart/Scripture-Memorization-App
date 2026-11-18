// Parry: runes fly at the knight one at a time, each with a word. Strike the one with the next word of the verse; block every
// other. Rules in core/parry.ts.
import { useEffect, useRef, useState } from 'preact/hooks';
import { isComboTier } from '../../core/games.ts';
import { PARRY_HEARTS, newParry, parryAct, parryStep, type ParryEvent } from '../../core/parry.ts';
import { feedback } from '../../services/feedback.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { Icon } from '../common.tsx';
import { DUST, flyWord, Fx, gapIn, punch, shake, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import { Hearts, Pixels, RUNE, useTicker } from './sprites.tsx';
import type { GameProps } from './types.ts';

const KNIGHT_X = 26; // % where a rune reaches the knight
const START_X = 94;

export function Parry({ verse, seed, look, backdrop, onDone }: GameProps) {
  const game = useRef(newParry(verse.text, seed + verse.text.length));
  const s = game.current;
  const stage = useRef<HTMLDivElement>(null);
  const runeEl = useRef<HTMLDivElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const fx = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const [, redraw] = useState(0);
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const [shown, setShown] = useState<number[]>([]);
  const [press, setPress] = useState<{ which: 'strike' | 'block'; ok: boolean; n: number } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const rest = (): KnightPose => (game.current.over === 'won' ? 'cheer' : game.current.over === 'lost' ? 'fall' : 'idle');
  const act = (name: KnightPose, ms: number) => {
    setPose((p) => ({ name, n: p.n + 1 }));
    later(ms, () => setPose((p) => (p.name === name ? { name: rest(), n: p.n + 1 } : p)));
  };
  const runeCentre = (): [number, number] => {
    const r = runeEl.current?.getBoundingClientRect();
    const b = stage.current?.getBoundingClientRect();
    return r && b ? [r.left + r.width / 2 - b.left, r.top + r.height / 2 - b.top] : [0, 0];
  };

  const handle = (events: ParryEvent[]) => {
    for (const e of events) {
      const [x, y] = runeCentre();
      if (e.type === 'rune') feedback.game('pop');
      if (e.type === 'strike') {
        flyWord(game.current.words[game.current.next - 1]?.raw ?? e.rune.word, runeEl.current, gapIn('parry-text'));
        fx.current?.burst(x, y, isComboTier(e.combo) ? 24 : 12, SPARKS);
        fx.current?.burst(x, y, 8, ['#a9a394', '#f4efe2'], 0.8);
        fx.current?.text(x, y - 30, `+${e.points}`);
        feedback.game('hit', e.combo - 1);
        stop.freeze(60);
        shake(stage.current, 0.25);
        act('attack', 360);
      }
      if (e.type === 'block') {
        fx.current?.burst(x - 10, y, 8, SPARKS, 0.6);
        fx.current?.text(x, y - 30, `+${e.points}`);
        feedback.game('block');
        act('block', 380);
      }
      if ((e.type === 'strike' || e.type === 'block') && isComboTier(e.combo)) {
        fx.current?.text(x, y - 70, `×${e.combo}!`, true);
        feedback.game('tier');
      }
      if (e.type === 'strike' || e.type === 'block') punch(comboEl.current);
      if (e.type === 'wrong' || e.type === 'hit') {
        if (e.rune.right) setShown((list) => [...list, game.current.next - 1]);
        fx.current?.burst(x, y, 10, DUST, 0.7);
        feedback.game('slip');
        shake(stage.current, 0.55);
        act('hurt', 420);
      }
    }
    if (game.current.over) {
      setPose((p) => ({ name: game.current.over === 'won' ? 'cheer' : 'fall', n: p.n + 1 }));
      later(1200, () => onDone({ won: game.current.over === 'won', slips: game.current.slips, score: game.current.score }));
    }
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    handle(parryStep(game.current, dt));
    redraw((n) => n + 1);
  }, !s.over);
  const choose = (which: 'strike' | 'block') => {
    if (!game.current.rune || game.current.over) return;
    feedback.unlock();
    const ev = parryAct(game.current, which);
    setPress((p) => ({ which, ok: ev[0]?.type !== 'wrong', n: (p?.n ?? 0) + 1 }));
    handle(ev);
    redraw((n) => n + 1);
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key.toLowerCase() === 's') choose('strike');
      else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'b') choose('block');
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);

  const r = s.rune;
  const x = r ? KNIGHT_X + (1 - Math.min(1, r.x)) * (START_X - KNIGHT_X) : START_X;
  return (
    <>
      <div class="verse-area stack">
        <div class={`game-stage parry-stage ${s.over ?? ''}`} style={backdrop} ref={stage} data-testid="parry-stage" data-next={s.next}>
          <div class="game-hud">
            <Hearts n={s.hearts} of={PARRY_HEARTS} testid="parry-hearts" />
            <b class="game-score" data-testid="game-score">
              {s.score}
            </b>
          </div>
          <div class="game-ground" />
          <div class="parry-knight">
            <AvatarFigure look={look} size={128} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
          </div>
          {r && (
            <div class={`parry-rune ${r.x > 0.7 ? 'near' : ''}`} style={{ left: `${x}%` }} ref={runeEl} key={r.id} data-testid="parry-rune" data-right={r.right ? 'yes' : undefined}>
              <Pixels map={RUNE} size={88} />
              <span class="word">{r.word}</span>
            </div>
          )}
          {s.combo >= 2 && (
            <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
              ×{s.combo}
            </b>
          )}
          <Fx ref={fx} />
        </div>
        <p class="verse-text duel-text" data-testid="parry-text">
          {s.words.map((w, i) => (
            <span key={i}>
              <span class={`w ${i < s.next ? (shown.includes(i) ? 'missed' : 'ok') : i === s.next ? 'cur gap' : 'gap'} ${i === s.next - 1 && !shown.includes(i) ? 'fresh' : ''}`}>{i < s.next ? w.raw : ' '.repeat(Math.max(3, Math.min(8, w.raw.length)))}</span>{' '}
            </span>
          ))}
        </p>
      </div>
      <div class="dock">
        <div class="dock-inner">
          <div class="parry-buttons" data-testid="parry-buttons">
            {(['block', 'strike'] as const).map((which) => (
              <button
                key={which}
                class={`parry-btn ${which} ${press?.which === which ? (press.ok ? 'good' : 'shake') : ''}`}
                data-press={press?.which === which ? press.n : undefined}
                onPointerDown={(e) => (e.preventDefault(), choose(which))}
                onClick={(e) => e.detail === 0 && choose(which)}
                disabled={!!s.over}
                data-testid={`parry-${which}`}
              >
                <Icon name={which === 'strike' ? 'play' : 'shieldline'} />
                {which === 'strike' ? 'Strike' : 'Block'}
              </button>
            ))}
          </div>
          <p class="muted small center" style={{ margin: 'var(--sp-2) 0 0' }}>
            Strike the next word. Block any other.
          </p>
        </div>
      </div>
    </>
  );
}
