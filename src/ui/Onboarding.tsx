import { useState } from 'preact/hooks';
import { Overlay } from './common.tsx';

const SLIDES = [
  { icon: '📖', title: 'Keep Scripture for life', body: 'Memorize For Life makes verse memory a calm daily habit — and makes the verses stick, long term.' },
  { icon: '➕', title: 'Add verses', body: 'Pick a book, chapter and verses. The text is looked up for you when you’re online, or you can type or paste it any time — even offline.' },
  { icon: '🗂️', title: 'Four piles', body: 'New verses start in Daily (3 reviews a day). After 90 days they move to Weekly, then Monthly, then Yearly — reviewed less and less, but never forgotten.' },
  { icon: '🧠', title: 'Four ways to practice', body: 'Flashcards, fill in the blanks, typing first letters, or speaking aloud. You’ll also recall where each verse is found.' },
  { icon: '🔥', title: 'Build your streak', body: 'Finish your due reviews each day to grow your streak. If you step away for 3 days, progress pauses — it never punishes you by erasing anything.' },
];

export function Onboarding({ onClose }: { onClose: () => void }) {
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
          <button class="btn primary grow" onClick={() => (last ? onClose() : setI(i + 1))} data-testid="onboarding-next">
            {last ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
