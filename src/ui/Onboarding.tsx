import { useState } from 'preact/hooks';
import { Overlay } from './common.tsx';
import { Mark, type MarkName } from './marks.tsx';

const SLIDES: { mark: MarkName; title: string; body: string }[] = [
  // the knight's theme (v1.87.0, owner-requested): God's word is the sword of the Spirit (Ephesians 6:17)
  { mark: 'book', title: 'Keep Scripture for life', body: 'Train a little each day, and God’s word becomes the sword of the Spirit in your hand.' },
  { mark: 'plus', title: 'Arm yourself', body: 'Add a verse: pick a book, chapter and verses. The text is looked up for you, or paste your own.' },
  { mark: 'piles', title: 'Rise through the ranks', body: 'New verses start in Daily. As they hold, they are promoted to Weekly, Monthly and Yearly.' },
  { mark: 'cards', title: 'Train four ways, then battle', body: 'Flashcards, blanks, typing or speaking, and games against goblins and a dragon.' },
  { mark: 'flame', title: 'Keep your flame lit', body: 'A short tour shows you around and earns your first shield.' },
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
