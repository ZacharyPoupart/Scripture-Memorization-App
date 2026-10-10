import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { alignSpeech, tokenizeSpeech } from '../../core/speech.ts';
import { tokenize } from '../../core/text.ts';
import { navigate } from '../../router.ts';
import { updateSettings, useApp } from '../../store.ts';
import { keepInView } from '../dom.ts';
import { Seg } from '../common.tsx';
import { Dock, MistakeDots, type ModeProps } from './shared.tsx';

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

export function speechSupported(): boolean {
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function Speak({ verse, onMistake, onDone, onRestart, mistakes }: ModeProps) {
  const { settings } = useApp();
  const showWords = settings.speakWords;
  const words = useMemo(() => tokenize(verse.text), [verse.id, verse.text]);
  const expected = useMemo(() => words.map((w) => w.key), [words]);
  const [listening, setListening] = useState(false);
  const [finished, setFinished] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const wantListening = useRef(false);
  const finals = useRef('');
  const area = useRef<HTMLDivElement>(null);

  const align = alignSpeech(expected, tokenizeSpeech(transcript), finished);

  useEffect(() => {
    keepInView(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
  }, [align.progress, finished]);
  useEffect(() => () => {
    wantListening.current = false;
    rec.current?.abort();
  }, []);

  if (!speechSupported()) {
    return (
      <>
        <div class="verse-area">
          <div class="banner info" data-testid="speak-unsupported">
            <strong>Speaking isn't available here.</strong> This browser doesn't offer speech recognition (it's experimental, and works best in Safari or Chrome with the microphone allowed).
          </div>
        </div>
        <Dock>
          <button class="btn primary block" onClick={() => navigate(location.hash.replace(/^#/, '').replace('mode=speak', 'mode=type'), true)}>
            Use “Type it out” instead
          </button>
        </Dock>
      </>
    );
  }

  const start = () => {
    setError(null);
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    const r: RecognitionLike = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    finals.current = '';
    setTranscript('');
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current += ' ' + res[0].transcript;
        else interim += ' ' + res[0].transcript;
      }
      setTranscript((finals.current + ' ' + interim).trim());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        wantListening.current = false;
        setListening(false);
        setError('Microphone access was blocked. Allow it in your browser settings, or use another mode.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition problem: ${e.error}`);
    };
    r.onend = () => {
      if (wantListening.current) {
        try {
          r.start(); // some browsers stop after a pause; keep listening until "Done"
        } catch {
          /* already started */
        }
      } else setListening(false);
    };
    rec.current = r;
    wantListening.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone.');
    }
  };

  const stop = () => {
    wantListening.current = false;
    rec.current?.stop();
    setListening(false);
    setFinished(true);
  };

  const proceed = () => {
    // Mistakes are charged now, after the word-by-word feedback has been seen.
    if (align.mistakes > 0 && onMistake(align.mistakes)) return; // too many: restarts
    onDone();
  };

  return (
    <>
      <div class="verse-area" ref={area}>
        <div class="muted small center">{showWords ? 'Say the verse aloud' : 'Say the verse from memory'}</div>
        <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>
        {!listening && !finished && (
          <div style={{ maxWidth: '320px', margin: '8px auto' }}>
            <Seg<'show' | 'hide'>
              label="Show the words?"
              value={showWords ? 'show' : 'hide'}
              options={[
                { value: 'show', label: 'Read along' },
                { value: 'hide', label: 'From memory' },
              ]}
              onChange={(v) => updateSettings({ speakWords: v === 'show' })}
            />
          </div>
        )}
        {(showWords || finished) && (
          <p class="verse-text" data-testid="speak-text">
            {words.map((w, i) => {
              const r = align.results[i];
              const cur = listening && !finished && i === align.progress;
              return (
                <span key={i}>
                  <span class={`w ${r === 'pending' || r === undefined ? 'pending' : r} ${cur ? 'cur' : ''}`}>{w.raw}</span>{' '}
                </span>
              );
            })}
          </p>
        )}
        {!showWords && !finished && (
          <div class="muted center" style={{ margin: '14px 0' }} data-testid="speak-hidden">
            {listening ? 'Listening… the words will appear when you finish.' : 'The words stay hidden until you finish.'}
          </div>
        )}
        {finished && (
          <div class={`banner ${align.mistakes === 0 ? 'good' : 'info'}`} data-testid="speak-result">
            {align.mistakes === 0 ? 'Perfect — every word!' : `${align.mistakes} word${align.mistakes === 1 ? '' : 's'} missed or different.`}
          </div>
        )}
        {error && <div class="banner bad" role="alert">{error}</div>}
        <div class="hint-text center" style={{ marginTop: '10px' }}>Experimental — recognition may mishear words.</div>
      </div>
      <Dock>
        <MistakeDots verse={verse} mistakes={mistakes} />
        {!finished ? (
          !listening ? (
            <button class="btn primary block" onClick={start} data-testid="speak-start">
              Start speaking
            </button>
          ) : (
            <button class="btn good block" onClick={stop} data-testid="speak-done">
              I'm done
            </button>
          )
        ) : (
          <div class="row">
            <button class="btn grow" onClick={onRestart}>
              Try again
            </button>
            <button class="btn primary grow" onClick={proceed} data-testid="speak-continue">
              Continue
            </button>
          </div>
        )}
      </Dock>
    </>
  );
}
