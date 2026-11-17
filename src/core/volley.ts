// Arrow Volley (v1.75.0, owner-requested: "click on words as they go by the screen to stop a projectile"). A real-time game, so
// this is a tiny simulation: `volleyStep` moves time on and `volleyTap` is a tap on an arrow. Pure and seeded, so it can be tested
// without a screen. Arrows fly from x = 0 (the archers) to x = 1 (the knight). Only the arrow carrying the NEXT word of the verse
// is dangerous: cut it down in time. Tapping any other word, or letting the right one land, costs a heart.
import { makeRng } from './quiz.ts';
import { tokenize, type Word } from './text.ts';

export const VOLLEY_HEARTS = 3;
export const VOLLEY_LANES = 3;

export interface Shot {
  id: number;
  /** As it is shown (no punctuation, so commas give nothing away). */
  word: string;
  key: string;
  lane: number;
  /** 0 at the archers, 1 at the knight. */
  x: number;
  /** Distance per millisecond. */
  speed: number;
}

export type VolleyEvent = { type: 'spawn' | 'cut' | 'wrong' | 'struck' | 'passed'; shot: Shot };

export interface VolleyState {
  words: Word[];
  /** The word the knight needs next (its place in the verse). */
  next: number;
  hearts: number;
  slips: number;
  combo: number;
  shots: Shot[];
  over: 'won' | 'lost' | null;
  /** Milliseconds since the last arrow left, and how many arrows since the needed word last flew. */
  sinceSpawn: number;
  sinceAnswer: number;
  nextId: number;
  rng: () => number;
}

export const shown = (w: Word) => w.raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w.raw;

export function newVolley(text: string, seed = 1): VolleyState {
  const words = tokenize(text);
  return { words, next: 0, hearts: VOLLEY_HEARTS, slips: 0, combo: 0, shots: [], over: words.length ? null : 'won', sinceSpawn: 1e9, sinceAnswer: 99, nextId: 1, rng: makeRng(seed) };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** It gets quicker as the verse goes on: an arrow takes 5.4 s to cross at the start and 3.8 s by the end. */
export const flightMs = (s: VolleyState) => lerp(5400, 3800, s.words.length ? s.next / s.words.length : 0);
export const spawnEveryMs = (s: VolleyState) => lerp(1500, 1050, s.words.length ? s.next / s.words.length : 0);

function spawn(s: VolleyState): Shot | null {
  const need = s.words[s.next];
  // a lane is free once its last arrow is well on its way, so two never overlap
  const free = Array.from({ length: VOLLEY_LANES }, (_, i) => i).filter((l) => !s.shots.some((sh) => sh.lane === l && sh.x < 0.3));
  if (!free.length) return null;
  const lane = free[Math.floor(s.rng() * free.length)];
  const flying = s.shots.some((sh) => sh.key === need.key);
  let w: Word | undefined;
  if (!flying && (s.sinceAnswer >= 2 || s.rng() < 0.55)) w = need;
  else {
    // a decoy: another word of the verse, the nearby ones first (those are the ones a memory mixes up)
    const near = s.words.filter((x) => x.key !== need.key && Math.abs(x.index - need.index) <= 4);
    const pool = near.length ? near : s.words.filter((x) => x.key !== need.key);
    w = pool.length ? pool[Math.floor(s.rng() * pool.length)] : flying ? undefined : need;
  }
  if (!w) return null;
  s.sinceAnswer = w.key === need.key ? 0 : s.sinceAnswer + 1;
  const shot: Shot = { id: s.nextId++, word: shown(w), key: w.key, lane, x: 0, speed: 1 / flightMs(s) };
  s.shots.push(shot);
  return shot;
}

function lose(s: VolleyState) {
  s.hearts--;
  s.slips++;
  s.combo = 0;
  if (s.hearts <= 0) s.over = 'lost';
}

/** Move the game on by `dt` milliseconds. Changes `s` and says what happened. */
export function volleyStep(s: VolleyState, dt: number): VolleyEvent[] {
  const events: VolleyEvent[] = [];
  if (s.over) return events;
  for (const sh of s.shots) sh.x += sh.speed * dt;
  for (const sh of s.shots.filter((x) => x.x >= 1)) {
    s.shots = s.shots.filter((x) => x !== sh);
    if (!s.over && sh.key === s.words[s.next].key) {
      lose(s);
      events.push({ type: 'struck', shot: sh });
    } else events.push({ type: 'passed', shot: sh });
  }
  if (s.over) return events;
  s.sinceSpawn += dt;
  if (s.sinceSpawn >= spawnEveryMs(s)) {
    const shot = spawn(s);
    if (shot) {
      s.sinceSpawn = 0;
      events.push({ type: 'spawn', shot });
    }
  }
  return events;
}

/** A tap on an arrow. The right word is cut down and the verse moves on; any other word costs a heart. */
export function volleyTap(s: VolleyState, id: number): VolleyEvent[] {
  const sh = s.shots.find((x) => x.id === id);
  if (!sh || s.over) return [];
  s.shots = s.shots.filter((x) => x !== sh);
  if (sh.key === s.words[s.next].key) {
    s.next++;
    s.combo++;
    if (s.next >= s.words.length) s.over = 'won';
    return [{ type: 'cut', shot: sh }];
  }
  lose(s);
  return [{ type: 'wrong', shot: sh }];
}
