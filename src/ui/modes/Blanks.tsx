import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { topicsOf } from '../../core/organize.ts';
import { difficultyFor, isCorrectChoice, makeBlanks, makeReferenceSteps, makeRng, makeTopicStep, type ChoiceStep } from '../../core/quiz.ts';
import { useApp } from '../../store.ts';
import { keepInView, useShake } from '../dom.ts';
import { feedback } from '../../services/feedback.ts';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

/**
 * A blank always contains its real word, invisibly: it takes exactly the width the word will have, so choosing
 * an answer never reflows the sentence.
 */
function Blank({ answer, state, testid }: { answer: string; state: 'hidden' | 'cur' | 'filled'; testid?: string }) {
  return (
    <span class={`blank ${state === 'cur' ? 'cur' : ''} ${state === 'filled' ? 'filled' : ''}`} data-testid={testid}>
      <span aria-hidden={state !== 'filled' ? 'true' : undefined}>{answer}</span>
      {state !== 'filled' && <span class="sr-only">blank</span>}
    </span>
  );
}

export function Blanks({ verse, onMistake, onDone, mistakes }: ModeProps) {
  const { data, settings } = useApp();
  const level = difficultyFor(verse.pile, settings.fillDifficulty);
  const { words, blanks } = useMemo(() => makeBlanks(verse.text, level, makeRng(Date.now() ^ (Math.random() * 1e9))), [verse.id, verse.text, level]);
  // After the words: where is it found (book, chapter, verse) and, if it has one, what is its topic?
  const steps: ChoiceStep[] = useMemo(() => {
    const rng = makeRng(Date.now() ^ (Math.random() * 1e9));
    const s = makeReferenceSteps(verse, level, rng);
    if (verse.topic) s.push(makeTopicStep(verse.topic, topicsOf(data).filter((t) => t !== verse.topic), level, rng));
    return s;
  }, [verse.id, level]);

  const [filled, setFilled] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [shakeCls, shake] = useShake();
  const area = useRef<HTMLDivElement>(null);
  const blankAt = new Map(blanks.map((b, i) => [b.index, i]));
  const inWords = filled < blanks.length;
  const current = inWords ? blanks[filled] : undefined;
  const step = !inWords ? steps[stepIdx] : undefined;
  const allDone = !inWords && stepIdx >= steps.length;

  useEffect(() => {
    keepInView(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
    if (allDone) {
      const t = setTimeout(onDone, 450);
      return () => clearTimeout(t);
    }
  }, [filled, stepIdx]);

  const choose = (opt: string) => {
    const ok = current ? isCorrectChoice(current, opt) : step ? opt.toLowerCase() === step.answer.toLowerCase() : false;
    if (ok) {
      feedback.correct();
      setWrong([]);
      if (current) setFilled(filled + 1);
      else setStepIdx(stepIdx + 1);
    } else {
      setWrong([...wrong, opt]);
      shake();
      onMistake();
    }
  };

  const stateOf = (kind: ChoiceStep['kind']): 'hidden' | 'cur' | 'filled' => {
    const i = steps.findIndex((s) => s.kind === kind);
    if (i < 0 || i < stepIdx) return 'filled';
    return i === stepIdx && !inWords ? 'cur' : 'hidden';
  };
  const stepAnswer = (kind: ChoiceStep['kind']) => steps.find((s) => s.kind === kind)?.answer;
  const bookName = stepAnswer('book')!;
  const chapterText = stepAnswer('chapter') ?? String(verse.chapter); // one-chapter books have no chapter question
  const verseText = stepAnswer('verse')!;
  const topicStep = steps.find((s) => s.kind === 'topic');

  const options = current ? current.options : step ? step.options : [];
  return (
    <>
      <div class="verse-area" ref={area}>
        <div class="muted small center">{inWords ? 'Choose the missing words' : 'Now, where is it found?'}</div>
        {inWords ? (
          <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>
            {formatRef(verse)}
          </div>
        ) : (
          <div class="ref-line" data-testid="ref-blanks">
            <Blank answer={bookName} state={stateOf('book')} testid={stateOf('book') === 'cur' ? 'current-ref-blank' : undefined} />{' '}
            {stepAnswer('chapter') ? <Blank answer={chapterText} state={stateOf('chapter')} testid={stateOf('chapter') === 'cur' ? 'current-ref-blank' : undefined} /> : chapterText}:
            <Blank answer={verseText} state={stateOf('verse')} testid={stateOf('verse') === 'cur' ? 'current-ref-blank' : undefined} />
          </div>
        )}
        {!inWords && topicStep && (
          <div class="topic-line" data-testid="topic-blank-line">
            <span class="muted small">Topic </span>
            <Blank answer={topicStep.answer} state={stateOf('topic')} testid={stateOf('topic') === 'cur' ? 'current-ref-blank' : undefined} />
          </div>
        )}
        <p class="verse-text" data-testid="blank-text">
          {words.map((w, i) => {
            const bi = blankAt.get(i);
            const sep = i < words.length - 1 ? ' ' : '';
            if (bi === undefined) return <span key={i}>{w.raw}{sep}</span>;
            const b = blanks[bi];
            // keep any punctuation that was attached to the word
            const at = w.raw.indexOf(b.answer);
            const lead = w.raw.slice(0, at);
            const trail = w.raw.slice(at + b.answer.length);
            const state = bi < filled ? 'filled' : bi === filled && inWords ? 'cur' : 'hidden';
            return (
              <span key={i}>
                {lead}
                <Blank answer={b.answer} state={state} testid={state === 'cur' && inWords ? 'current-blank' : state === 'hidden' ? 'blank' : undefined} />
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
          {options.map((o) => (
            <button key={o} class="option" disabled={wrong.includes(o)} onClick={() => choose(o)} data-testid="option">
              {o}
            </button>
          ))}
          {allDone && (
            <div class="center muted" style={{ gridColumn: '1 / -1', paddingTop: '30px' }}>
              Complete!
            </div>
          )}
        </div>
      </Dock>
    </>
  );
}
