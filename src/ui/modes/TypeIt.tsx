import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { primeKeyboard } from '../keyboard.ts';
import { topicsOf } from '../../core/organize.ts';
import { formatRef } from '../../core/reference.ts';
import { advanceRef, difficultyFor, makeRng, makeTopicStep, referenceTokens, skipRef } from '../../core/quiz.ts';
import { matchesFirstLetter, tokenize } from '../../core/text.ts';
import { feedback } from '../../services/feedback.ts';
import { useApp } from '../../store.ts';
import { keepInView, useShake } from '../dom.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

export function TypeIt({ verse, onMistake, onDone, mistakes, after }: ModeProps) {
  const words = useMemo(() => tokenize(verse.text), [verse.id, verse.text]);
  const [pos, setPos] = useState(0);
  // After the words: the reference, typed as the first letter of the book and then chapter:verse(-verse).
  const refTokens = useMemo(() => (after.includes('citation') ? referenceTokens(verse) : []), [verse.id]); // none when the practice order does not ask for the citation here
  const [rpos, setRpos] = useState(0);
  const [missedRef, setMissedRef] = useState<number[]>([]);
  const rposRef = useRef(0);
  const [missed, setMissed] = useState<number[]>([]); // words shown after a wrong letter
  const [shakeCls, shake] = useShake();
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);
  // If the verse has a topic, it is asked last: type its first letters (or tap it) once the reference is done.
  const { data, settings } = useApp();
  const topicStep = useMemo(
    () => (verse.topic && after.includes('topic') ? makeTopicStep(verse.topic, topicsOf(data).filter((t) => t !== verse.topic), difficultyFor(verse.pile, settings.fillDifficulty), makeRng(Date.now() ^ (Math.random() * 1e9))) : null),
    [verse.id],
  );
  const [wrongTopics, setWrongTopics] = useState<string[]>([]);
  const typedTopic = useRef('');
  const [typedShown, setTypedShown] = useState('');

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement === input.current) primeKeyboard(); // the next verse's field takes over without the keyboard closing
    };
  }, []);
  useEffect(() => {
    keepInView(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
    if (pos >= words.length && rpos >= refTokens.length && !topicStep) {
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
      if (posRef.current >= words.length && rposRef.current >= refTokens.length && topicStep) {
        typeTopic(ch);
        continue;
      }
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

  const chooseTopic = (t: string) => {
    typedTopic.current = '';
    setTypedShown('');
    if (t.toLowerCase() === verse.topic.toLowerCase()) {
      feedback.correct();
      onDone();
      return;
    }
    setWrongTopics((w) => [...w, t]);
    shake();
    onMistake();
  };

  /** Typing the topic: the letters narrow the choices, and the choice is made as soon as only one is left. */
  const typeTopic = (ch: string) => {
    if (!topicStep) return;
    const next = (typedTopic.current + ch).replace(/^\s+/, '').toLowerCase();
    const left = topicStep.options.filter((o) => !wrongTopics.includes(o) && o.toLowerCase().startsWith(next));
    if (left.length === 0) {
      typedTopic.current = '';
      setTypedShown('');
      shake();
      onMistake();
      return;
    }
    const exact = left.find((o) => o.toLowerCase() === next);
    if (left.length === 1 || exact) {
      chooseTopic(exact ?? left[0]);
      return;
    }
    typedTopic.current = next;
    setTypedShown(next);
  };

  const reveal = () => {
    if (posRef.current >= words.length && rposRef.current >= refTokens.length && topicStep) {
      const right = topicStep.options.find((o) => o.toLowerCase() === verse.topic.toLowerCase());
      setWrongTopics((w) => [...w, ...topicStep.options.filter((o) => o !== right && !w.includes(o)).slice(0, 1)]);
      onMistake();
      return;
    }
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
  const wordsDone = pos >= words.length;
  const inRef = wordsDone && refTokens.length > 0;
  const inTopic = wordsDone && rpos >= refTokens.length && !!topicStep;
  // The keyboard types straight into a hidden field; tapping the text brings the keyboard back if it was dismissed.
  const focus = () => input.current?.focus({ preventScroll: true });

  return (
    <>
      <div class="verse-area" ref={area} onClick={focus}>
        <div class="muted small center">
          {inTopic ? "What is this verse's topic? Type its first letters, or tap it" : inRef ? 'Now the reference: the first letter of the book, then chapter:verse' : 'Type the first letter of each word'}
        </div>
        {!wordsDone && <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>}
        <p class="verse-text" data-testid="type-text">
          {words.map((w, i) => (
            <span key={i}>
              <span class={`w ${i >= pos ? 'hidden' : ''} ${i === pos ? 'cur' : ''} ${missed.includes(i) ? 'missed' : ''}`} data-testid={i < pos ? 'revealed' : undefined}>
                {w.raw}
              </span>{' '}
            </span>
          ))}
        </p>
        {inRef && (
          <div class="ref-line type-ref" data-testid="type-ref">
            {refTokens.map((t, i) => (
              <span key={i} class={`w ${i >= rpos ? 'hidden' : ''} ${i === rpos ? 'cur' : ''} ${missedRef.includes(i) ? 'missed' : ''}`} data-testid={i < rpos ? 'ref-revealed' : undefined} style={{ whiteSpace: 'pre' }}>
                {t.show}
              </span>
            ))}
          </div>
        )}
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        {inTopic && topicStep && (
          <div class={`options ${shakeCls}`} data-testid="topic-options">
            {topicStep.options.map((o) => (
              <button
                key={o}
                class="option"
                disabled={wrongTopics.includes(o) || (typedShown !== '' && !o.toLowerCase().startsWith(typedShown))}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => chooseTopic(o)}
                data-testid="topic-option"
              >
                {o}
              </button>
            ))}
          </div>
        )}
        <div class={`type-dock ${shakeCls}`}>
          <input
            ref={input}
            class="type-input"
            type="text"
            inputMode={inRef && !inTopic && refTokens[rpos]?.kind !== 'book' ? 'numeric' : 'text'}
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            enterKeyHint="done"
            aria-label={inTopic ? 'Type the first letters of the topic' : inRef ? 'Type the first letter of the book, then the chapter and verse' : 'Type the first letter of the next word'}
            onInput={onInput}
            data-testid="type-input"
          />
          <button class="btn block" onPointerDown={(e) => e.preventDefault()} onClick={reveal} data-testid="reveal">
            Reveal
          </button>
        </div>
        <div class="hint-text center" style={{ marginTop: '6px' }}>
          {inTopic
            ? `Typing ${typedShown ? `"${typedShown}"` : 'the first letters'} narrows the choices. Tap the text to bring the keyboard back.`
            : inRef
              ? 'Colon and dash are optional.'
              : `Word ${Math.min(pos + 1, words.length)} of ${words.length}.`}
        </div>
      </Dock>
    </>
  );
}
