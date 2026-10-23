// Tiny, optional sensory feedback. Everything is OFF by default and individually toggleable in Settings.
// Sound = a very quiet synthesized tone (Web Audio, nothing to download, works offline).

export interface FeedbackPrefs {
  sound: boolean;
}

interface AudioLike {
  currentTime: number;
  destination: unknown;
  state?: string;
  resume?: () => Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
  };
}

export interface FeedbackEnv {
  AudioContext?: new () => AudioLike;
}

type Note = [freq: number, startAt: number, dur: number];

const SOUNDS: Record<string, Note[]> = {
  correct: [[660, 0, 0.09]],
  complete: [[523.25, 0, 0.12], [783.99, 0.1, 0.2]],
  milestone: [[523.25, 0, 0.14], [659.25, 0.12, 0.14], [783.99, 0.24, 0.14], [1046.5, 0.36, 0.3]],
};
const VOLUME = 0.05; // deliberately quiet

export function createFeedback(getPrefs: () => FeedbackPrefs, env: FeedbackEnv) {
  let ctx: AudioLike | null = null;

  function play(kind: string) {
    const prefs = getPrefs();
    if (!prefs.sound || !env.AudioContext) return;
    try {
      ctx ??= new env.AudioContext();
      void ctx.resume?.();
      const t0 = ctx.currentTime;
      for (const [freq, start, dur] of SOUNDS[kind]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t0 + start);
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.linearRampToValueAtTime(VOLUME, t0 + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + start);
        osc.stop(t0 + start + dur + 0.02);
      }
    } catch {
      /* audio unavailable (e.g. blocked): feedback is optional, never an error */
    }
  }

  return {
    correct: () => play('correct'),
    complete: () => play('complete'),
    milestone: () => play('milestone'),
  };
}

let prefs: FeedbackPrefs = { sound: false };
export const setFeedbackPrefs = (p: FeedbackPrefs) => void (prefs = p);

export const feedback = createFeedback(
  () => prefs,
  {
    get AudioContext() {
      const w = window as unknown as { AudioContext?: FeedbackEnv['AudioContext']; webkitAudioContext?: FeedbackEnv['AudioContext'] };
      return w.AudioContext ?? w.webkitAudioContext;
    },
  } as FeedbackEnv,
);
