import { describe, expect, it } from 'vitest';
import { createFeedback } from '../../src/services/feedback.ts';

function fakeEnv() {
  const log = { contexts: 0, oscillators: 0 };
  class Ctx {
    currentTime = 0;
    destination = {};
    constructor() {
      log.contexts++;
    }
    createOscillator() {
      log.oscillators++;
      return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
    }
  }
  return { log, env: { AudioContext: Ctx as never } };
}

describe('optional feedback', () => {
  it('does absolutely nothing while the sound toggle is off (the default)', () => {
    const { log, env } = fakeEnv();
    const fb = createFeedback(() => ({ sound: false }), env);
    fb.correct();
    fb.complete();
    fb.milestone();
    expect(log).toEqual({ contexts: 0, oscillators: 0 });
  });

  it('sound only creates audio when switched on, lazily, once', () => {
    const { log, env } = fakeEnv();
    const fb = createFeedback(() => ({ sound: true }), env);
    fb.correct();
    fb.complete();
    expect(log.contexts).toBe(1);
    expect(log.oscillators).toBe(1 + 2);
  });

  it('a broken or blocked audio device never throws', () => {
    const fb = createFeedback(() => ({ sound: true }), {
      AudioContext: class {
        constructor() {
          throw new Error('blocked');
        }
      } as never,
    });
    expect(() => fb.complete()).not.toThrow();
  });

  it('bigger moments sound bigger', () => {
    const a = fakeEnv();
    createFeedback(() => ({ sound: true }), a.env).correct();
    const b = fakeEnv();
    createFeedback(() => ({ sound: true }), b.env).milestone();
    expect(b.log.oscillators).toBeGreaterThan(a.log.oscillators);
  });
});
