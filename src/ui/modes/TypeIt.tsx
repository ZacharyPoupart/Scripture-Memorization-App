import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { matchesFirstLetter, tokenize } from '../../core/text.ts';
import { centerIn, useShake } from '../dom.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

export function TypeIt({ verse, onMistake, onDone, mistakes }: ModeProps) {
  const words = useMemo(() => tokenize(verse.text), [verse.id, verse.text]);
  const [pos, setPos] = useState(0);
  const [shakeCls, shake] = useShake();
  const input = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    centerIn(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
    if (pos >= words.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
  }, [pos]);

  const advance = () => {
    posRef.current += 1;
    setPos(posRef.current);
  };

  const onInput = (e: Event) => {
    const el = e.currentTarget as HTMLInputElement;
    const typed = el.value;
    el.value = '';
    for (const ch of typed) {
      if (/\s/.test(ch) || posRef.current >= words.length) continue;
      if (matchesFirstLetter(words[posRef.current], ch)) advance();
      else {
        shake();
        if (onMistake()) return;
      }
    }
  };

  const reveal = () => {
    if (posRef.current >= words.length) return;
    advance();
    onMistake();
  };

  return (
    <>
      <div class="verse-area" ref={area} onClick={() => input.current?.focus({ preventScroll: true })}>
        <div class="muted small center">Type the first letter of each word</div>
        <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>
        <p class="verse-text" data-testid="type-text">
          {words.map((w, i) => (
            <span key={i}>
              <span class={`w ${i >= pos ? 'hidden' : ''} ${i === pos ? 'cur' : ''}`} data-testid={i < pos ? 'revealed' : undefined}>
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
            inputMode="text"
            autocapitalize="off"
            autocomplete="off"
            autocorrect="off"
            spellcheck={false}
            enterKeyHint="done"
            placeholder="Type the next letter…"
            aria-label="Type the first letter of the next word"
            onInput={onInput}
            data-testid="type-input"
          />
          <button class="btn" onPointerDown={(e) => e.preventDefault()} onClick={reveal} data-testid="reveal">
            Reveal
          </button>
        </div>
        <div class="hint-text center" style={{ marginTop: '6px' }}>
          Reveal shows the word but counts as a mistake. Word {Math.min(pos + 1, words.length)} of {words.length}.
        </div>
      </Dock>
    </>
  );
}
