import { describe, expect, it } from 'vitest';
import { exportBackup, normalizeData, parseBackup } from '../../src/core/backup.ts';
import { mergeData } from '../../src/core/merge.ts';
import { itemById, owns } from '../../src/core/avatar.ts';
import { buildTodayQueue } from '../../src/core/today.ts';
import { verseStatus } from '../../src/core/schedule.ts';
import { LESSONS, START, doneLessons, isLastStep, lessonStart, needsAction, nextLesson, nextPos, prevPos, sampleTourData, stepAt } from '../../src/core/tour.ts';
import { newSim, simAdvance, simReview, simView } from '../../src/core/tourSim.ts';
import { at, D0, newData } from './helpers.ts';

describe('the lessons', () => {
  it('have unique ids, wording on every step, and sensible targets', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    for (const l of LESSONS) {
      expect(l.title && l.blurb && l.steps.length > 0, l.id).toBeTruthy();
      expect(new Set(l.steps.map((s) => s.id)).size, l.id).toBe(l.steps.length);
      for (const s of l.steps) {
        expect(s.title.length, s.id).toBeGreaterThan(2);
        expect(s.body.length, s.id).toBeGreaterThan(10);
        if (s.advance?.kind === 'click') expect(s.target, `${s.id}: a tap step needs something to tap`).toBeTruthy();
      }
    }
  });

  it('never use guilt or urgency wording', () => {
    const text = LESSONS.flatMap((l) => l.steps.map((s) => `${s.title} ${s.body}`)).join(' ').toLowerCase();
    for (const bad of ['overdue', 'behind', 'falling', 'lazy', 'failed', 'hurry', "don't forget", 'last chance']) expect(text).not.toContain(bad);
  });

  it('quote the real graduation numbers', () => {
    const text = LESSONS.flatMap((l) => l.steps.map((s) => s.body)).join(' ');
    expect(text).toContain('90 days');
    expect(text).toContain('15 weeks');
    expect(text).toContain('6 months');
  });
});

describe('the step engine', () => {
  it('walks every step in order and ends after the last', () => {
    let p: typeof START | null = START;
    let n = 0;
    while (p) {
      n++;
      expect(stepAt(p)).toBeTruthy();
      p = nextPos(p);
    }
    expect(n).toBe(LESSONS.reduce((t, l) => t + l.steps.length, 0));
    expect(isLastStep({ lesson: LESSONS.length - 1, step: LESSONS[LESSONS.length - 1].steps.length - 1 })).toBe(true);
  });

  it('goes back across lessons and stops at the very start', () => {
    expect(prevPos(START)).toEqual(START);
    expect(prevPos({ lesson: 1, step: 0 })).toEqual({ lesson: 0, step: LESSONS[0].steps.length - 1 });
    expect(prevPos({ lesson: 1, step: 2 })).toEqual({ lesson: 1, step: 1 });
  });

  it('can skip a lesson or jump to one (clamped), and knows which steps need the person to act', () => {
    expect(nextLesson({ lesson: 0, step: 2 })).toEqual({ lesson: 1, step: 0 });
    expect(nextLesson({ lesson: LESSONS.length - 1, step: 0 })).toBeNull();
    expect(lessonStart(99)).toEqual({ lesson: LESSONS.length - 1, step: 0 });
    expect(lessonStart(-3)).toEqual(START);
    expect(needsAction({ id: 'x', title: 'x', body: 'x', advance: { kind: 'click' }, target: 't' })).toBe(true);
    expect(needsAction({ id: 'x', title: 'x', body: 'x' })).toBe(false);
    expect(doneLessons(['review', 'nope', 'basics'])).toEqual(['basics', 'review']);
  });
});

describe('the practice verses', () => {
  it('are three verses in three piles, all ready, the Daily one first', () => {
    const now = at(D0, '09:00');
    const data = sampleTourData(now);
    const vs = Object.values(data.verses);
    expect(vs.map((v) => v.pile).sort()).toEqual(['daily', 'monthly', 'weekly']);
    for (const v of vs) expect(verseStatus(data, v, now).state, v.pile).toBe('ready');
    const queue = buildTodayQueue(data, now);
    expect(data.verses[queue[0]].pile).toBe('daily');
  });
});

describe('the simulator', () => {
  it('shows a Daily verse nearly through its 90 days, and moves it up after a few reviewed days', () => {
    let sim = newSim();
    expect(simView(sim)).toMatchObject({ pile: 'daily', progress: 'Day 84 of 90', canReview: true });
    sim = simAdvance(sim, 6, true);
    expect(simView(sim).pile).toBe('weekly');
    expect(sim.log.some((l) => l.includes('Moved up to Weekly'))).toBe(true);
  });

  it('a day with no review earns nothing, and a Daily verse cannot be reviewed again at once', () => {
    let sim = newSim();
    sim = simAdvance(sim, 3, false);
    expect(simView(sim).progress).toBe('Day 84 of 90');
    sim = simReview(sim);
    expect(simView(sim).progress).toBe('Day 85 of 90');
  });

  it('never changes the sim it was given', () => {
    const sim = newSim();
    const before = JSON.stringify(sim);
    simAdvance(sim, 5, true);
    simReview(sim);
    expect(JSON.stringify(sim)).toBe(before);
  });
});

describe('finishing the tour is remembered with the data', () => {
  it('tourAt unlocks the shield, merges to the latest, and survives a backup', () => {
    const shield = itemById('shield-iron-bulwark')!;
    const a = newData();
    const b = newData();
    expect(owns(a, shield)).toBe(false);
    b.tourAt = 5000;
    const m = mergeData(a, b);
    expect(m.tourAt).toBe(5000);
    expect(owns(m, shield)).toBe(true);
    a.tourAt = 9000;
    expect(mergeData(a, b).tourAt).toBe(9000);
    expect(mergeData(mergeData(a, b), b)).toEqual(mergeData(a, b)); // idempotent
    expect(mergeData(a, b)).toEqual(mergeData(b, a)); // commutative
    const back = parseBackup(exportBackup(a, '1.34.0', 1));
    expect(back.tourAt).toBe(9000);
    expect(normalizeData({ ...JSON.parse(JSON.stringify(a)), tourAt: 'soon' }).tourAt).toBeUndefined();
    expect(normalizeData({ ...JSON.parse(JSON.stringify(a)), tourAt: -4 }).tourAt).toBeUndefined();
  });
});
