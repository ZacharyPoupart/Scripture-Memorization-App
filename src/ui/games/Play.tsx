// Minigames with the knight (v1.75.0, owner-requested): two short games that practise a verse. Logic is in core/games.ts.
// Nothing here is saved: no review is counted, no coins, no streak. It is practice for the fun of it.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { currentLook, sceneUrl } from '../../core/avatar.ts';
import { DUEL_HEARTS, GAMES, duelRight, duelRounds, plankFits, planks, scatter, stars, type Plank } from '../../core/games.ts';
import { formatRef } from '../../core/reference.ts';
import { liveVerses } from '../../core/schedule.ts';
import type { Verse } from '../../core/types.ts';
import { back, navigate } from '../../router.ts';
import { useApp } from '../../store.ts';
import { AvatarFigure } from '../AvatarFigure.tsx';
import { Confetti, Icon } from '../common.tsx';
import { Dock } from '../modes/shared.tsx';

// ---------------------------------------------------------------- pixel pictures (drawn from little maps, one square a letter)

const DRAGON = [
  '..............kk......kk..',
  '.............kddk....kddk.',
  '......kk....kddddk..kdddk.',
  '.....kwk...kdddddkkkddddk.',
  '..kkkkgkk..kddddddddddddk.',
  '.kgggggggkkkgdddddddddgk..',
  'kgrgggggggggggggddddggk...',
  'kggggggggggggggggggggk....',
  'kwkwkgggggyyyygggggggk....',
  '.k.k.kkggyyyyyyggggggk....',
  '......kggyyyyyyygggggkk...',
  '......kgyyyyyyyygggggggk..',
  '......kggyyyyyygggkkgggk..',
  '.....kgggkkkkkgggk..kggk..',
  '.....kggk....kggk....kgk..',
  '....kkkkk...kkkkk....kkk..',
];
// the flame it breathes, and the spark where a blow lands
const FLAME = ['..oo....', '.oyyoo..', 'oyywyyoo', '.oyyoo..', '..oo....'];
const SPARK = ['..w..', '.wyw.', 'wyyyw', '.wyw.', '..w..'];
const HEART = ['.kk.kk.', 'krrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const STAR = ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', '.kykyk.', 'kk...kk'];
const TOWER = ['k.k.k', 'kkkkk', 'ksssk', 'ksssk', 'ksksk', 'ksksk'];
const INK: Record<string, string> = { k: '#221e26', g: '#3f8f5b', d: '#2c6a43', y: '#e8c66a', r: '#c8463c', w: '#f4efe2', s: '#a9a394', o: '#e2792f' };

function Pixels({ map, size, dim, label }: { map: string[]; size: number; dim?: boolean; label?: string }) {
  const w = map[0].length;
  const h = map.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={size} height={(size * h) / w} shape-rendering="crispEdges" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'} style={{ opacity: dim ? 0.22 : 1, display: 'block' }}>
      {map.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width="1.02" height="1.02" fill={INK[c]} />)))}
    </svg>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div class="game-stars" role="img" aria-label={`${n} of 3 stars`} data-testid="game-stars" data-stars={n}>
      {[1, 2, 3].map((i) => (
        <span key={i} class={i <= n ? 'on' : ''} style={{ animationDelay: `${0.15 * i}s` }}>
          <Pixels map={STAR} size={40} dim={i > n} />
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the screen

export function Play({ game, verseId }: { game: string; verseId: string }) {
  const { data } = useApp();
  const verse = liveVerses(data).find((v) => v.id === verseId);
  const info = GAMES.find((g) => g.id === game);
  const [round, setRound] = useState(1); // "Play again" starts a fresh, differently mixed game
  if (!verse || !info) {
    return (
      <div class="review">
        <div class="verse-area center stack pt-6">
          <h2 class="headline">That game isn’t here</h2>
          <button class="btn primary" onClick={() => navigate('/', true)}>
            Back home
          </button>
        </div>
      </div>
    );
  }
  const other = GAMES.find((g) => g.id !== info.id)!;
  const again = () => setRound((r) => r + 1);
  const swap = () => navigate(`/play/${other.id}/${verse.id}`, true);
  return (
    <div class="review game" data-testid="game" data-game={info.id}>
      <div class="review-head">
        <button class="icon-btn" aria-label="Close the game" onClick={() => back(`/verse/${verse.id}`)} data-testid="game-close">
          <Icon name="close" />
        </button>
        <div class="title">
          <strong>{info.name}</strong>
          <span class="sub">{formatRef(verse)}</span>
        </div>
        <span style={{ width: 44 }} />
      </div>
      {info.id === 'duel' ? <Duel key={round} verse={verse} seed={round} onAgain={again} onSwap={swap} otherName={other.name} /> : <Bridge key={round} verse={verse} seed={round} onAgain={again} onSwap={swap} otherName={other.name} />}
    </div>
  );
}

interface GameProps {
  verse: Verse;
  seed: number;
  onAgain: () => void;
  onSwap: () => void;
  otherName: string;
}

function Finish({ title, body, n, onAgain, onSwap, otherName, verse }: { title: string; body: string; n: number } & Omit<GameProps, 'seed'>) {
  return (
    <>
      <div class="verse-area center stack" data-testid="game-finish">
        {n > 0 && <Confetti count={n * 12} />}
        <h2 class="headline">{title}</h2>
        {n > 0 && <Stars n={n} />}
        <p class="muted measure-sm" style={{ margin: '0 auto' }}>
          {body}
        </p>
        <p class="verse-text measure-sm" style={{ margin: '0 auto' }}>
          {verse.text}
        </p>
      </div>
      <Dock>
        <div class="row">
          <button class="btn grow" onClick={onSwap} data-testid="game-swap">
            Try {otherName}
          </button>
          <button class="btn primary grow" onClick={onAgain} data-testid="game-again">
            Play again
          </button>
        </div>
      </Dock>
    </>
  );
}

// ---------------------------------------------------------------- Dragon Duel

/** The scene behind a game: the knight's own background, as wide as the stage. */
function useBackdrop() {
  const { data } = useApp();
  const look = currentLook(data);
  const url = sceneUrl(look.scene);
  return { look, style: url ? { backgroundImage: `url(${import.meta.env.BASE_URL}${url.replace(/^\//, '')})` } : undefined };
}

function Duel({ verse, seed, onAgain, onSwap, otherName }: GameProps) {
  const { look, style } = useBackdrop();
  const rounds = useMemo(() => duelRounds(verse.text, seed + verse.text.length), [verse.text, seed]);
  const [at, setAt] = useState(0);
  const [hearts, setHearts] = useState(DUEL_HEARTS);
  const [slips, setSlips] = useState(0);
  const [combo, setCombo] = useState(0); // right words in a row: the blows get bigger
  const [beat, setBeat] = useState<{ kind: 'hit' | 'hurt'; n: number } | null>(null); // restarts the animations
  const [wrong, setWrong] = useState<string | null>(null);
  const [over, setOver] = useState(false); // the last blow (or the last flame) plays out before the result shows
  const won = at >= rounds.length;
  const lost = hearts <= 0;
  useEffect(() => {
    if (!won && !lost) return;
    const t = setTimeout(() => setOver(true), 1100);
    return () => clearTimeout(t);
  }, [won, lost]);

  if (over)
    return (
      <Finish
        title={won ? 'The dragon is beaten' : 'The dragon holds the gate'}
        body={won ? (slips === 0 ? 'Not one slip. This verse is yours.' : `You got there with ${slips} slip${slips === 1 ? '' : 's'}. Go again for a clean run?`) : 'It got the better of you this time. Read the verse once more and have another go.'}
        n={won ? stars(slips) : 0}
        onAgain={onAgain}
        onSwap={onSwap}
        otherName={otherName}
        verse={verse}
      />
    );

  const cur = rounds[Math.min(at, rounds.length - 1)];
  const choose = (c: string) => {
    if (won || lost) return;
    if (duelRight(cur, c)) {
      setWrong(null);
      setCombo(combo + 1);
      setBeat({ kind: 'hit', n: at });
      setAt(at + 1);
    } else {
      setWrong(c);
      setCombo(0);
      setSlips(slips + 1);
      setHearts(hearts - 1);
      setBeat({ kind: 'hurt', n: slips });
    }
  };
  const left = rounds.length - at;
  const fx = beat ? `${beat.kind}${beat.n}` : 'none';
  const big = combo >= 3 && beat?.kind === 'hit';
  return (
    <>
      <div class="verse-area stack">
        <div class={`duel-stage ${beat?.kind ?? ''} ${won ? 'won' : ''} ${lost ? 'lost' : ''}`} style={style} key={beat?.kind === 'hurt' ? `s${fx}` : 'stage'} data-testid="duel-stage">
          <div class="duel-hud">
            <div class="duel-hearts" role="img" aria-label={`${hearts} of ${DUEL_HEARTS} hearts`} data-testid="duel-hearts" data-hearts={hearts}>
              {Array.from({ length: DUEL_HEARTS }, (_, i) => (
                <span key={`${i}-${i >= hearts}`} class={i >= hearts ? 'gone' : ''}>
                  <Pixels map={HEART} size={22} dim={i >= hearts} />
                </span>
              ))}
            </div>
            <div class="bar duel-hp" role="img" aria-label={`The dragon has ${left} of ${rounds.length} strength left`}>
              <i style={{ width: `${(left / rounds.length) * 100}%` }} />
            </div>
          </div>
          <div class="duel-ground" />
          <div class={`duel-knight ${beat?.kind ?? ''}`} key={`k${fx}`}>
            <AvatarFigure look={look} size={150} bare />
          </div>
          <div class={`duel-dragon ${beat?.kind ?? ''}`} key={`d${fx}`}>
            <Pixels map={DRAGON} size={150} label="The dragon" />
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
            <button key={`${at}-${c}`} class={`btn ${wrong === c ? 'shake' : ''}`} onClick={() => choose(c)} data-right={duelRight(cur, c) ? 'yes' : undefined} disabled={won || lost}>
              {c}
            </button>
          ))}
        </div>
      </Dock>
    </>
  );
}

// ---------------------------------------------------------------- Bridge of the Word

function Bridge({ verse, seed, onAgain, onSwap, otherName }: GameProps) {
  const { look, style } = useBackdrop();
  const all = useMemo(() => planks(verse.text), [verse.text]);
  const mixed = useMemo(() => scatter(all, seed + verse.text.length), [all, seed]);
  const [laid, setLaid] = useState(0);
  const [used, setUsed] = useState<number[]>([]); // the planks already taken from the bank (their place in `mixed`)
  const [slips, setSlips] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [over, setOver] = useState(false); // the knight walks the last plank before the result shows
  const across = laid >= all.length;
  useEffect(() => {
    if (!across) return;
    const t = setTimeout(() => setOver(true), 1200);
    return () => clearTimeout(t);
  }, [across]);

  if (over)
    return (
      <Finish
        title="Safely across"
        body={slips === 0 ? 'Every plank in its place, first time.' : `Across with ${slips} wobble${slips === 1 ? '' : 's'}. Go again for a clean crossing?`}
        n={stars(slips)}
        onAgain={onAgain}
        onSwap={onSwap}
        otherName={otherName}
        verse={verse}
      />
    );

  const pick = (p: Plank, i: number) => {
    if (across) return;
    if (plankFits(all, laid, p)) {
      setWrong(null);
      setUsed([...used, i]);
      setLaid(laid + 1);
    } else {
      setWrong(i);
      setSlips(slips + 1);
    }
  };
  // the knight stands on the last plank laid (on the near cliff before the first, on the far one at the end)
  const walk = across ? 84 : 4 + (laid / all.length) * 62;
  return (
    <>
      <div class="verse-area stack">
        <div class={`bridge-stage ${across ? 'across' : ''}`} style={style} data-testid="bridge-stage" data-laid={laid}>
          <div class="bridge-cliff near" />
          <div class="bridge-cliff far">
            <Pixels map={TOWER} size={44} label="The far tower" />
          </div>
          <div class="bridge-planks" aria-hidden="true">
            {all.map((_, i) => (
              <i key={i} class={i < laid ? 'laid' : ''} />
            ))}
          </div>
          {slips > 0 && <i class="bridge-drop" key={`drop${slips}`} style={{ left: `${18 + (laid / all.length) * 62}%` }} aria-hidden="true" />}
          <div class={`bridge-walker ${slips > 0 && wrong !== null ? 'wobble' : ''}`} key={`w${slips}`} style={{ left: `${walk}%` }}>
            <div class="bridge-step" key={`step${laid}`}>
              <AvatarFigure look={look} size={96} bare />
            </div>
          </div>
        </div>
        <p class="verse-text bridge-text" data-testid="bridge-text">
          {laid === 0 ? <span class="muted">Tap the phrase that comes first.</span> : all.slice(0, laid).map((p) => p.text).join(' ')}
        </p>
        <div class="bridge-bank" data-testid="bridge-bank">
          {mixed.map((p, i) =>
            used.includes(i) ? null : (
              <button key={i} class={`btn plank ${wrong === i ? 'shake' : ''}`} onClick={() => pick(p, i)} data-order={p.order}>
                {p.text}
              </button>
            ),
          )}
        </div>
      </div>
    </>
  );
}
