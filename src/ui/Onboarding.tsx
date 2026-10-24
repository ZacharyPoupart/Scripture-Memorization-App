import { useState } from 'preact/hooks';
import { Overlay } from './common.tsx';

const SLIDES = [
  { icon: '📖', title: 'Keep Scripture for life', body: 'A calm daily habit that makes verses stick.' },
  { icon: '➕', title: 'Add verses', body: 'Pick a book, chapter and verses. The text is looked up for you, or paste your own.' },
  { icon: '🗂️', title: 'Four piles', body: 'New verses start in Daily. As they settle they move up to Weekly, Monthly and Yearly.' },
  { icon: '🧠', title: 'Four ways to practice', body: 'Flashcards, blanks, typing or speaking.' },
  { icon: '🔥', title: 'Build your streak', body: 'A short tour shows you around and earns your first shield.' },
];

export function Onboarding({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <Overlay center label="Welcome">
      <div class="modal stack center" data-testid="onboarding">
        <div class="hero">{s.icon}</div>
        <h2>{s.title}</h2>
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
