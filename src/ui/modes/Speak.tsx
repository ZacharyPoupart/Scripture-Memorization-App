import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatRef } from '../../core/reference.ts';
import { alignSpeech, speechAccuracy, speechPassed, SPEECH_PASS, tokenizeSpeech } from '../../core/speech.ts';
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
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  addEventListener?(type: string, fn: () => void): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

/**
 * A phone allows one listener at a time and lets go of the last one a moment late. So each start makes a fresh recogniser (a finished
 * one is not reliable to reuse on iPhone), after letting go of the previous one, and a start that is refused is tried again a few
 * times. Nothing is ever aborted by the retry itself.
 */
let lastOne: RecognitionLike | null = null; // the one that may still be listening or closing
let closing: Promise<void> = Promise.resolve(); // resolves when everything let go of has really ended (or after a short wait)

/** Watch for a recogniser's real end, so the next one is only started once the phone has let go of the microphone. */
function track(r: RecognitionLike) {
  r.addEventListener?.('end', () => ((r as any).__ended = true));
}

function letGo(r: RecognitionLike | null) {
  if (!r) return;
  r.onstart = r.onaudiostart = r.onresult = r.onerror = r.onend = null; // nothing it says from now on may reach a screen
  if (!(r as any).__ended) {
    const gone = new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1500);
      r.addEventListener?.('end', () => {
        clearTimeout(t);
        resolve();
      });
    });
    closing = Promise.all([closing, gone]).then(() => undefined);
  }
  try {
    r.abort();
  } catch {
    /* nothing running */
  }
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
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heardSomething = useRef(false);
  const area = useRef<HTMLDivElement>(null);

  const align = alignSpeech(expected, tokenizeSpeech(transcript), finished);

  useEffect(() => {
    keepInView(area.current, area.current?.querySelector('.cur') as HTMLElement | null);
  }, [align.progress, finished]);
  useEffect(() => () => {
    wantListening.current = false;
    clearTimeout(watchdog.current);
    letGo(rec.current);
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
    finals.current = '';
    heardSomething.current = false;
    setTranscript('');
    wantListening.current = true;
    setListening(true);
    const fail = (message: string) => {
      wantListening.current = false;
      clearTimeout(watchdog.current);
      letGo(rec.current);
      setListening(false);
      setError(message);
    };
    const open = (tries: number, silentTries = 2) => {
      if (!wantListening.current) return;
      const w = window as any;
      const r: RecognitionLike = new (w.SpeechRecognition || w.webkitSpeechRecognition)();
      track(r);
      let alive = false; // the phone has really started listening (or we heard something)
      let silent: ReturnType<typeof setTimeout> | undefined;
      r.continuous = true;
      r.interimResults = true;
      r.lang = 'en-US';
      r.onstart = () => clearTimeout(watchdog.current);
      r.onaudiostart = () => {
        alive = true;
        clearTimeout(silent);
      };
      r.onresult = (e) => {
        alive = true;
        clearTimeout(silent);
        heardSomething.current = true;
        clearTimeout(watchdog.current);
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finals.current += ' ' + res[0].transcript;
          else interim += ' ' + res[0].transcript;
        }
        setTranscript((finals.current + ' ' + interim).trim());
      };
      r.onerror = (e) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fail('Microphone access was blocked. Allow it in your browser settings, or use another mode.');
        else if (e.error === 'audio-capture') fail('The microphone is not available right now. Close anything else using it and try again.');
        else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Speech recognition problem: ${e.error}`);
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
      lastOne = r;
      try {
        r.start();
      } catch {
        // the last one is probably still closing: try again with a fresh one in a moment
        letGo(r);
        lastOne = null;
        if (tries <= 0) return fail('Could not start the microphone. Tap Start speaking to try again.');
        setTimeout(() => open(tries - 1, silentTries), 300);
        return;
      }
      // a phone sometimes starts a second listener without ever giving it the microphone: no audio and no words, and no error either.
      // Start over with a fresh one instead of leaving it deaf.
      silent = setTimeout(() => {
        if (alive || heardSomething.current || !wantListening.current || silentTries <= 0) return;
        letGo(r);
        lastOne = null;
        closing.then(() => setTimeout(() => open(tries, silentTries - 1), 200));
      }, 3500);
    };
    // let go of the previous listener first, and wait until the phone really has before starting the next
    const previous = lastOne;
    lastOne = null;
    letGo(previous);
    closing.then(() => setTimeout(() => open(6), previous ? 250 : 0));
    // if the microphone never starts, say so instead of waiting in silence
    clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => !heardSomething.current && fail('The microphone did not start. Check that it is allowed for this app, then tap Start speaking to try again.'), 12000);
  };

  const stop = () => {
    wantListening.current = false;
    clearTimeout(watchdog.current);
    rec.current?.stop();
    setListening(false);
    setFinished(true);
  };

  const proceed = () => {
    // Close is enough (the microphone mishears): 85% of the words or better passes with no slips charged.
    // Below that, the missed words are charged as slips now, after the word-by-word feedback has been seen.
    if (!speechPassed(align) && align.mistakes > 0 && onMistake(align.mistakes)) return; // too many: restarts
    onDone();
  };

  return (
    <>
      <div class="verse-area" ref={area}>
        <div class="muted small center">{showWords ? 'Say the verse aloud' : 'Say the verse from memory'}</div>
        <div class="prompt-ref" style={{ fontSize: '1.3rem' }}>{formatRef(verse)}</div>
        {!listening && !finished && (
          <div class="measure-sm my-2">
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
          <div class="muted center my-4" data-testid="speak-hidden">
            {listening ? 'Listening… the words will appear when you finish.' : 'The words stay hidden until you finish.'}
          </div>
        )}
        {finished && !transcript.trim() && (
          <div class="banner info" data-testid="speak-nothing-heard">
            Nothing was heard. Check that the microphone is allowed for this app and that nothing else is using it, then try again.
          </div>
        )}
        {finished && (
          <div class={`banner ${speechPassed(align) ? 'good' : 'info'}`} data-testid="speak-result">
            {align.mistakes === 0
              ? 'Perfect — every word!'
              : speechPassed(align)
                ? `Close enough — ${Math.round(speechAccuracy(align) * 100)}% of the words. That counts.`
                : `${align.mistakes} word${align.mistakes === 1 ? '' : 's'} missed or different (${Math.round(speechAccuracy(align) * 100)}%; ${Math.round(SPEECH_PASS * 100)}% passes).`}
          </div>
        )}
        {finished && transcript.trim() && !speechPassed(align) && (
          <div class="muted small center" data-testid="speak-heard">
            Heard: {transcript}
          </div>
        )}
        {error && <div class="banner bad" role="alert">{error}</div>}
        <div class="hint-text center mt-3">Experimental — recognition may mishear words.</div>
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
