// Minigames with the knight (v1.75.0, owner-requested): two short games that practise a verse. Logic is in core/games.ts.
// Nothing here is saved: no review is counted, no coins, no streak. It is practice for the fun of it.
import { useMemo, useState } from 'preact/hooks';
import { currentLook } from '../../core/avatar.ts';
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
  '....................',
  '..........kk....kk..',
  '.........kwk...kggk.',
  '....kkkkkkggkkkgggk.',
  '...kggggggggggggggk.',
  '..kgrgggggggggdgggk.',
  '.kggggggggggggddggk.',
  '.kwkwkgggyyyggdddgk.',
  '..k.k.kggyyyyggddgk.',
  '......kgyyyyyggggk..',
  '......kgyyyyygggk...',
  '.....kggkkkkggkk....',
  '.....kgk....kgk.....',
  '....kkkk...kkkk.....',
];
const HEART = ['.kk.kk.', 'krrkrrk', 'krrrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const STAR = ['...k...', '..kyk..', 'kkkykkk', 'kyyyyyk', '.kyyyk.', '.kykyk.', 'kk...kk'];
const TOWER = ['k.k.k', 'kkkkk', 'ksssk', 'ksssk', 'ksksk', 'ksksk'];
const INK: Record<string, string> = { k: '#221e26', g: '#3f8f5b', d: '#2c6a43', y: '#e8c66a', r: '#c8463c', w: '#f4efe2', s: '#a9a394' };

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

function Duel({ verse, seed, onAgain, onSwap, otherName }: GameProps) {
  const { data } = useApp();
  const rounds = useMemo(() => duelRounds(verse.text, seed + verse.text.length), [verse.text, seed]);
  const [at, setAt] = useState(0);
  const [hearts, setHearts] = useState(DUEL_HEARTS);
  const [slips, setSlips] = useState(0);
  const [beat, setBeat] = useState<{ kind: 'hit' | 'hurt'; n: number } | null>(null); // restarts the little animation
  const [wrong, setWrong] = useState<string | null>(null);
  const won = at >= rounds.length;
  const lost = hearts <= 0;

  if (won || lost)
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

  const cur = rounds[at];
  const choose = (c: string) => {
    if (duelRight(cur, c)) {
      setWrong(null);
      setBeat({ kind: 'hit', n: at });
      setAt(at + 1);
    } else {
      setWrong(c);
      setSlips(slips + 1);
      setHearts(hearts - 1);
      setBeat({ kind: 'hurt', n: slips });
    }
  };
  const left = rounds.length - at;
  return (
    <>
      <div class="verse-area stack">
        <div class="duel-stage" data-testid="duel-stage">
          <div class={`duel-knight ${beat?.kind ?? ''}`} key={`k${beat?.kind}${beat?.n}`}>
            <AvatarFigure look={currentLook(data)} size={112} />
            <div class="duel-hearts" role="img" aria-label={`${hearts} of ${DUEL_HEARTS} hearts`} data-testid="duel-hearts" data-hearts={hearts}>
              {Array.from({ length: DUEL_HEARTS }, (_, i) => (
                <Pixels key={i} map={HEART} size={20} dim={i >= hearts} />
              ))}
            </div>
          </div>
          <div class={`duel-dragon ${beat?.kind ?? ''}`} key={`d${beat?.kind}${beat?.n}`}>
            <Pixels map={DRAGON} size={132} label="The dragon" />
            <div class="bar duel-hp" role="img" aria-label={`The dragon has ${left} of ${rounds.length} strength left`}>
              <i style={{ width: `${(left / rounds.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <p class="verse-text duel-text" data-testid="duel-text">
          {rounds.map((r, i) => (
            <span key={i}>
              <span class={`w ${i < at ? 'ok' : i === at ? 'cur gap' : 'gap'}`}>{i < at ? r.word.raw : ' '.repeat(Math.max(3, Math.min(8, r.word.raw.length)))}</span>{' '}
            </span>
          ))}
        </p>
      </div>
      <Dock>
        <div class="game-choices" data-testid="duel-choices">
          {cur.choices.map((c) => (
            <button key={`${at}-${c}`} class={`btn ${wrong === c ? 'shake' : ''}`} onClick={() => choose(c)} data-right={duelRight(cur, c) ? 'yes' : undefined}>
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
  const { data } = useApp();
  const all = useMemo(() => planks(verse.text), [verse.text]);
  const mixed = useMemo(() => scatter(all, seed + verse.text.length), [all, seed]);
  const [laid, setLaid] = useState(0);
  const [used, setUsed] = useState<number[]>([]); // the planks already taken from the bank (their place in `mixed`)
  const [slips, setSlips] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);

  if (laid >= all.length)
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
    if (plankFits(all, laid, p)) {
      setWrong(null);
      setUsed([...used, i]);
      setLaid(laid + 1);
    } else {
      setWrong(i);
      setSlips(slips + 1);
    }
  };
  return (
    <>
      <div class="verse-area stack">
        <div class="bridge-stage" data-testid="bridge-stage" data-laid={laid}>
          <div class="bridge-walker" style={{ left: `${(laid / all.length) * 82}%` }}>
            <AvatarFigure look={currentLook(data)} size={52} view="face" />
          </div>
          <div class="bridge-goal">
            <Pixels map={TOWER} size={40} label="The far tower" />
          </div>
          <div class="bridge-planks" aria-hidden="true">
            {all.map((_, i) => (
              <i key={i} class={i < laid ? 'laid' : ''} />
            ))}
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
