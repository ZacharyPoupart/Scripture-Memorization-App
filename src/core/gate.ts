// Hold the Gate (v1.76.0, owner-requested games; from the game-design research: first-letter recall is the strongest cue for
// exact wording). A goblin marches on the gate for every word of the verse; tap the FIRST LETTER of the next word to strike it
// down before it arrives. The word is never shown until it is struck (or reaches the gate). Pure and seeded: `gateStep` moves
// time on, `gateTap` is a tap on a letter key.
import { comboMultiplier, points } from './games.ts';
import { makeRng, shuffle } from './quiz.ts';
import { tokenize, type Word } from './text.ts';

export const GATE_HEARTS = 3;
export const GATE_KEYS = 6;
/** Every this many right answers in a row charge the shield: the next slip is blocked (it still counts as a slip). */
export const SHIELD_EVERY = 5;

export interface GateState {
  words: Word[];
  next: number;
  hearts: number;
  slips: number;
  combo: number;
  score: number;
  /** The marching goblin: 0 where it appears, 1 at the gate. */
  x: number;
  keys: string[];
  shield: boolean;
  over: 'won' | 'lost' | null;
  rng: () => number;
}

export type GateEvent =
  | { type: 'strike'; word: Word; points: number; combo: number; quick: number }
  | { type: 'miss'; letter: string } // a wrong key: the goblin lunges forward
  | { type: 'breach'; word: Word } // the goblin reached the gate: a heart, and the word is shown
  | { type: 'block'; word?: Word } // the shield took it
  | { type: 'shield' }; // the shield is charged

/** The first letter as a key shows it: a capital, or the digit. */
export const firstLetter = (w: Word) => w.key[0]?.toUpperCase() ?? '';

/** How long the goblin takes to reach the gate (ms): 5 s at the start, 3.5 s by the end. */
export const marchMs = (s: GateState) => 5000 - 1500 * (s.words.length ? s.next / s.words.length : 0);

/** Six keys: the right first letter, the first letters of nearby words (the ones a memory mixes up), then other letters. */
export function gateKeys(words: Word[], i: number, rng: () => number): string[] {
  const right = firstLetter(words[i]);
  const keys = [right];
  for (let d = 1; d < words.length && keys.length < GATE_KEYS; d++)
    for (const j of [i + d, i - d]) {
      const l = words[j] && firstLetter(words[j]);
      if (l && !keys.includes(l) && keys.length < GATE_KEYS) keys.push(l);
    }
  const fill = shuffle([...'ABCDEFGHIJKLMNOPRSTUWY'], rng);
  for (const l of fill) if (keys.length < GATE_KEYS && !keys.includes(l)) keys.push(l);
  return shuffle(keys, rng);
}

export function newGate(text: string, seed = 1): GateState {
  const words = tokenize(text);
  const rng = makeRng(seed);
  return { words, next: 0, hearts: GATE_HEARTS, slips: 0, combo: 0, score: 0, x: 0, keys: words.length ? gateKeys(words, 0, rng) : [], shield: false, over: words.length ? null : 'won', rng };
}

function advance(s: GateState) {
  s.next++;
  s.x = 0;
  if (s.next >= s.words.length) s.over = 'won';
  else s.keys = gateKeys(s.words, s.next, s.rng);
}

/** A slip: the shield takes it if charged, otherwise a heart goes. Either way it counts as a slip. */
function slip(s: GateState, events: GateEvent[], word?: Word): boolean {
  s.slips++;
  s.combo = 0;
  if (s.shield) {
    s.shield = false;
    events.push({ type: 'block', word });
    return true;
  }
  s.hearts--;
  if (s.hearts <= 0) s.over = 'lost';
  return false;
}

export function gateStep(s: GateState, dt: number): GateEvent[] {
  if (s.over) return [];
  s.x += dt / marchMs(s);
  if (s.x < 1) return [];
  const word = s.words[s.next];
  const events: GateEvent[] = [];
  if (!slip(s, events, word)) events.push({ type: 'breach', word });
  if (!s.over) advance(s); // the word is shown and the next goblin comes on, so the verse always moves forward
  return events;
}

export function gateTap(s: GateState, letter: string): GateEvent[] {
  if (s.over) return [];
  const word = s.words[s.next];
  const events: GateEvent[] = [];
  if (letter.toUpperCase() === firstLetter(word)) {
    s.combo++;
    const quick = Math.max(0, 1 - s.x);
    const p = points(s.combo, quick);
    s.score += p;
    events.push({ type: 'strike', word, points: p, combo: s.combo, quick });
    if (s.combo % SHIELD_EVERY === 0 && !s.shield) {
      s.shield = true;
      events.push({ type: 'shield' });
    }
    advance(s);
  } else {
    events.push({ type: 'miss', letter });
    slip(s, events);
    s.x = Math.min(0.95, s.x + 0.15); // the goblin lunges forward
  }
  return events;
}

export { comboMultiplier };
