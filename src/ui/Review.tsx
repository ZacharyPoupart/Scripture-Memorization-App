import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../core/reference.ts';
import { nextPile, pileVerses, streakInfo, todaySummary, verseStatus } from '../core/schedule.ts';
import { doneLine } from '../core/milestones.ts';
import { feedback } from '../services/feedback.ts';
import { tooManyMistakes } from '../core/quiz.ts';
import { PILES, type AppData, type LevelUp, type ReviewMode, type Verse } from '../core/types.ts';
import { back, navigate, type Route } from '../router.ts';
import { completeReview, showToast, useApp } from '../store.ts';
import { CheckMark, Confetti, Icon, PileBadge, PILE_INFO, pileProgress } from './common.tsx';
import { MODES } from './ModePicker.tsx';
import { Blanks } from './modes/Blanks.tsx';
import { Flashcard } from './modes/Flashcard.tsx';
import { RefRecall } from './modes/RefRecall.tsx';
import { Speak } from './modes/Speak.tsx';
import { TypeIt } from './modes/TypeIt.tsx';

import { buildTodayQueue } from '../core/today.ts';

function buildQueue(data: AppData, q: URLSearchParams, now: number): string[] {
  const one = q.get('verse');
  if (one) return data.verses[one] && !data.verses[one].deletedAt ? [one] : [];
  const ready = (v: Verse) => verseStatus(data, v, now).state === 'ready';
  if (q.get('today')) return buildTodayQueue(data, now);
  const pile = q.get('pile');
  if (pile && (PILES as string[]).includes(pile)) {
    const vs = pileVerses(data, pile as (typeof PILES)[number]);
    return (q.get('scope') === 'all' ? vs : vs.filter(ready)).map((v) => v.id);
  }
  return [];
}

type Step = 'text' | 'ref';

/** One verse, one attempt: the chosen mode, then reference recall. Remounted (new key) on restart. */
function VerseAttempt({ verse, mode, onFinished, onRestart }: { verse: Verse; mode: ReviewMode; onFinished: () => void; onRestart: () => void }) {
  const [step, setStep] = useState<Step>('text');
  const [mistakes, setMistakes] = useState(0);
  const count = useRef(0);
  const pile = useRef(verse.pile).current; // the pile the attempt started in decides how strict it is

  const onMistake = (n = 1) => {
    count.current += n;
    setMistakes(count.current);
    if (tooManyMistakes(count.current, pile)) {
      onRestart();
      return true;
    }
    return false;
  };
  // A flashcard shows the reference on the card itself, and Fill-in-the-blank asks for the reference (and topic) as blanks of its own; Type and Speak finish with typed reference recall
  const props = { verse, onMistake, onRestart, mistakes, onDone: () => (step === 'text' && mode !== 'flashcard' && mode !== 'blanks' ? setStep('ref') : onFinished()) };
  if (step === 'ref') return <RefRecall {...props} />;
  switch (mode) {
    case 'blanks':
      return <Blanks {...props} />;
    case 'type':
      return <TypeIt {...props} />;
    case 'speak':
      return <Speak {...props} />;
    default:
      return <Flashcard {...props} />;
  }
}

function ResultProgress({ verse, data }: { verse: Verse; data: AppData }) {
  const now = Date.now();
  const p = pileProgress(data, verse, now);
  const next = nextPile(verse.pile);
  const sum = todaySummary(data, now);
  return (
    <div class={`stack pile-${verse.pile}`} style={{ maxWidth: '320px', margin: '14px auto 0' }} data-testid="result-progress">
      {p.target && next ? (
        <div>
          <div class="bar">
            <i style={{ width: `${p.pct}%` }} />
          </div>
          <div class="muted small" style={{ marginTop: '4px' }}>
            {p.earned} of {p.target} days toward {PILE_INFO[next].label}
          </div>
        </div>
      ) : (
        <div class="muted small">Kept for life — reviewed once a year.</div>
      )}
      {sum.total > 0 && (
        <div class="muted small">
          {sum.met} of {sum.total} due reviews done today
        </div>
      )}
    </div>
  );
}

function SkipVerse({ onSkip }: { onSkip: () => void }) {
  useEffect(onSkip, []);
  return null;
}

export function Review({ route }: { route: Route }) {
  const { data, settings } = useApp();
  const mode = (MODES.find((m) => m.value === route.query.get('mode'))?.value ?? settings.defaultMode) as ReviewMode;
  const queue = useMemo(() => buildQueue(data, route.query, Date.now()), []);
  const [idx, setIdx] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ counted: boolean; levelUps: LevelUp[]; todayComplete: boolean } | null>(null);
  const [tally, setTally] = useState({ counted: 0, practice: 0, ups: 0 });
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!queue.length) {
    return (
      <div class="review">
        <div class="review-head">
          <button class="icon-btn" aria-label="Close" onClick={() => back('/')}>
            <Icon name="close" />
          </button>
        </div>
        <div class="verse-area center stack">
          <div class="hero">🌿</div>
          <h2>Nothing to review right now</h2>
          <p class="muted">Come back when a review unlocks — or open any verse for extra practice.</p>
          <button class="btn primary" onClick={() => navigate('/', true)}>
            Back home
          </button>
        </div>
      </div>
    );
  }

  const finished = idx >= queue.length;
  const verse = !finished ? data.verses[queue[idx]] : undefined;

  const next = () => {
    clearTimeout(advanceTimer.current);
    setResult(null);
    setAttempt(0);
    setIdx((i) => i + 1);
  };

  const onFinished = () => {
    if (!verse) return;
    const r = completeReview(verse.id);
    setResult({ counted: r.counted, levelUps: r.levelUps, todayComplete: r.todayComplete });
    feedback.complete();
    setTally((t) => ({ counted: t.counted + (r.counted ? 1 : 0), practice: t.practice + (r.counted ? 0 : 1), ups: t.ups + r.levelUps.length }));
    advanceTimer.current = setTimeout(next, 1100);
  };

  const onRestart = () => {
    showToast('Let’s try that verse again from the start.');
    setAttempt((a) => a + 1);
  };

  if (finished) {
    const nowT = Date.now();
    const sum = todaySummary(data, nowT);
    const streak = streakInfo(data, nowT);
    const fullyDone = sum.total > 0 && sum.remaining === 0; // every review of today finished (not just enough for the streak)
    return (
      <div class="review" data-testid="session-summary">
        <div class="verse-area center stack" style={{ paddingTop: '48px' }}>
          {fullyDone ? (
            <div class="alldone" data-testid="all-done">
              {settings.celebrations === 'full' && <Confetti count={36} />}
              <CheckMark size={72} />
              <h1>All done for today</h1>
              <p class="muted" style={{ margin: 0 }}>
                {streak.count > 0 ? `Streak: ${streak.count} day${streak.count === 1 ? '' : 's'}. See you tomorrow.` : 'See you tomorrow.'}
              </p>
            </div>
          ) : sum.outcome === 'c' ? (
            <div class="alldone" data-testid="streak-kept">
              <CheckMark size={64} />
              <h1>Nice work</h1>
              <p class="muted" style={{ margin: 0 }}>
                {streak.count > 0 ? `Your streak is ${streak.count} day${streak.count === 1 ? '' : 's'}.` : 'Your flame is lit.'}
              </p>
            </div>
          ) : (
            <>
              <div class="hero">🌿</div>
              <h1>Session complete</h1>
            </>
          )}
          <p class="muted">
            {queue.length} verse{queue.length === 1 ? '' : 's'} reviewed · {tally.counted} counted
            {tally.practice > 0 ? ` · ${tally.practice} extra practice` : ''}
          </p>
          {!fullyDone && sum.remaining > 0 && (
            <p class="muted small" data-testid="more-later">
              {sum.remaining} more due today — {sum.readyNow > 0 ? 'ready whenever you are.' : 'the next one unlocks a little later.'}
            </p>
          )}
          <div class="row" style={{ justifyContent: 'center' }}>
            <button class="btn primary" onClick={() => navigate('/', true)} data-testid="session-done">
              Back home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!verse || verse.deletedAt) return <SkipVerse onSkip={next} />; // deleted mid-session (e.g. by sync)

  const modeInfo = MODES.find((m) => m.value === mode)!;
  return (
    <div class="review" data-testid="review" data-mode={mode}>
      <div class="review-head">
        <button class="icon-btn" aria-label="Close review" onClick={() => back('/')} data-testid="close-review">
          <Icon name="close" />
        </button>
        <div class="title">
          {modeInfo.long}
          <span class="sub">
            Verse {idx + 1} of {queue.length}
          </span>
        </div>
        <PileBadge pile={verse.pile} />
      </div>
      <div class="review-progress" aria-hidden="true">
        <i style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>
      {result ? (
        <div class="verse-area" onClick={next} data-testid="verse-result">
          <div class="result-card">
            <div class="result-check">{result.counted ? <CheckMark size={64} /> : <div class="big">＋</div>}</div>
            <h2 style={{ marginTop: '10px' }}>{formatRef(verse)}</h2>
            <p class="muted">{result.counted ? `Review counted. ${doneLine(tally.counted)}` : 'Extra practice — it doesn’t change the schedule.'}</p>
            <ResultProgress verse={verse} data={data} />
            {result.levelUps.length > 0 && <p>Level up! Now in {PILE_INFO[result.levelUps[result.levelUps.length - 1].to].label}.</p>}
            {result.todayComplete && <p class="status-ready">That’s everything for today.</p>}
          </div>
        </div>
      ) : (
        <VerseAttempt key={`${verse.id}-${attempt}`} verse={verse} mode={mode} onFinished={onFinished} onRestart={onRestart} />
      )}
    </div>
  );
}
