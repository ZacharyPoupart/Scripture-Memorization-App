import { useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { mistakesAllowed } from '../../core/quiz.ts';
import { revealGroups, tokenize, type RevealStep } from '../../core/text.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

let lastStep: RevealStep = 'phrase'; // remembered while the app is open

/** Recite from memory, then tap to uncover the verse a phrase (or word) at a time. */
export function Flashcard({ verse, onMistake, onDone, onRestart, mistakes }: ModeProps) {
  const words = useMemo(() => tokenize(verse.text), [verse.text]);
  const [step, setStep] = useState<RevealStep>(lastStep);
  const groups = useMemo(() => revealGroups(words, step), [words, step]);
  const [shown, setShown] = useState(0); // number of groups uncovered
  const area = useRef<HTMLDivElement>(null);
  const canAlmost = mistakesAllowed(verse.pile) > 0;
  const complete = shown >= groups.length;
  const wordsShown = groups.slice(0, shown).reduce((a, b) => a + b, 0);

  const revealNext = () => {
    if (complete) return;
    const next = shown + 1;
    setShown(next);
    // keep the newest words in view without ever moving the page: only scroll the verse area, and only if needed
    requestAnimationFrame(() => {
      const box = area.current;
      const el = box?.querySelector<HTMLElement>(`[data-w="${groups.slice(0, next).reduce((a, b) => a + b, 0) - 1}"]`);
      if (!box || !el) return;
      const c = box.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      if (e.bottom > c.bottom - 8 || e.top < c.top) box.scrollTo({ top: box.scrollTop + e.bottom - c.bottom + 48, behavior: 'auto' });
    });
  };
  const revealAll = () => setShown(groups.length);
  const startOver = () => {
    setShown(0);
    area.current?.scrollTo({ top: 0 });
  };
  const changeStep = (st: RevealStep) => {
    lastStep = st;
    setStep(st);
    setShown(0);
  };

  // word index -> is it uncovered yet?
  return (
    <>
      <div class="verse-area" ref={area}>
        <div class="flashcard-top">
          <div class="muted small">Recite it in your head, then tap to uncover</div>
          <div class="prompt-ref">{formatRef(verse)}</div>
          <div class="row wrap" style={{ justifyContent: 'center' }}>
            <span class="chip">{verse.translation}</span>
            {verse.topic && <span class="chip">#{verse.topic}</span>}
          </div>
        </div>
        <div
          class="verse-text reveal-text"
          data-testid={complete ? 'card-back' : 'card-front'}
          onClick={revealNext}
          role="button"
          tabIndex={-1}
          aria-label={complete ? verse.text : `Tap to uncover the next ${step}`}
        >
          {words.map((w) => (
            <span key={w.index} data-w={w.index} class={w.index < wordsShown ? 'rw on' : 'rw'} aria-hidden={w.index < wordsShown ? undefined : 'true'}>
              {w.raw}{' '}
            </span>
          ))}
        </div>
        {complete && (
          <p class="center muted small" style={{ marginTop: '16px' }}>
            How did you do?
          </p>
        )}
      </div>
      <Dock>
        {canAlmost && <MistakeDots verse={verse} mistakes={mistakes} />}
        {!complete ? (
          <>
            <button class="btn primary block" onClick={revealNext} data-testid="reveal-next">
              {shown === 0 ? `Uncover first ${step}` : `Uncover next ${step}`}
            </button>
            <div class="reveal-tools">
              <button class="btn ghost small" onClick={revealAll} data-testid="flip">
                Show all
              </button>
              {shown > 0 && (
                <button class="btn ghost small" onClick={startOver} data-testid="reveal-reset">
                  Start over
                </button>
              )}
              <button class="btn ghost small" onClick={() => changeStep(step === 'phrase' ? 'word' : 'phrase')} data-testid="reveal-step" aria-label={`Uncovering by ${step}. Switch to ${step === 'phrase' ? 'word' : 'phrase'}.`}>
                By {step}
              </button>
            </div>
          </>
        ) : (
          <div class={canAlmost ? 'grid3' : 'grid2'}>
            <button
              class="btn good"
              onClick={() => {
                feedback.correct();
                onDone();
              }}
              data-testid="grade-good"
            >
              Nailed it
            </button>
            {canAlmost && (
              <button
                class="btn"
                data-testid="grade-almost"
                onClick={() => {
                  if (!onMistake()) onDone();
                }}
              >
                Almost
              </button>
            )}
            <button class="btn danger" onClick={onRestart} data-testid="grade-missed">
              Missed it
            </button>
          </div>
        )}
      </Dock>
    </>
  );
}
