// Goblin Burrows: three goblins pop up from six burrows, one holding the next word; bonk that one before they duck.
// Rules in core/burrows.ts. Daily verses show words, the later piles only first letters.
import { useEffect, useRef, useState } from 'preact/hooks';
import { BURROWS, BURROW_HEARTS, burrowsNeeds, burrowsStep, burrowsTap, newBurrows, type BurrowsEvent, type Mole } from '../../core/burrows.ts';
import { isComboTier } from '../../core/games.ts';
import { feedback } from '../../services/feedback.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { DUST, flyWord, Fx, gapIn, GOO, pointIn, punch, shake, slashWave, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import { Hearts, Sprite, stripUrl, useTicker } from './sprites.tsx';
import type { GameProps } from './types.ts';

const MOLE = 0.5; // CSS pixels a sheet pixel: a goblin in its burrow (the pictures carry their own mound)

export function Burrows({ verse, seed, look, backdrop, onDone }: GameProps) {
  const game = useRef(newBurrows(verse.text, verse.pile, seed + verse.text.length));
  const s = game.current;
  const stage = useRef<HTMLDivElement>(null);
  const holes = useRef<(HTMLButtonElement | null)[]>([]);
  const knight = useRef<HTMLDivElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const fx = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const [, redraw] = useState(0);
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const [bonked, setBonked] = useState<{ hole: number; n: number } | null>(null);
  const [shown, setShown] = useState<number[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms));
  const act = (name: KnightPose, ms: number) => {
    setPose((p) => ({ name, n: p.n + 1 }));
    later(ms, () => setPose((p) => (p.name === name ? { name: game.current.over === 'won' ? 'cheer' : game.current.over === 'lost' ? 'fall' : 'idle', n: p.n + 1 } : p)));
  };
  const centre = (hole: number): [number, number] => {
    const el = holes.current[hole];
    const st = stage.current;
    if (!el || !st) return [0, 0];
    const a = el.getBoundingClientRect();
    const b = st.getBoundingClientRect();
    return [a.left + a.width / 2 - b.left, a.top + a.height * 0.35 - b.top];
  };

  const handle = (events: BurrowsEvent[]) => {
    for (const e of events) {
      if (e.type === 'rise') feedback.game('pop');
      if (e.type === 'bonk') {
        flyWord(game.current.words[game.current.next - 1]?.raw ?? e.mole.label, holes.current[e.mole.hole], gapIn('burrows-text'));
        const [x, y] = centre(e.mole.hole);
        slashWave(stage.current, pointIn(knight.current, stage.current, 0.7, 0.4), [x, y], isComboTier(e.combo));
        fx.current?.burst(x, y, isComboTier(e.combo) ? 26 : 12, SPARKS);
        fx.current?.burst(x, y, 6, GOO, 0.6);
        fx.current?.text(x, y - 26, `+${e.points}`);
        if (isComboTier(e.combo)) {
          fx.current?.text(x, y - 66, `×${e.combo}!`, true);
          feedback.game('tier');
        }
        feedback.game('hit', e.combo - 1);
        stop.freeze(isComboTier(e.combo) ? 110 : 55);
        shake(stage.current, isComboTier(e.combo) ? 0.4 : 0.18);
        punch(comboEl.current);
        act('attack', 360);
        setBonked((b) => ({ hole: e.mole.hole, n: (b?.n ?? 0) + 1 }));
        later(300, () => setBonked(null));
      }
      if (e.type === 'wrong') {
        const [x, y] = centre(e.mole.hole);
        fx.current?.burst(x, y, 8, DUST, 0.6);
        feedback.game('slip');
        shake(stage.current, 0.45);
        act('hurt', 400);
      }
      if (e.type === 'escape') {
        setShown((list) => [...list, e.word.index]);
        feedback.game('slip');
        shake(stage.current, 0.4);
        act('hurt', 400);
      }
    }
    if (game.current.over) {
      setPose((p) => ({ name: game.current.over === 'won' ? 'cheer' : 'fall', n: p.n + 1 }));
      later(1200, () => onDone({ won: game.current.over === 'won', slips: game.current.slips, score: game.current.score }));
    }
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    handle(burrowsStep(game.current, dt));
    redraw((n) => n + 1);
  }, !s.over);
  const tap = (hole: number) => {
    feedback.unlock();
    handle(burrowsTap(game.current, hole));
    redraw((n) => n + 1);
  };

  const moleIn = (hole: number): Mole | undefined => s.moles.find((m) => m.hole === hole);
  const leaving = s.moles.length > 0 && s.upFor > s.stay - 260;
  return (
    <div class="verse-area stack">
      <div class={`game-stage burrows-stage ${s.over ?? ''}`} style={backdrop} ref={stage} data-testid="burrows-stage" data-next={s.next}>
        <div class="game-hud">
          <Hearts n={s.hearts} of={BURROW_HEARTS} testid="burrows-hearts" />
          <b class="game-score" data-testid="game-score">
            {s.score}
          </b>
        </div>
        <div class="burrows-field" aria-hidden="true" style={{ backgroundImage: `url(${stripUrl('grass')})` }} />
        <div class="burrows-knight" ref={knight}>
          <AvatarFigure look={look} size={134} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
        </div>
        <div class="burrows-grid">
          {Array.from({ length: BURROWS }, (_, hole) => {
            const m = moleIn(hole);
            const hit = bonked?.hole === hole;
            return (
              <button
                key={hole}
                ref={(el) => void (holes.current[hole] = el)}
                class={`burrow ${m ? 'up' : ''} ${m && leaving ? 'leaving' : ''} ${hit ? 'bonked' : ''}`}
                onPointerDown={(e) => (e.preventDefault(), tap(hole))}
                onClick={(e) => e.detail === 0 && tap(hole)}
                aria-label={m ? m.label : 'An empty burrow'}
                disabled={!!s.over}
                data-testid="burrow"
                data-right={m && burrowsNeeds(s, m) ? 'yes' : undefined}
              >
                {(m || hit) && (
                  <span class="mole" key={m ? `${s.next}-${hole}` : `b${bonked?.n}`}>
                    {m && <span class="sign">{m.label}</span>}
                    <Sprite key={hit ? 'b' : leaving && m ? 'e' : 'p'} name={hit ? 'burrow-bonk' : leaving && m ? 'burrow-escape' : 'burrow-pop'} scale={MOLE} fps={hit ? 6 : 18} once={!hit} />
                  </span>
                )}
                <span class="hole">
                  <Sprite name="mound" scale={MOLE * 0.78} />
                </span>
              </button>
            );
          })}
        </div>
        {s.combo >= 2 && (
          <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
            ×{s.combo}
          </b>
        )}
        <Fx ref={fx} />
      </div>
      <p class="verse-text duel-text" data-testid="burrows-text">
        {s.words.map((w, i) => (
          <span key={i}>
            <span class={`w ${i < s.next ? (shown.includes(i) ? 'missed' : 'ok') : i === s.next ? 'cur gap' : 'gap'} ${i === s.next - 1 ? 'fresh' : ''}`}>{i < s.next ? w.raw : ' '.repeat(Math.max(3, Math.min(8, w.raw.length)))}</span>{' '}
          </span>
        ))}
      </p>
      <p class="muted small center" style={{ margin: 0 }}>
        {s.letters ? 'Bonk the first letter of the next word.' : 'Bonk the next word.'}
      </p>
    </div>
  );
}
