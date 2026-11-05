import { useState } from 'preact/hooks';
import { Overlay } from './common.tsx';
import { Mark, type MarkName } from './marks.tsx';

const SLIDES: { mark: MarkName; title: string; body: string }[] = [
  { mark: 'book', title: 'Keep Scripture for life', body: 'A calm daily habit that makes verses stick.' },
  { mark: 'plus', title: 'Add verses', body: 'Pick a book, chapter and verses. The text is looked up for you, or paste your own.' },
  { mark: 'piles', title: 'Four piles', body: 'New verses start in Daily. As they settle they move up to Weekly, Monthly and Yearly.' },
  { mark: 'cards', title: 'Four ways to practice', body: 'Flashcards, blanks, typing or speaking.' },
  { mark: 'flame', title: 'Build your streak', body: 'A short tour shows you around and earns your first shield.' },
];

export function Onboarding({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <Overlay center label="Welcome">
      <div class="modal stack center" data-testid="onboarding">
        <Mark name={s.mark} size={52} />
        <h2 class="headline">{s.title}</h2>
        <p class="muted" style={{ margin: 0 }}>
          {s.body}
        </p>
        <div class="dots" aria-hidden="true">
          {SLIDES.map((_, k) => (
            <i key={k} class={k === i ? 'on' : ''} />
          ))}
        </div>
        <div class="row">
          {!last && (
            <button class="btn ghost" onClick={onClose} data-testid="onboarding-skip">
              Skip
            </button>
          )}
          {last && (
            <button class="btn ghost" onClick={onClose} data-testid="onboarding-later">
              Not now
            </button>
          )}
          <button class="btn primary grow" onClick={() => (last ? onTour() : setI(i + 1))} data-testid="onboarding-next">
            {last ? 'Take the tour' : 'Next'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
