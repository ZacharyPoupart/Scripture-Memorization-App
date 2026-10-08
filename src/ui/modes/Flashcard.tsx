import { useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { revealGroups, tokenize, type RevealStep } from '../../core/text.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, type ModeProps } from './shared.tsx';

let lastStep: RevealStep = 'phrase'; // remembered while the app is open
type View = 'front' | 'gradual' | 'back';

/**
 * Quizlet-style flashcard: the reference on the front, tap to flip to the whole verse, then "Nailed it" or
 * "Needs work". For a gentler start there is also "Uncover bit by bit": the verse appears a phrase (or
 * word) at a time. There is no reference-recall step after a flashcard (the reference is on the card).
 */
export function Flashcard({ verse, onDone, onRestart }: ModeProps) {
  const [view, setView] = useState<View>('front');
  const words = useMemo(() => tokenize(verse.text), [verse.text]);
  const [step, setStep] = useState<RevealStep>(lastStep);
  const groups = useMemo(() => revealGroups(words, step), [words, step]);
  const [shown, setShown] = useState(0);
  const area = useRef<HTMLDivElement>(null);
  const wordsShown = groups.slice(0, shown).reduce((a, b) => a + b, 0);

  const revealNext = () => {
    const next = shown + 1;
    if (next >= groups.length) return setView('back');
    setShown(next);
    // keep the newest words in view; only the verse area scrolls, and only when needed
    requestAnimationFrame(() => {
      const box = area.current;
      const el = box?.querySelector<HTMLElement>(`[data-w="${groups.slice(0, next).reduce((a, b) => a + b, 0) - 1}"]`);
      if (!box || !el) return;
      const c = box.getBoundingClientRect();
      const e = el.getBoundingClientRect();
      if (e.bottom > c.bottom - 8 || e.top < c.top) box.scrollTo({ top: box.scrollTop + e.bottom - c.bottom + 48, behavior: 'auto' });
    });
  };
  const changeStep = (st: RevealStep) => {
    lastStep = st;
    setStep(st);
    setShown(0);
  };
  const flip = () => setView((v) => (v === 'back' ? 'front' : 'back'));

  return (
    <>
      <div class="verse-area" ref={area}>
        {view === 'front' && (
          <button class="flashcard-face" onClick={flip} data-testid="card-front" aria-label={`${formatRef(verse)}. Tap to flip and see the verse.`}>
            <span class="muted small">Recite this verse from memory</span>
            <span class="prompt-ref">{formatRef(verse)}</span>
            <span class="row wrap" style={{ justifyContent: 'center' }}>
              <span class="chip">{verse.translation}</span>
              {verse.topic && <span class="chip">#{verse.topic}</span>}
            </span>
            <span class="muted small">Tap the card to flip</span>
          </button>
        )}
        {view === 'back' && (
          <button class="flashcard-face back" onClick={flip} data-testid="card-back" aria-label={`${verse.text} Tap to flip back.`}>
            <span class="verse-text">{verse.text}</span>
            <span class="muted small">{formatRef(verse)} · {verse.translation}</span>
          </button>
        )}
        {view === 'gradual' && (
          <>
            <div class="flashcard-top">
              <div class="prompt-ref">{formatRef(verse)}</div>
              <div class="muted small">Recite it in your head, then tap to uncover</div>
            </div>
            <div class="verse-text reveal-text" data-testid="card-gradual" onClick={revealNext} role="button" tabIndex={-1} aria-label={`Tap to uncover the next ${step}`}>
              {words.map((w) => (
                <span key={w.index} data-w={w.index} class={w.index < wordsShown ? 'rw on' : 'rw'} aria-hidden={w.index < wordsShown ? undefined : 'true'}>
                  {w.raw}{' '}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
      <Dock>
        {view === 'back' ? (
          <div class="grid2">
            <button class="btn good" onClick={() => { feedback.correct(); onDone(); }} data-testid="grade-good">
              Nailed it
            </button>
            <button class="btn" onClick={onRestart} data-testid="grade-missed">
              Needs work
            </button>
          </div>
        ) : view === 'front' ? (
          <>
            <button class="btn primary block" onClick={flip} data-testid="flip">
              Flip
            </button>
            <div class="reveal-tools">
              <button class="btn ghost small" onClick={() => { setShown(0); setView('gradual'); }} data-testid="gradual-start">
                Uncover bit by bit
              </button>
            </div>
          </>
        ) : (
          <>
            <button class="btn primary block" onClick={revealNext} data-testid="reveal-next">
              {shown === 0 ? `Uncover first ${step}` : `Uncover next ${step}`}
            </button>
            <div class="reveal-tools">
              <button class="btn ghost small" onClick={() => setView('back')} data-testid="show-all">
                Show all
              </button>
              {shown > 0 && (
                <button class="btn ghost small" onClick={() => { setShown(0); area.current?.scrollTo({ top: 0 }); }} data-testid="reveal-reset">
                  Start over
                </button>
              )}
              <button class="btn ghost small" onClick={() => changeStep(step === 'phrase' ? 'word' : 'phrase')} data-testid="reveal-step" aria-label={`Uncovering by ${step}. Switch to ${step === 'phrase' ? 'word' : 'phrase'}.`}>
                By {step}
              </button>
              <button class="btn ghost small" onClick={() => setView('front')}>
                Back
              </button>
            </div>
          </>
        )}
      </Dock>
    </>
  );
}
