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
    frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime?(v: number, t: number): void };
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

/** A note: frequency, when it starts and how long it lasts (s); optionally a wave, a slide to another frequency, and its own volume. */
type Note = [freq: number, startAt: number, dur: number, wave?: string, slideTo?: number, vol?: number];

/** The games' sounds (v1.76.0): short, soft, synthesized (nothing to download). Tuned by the research brief, quiet like the rest. */
export type GameSound = 'hit' | 'tier' | 'slip' | 'thud' | 'block' | 'star' | 'win' | 'loss' | 'pop';
const semis = (n: number) => Math.pow(2, n / 12);
const PENTA = [0, 2, 4, 7, 9, 12];
function gameNotes(kind: GameSound, step: number): Note[] {
  switch (kind) {
    case 'hit': {
      const f = 520 * semis(PENTA[Math.min(PENTA.length - 1, Math.max(0, step))]); // climbs with the combo
      return [[f, 0, 0.07, 'square', undefined, 0.035], [f * 2, 0.01, 0.05, 'triangle', undefined, 0.03]];
    }
    case 'tier':
      return [[660, 0, 0.08, 'triangle', undefined, 0.06], [990, 0.07, 0.12, 'triangle', undefined, 0.06]];
    case 'slip':
      return [[180, 0, 0.18, 'sawtooth', 90, 0.03]];
    case 'thud':
      return [[110, 0, 0.1, 'sine', 70, 0.09]];
    case 'block':
      return [[880, 0, 0.05, 'square', undefined, 0.03], [1320, 0, 0.05, 'square', undefined, 0.02]];
    case 'pop':
      return [[300, 0, 0.06, 'triangle', 520, 0.04]];
    case 'star':
      return [[784 * semis(PENTA[Math.min(5, step * 2)]), 0, 0.1, 'triangle', undefined, 0.06]];
    case 'win':
      return SOUNDS.milestone;
    case 'loss':
      return [[392, 0, 0.16, 'sine', undefined, 0.05], [294, 0.16, 0.22, 'sine', undefined, 0.05]];
  }
}

const SOUNDS: Record<string, Note[]> = {
  correct: [[660, 0, 0.09]],
  complete: [[523.25, 0, 0.12], [783.99, 0.1, 0.2]],
  milestone: [[523.25, 0, 0.14], [659.25, 0.12, 0.14], [783.99, 0.24, 0.14], [1046.5, 0.36, 0.3]],
};
const VOLUME = 0.05; // deliberately quiet

export function createFeedback(getPrefs: () => FeedbackPrefs, env: FeedbackEnv) {
  let ctx: AudioLike | null = null;

  function play(kind: string, notes: Note[] = SOUNDS[kind]) {
    const prefs = getPrefs();
    if (!prefs.sound || !env.AudioContext) return;
    try {
      ctx ??= new env.AudioContext();
      void ctx.resume?.();
      const t0 = ctx.currentTime;
      for (const [freq, start, dur, wave, slideTo, vol] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave ?? 'sine';
        osc.frequency.setValueAtTime(freq, t0 + start);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime?.(slideTo, t0 + start + dur);
        gain.gain.setValueAtTime(0.0001, t0 + start);
        gain.gain.linearRampToValueAtTime(vol ?? VOLUME, t0 + start + 0.006);
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
    /** A game sound; `step` is the combo for a hit (the pitch climbs) or the star's number. */
    game: (kind: GameSound, step = 0) => play(kind, gameNotes(kind, step)),
    /** Wake the sound up inside a tap (iPhone only allows it to start there), and again when the app comes back. */
    unlock: () => {
      if (!getPrefs().sound || !env.AudioContext) return;
      try {
        ctx ??= new env.AudioContext();
        void ctx.resume?.();
      } catch {
        /* optional */
      }
    },
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
