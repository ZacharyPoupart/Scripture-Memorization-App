import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { BOOKS, searchBooks } from '../../core/books.ts';
import { formatRef } from '../../core/reference.ts';
import { topicsOf } from '../../core/organize.ts';
import { firstWords, type CueKind, type PracticePart } from '../../core/practice.ts';
import { checkReference, difficultyFor, makeRng, makeTopicStep } from '../../core/quiz.ts';
import { useApp } from '../../store.ts';
import { Overlay } from '../common.tsx';
import { useShake } from '../dom.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

/**
 * The shared questions around the verse: where is it found (the citation) and what is its topic, in the order given by `parts`.
 * After the verse (Speak it) the verse is shown above. Before the verse (`cue`) what is shown is only a cue to which verse is meant
 * (the citation when the topic is asked, the topic when the citation is asked, else the first words): it hides as soon as the first
 * entry is made and the space stays, so nothing jumps. The topic can be typed (the letters narrow the choices) or tapped. Nothing on
 * screen hints at the answer. Wrong answers count as mistakes like everywhere else.
 */
export function RefRecall({ verse, onMistake, onDone, onRestart, mistakes, parts, cue }: ModeProps & { parts: PracticePart[]; cue?: CueKind | null }) {
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
  const [idx, setIdx] = useState(0);
  const [entered, setEntered] = useState(false); // the first entry hides the cue
  const stage = parts[idx] === 'topic' ? 'topic' : 'ref';
  const next = () => (idx + 1 >= parts.length ? onDone() : setIdx(idx + 1));
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);
  const topicStep = useMemo(
    () => (verse.topic ? makeTopicStep(verse.topic, topicsOf(data).filter((t) => t !== verse.topic), difficultyFor(verse.pile, settings.fillDifficulty), makeRng(Date.now() ^ (Math.random() * 1e9))) : null),
    [verse.id],
  );
  const [typed, setTyped] = useState('');
  const topicInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (stage === 'topic') topicInput.current?.focus({ preventScroll: true });
  }, [stage]);
  /** Typing the topic: the letters narrow the choices, and the choice is made as soon as only one is left. */
  const typeTopic = (value: string) => {
    setEntered(true);
    if (!topicStep) return;
    const nextText = value.replace(/^\s+/, '').toLowerCase();
    if (nextText === '') {
      setTyped('');
      return;
    }
    const left = topicStep.options.filter((o) => !wrongTopics.includes(o) && o.toLowerCase().startsWith(nextText));
    if (left.length === 0) {
      setTyped('');
      shake();
      onMistake();
      return;
    }
    const exact = left.find((o) => o.toLowerCase() === nextText);
    if (left.length === 1 || exact) {
      chooseTopic(exact ?? left[0]);
      return;
    }
    setTyped(nextText);
  };
  const chooseTopic = (t: string) => {
    setEntered(true);
    setTyped('');
    if (t.toLowerCase() === verse.topic.toLowerCase()) {
      feedback.correct();
      next();
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
      next();
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
        {cue ? (
          <div
            class={cue === 'words' ? 'verse-text' : 'prompt-ref'}
            style={{ marginTop: '12px', visibility: entered ? 'hidden' : 'visible', ...(cue === 'words' ? {} : { fontSize: '1.5rem' }) }}
            aria-hidden={entered ? 'true' : undefined}
            data-testid="quiz-cue"
          >
            {cue === 'citation' ? formatRef(verse) : cue === 'topic' ? verse.topic : firstWords(verse.text)}
          </div>
        ) : (
          <p class="verse-text" style={{ marginTop: '12px' }} data-testid="ref-verse-text">
            {verse.text}
          </p>
        )}
        {revealed && (
          <div class="banner info center" data-testid="ref-answer" style={{ marginTop: '12px' }}>
            It's <strong>{formatRef(verse)}</strong>. Let's go through it once more.
          </div>
        )}
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        {stage === 'topic' && topicStep ? (
          <div class={`stack ${shakeCls}`} style={{ '--g': '10px' } as never}>
            <input
              ref={topicInput}
              class="input"
              type="text"
              value={typed}
              placeholder="Type the topic, or tap it"
              aria-label="Type the first letters of the topic"
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              spellcheck={false}
              onInput={(e) => typeTopic(e.currentTarget.value)}
              data-testid="topic-input"
            />
            <div class="options" data-testid="topic-options">
              {topicStep.options.map((o) => (
                <button
                  key={o}
                  class="option"
                  disabled={wrongTopics.includes(o) || (typed !== '' && !o.toLowerCase().startsWith(typed))}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => chooseTopic(o)}
                  data-testid="topic-option"
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        ) : !revealed ? (
          <div class={`stack ${shakeCls}`} style={{ '--g': '10px' } as never}>
            <button class="input" style={{ textAlign: 'left', fontWeight: 600, color: book ? undefined : 'var(--muted)' }} onClick={() => (setEntered(true), setPicking(true))} data-testid="ref-book">
              {book ? BOOKS[book - 1].name : 'Book…'}
            </button>
            <div class="grid3">
              <input class="input" type="number" inputMode="numeric" placeholder="Chapter" aria-label="Chapter" value={chapter} onInput={(e) => (setEntered(true), setChapter(e.currentTarget.value))} data-testid="ref-chapter" />
              <input class="input" type="number" inputMode="numeric" placeholder="Verse" aria-label="Verse" value={start} onInput={(e) => (setEntered(true), setStart(e.currentTarget.value))} data-testid="ref-start" />
              <input class="input" type="number" inputMode="numeric" placeholder="To" aria-label="Last verse of a range" value={end} onInput={(e) => (setEntered(true), setEnd(e.currentTarget.value))} data-testid="ref-end" />
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
