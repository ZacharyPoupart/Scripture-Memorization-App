// The games (v1.75.0, owner-requested: real-time games as the focal point of the app). Four ways to practise a verse with the
// knight, all against the clock and each a different kind of recall: Hold the Gate (first letters, Gate.tsx), Goblin Burrows (the
// next word, popping up, Burrows.tsx), Dragon Duel (the next word, chosen under fire) and Bridge Run (word order), here. v1.78.0
// retired Arrow Volley, Sword Dance and Parry as too close to these. The rules are in core/games.ts, gate.ts and burrows.ts. A game WON within the pile's mistake allowance is recorded with the same `completeReview` every review type
// uses, so the schedule, streak and coins follow their usual rules; a game lost, or won with too many slips, saves nothing.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { currentLook, sceneUrl, type Look } from '../../core/avatar.ts';
import { BRIDGE_HEARTS, BRIDGE_PLANK_MS, DUEL_HEARTS, GAMES, bestKey, duelChargeMs, gameCounts, runGames, duelRight, duelRounds, isComboTier, plankFits, planks, points, recordBest, bank, stars, totalStars, verseStars, type GameId, type Plank } from '../../core/games.ts';
import { mistakesAllowed } from '../../core/quiz.ts';
import { formatRef } from '../../core/reference.ts';
import { liveVerses, verseStatus } from '../../core/schedule.ts';
import { buildTodayQueue } from '../../core/today.ts';
import type { LevelUp, Verse } from '../../core/types.ts';
import { back, navigate } from '../../router.ts';
import { completeReview, updateSettings, useApp } from '../../store.ts';
import { feedback } from '../../services/feedback.ts';
import { AvatarFigure, type KnightPose } from '../AvatarFigure.tsx';
import { CoinCount } from '../CoinCount.tsx';
import { Confetti, Icon, PILE_INFO } from '../common.tsx';
import { Dock } from '../modes/shared.tsx';
import { EmptyState } from '../primitives.tsx';
import { Dragon, FLAME, GATE, GOBLIN, GOBLIN_UP, Hearts, Pixels, SPARK, Stars, TOWER, useTicker } from './sprites.tsx';
import { Burrows } from './Burrows.tsx';
import { Gate } from './Gate.tsx';
import { DUST, flyWord, Fx, gapIn, pointIn, punch, shake, slashWave, SPARKS, useHitStop, type FxHandle } from './juice.tsx';
import type { GameProps, Outcome } from './types.ts';

/** The scene behind a game: the knight's own background, as wide as the stage. */
function useBackdrop(): { look: Look; style?: Record<string, string> } {
  const { data } = useApp();
  const look = currentLook(data);
  const url = sceneUrl(look.scene);
  return { look, style: url ? { backgroundImage: `url(${import.meta.env.BASE_URL}${url.replace(/^\//, '')})` } : undefined };
}

type Recorded = { counted: boolean; levelUps: LevelUp[]; seeds: number; base: number; multiplier: number };

// ---------------------------------------------------------------- one game on one verse

export function Play({ game, verseId }: { game: string; verseId: string }) {
  const { data } = useApp();
  const { look, style } = useBackdrop();
  const verse = liveVerses(data).find((v) => v.id === verseId);
  const info = GAMES.find((g) => g.id === game);
  const [round, setRound] = useState(1); // "Play again" starts a fresh, differently mixed game
  const [done, setDone] = useState<Outcome | null>(null);
  if (!verse || !info) {
    return (
      <div class="review">
        <div class="verse-area center stack pt-6">
          <h2 class="headline">That game isn’t here</h2>
          <button class="btn primary" onClick={() => navigate('/play', true)}>
            Back to the games
          </button>
        </div>
      </div>
    );
  }
  const other = GAMES[(GAMES.indexOf(info) + 1) % GAMES.length];
  const again = () => (setDone(null), setRound((r) => r + 1));
  const props = { verse, seed: round, look, backdrop: style, onDone: setDone };
  return (
    <div class="review game" data-testid="game" data-game={info.id}>
      <div class="review-head">
        <button class="icon-btn" aria-label="Close the game" onClick={() => back('/play')} data-testid="game-close">
          <Icon name="close" />
        </button>
        <div class="title">
          <span class="game-name">{info.name}</span>
          <strong class="game-ref" data-testid="game-ref">
            {formatRef(verse)}
          </strong>
        </div>
        <span style={{ width: '44px' }} />
      </div>
      {done ? (
        <Finish key={`f${round}`} game={info.id} verse={verse} outcome={done} onAgain={again} onSwap={() => navigate(`/play/${other.id}/${verse.id}`, true)} otherName={other.name} />
      ) : info.id === 'gate' ? (
        <Gate key={round} {...props} />
      ) : info.id === 'burrows' ? (
        <Burrows key={round} {...props} />
      ) : info.id === 'duel' ? (
        <Duel key={round} {...props} />
      ) : (
        <Bridge key={round} {...props} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- a run through everything due today, a random game each

/**
 * "Play today's reviews" (v1.79.0, owner-requested): the same verses, in the same order, as Today's own review session
 * (`buildTodayQueue`, fixed when the run starts), each in a random game. Each win counts as that verse's review, like any game.
 */
export function PlayRun() {
  const { data, settings } = useApp();
  const { look, style } = useBackdrop();
  const [queue] = useState(() => buildTodayQueue(data, Date.now()));
  const [games] = useState(() => runGames(queue.length));
  const [idx, setIdx] = useState(0);
  const [round, setRound] = useState(1);
  const [done, setDone] = useState<Outcome | null>(null);
  const [tally, setTally] = useState({ played: 0, counted: 0, stars: 0, seeds: 0, base: 0, multiplier: 1 });
  const verse = liveVerses(data).find((v) => v.id === queue[idx]);
  const close = () => back('/play');

  if (!queue.length || idx >= queue.length || !verse) {
    const finished = queue.length > 0 && idx >= queue.length;
    return (
      <div class="review game" data-testid="run-summary">
        <div class="review-head">
          <button class="icon-btn" aria-label="Close" onClick={close} data-testid="game-close">
            <Icon name="close" />
          </button>
        </div>
        <div class="verse-area center stack pt-6">
          {finished ? (
            <>
              <Confetti count={30} />
              <h2 class="headline">Every verse played</h2>
              <p class="muted" style={{ margin: 0 }} data-testid="run-tally">
                {tally.played} verse{tally.played === 1 ? '' : 's'} played · {tally.counted} counted · {tally.stars} star{tally.stars === 1 ? '' : 's'}
              </p>
              {tally.seeds > 0 && settings.avatarOn && <CoinCount base={tally.base} total={tally.seeds} multiplier={tally.multiplier} testid="run-seeds" />}
            </>
          ) : (
            <h2 class="headline">Nothing is due right now</h2>
          )}
          <button class="btn primary" onClick={() => navigate('/', true)} data-testid="run-done">
            Back home
          </button>
        </div>
      </div>
    );
  }

  const game = games[idx];
  const info = GAMES.find((g) => g.id === game)!;
  const last = idx + 1 >= queue.length;
  const props = { verse, seed: round + idx * 31, look, backdrop: style, onDone: setDone };
  const run: RunStep = {
    nextLabel: last ? 'Finish' : `Next verse: ${GAMES.find((g) => g.id === games[idx + 1])!.name}`,
    onNext: () => {
      setDone(null);
      setRound(1);
      setIdx(idx + 1);
    },
    onRecorded: (rec, outcome) =>
      setTally((t) => ({
        played: t.played + 1,
        counted: t.counted + (rec?.counted ? 1 : 0),
        stars: t.stars + (outcome.won ? stars(outcome.slips) : 0),
        seeds: t.seeds + (rec?.seeds ?? 0),
        base: t.base + (rec?.base ?? 0),
        multiplier: Math.max(t.multiplier, rec?.multiplier ?? 1),
      })),
  };
  return (
    <div class="review game" data-testid="game" data-game={game} data-run={`${idx + 1}/${queue.length}`}>
      <div class="review-head">
        <button class="icon-btn" aria-label="Close the games" onClick={close} data-testid="game-close">
          <Icon name="close" />
        </button>
        <div class="title">
          <span class="game-name">
            {info.name} · {idx + 1} of {queue.length}
          </span>
          <strong class="game-ref" data-testid="game-ref">
            {formatRef(verse)}
          </strong>
        </div>
        <span style={{ width: '44px' }} />
      </div>
      <div class="review-progress" aria-hidden="true">
        <i style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>
      {done ? (
        <Finish key={`f${idx}-${round}`} game={game} verse={verse} outcome={done} onAgain={() => (setDone(null), setRound((r) => r + 1))} onSwap={() => {}} otherName="" run={run} />
      ) : game === 'gate' ? (
        <Gate key={`${idx}-${round}`} {...props} />
      ) : game === 'burrows' ? (
        <Burrows key={`${idx}-${round}`} {...props} />
      ) : game === 'duel' ? (
        <Duel key={`${idx}-${round}`} {...props} />
      ) : (
        <Bridge key={`${idx}-${round}`} {...props} />
      )}
    </div>
  );
}

const WORDS: Record<GameId, { won: string; lost: string }> = {
  gate: { won: 'The gate holds', lost: 'The goblins broke through' },
  burrows: { won: 'Every goblin bonked', lost: 'The goblins got away' },
  duel: { won: 'The dragon is beaten', lost: 'The dragon holds the gate' },
  bridge: { won: 'Safely across', lost: 'Into the river' },
};

/** The result. A win within the pile's mistake allowance is recorded here, once, like any other review. */
/** In a run of today's reviews the result moves on to the next verse (and its game) instead of offering a swap. */
interface RunStep {
  onNext: () => void;
  nextLabel: string;
  onRecorded: (rec: Recorded | null, outcome: Outcome) => void;
}

function Finish({ game, verse, outcome, onAgain, onSwap, otherName, run }: { game: GameId; verse: Verse; outcome: Outcome; onAgain: () => void; onSwap: () => void; otherName: string; run?: RunStep }) {
  const { data, settings } = useApp();
  const clean = outcome.slips <= mistakesAllowed(verse.pile);
  const counts = gameCounts(verse.pile, outcome.won, outcome.slips);
  const [rec, setRec] = useState<Recorded | null>(null);
  const once = useRef(false);
  const [best, setBest] = useState<{ newScore: boolean; newStars: boolean; prior: number }>({ newScore: false, newStars: false, prior: 0 });
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    const recorded = counts ? completeReview(verse.id) : null;
    setRec(recorded);
    run?.onRecorded(recorded, outcome);
    // personal bests are kept on this device (the stars and score of each game and verse)
    const key = bestKey(game, verse.id);
    const table = settings.gameBest ?? {};
    const r = recordBest(table, key, { won: outcome.won, stars: outcome.won ? stars(outcome.slips) : 0, score: outcome.score });
    setBest({ newScore: r.newScore, newStars: r.newStars, prior: table[key]?.score ?? 0 });
    if (r.table !== table) updateSettings({ gameBest: r.table });
    if (outcome.won) {
      feedback.game('win');
      for (let i = 1; i <= stars(outcome.slips); i++) setTimeout(() => feedback.game('star', i), 300 + 150 * i);
    } else feedback.game('loss');
  }, []);
  const now = Date.now();
  const nextId = buildTodayQueue(data, now).find((id) => id !== verse.id);
  const n = outcome.won ? stars(outcome.slips) : 0;
  const body = !outcome.won
    ? 'It got the better of you this time. Read the verse once more and have another go.'
    : !clean
      ? `You won, with ${outcome.slips} slip${outcome.slips === 1 ? '' : 's'}. ${PILE_INFO[verse.pile].label} verses need a clean run to count as the review. Go again?`
      : rec
        ? rec.levelUps.length
          ? `That counted as its review, and it moved up to ${PILE_INFO[rec.levelUps[rec.levelUps.length - 1].to].label}.`
          : rec.counted
            ? 'That counted as its review.'
            : 'Extra practice. This verse was already done for now.'
        : '';
  return (
    <>
      <div class="verse-area center stack" data-testid="game-finish" data-counted={rec?.counted ? 'yes' : 'no'}>
        {n > 0 && <Confetti count={n * 12} />}
        <h2 class="headline">{outcome.won ? WORDS[game].won : WORDS[game].lost}</h2>
        {n > 0 && <Stars n={n} />}
        <div class="final-score" data-testid="game-final-score">
          <span class="muted small">Score</span>
          <b>{outcome.score}</b>
          {best.newScore && (
            <span class="new-best" data-testid="game-new-best">
              New best!
            </span>
          )}
        </div>
        <p class="muted measure-sm" style={{ margin: '0 auto' }} data-testid="game-verdict">
          {body}
        </p>
        {rec && rec.seeds > 0 && settings.avatarOn && <CoinCount base={rec.base} total={rec.seeds} multiplier={rec.multiplier} testid="game-seeds" />}
        <p class="verse-text measure-sm" style={{ margin: '0 auto' }}>
          {verse.text}
        </p>
      </div>
      <Dock>
        <div class="stack">
          {run && (
            <button class="btn primary block" onClick={run.onNext} data-testid="run-next">
              {run.nextLabel}
            </button>
          )}
          {!run && nextId && outcome.won && (
            <button class="btn primary block" onClick={() => navigate(`/play/${game}/${nextId}`, true)} data-testid="game-next">
              Next verse
            </button>
          )}
          <div class="row">
            {!run && (
              <button class="btn grow" onClick={onSwap} data-testid="game-swap">
                Try {otherName}
              </button>
            )}
            <button class={`btn grow ${run || (nextId && outcome.won) ? '' : 'primary'}`} onClick={onAgain} data-testid="game-again">
              Play again
            </button>
          </div>
        </div>
      </Dock>
    </>
  );
}

/** setTimeout that is cleared when the game closes. */
function useLater() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return (ms: number, fn: () => void) => void timers.current.push(setTimeout(fn, ms));
}

/** A pose that plays once and then settles (the key restarts it when the same pose comes twice in a row). */
function usePose(rest: () => KnightPose) {
  const [pose, setPose] = useState<{ name: KnightPose; n: number }>({ name: 'idle', n: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const play = (name: KnightPose, ms = 400) => {
    clearTimeout(timer.current);
    setPose((p) => ({ name, n: p.n + 1 }));
    timer.current = setTimeout(() => setPose((p) => ({ name: rest(), n: p.n + 1 })), ms);
  };
  return [pose, play] as const;
}

// ---------------------------------------------------------------- Dragon Duel: strike with the next word before the fire comes

function Duel({ verse, seed, look, backdrop, onDone }: GameProps) {
  const rounds = useMemo(() => duelRounds(verse.text, seed + verse.text.length), [verse.text, seed]);
  const [at, setAt] = useState(0);
  const [hearts, setHearts] = useState(DUEL_HEARTS);
  const [slips, setSlips] = useState(0);
  const [combo, setCombo] = useState(0); // right words in a row: the blows get bigger
  const [beat, setBeat] = useState<{ kind: 'hit' | 'hurt'; n: number } | null>(null); // restarts the animations
  const [wrong, setWrong] = useState<string | null>(null);
  const [charge, setCharge] = useState(0); // the dragon drawing breath, 0 to 1
  const [score, setScore] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const dragonEl = useRef<HTMLDivElement>(null);
  const knightEl = useRef<HTMLDivElement>(null);
  const comboEl = useRef<HTMLElement>(null);
  const fxr = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const won = at >= rounds.length;
  const lost = hearts <= 0;
  const live = useRef({ won, lost });
  live.current = { won, lost };
  const [pose, play] = usePose(() => (live.current.won ? 'cheer' : live.current.lost ? 'fall' : 'idle'));
  const later = useLater();
  useEffect(() => {
    if (!won && !lost) return;
    const t = setTimeout(() => onDone({ won, slips, score }), 1300);
    return () => clearTimeout(t);
  }, [won, lost]);
  const dragonAt = (): [number, number] => {
    const d = dragonEl.current?.getBoundingClientRect();
    const b = stage.current?.getBoundingClientRect();
    return d && b ? [d.left + d.width * 0.4 - b.left, d.top + d.height * 0.45 - b.top] : [0, 0];
  };

  const burn = () => {
    feedback.game('slip');
    later(330, () => shake(stage.current, 0.55));
    setCombo(0);
    setSlips((n) => n + 1);
    setHearts((h) => h - 1);
    setBeat((b) => ({ kind: 'hurt', n: (b?.n ?? 0) + 1 }));
    setCharge(0);
    play('hurt', 900);
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    const next = charge + dt / duelChargeMs(at / rounds.length);
    if (next >= 1) burn(); // too slow: the dragon breathes
    else setCharge(next);
  }, !won && !lost);

  const cur = rounds[Math.min(at, rounds.length - 1)];
  const choose = (c: string, from?: Element) => {
    if (won || lost) return;
    feedback.unlock();
    if (duelRight(cur, c)) {
      flyWord(cur.word.raw, from, gapIn('duel-text'));
      const n = combo + 1;
      const p = points(n, 1 - charge);
      const [x, y] = dragonAt();
      slashWave(stage.current, pointIn(knightEl.current, stage.current, 0.75, 0.4), [x, y], isComboTier(n) || at + 1 >= rounds.length);
      fxr.current?.burst(x, y, isComboTier(n) || at + 1 >= rounds.length ? 28 : 12, SPARKS);
      fxr.current?.text(x, y - 40, `+${p}`);
      if (isComboTier(n)) {
        fxr.current?.text(x - 10, y - 80, `×${n}!`, true);
        feedback.game('tier');
      }
      feedback.game('hit', n - 1);
      stop.freeze(at + 1 >= rounds.length ? 180 : isComboTier(n) ? 110 : 60);
      shake(stage.current, at + 1 >= rounds.length ? 0.8 : isComboTier(n) ? 0.45 : 0.25);
      punch(comboEl.current);
      setScore(score + p);
      setWrong(null);
      setCombo(n);
      setBeat((b) => ({ kind: 'hit', n: (b?.n ?? 0) + 1 }));
      setAt(at + 1);
      setCharge(0);
      play('attack', 420);
    } else {
      setWrong(c);
      burn();
    }
  };
  const left = rounds.length - at;
  const fx = beat ? `${beat.kind}${beat.n}` : 'none';
  const big = combo >= 3 && beat?.kind === 'hit';
  return (
    <>
      <div class="verse-area stack">
        <div class={`game-stage duel-stage ${beat?.kind ?? ''} ${won ? 'won' : ''} ${lost ? 'lost' : ''}`} style={backdrop} ref={stage} data-testid="duel-stage">
          <div class="game-hud">
            <Hearts n={hearts} of={DUEL_HEARTS} testid="duel-hearts" />
            <b class="game-score duel-score" data-testid="game-score">
              {score}
            </b>
            <div class="duel-bars">
              <div class="bar duel-hp" role="img" aria-label={`The dragon has ${left} of ${rounds.length} strength left`}>
                <i style={{ width: `${(left / rounds.length) * 100}%` }} />
              </div>
              <div class={`bar duel-charge ${charge > 0.7 ? 'hot' : ''}`} role="img" aria-label="The dragon is drawing breath" data-testid="duel-charge">
                <i style={{ width: `${charge * 100}%` }} />
              </div>
            </div>
          </div>
          <div class="game-ground" />
          <div class={`duel-knight ${beat?.kind ?? ''}`} key={`k${fx}`} ref={knightEl}>
            <AvatarFigure look={look} size={150} bare pose={pose.name} key={`${pose.name}${pose.n}`} />
          </div>
          <div class={`duel-dragon ${beat?.kind ?? ''} ${charge > 0.7 ? 'rearing' : ''}`} key={`d${fx}`} ref={dragonEl}>
            <Dragon size={150} />
          </div>
          {beat?.kind === 'hit' && (
            <div class={`duel-fx ${big ? 'big' : ''}`} key={`f${fx}`} aria-hidden="true">
              <svg class="duel-slash" viewBox="0 0 60 60" width="96" height="96">
                <path d="M6 50 Q30 4 56 10 Q34 16 16 54 Z" />
              </svg>
              <span class="duel-spark">
                <Pixels map={SPARK} size={34} />
              </span>
              <b class="duel-dmg">{combo >= 3 ? `×${combo}!` : 'Hit!'}</b>
            </div>
          )}
          {beat?.kind === 'hurt' && (
            <div class="duel-flame" key={`f${fx}`} aria-hidden="true">
              <Pixels map={FLAME} size={54} />
            </div>
          )}
          {combo >= 2 && (
            <b class="game-combo hud-combo" ref={comboEl} data-testid="game-combo">
              ×{combo}
            </b>
          )}
          <Fx ref={fxr} />
        </div>
        <p class="verse-text duel-text" data-testid="duel-text">
          {rounds.map((r, i) => (
            <span key={i}>
              <span class={`w ${i < at ? 'ok' : i === at ? 'cur gap' : 'gap'} ${i === at - 1 ? 'fresh' : ''}`}>{i < at ? r.word.raw : ' '.repeat(Math.max(3, Math.min(8, r.word.raw.length)))}</span>{' '}
            </span>
          ))}
        </p>
      </div>
      <Dock>
        <div class="game-choices" data-testid="duel-choices">
          {cur.choices.map((c) => (
            <button key={`${at}-${c}`} class={`btn ${wrong === c ? 'shake' : ''}`} onPointerDown={(e) => (e.preventDefault(), choose(c, e.currentTarget as Element))} onClick={(e) => e.detail === 0 && choose(c, e.currentTarget as Element)} data-right={duelRight(cur, c) ? 'yes' : undefined} disabled={won || lost}>
              {c}
            </button>
          ))}
        </div>
      </Dock>
    </>
  );
}

// ---------------------------------------------------------------- Bridge Run: lay each phrase before the knight reaches the edge

function Bridge({ verse, seed, look, backdrop, onDone }: GameProps) {
  const all = useMemo(() => planks(verse.text, 1), [verse.text]); // one word a plank (v1.78.0, owner-requested)
  const [laid, setLaid] = useState(0);
  const [hearts, setHearts] = useState(BRIDGE_HEARTS);
  const [slips, setSlips] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [pos, setPos] = useState(-0.9); // where the knight is, in planks: below 0 is the near cliff, `laid` is the edge
  const [rest, setRest] = useState(0); // a breather after a fall (ms left)
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const plankRow = useRef<HTMLDivElement>(null);
  const fxr = useRef<FxHandle>(null);
  const stop = useHitStop(stage);
  const across = laid >= all.length;
  const lost = hearts <= 0;
  const live = useRef({ across, lost });
  live.current = { across, lost };
  const [pose, play] = usePose(() => (live.current.across ? 'cheer' : live.current.lost ? 'fall' : 'walk'));
  useEffect(() => {
    if (!across && !lost) return;
    const t = setTimeout(() => onDone({ won: across, slips, score }), across ? 1500 : 1200);
    return () => clearTimeout(t);
  }, [across, lost]);

  const hurt = () => {
    setSlips((n) => n + 1);
    setHearts((h) => h - 1);
    setCombo(0);
    feedback.game('slip');
    shake(stage.current, 0.5);
  };
  useTicker((dt) => {
    if (stop.eat(dt)) return;
    if (lost) return;
    if (across) return setPos((p) => Math.min(all.length + 0.9, p + dt / 500)); // strides off the end onto the far cliff
    if (rest > 0) return setRest(rest - dt);
    const next = pos + dt / BRIDGE_PLANK_MS;
    if (next >= laid - 0.12) {
      // out of bridge: he tips over the edge, loses a heart, and climbs back a plank
      hurt();
      play('fall', 800);
      setRest(900);
      setPos(Math.max(-0.9, laid - 1.1));
    } else setPos(next);
  }, pos < all.length + 0.9);

  const pick = (p: Plank, from?: Element) => {
    if (across || lost) return;
    feedback.unlock();
    if (plankFits(all, laid, p)) {
      flyWord(p.text, from, document.querySelector('[data-testid="bridge-text"] .next-slot'));
      const n = combo + 1;
      const pts = points(n, Math.max(0, Math.min(1, laid - pos - 0.2)));
      const slot = plankRow.current?.children[laid] as HTMLElement | undefined;
      const st = stage.current;
      if (slot && st) {
        const a = slot.getBoundingClientRect();
        const b = st.getBoundingClientRect();
        const x = a.left + a.width / 2 - b.left;
        const y = a.top - b.top;
        setTimeout(() => fxr.current?.burst(x, y + 6, isComboTier(n) ? 22 : 10, DUST, 0.7), 180); // when it lands
        fxr.current?.text(x, y - 18, `+${pts}`);
        if (isComboTier(n)) fxr.current?.text(x, y - 56, `×${n}!`, true);
      }
      setTimeout(() => feedback.game('thud'), 180);
      feedback.game(isComboTier(n) ? 'tier' : 'hit', n - 1);
      if (laid + 1 >= all.length) stop.freeze(160);
      setTimeout(() => shake(stage.current, laid + 1 >= all.length ? 0.5 : 0.15), 180);
      setCombo(n);
      setScore(score + pts);
      setWrong(null);
      setLaid(laid + 1);
    } else {
      setWrong(p.order);
      hurt();
      play('hurt', 400);
    }
  };
  const span = 68; // % of the stage the bridge covers, starting at 16%
  const x = 16 + (Math.max(-0.9, Math.min(all.length + 0.9, pos)) / all.length) * span;
  const danger = !across && !lost && rest <= 0 && laid - pos < 0.45;
  return (
    <>
      <div class="verse-area stack">
        <div class={`game-stage bridge-stage ${across ? 'across' : ''} ${lost ? 'lost' : ''}`} style={backdrop} ref={stage} data-testid="bridge-stage" data-laid={laid} data-total={all.length}>
          <div class="game-hud">
            <Hearts n={hearts} of={BRIDGE_HEARTS} testid="bridge-hearts" />
            <b class="game-score" data-testid="game-score">
              {score}
            </b>
          </div>
          <div class="bridge-river" />
          <div class="bridge-cliff near" />
          <div class="bridge-cliff far">
            <Pixels map={TOWER} size={44} label="The far tower" />
          </div>
          <div class="bridge-planks" aria-hidden="true" ref={plankRow}>
            {all.map((_, i) => (
              <i key={i} class={i < laid ? 'laid' : i === laid && danger ? 'wanted' : ''} />
            ))}
          </div>
          {slips > 0 && wrong !== null && <i class="bridge-drop" key={`drop${slips}`} style={{ left: `${16 + (laid / all.length) * span}%` }} aria-hidden="true" />}
          <div class={`bridge-walker ${rest > 0 ? 'fell' : ''} ${danger ? 'danger' : ''}`} style={{ left: `${x}%` }} key={`w${rest > 0 ? slips : 'on'}`}>
            <AvatarFigure look={look} size={100} bare pose={rest > 0 ? 'fall' : pose.name} key={`${rest > 0 ? 'fall' : pose.name}${pose.n}`} />
          </div>
          <Fx ref={fxr} />
        </div>
        <p class="verse-text bridge-text" data-testid="bridge-text">
          {laid === 0 ? <span class="muted">Tap the word that comes first.</span> : all.slice(0, laid - 1).map((p) => p.text).join(' ')}
          {laid > 0 && (
            <>
              {laid > 1 ? ' ' : ''}
              <span class="bridge-fresh" key={laid}>
                {all[laid - 1].text}
              </span>
            </>
          )}{' '}
          <span class="next-slot" aria-hidden="true" />
        </p>
        <div class="bridge-bank" data-testid="bridge-bank">
          {bank(all, laid, seed + verse.text.length).map((p) => (
            <button key={p.order} class={`btn plank ${wrong === p.order ? 'shake' : ''}`} onPointerDown={(e) => (e.preventDefault(), pick(p, e.currentTarget as Element))} onClick={(e) => e.detail === 0 && pick(p, e.currentTarget as Element)} data-order={p.order} disabled={across || lost}>
              {p.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || p.text}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- the games' home

const ART: Record<GameId, () => preact.JSX.Element> = {
  gate: () => <Pixels map={GATE} size={34} />,
  burrows: () => <Pixels map={GOBLIN_UP} size={36} />,
  duel: () => <Dragon size={52} />,
  bridge: () => <Pixels map={TOWER} size={34} />,
};

/** Up to three small stars: the best this device has won with on this game and verse. */
function BestStars({ n }: { n: number }) {
  return (
    <span class="best-stars" aria-label={n ? `Best: ${n} of 3 stars` : 'Not won yet'}>
      {[1, 2, 3].map((i) => (
        <i key={i} class={i <= n ? 'on' : ''} />
      ))}
    </span>
  );
}

export function PlayHub() {
  const { data, settings } = useApp();
  const best = settings.gameBest ?? {};
  const { look, style } = useBackdrop();
  const now = Date.now();
  const verses = liveVerses(data);
  const queue = buildTodayQueue(data, now);
  const ready = (v: Verse) => verseStatus(data, v, now).state === 'ready';
  const sorted = [...verses].sort((a, b) => (queue.includes(a.id) ? queue.indexOf(a.id) : 1e6) - (queue.includes(b.id) ? queue.indexOf(b.id) : 1e6));
  const [chosen, setChosen] = useState<string | null>(null);
  const verse = sorted.find((v) => v.id === chosen) ?? sorted[0];
  if (!verse) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1 class="headline">Play</h1>
          <EmptyState mark="book" title="Add a verse to play with" testid="play-empty">
            <button class="btn primary block" onClick={() => navigate('/add')}>
              Add a verse
            </button>
          </EmptyState>
        </div>
      </div>
    );
  }
  const readyCount = sorted.filter(ready).length;
  return (
    <div class="scroll">
      <div class="narrow stack" data-testid="play-hub">
        <div class="row spread">
          <h1 class="headline">Play</h1>
          <div class="row gap-2">
            <span class="hub-stars" data-testid="hub-stars" title="Stars you have won, across every game and verse">
              <i class="best-star" aria-hidden="true" />
              {totalStars(best)}
            </span>
            <button class={`icon-btn sound-toggle ${settings.soundOn ? 'on' : ''}`} onClick={() => (updateSettings({ soundOn: !settings.soundOn }), setTimeout(() => feedback.game('tier'), 30))} aria-pressed={settings.soundOn} aria-label={settings.soundOn ? 'Sound is on. Turn it off' : 'Sound is off. Turn it on'} data-testid="game-sound">
              <Icon name={settings.soundOn ? 'sound' : 'mute'} />
            </button>
          </div>
        </div>
        <div class="game-stage hub-stage" style={style} aria-hidden="true">
          <div class="game-ground" />
          <div class="hub-knight">
            <AvatarFigure look={look} size={128} bare pose="march" />
          </div>
          <div class="hub-goblin">
            <Pixels map={GOBLIN} size={44} />
          </div>
          <div class="hub-dragon">
            <Dragon size={120} />
          </div>
        </div>
        {readyCount > 0 && (
          <button class="btn primary block" onClick={() => navigate('/play/run')} data-testid="play-run">
            Play today’s reviews · {readyCount}
          </button>
        )}
        <label class="stack gap-1">
          <span class="label">
            Verse {readyCount > 0 && <span class="muted">· {readyCount} ready today</span>} <span class="muted">· {verseStars(best, verse.id)} of {GAMES.length * 3} stars</span>
          </span>
          <select class="input" value={verse.id} onChange={(e) => setChosen((e.target as HTMLSelectElement).value)} data-testid="play-verse">
            {sorted.map((v) => (
              <option key={v.id} value={v.id}>
                {formatRef(v)}
                {ready(v) ? ' · ready' : ''}
              </option>
            ))}
          </select>
        </label>
        <ul class="game-cards">
          {GAMES.map((g) => (
            <li key={g.id}>
              <button class="game-card" onClick={() => navigate(`/play/${g.id}/${verse.id}`)} data-testid={`hub-${g.id}`}>
                <span class="game-card-art">{ART[g.id]()}</span>
                <span class="game-card-text">
                  <strong>
                    {g.name} <BestStars n={best[bestKey(g.id, verse.id)]?.stars ?? 0} />
                  </strong>
                  <small class="muted">{g.blurb}</small>
                  {best[bestKey(g.id, verse.id)] && <small class="muted">Best {best[bestKey(g.id, verse.id)].score}</small>}
                </span>
                <Icon name="arrow" />
              </button>
            </li>
          ))}
        </ul>
        <p class="muted small" style={{ margin: 0 }}>
          Win a game and it counts as that verse’s review. Weekly, Monthly and Yearly verses need a clean run.
        </p>
      </div>
    </div>
  );
}
