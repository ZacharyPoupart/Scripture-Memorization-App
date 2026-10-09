import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { advanceRef, referenceTokens, skipRef } from '../../core/quiz.ts';
import { matchesFirstLetter, tokenize } from '../../core/text.ts';
import { keepInView, useShake } from '../dom.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

export function TypeIt({ verse, onMistake, onDone, mistakes }: ModeProps) {
  const words = useMemo(() => tokenize(verse.text), [verse.id, verse.text]);
  const [pos, setPos] = useState(0);
  // After the words: the reference, typed as the first letter of the book and then chapter:verse(-verse).
  const refTokens = useMemo(() => referenceTokens(verse), [verse.id]);
  const [rpos, setRpos] = useState(0);
  const [missedRef, setMissedRef] = useState<number[]>([]);
  const rposRef = useRef(0);
  const [missed, setMissed] = useState<number[]>([]); // words shown after a wrong letter
  const [shakeCls, shake] = useShake();
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    keepInView(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
    if (pos >= words.length && rpos >= refTokens.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [pos, rpos]);

  const advance = () => {
    posRef.current += 1;
    setPos(posRef.current);
  };

  const moveRef = (to: number) => {
    rposRef.current = to;
    setRpos(to);
  };

  const onInput = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    const typed = el.value;
    el.value = '';
    for (const ch of typed) {
      if (/\s/.test(ch)) continue;
      if (posRef.current >= words.length) {
        // the reference
        if (rposRef.current >= refTokens.length) continue;
        const r = advanceRef(refTokens, rposRef.current, ch);
        if (r.ok) moveRef(r.pos);
        else {
          shake();
          if (onMistake()) return;
          const to = skipRef(refTokens, rposRef.current);
          setMissedRef((m) => [...m, ...Array.from({ length: to - rposRef.current }, (_, i) => rposRef.current + i)]);
          moveRef(to);
        }
        continue;
      }
      if (matchesFirstLetter(words[posRef.current], ch)) advance();
      else {
        // A wrong letter counts as a mistake, shows the word you missed, and lets you carry on.
        shake();
        if (onMistake()) return;
        setMissed((m) => [...m, posRef.current]);
        advance();
      }
    }
  };

  const reveal = () => {
    if (posRef.current >= words.length) {
      if (rposRef.current >= refTokens.length) return;
      const to = skipRef(refTokens, rposRef.current);
      setMissedRef((m) => [...m, ...Array.from({ length: to - rposRef.current }, (_, i) => rposRef.current + i)]);
      moveRef(to);
      onMistake();
      return;
    }
    setMissed((m) => [...m, posRef.current]);
    advance();
    onMistake();
  };
  const inRef = pos >= words.length;

  return (
    <>
      <div class="verse-area" ref={area} onClick={() => input.current?.focus({ preventScroll: true })}>
        <div class="muted small center">{inRef ? 'Now the reference: the first letter of the book, then chapter:verse' : 'Type the first letter of each word'}</div>
        {inRef ? (
          <div class="ref-line type-ref" data-testid="type-ref">
            {refTokens.map((t, i) => (
              <span key={i} class={`w ${i >= rpos ? 'hidden' : ''} ${i === rpos ? 'cur' : ''} ${missedRef.includes(i) ? 'missed' : ''}`} data-testid={i < rpos ? 'ref-revealed' : undefined} style={{ whiteSpace: 'pre' }}>
                {t.show}
              </span>
            ))}
          </div>
        ) : (
          <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>
        )}
        <p class="verse-text" data-testid="type-text">
          {words.map((w, i) => (
            <span key={i}>
              <span class={`w ${i >= pos ? 'hidden' : ''} ${i === pos ? 'cur' : ''} ${missed.includes(i) ? 'missed' : ''}`} data-testid={i < pos ? 'revealed' : undefined}>
                {w.raw}
              </span>{' '}
            </span>
          ))}
        </p>
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        <div class="row">
          <input
            ref={input}
            class={`type-input grow ${shakeCls}`}
            type="text"
            inputMode={inRef && refTokens[rpos]?.kind !== 'book' ? 'numeric' : 'text'}
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            enterKeyHint="done"
            placeholder={inRef ? 'Book letter, then 3:16…' : 'Type the next letter…'}
            aria-label={inRef ? 'Type the first letter of the book, then the chapter and verse' : 'Type the first letter of the next word'}
            onInput={onInput}
            data-testid="type-input"
          />
          <button class="btn" onPointerDown={(e) => e.preventDefault()} onClick={reveal} data-testid="reveal">
            Reveal
          </button>
        </div>
        <div class="hint-text center" style={{ marginTop: '6px' }}>
          {inRef
            ? 'Colon and dash are optional. A wrong character shows it (counts as a slip) and you carry on.'
            : `A wrong letter shows the word (counts as a slip) and you carry on. Word ${Math.min(pos + 1, words.length)} of ${words.length}.`}
        </div>
      </Dock>
    </>
  );
}
