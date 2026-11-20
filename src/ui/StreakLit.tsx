import { useEffect } from 'preact/hooks';
import { dayKeyOf } from '../core/dates.ts';
import { streakInfo } from '../core/schedule.ts';
import { showToast, updateSettings, useApp } from '../store.ts';

/**
 * "Streak earned for today" (v1.84.0, owner-requested: a clear way of knowing you earned your streak for today): a toast the moment
 * today counts toward the streak, wherever that happens (a review, a game, a campaign), once a day on this device. Not in the
 * tour's sandbox, and not before the welcome is done.
 */
export function StreakLit() {
  const { data, settings, sandbox } = useApp();
  const now = Date.now();
  const today = dayKeyOf(now);
  const streak = streakInfo(data, now);
  const fire = streak.todayDone && settings.onboarded && !sandbox && settings.streakLitDay !== today;
  useEffect(() => {
    if (!fire) return;
    updateSettings({ streakLitDay: today });
    showToast(`Streak earned for today · ${streak.count} day${streak.count === 1 ? '' : 's'}`);
  }, [fire]);
  return null;
}
