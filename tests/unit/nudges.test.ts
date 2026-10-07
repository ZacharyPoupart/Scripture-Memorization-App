import { describe, expect, it } from 'vitest';
import { shouldNudgeBackup } from '../../src/core/nudges.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 1);
const base = { syncOn: false, verses: 5, lastExportAt: 0, nudgeDismissedAt: 0, now: NOW };

describe('backup nudge', () => {
  it('appears when there is data worth protecting and no safety net', () => {
    expect(shouldNudgeBackup(base)).toBe(true);
    expect(shouldNudgeBackup({ ...base, lastExportAt: NOW - 45 * DAY })).toBe(true);
  });
  it('stays quiet with sync on, few verses, or a recent export', () => {
    expect(shouldNudgeBackup({ ...base, syncOn: true })).toBe(false);
    expect(shouldNudgeBackup({ ...base, verses: 2 })).toBe(false);
    expect(shouldNudgeBackup({ ...base, lastExportAt: NOW - 10 * DAY })).toBe(false);
  });
  it('after "Not now" it waits two weeks', () => {
    expect(shouldNudgeBackup({ ...base, nudgeDismissedAt: NOW - 3 * DAY })).toBe(false);
    expect(shouldNudgeBackup({ ...base, nudgeDismissedAt: NOW - 15 * DAY })).toBe(true);
  });
});
