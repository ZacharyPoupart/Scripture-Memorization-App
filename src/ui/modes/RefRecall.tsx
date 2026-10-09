import { useMemo, useState } from 'preact/hooks';
import { BOOKS, searchBooks } from '../../core/books.ts';
import { formatRef } from '../../core/reference.ts';
import { topicsOf } from '../../core/organize.ts';
import { checkReference, difficultyFor, makeRng, makeTopicStep } from '../../core/quiz.ts';
import { useApp } from '../../store.ts';
import { Overlay } from '../common.tsx';
import { useShake } from '../dom.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

/** After the verse itself: where is it found? Nothing on screen hints at the answer. */
export function RefRecall({ verse, onMistake, onDone, onRestart, mistakes, topicOnly }: ModeProps) {
  const [book, setBook] = useState<number | null>(null);
  const [chapter, setChapter] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [shakeCls, shake] = useShake();
  const [message, setMessage] = useState('');
  const [revealed, setRevealed] = useState(false);
  // If the verse has a topic, it is quizzed too (multiple choice) once the reference is right.
  const { data, settings } = useApp();
  const [stage, setStage] = useState<'ref' | 'topic'>(topicOnly ? 'topic' : 'ref');
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);
  const topicStep = useMemo(
    () => (verse.topic ? makeTopicStep(verse.topic, topicsOf(data).filter((t) => t !== verse.topic), difficultyFor(verse.pile, settings.fillDifficulty), makeRng(Date.now() ^ (Math.random() * 1e9))) : null),
    [verse.id],
  );
  const chooseTopic = (t: string) => {
    if (t.toLowerCase() === verse.topic.toLowerCase()) {
      feedback.correct();
      onDone();
      return;
    }
    setWrongTopics([...wrongTopics, t]);
    shake();
    onMistake();
  };

  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const ready = book !== null && chapter !== '' && start !== '';

  const check = () => {
    const res = checkReference({ book, chapter: num(chapter), start: num(start), end: num(end) }, verse);
    if (res.ok) {
      setMessage('');
      feedback.correct();
      if (topicStep) setStage('topic');
      else onDone();
      return;
    }
    shake();
    setMessage('Not quite — think about where this verse is found, and try again.');
    onMistake();
  };

  return (
    <>
      <div class="verse-area">
        <div class="muted small center">{stage === 'topic' ? "What is this verse's topic?" : 'Where is this verse found?'}</div>
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
        {stage === 'topic' && topicStep ? (
          <div class={`options ${shakeCls}`} data-testid="topic-options">
            {topicStep.options.map((o) => (
              <button key={o} class="option" disabled={wrongTopics.includes(o)} onClick={() => chooseTopic(o)} data-testid="topic-option">
                {o}
              </button>
            ))}
          </div>
        ) : !revealed ? (
          <div class={`stack ${shakeCls}`} style={{ '--g': '10px' } as never}>
            <button class="input" style={{ textAlign: 'left', fontWeight: 600, color: book ? undefined : 'var(--muted)' }} onClick={() => setPicking(true)} data-testid="ref-book">
              {book ? BOOKS[book - 1].name : 'Book…'}
            </button>
            <div class="grid3">
              <input class="input" type="number" inputMode="numeric" placeholder="Chapter" aria-label="Chapter" value={chapter} onInput={(e) => setChapter(e.currentTarget.value)} data-testid="ref-chapter" />
              <input class="input" type="number" inputMode="numeric" placeholder="Verse" aria-label="Verse" value={start} onInput={(e) => setStart(e.currentTarget.value)} data-testid="ref-start" />
              <input class="input" type="number" inputMode="numeric" placeholder="To" aria-label="Last verse of a range" value={end} onInput={(e) => setEnd(e.currentTarget.value)} data-testid="ref-end" />
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
