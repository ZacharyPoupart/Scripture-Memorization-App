import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { difficultyFor, isCorrectChoice, makeBlanks, makeRng } from '../../core/quiz.ts';
import { useApp } from '../../store.ts';
import { centerIn, useShake } from '../dom.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

export function Blanks({ verse, onMistake, onDone, mistakes }: ModeProps) {
  const { settings } = useApp();
  const level = difficultyFor(verse.pile, settings.fillDifficulty);
  const { words, blanks } = useMemo(() => makeBlanks(verse.text, level, makeRng(Date.now() ^ (Math.random() * 1e9))), [verse.id, verse.text, level]);
  const [filled, setFilled] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [shakeCls, shake] = useShake();
  const area = useRef<HTMLDivElement>(null);
  const current = blanks[filled];
  const blankAt = new Map(blanks.map((b, i) => [b.index, i]));

  useEffect(() => {
    centerIn(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
    if (filled >= blanks.length) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
  }, [filled]);

  const choose = (opt: string) => {
    if (!current) return;
    if (isCorrectChoice(current, opt)) {
      feedback.correct();
      setWrong([]);
      setFilled(filled + 1);
    } else {
      setWrong([...wrong, opt]);
      shake();
      onMistake();
    }
  };

  return (
    <>
      <div class="verse-area" ref={area}>
        <div class="muted small center">Choose the missing words</div>
        <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>
        <p class="verse-text" data-testid="blank-text">
          {words.map((w, i) => {
            const bi = blankAt.get(i);
            const sep = i < words.length - 1 ? ' ' : '';
            if (bi === undefined) return <span key={i}>{w.raw}{sep}</span>;
            const b = blanks[bi];
            // keep any punctuation that was attached to the word
            const lead = w.raw.slice(0, w.raw.indexOf(b.answer));
            const trail = w.raw.slice(w.raw.indexOf(b.answer) + b.answer.length);
            if (bi < filled)
              return (
                <span key={i}>
                  {lead}
                  <span class="blank filled">{b.answer}</span>
                  {trail}
                  {sep}
                </span>
              );
            return (
              <span key={i}>
                {lead}
                <span class={`blank ${bi === filled ? 'cur' : ''}`} style={{ minWidth: `${Math.max(2.4, b.answer.length * 0.62)}em` }} data-testid={bi === filled ? 'current-blank' : 'blank'} aria-label="blank" />
                {trail}
                {sep}
              </span>
            );
          })}
        </p>
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        <div class={`options ${shakeCls}`} data-testid="options">
          {current ? (
            current.options.map((o) => (
              <button key={o} class="option" disabled={wrong.includes(o)} onClick={() => choose(o)} data-testid="option">
                {o}
              </button>
            ))
          ) : (
            <div class="center muted" style={{ gridColumn: '1 / -1', paddingTop: '30px' }}>
              Complete!
            </div>
          )}
        </div>
      </Dock>
    </>
  );
}
