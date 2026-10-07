import { useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { mistakesAllowed } from '../../core/quiz.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

export function Flashcard({ verse, onMistake, onDone, onRestart, mistakes }: ModeProps) {
  const [flipped, setFlipped] = useState(false);
  const canAlmost = mistakesAllowed(verse.pile) > 0;
  return (
    <>
      <div class="verse-area">
        {!flipped ? (
          <div class="flip-card stack" data-testid="card-front">
            <div>
              <div class="muted small">Recite this verse from memory</div>
              <div class="prompt-ref">{formatRef(verse)}</div>
              <div class="row wrap" style={{ justifyContent: 'center' }}>
                <span class="chip">{verse.translation}</span>
                {verse.topic && <span class="chip">#{verse.topic}</span>}
              </div>
            </div>
          </div>
        ) : (
          <div data-testid="card-back">
            <p class="verse-text">{verse.text}</p>
            <p class="center muted small" style={{ marginTop: '16px' }}>
              How did you do?
            </p>
          </div>
        )}
      </div>
      <Dock>
        {canAlmost && <MistakeDots verse={verse} mistakes={mistakes} />}
        {!flipped ? (
          <button class="btn primary block" onClick={() => setFlipped(true)} data-testid="flip">
            Flip to check
          </button>
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
