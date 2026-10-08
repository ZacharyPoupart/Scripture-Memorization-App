// Celebration sizes scale with the achievement. Streak milestones are celebrated once per streak.
import { dayKeyOf } from './dates.ts';

export const STREAK_MILESTONES = [1, 3, 7, 14, 30, 60, 100, 150, 200, 365, 500, 730, 1000] as const;

export type CelebrationSize = 'small' | 'medium' | 'large';

export function isStreakMilestone(count: number): boolean {
  return (STREAK_MILESTONES as readonly number[]).includes(count);
}

export function streakMilestoneSize(count: number): CelebrationSize {
  return count >= 100 ? 'large' : count >= 14 ? 'medium' : 'small';
}

export function streakMilestoneId(count: number, now: number): string {
  return `streak:${count}:${dayKeyOf(now)}`;
}

export function streakMilestoneText(count: number): { title: string; body: string } {
  if (count === 1) return { title: 'Day one', body: 'Your flame is lit. Every day you practise it grows.' };
  if (count >= 365) return { title: `${count} days in a row`, body: 'A whole year of showing up. Scripture is becoming part of you.' };
  if (count >= 100) return { title: `${count} days in a row`, body: 'That kind of steadiness changes a person. Well done.' };
  if (count >= 30) return { title: `${count} days in a row`, body: 'A month of daily practice. The habit is real now.' };
  if (count >= 14) return { title: `${count} days in a row`, body: 'Two weeks of steady practice.' };
  if (count >= 7) return { title: 'A full week', body: 'Seven days in a row. Nicely done.' };
  return { title: `${count} days in a row`, body: 'A good rhythm is starting.' };
}

/** Gentle, never guilt-based copy for finishing a review (rotates, deterministic from a counter). */
const DONE_LINES = ['Well done.', 'That one is a little more yours now.', 'Steady and sure.', 'Good work.', 'Another one planted.'];
export const doneLine = (n: number) => DONE_LINES[Math.abs(n) % DONE_LINES.length];
