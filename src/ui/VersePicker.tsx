import { useEffect, useRef, useState } from 'preact/hooks';
import { BOOKS, versesInChapter } from '../core/books.ts';
import { Overlay } from './common.tsx';

export interface RefValue {
  book: number; // 0 = not chosen
  chapter: number; // 0 = not chosen
  start: number; // 0 = not chosen
  end: number; // 0 = single verse
}

type Step = 'book' | 'chapter' | 'verse';

/**
 * Three boxes — Book, Chapter, Verse — each opening a compact grid of big tap targets. Each pick opens the next
 * grid by itself. In the verse grid, tap a first verse and then (optionally) a last one: everything between is
 * highlighted and that is the range. No keyboard, no typing, no long list.
 */
export function VersePicker({ value, onChange }: { value: RefValue; onChange: (v: RefValue) => void }) {
  const [step, setStep] = useState<Step | null>(null);
  const book = value.book ? BOOKS[value.book - 1] : undefined;

  const pickBook = (n: number) => {
    if (n === value.book) return setStep(value.chapter ? null : 'chapter');
    onChange({ book: n, chapter: 0, start: 0, end: 0 });
    setStep('chapter');
  };
  const pickChapter = (c: number) => {
    if (c === value.chapter) return setStep(value.start ? null : 'verse');
    onChange({ ...value, chapter: c, start: 0, end: 0 });
    setStep('verse');
  };

  const verseText = value.start ? (value.end > value.start ? `${value.start}–${value.end}` : String(value.start)) : '';
  const box = (label: string, text: string, s: Step, disabled: boolean, testid: string) => (
    <button
      type="button"
      class={`pick-box ${text ? 'filled' : ''}`}
      disabled={disabled}
      aria-haspopup="dialog"
      aria-label={`${label}: ${text || 'not chosen'}`}
      onClick={() => setStep(s)}
      data-testid={testid}
    >
      <span class="pick-label">{label}</span>
      <span class="pick-value">{text || 'Choose'}</span>
    </button>
  );

  return (
    <div class="stack" data-testid="verse-picker">
      {box('Book', book?.name ?? '', 'book', false, 'pick-book')}
      <div class="grid2">
        {box('Chapter', value.chapter ? String(value.chapter) : '', 'chapter', !value.book, 'pick-chapter')}
        {box('Verse', verseText, 'verse', !value.chapter, 'pick-verse')}
      </div>
      {step === 'book' && <BookPanel current={value.book} onPick={pickBook} onClose={() => setStep(null)} />}
      {step === 'chapter' && book && (
        <Shell title={`${book.name} — chapter`} onBack={() => setStep('book')} onClose={() => setStep(null)} testid="chapter-grid">
          <NumberGrid from={1} to={book.chapters} selected={(n) => n === value.chapter} onPick={pickChapter} cols={5} />
        </Shell>
      )}
      {step === 'verse' && book && (
        <VersePanel
          title={`${book.name} ${value.chapter} — verse`}
          label={`${book.name} ${value.chapter}`}
          max={versesInChapter(value.book, value.chapter) ?? 30}
          start={value.start}
          end={value.end}
          onChange={(start, end) => onChange({ ...value, start, end })}
          onBack={() => setStep('chapter')}
          onClose={() => setStep(null)}
        />
      )}
    </div>
  );
}

function Shell({ title, onBack, onClose, children, testid, footer }: { title: string; onBack?: () => void; onClose: () => void; children: preact.ComponentChildren; testid: string; footer?: preact.ComponentChildren }) {
  return (
    <Overlay onClose={onClose} label={title}>
      <div class="sheet pick-sheet" data-testid={testid}>
        <div class="row pick-head">
          {onBack ? (
            <button class="btn small ghost" onClick={onBack} aria-label="Back">
              ‹ Back
            </button>
          ) : (
            <span style={{ width: '64px' }} />
          )}
          <h2 class="grow center">{title}</h2>
          <button class="btn small ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
        {footer}
      </div>
    </Overlay>
  );
}

function useScrollToSelected(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (el && ref.current) ref.current.scrollTop = Math.max(0, el.offsetTop - ref.current.clientHeight / 2 + el.clientHeight / 2);
  }, [dep]);
  return ref;
}

function BookPanel({ current, onPick, onClose }: { current: number; onPick: (n: number) => void; onClose: () => void }) {
  const ref = useScrollToSelected('books');
  return (
    <Shell title="Choose a book" onClose={onClose} testid="book-grid">
      <div class="pick-scroll" ref={ref}>
        <div class="pick-grid books" role="group" aria-label="Books">
          {BOOKS.map((b) => (
            <button key={b.n} class="pick-btn" aria-pressed={b.n === current} onClick={() => onPick(b.n)} data-testid="book-option" data-book={b.n}>
              {b.name}
            </button>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function NumberGrid({ from, to, selected, between, onPick, cols }: { from: number; to: number; selected: (n: number) => boolean; between?: (n: number) => boolean; onPick: (n: number) => void; cols: number }) {
  const ref = useScrollToSelected(from + ':' + to);
  const nums = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
  return (
    <div class="pick-scroll" ref={ref}>
      <div class="pick-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="group" aria-label="Numbers">
        {nums.map((n) => (
          <button key={n} class={`pick-btn num ${between?.(n) ? 'between' : ''}`} aria-pressed={selected(n)} onClick={() => onPick(n)} data-testid="num-option" data-n={n}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tap a first verse, optionally a last one; the verses between are highlighted. */
function VersePanel({ title, label, max, start, end, onChange, onBack, onClose }: { title: string; label: string; max: number; start: number; end: number; onChange: (start: number, end: number) => void; onBack: () => void; onClose: () => void }) {
  // Some translations number a few more verses than the common list (e.g. 3 John 15): "＋" reveals 5 more.
  const [shown, setShown] = useState(Math.max(max, end, start));
  // Every time the grid opens, the first tap starts a NEW selection (so changing 16 to 20 is never an accidental
  // range 16-20). The current choice stays highlighted until you tap.
  const [second, setSecond] = useState(false);
  const tap = (n: number) => {
    if (!second) {
      setSecond(true);
      return onChange(n, 0);
    }
    if (n === start) return onClose(); // tapped the same verse again: just this one
    if (n > start) {
      onChange(start, n); // the second tap completes the range...
      return onClose(); // ...and we're done
    }
    onChange(n, 0); // tapped before the first: that becomes the new first verse
  };
  const range = end > start;
  return (
    <Shell
      title={title}
      onBack={onBack}
      onClose={onClose}
      testid="verse-grid"
      footer={
        <div class="pick-bar" data-testid="pick-bar">
          <div class="grow">
            <div class="pick-bar-ref">{start ? `${label}:${range ? `${start}–${end}` : start}` : label}</div>
            <div class="muted small">{second && start ? 'Tap a second verse for a range' : 'Tap a verse'}</div>
          </div>
          {shown < 176 && (
            <button class="btn ghost more-btn" onClick={() => setShown(Math.min(176, shown + 5))} aria-label="Show 5 more verse numbers" data-testid="more-verses">
              ＋
            </button>
          )}
          <button class="btn primary" disabled={!start} onClick={onClose} data-testid="pick-done">
            Done
          </button>
        </div>
      }
    >
      <NumberGrid
        from={1}
        to={shown}
        cols={6}
        selected={(n) => n === start || (range && n === end)}
        between={(n) => range && n > start && n < end}
        onPick={tap}
      />
    </Shell>
  );
}
