import { describe, expect, it } from 'vitest';
import { hello, reviewLine, summaryLine, todayLine, type TodayMood } from '../../src/core/voice.ts';

const guilt = /you (missed|failed|lost|let)|streak (lost|broken|ruined)|behind|shame|disappoint|don['’]t give up|last chance|hurry/i;
const moods: TodayMood[] = [{ kind: 'empty' }, { kind: 'break' }, { kind: 'ready', ready: 1, doneToday: 0 }, { kind: 'ready', ready: 4, doneToday: 2 }, { kind: 'waiting' }, { kind: 'done' }, { kind: 'quiet' }];

describe('the knight’s voice', () => {
  it('always has something kind to say, and never guilt or hurry', () => {
    for (const mood of moods)
      for (const hour of [0, 6, 13, 21])
        for (const day of [0, 1, 2, 3, 400])
          for (const streak of [0, 1, 7, 120]) {
            const line = todayLine(mood, { hour, day, streak });
            expect(line.length).toBeGreaterThan(8);
            expect(line).not.toMatch(guilt);
            expect(line).not.toMatch(/undefined|NaN/);
          }
    for (let n = 0; n < 12; n++)
      for (const counted of [true, false])
        for (const levelUp of [true, false])
          for (const todayComplete of [true, false]) expect(reviewLine({ counted, levelUp, todayComplete, n })).not.toMatch(guilt);
    for (const reviewed of [1, 3, 9]) for (const fullyDone of [true, false]) expect(summaryLine({ reviewed, fullyDone, streak: 5 })).not.toMatch(guilt);
  });

  it('says the same thing for the same moment, and counts verses in plain words', () => {
    const o = { hour: 9, day: 12, streak: 0 };
    expect(todayLine({ kind: 'ready', ready: 3, doneToday: 0 }, o)).toBe(todayLine({ kind: 'ready', ready: 3, doneToday: 0 }, o));
    expect(todayLine({ kind: 'ready', ready: 1, doneToday: 1 }, o)).toContain('1 verse ');
    expect(todayLine({ kind: 'ready', ready: 3, doneToday: 1 }, o)).toContain('3 verses');
  });

  it('greets by the hour', () => {
    expect(hello(8)).toBe('Good morning.');
    expect(hello(14)).toBe('Good afternoon.');
    expect(hello(20)).toBe('Good evening.');
  });

  it('marks the special moments', () => {
    expect(reviewLine({ counted: true, levelUp: true, todayComplete: false, n: 0 })).toMatch(/moved up/);
    expect(reviewLine({ counted: false, levelUp: false, todayComplete: false, n: 0 })).toMatch(/practice|love/i);
    expect(summaryLine({ reviewed: 2, fullyDone: true, streak: 9 })).toContain('9 days');
  });
});
