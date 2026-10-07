import { describe, expect, it } from 'vitest';
import { createFeedback } from '../../src/services/feedback.ts';

function fakeEnv() {
  const log = { contexts: 0, oscillators: 0, vibrations: [] as unknown[] };
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
  return { log, env: { AudioContext: Ctx as never, vibrate: (p: number | number[]) => (log.vibrations.push(p), true) } };
}

describe('optional feedback', () => {
  it('does absolutely nothing while both toggles are off (the default)', () => {
    const { log, env } = fakeEnv();
    const fb = createFeedback(() => ({ sound: false, haptics: false }), env);
    fb.correct();
    fb.complete();
    fb.milestone();
    expect(log).toEqual({ contexts: 0, oscillators: 0, vibrations: [] });
  });

  it('sound only creates audio when switched on, lazily, once', () => {
    const { log, env } = fakeEnv();
    const fb = createFeedback(() => ({ sound: true, haptics: false }), env);
    fb.correct();
    fb.complete();
    expect(log.contexts).toBe(1);
    expect(log.oscillators).toBe(1 + 2);
    expect(log.vibrations).toEqual([]);
  });

  it('haptics are independent of sound and need platform support', () => {
    const { log, env } = fakeEnv();
    createFeedback(() => ({ sound: false, haptics: true }), env).correct();
    expect(log.vibrations).toEqual([8]);
    expect(log.contexts).toBe(0);
    const none = createFeedback(() => ({ sound: false, haptics: true }), {});
    expect(() => none.milestone()).not.toThrow();
  });

  it('a broken or blocked audio device never throws', () => {
    const fb = createFeedback(() => ({ sound: true, haptics: true }), {
      AudioContext: class {
        constructor() {
          throw new Error('blocked');
        }
      } as never,
      vibrate: () => {
        throw new Error('nope');
      },
    });
    expect(() => fb.complete()).not.toThrow();
  });

  it('bigger moments sound/feel bigger', () => {
    const a = fakeEnv();
    createFeedback(() => ({ sound: true, haptics: true }), a.env).correct();
    const b = fakeEnv();
    createFeedback(() => ({ sound: true, haptics: true }), b.env).milestone();
    expect(b.log.oscillators).toBeGreaterThan(a.log.oscillators);
    expect((b.log.vibrations[0] as number[]).length).toBeGreaterThan(1);
  });
});
