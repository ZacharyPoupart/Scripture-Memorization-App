import { useState } from 'preact/hooks';
import { BOOKS, searchBooks } from '../../core/books.ts';
import { formatRef } from '../../core/reference.ts';
import { checkReference } from '../../core/quiz.ts';
import { Overlay } from '../common.tsx';
import { useShake } from '../dom.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

/** After the verse itself: where is it found? Nothing on screen hints at the answer. */
export function RefRecall({ verse, onMistake, onDone, onRestart, mistakes }: ModeProps) {
  const [book, setBook] = useState<number | null>(null);
  const [chapter, setChapter] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [shakeCls, shake] = useShake();
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(false);

  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const ready = book !== null && chapter !== '' && start !== '';

  const check = () => {
    const res = checkReference({ book, chapter: num(chapter), start: num(start), end: num(end) }, verse);
    if (res.ok) {
      setMessage('');
      onDone();
      return;
    }
    shake();
    setMessage('Not quite — think about where this verse is found, and try again.');
    onMistake();
  };

  return (
    <>
      <div class="verse-area">
        <div class="muted small center">Where is this verse found?</div>
        <p class="verse-text" style={{ marginTop: '12px' }} data-testid="ref-verse-text">
          {verse.text}
        </p>
        {revealed && (
          <div class="banner info center" data-testid="ref-answer" style={{ marginTop: '12px' }}>
            It's <strong>{formatRef(verse)}</strong>. Let's go through it once more.
          </div>
        )}
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        {!revealed ? (
          <div class={`stack ${shakeCls}`} style={{ '--g': '10px' } as never}>
            <button class="input" style={{ textAlign: 'left', fontWeight: 600, color: book ? undefined : 'var(--muted)' }} onClick={() => setPicking(true)} data-testid="ref-book">
              {book ? BOOKS[book - 1].name : 'Book…'}
            </button>
            <div class="grid3">
              <input class="input" type="number" inputMode="numeric" placeholder="Chapter" aria-label="Chapter" value={chapter} onInput={(e) => setChapter(e.currentTarget.value)} data-testid="ref-chapter" />
              <input class="input" type="number" inputMode="numeric" placeholder="Verse" aria-label="Verse" value={start} onInput={(e) => setStart(e.currentTarget.value)} data-testid="ref-start" />
              <input class="input" type="number" inputMode="numeric" placeholder="to (if range)" aria-label="Last verse of a range" value={end} onInput={(e) => setEnd(e.currentTarget.value)} data-testid="ref-end" />
            </div>
            {message && (
              <div class="error-text" role="alert" data-testid="ref-message">
                {message}
              </div>
            )}
            <div class="row">
              <button class="btn" onClick={() => setRevealed(true)} data-testid="ref-giveup">
                I don't remember
              </button>
              <button class="btn primary grow" disabled={!ready} onClick={check} data-testid="ref-check">
                Check
              </button>
            </div>
          </div>
        ) : (
          <button class="btn primary block" onClick={onRestart} data-testid="ref-retry">
            Try this verse again
          </button>
        )}
      </Dock>

      {picking && (
        <Overlay onClose={() => setPicking(false)} label="Choose a book">
          <div class="sheet full" data-testid="book-picker">
            <div class="row" style={{ marginBottom: '10px' }}>
              <input class="input grow" autofocus placeholder="Search books…" value={query} onInput={(e) => setQuery(e.currentTarget.value)} data-testid="book-search" autocapitalize="off" autocomplete="off" />
              <button class="btn" onClick={() => setPicking(false)}>
                Cancel
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }} class="list">
              {searchBooks(query).map((b) => (
                <button
                  key={b.n}
                  class="btn block"
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => {
                    setBook(b.n);
                    setPicking(false);
                    setQuery('');
                  }}
                  data-testid={`book-option`}
                  data-book={b.n}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        </Overlay>
      )}
    </>
  );
}
