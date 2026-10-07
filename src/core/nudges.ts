// Gentle, infrequent reminders to protect your data. Never nagging: at most once per two weeks, and
// only when there is something worth protecting and no other safety net (sync or a recent export).
const DAY = 86_400_000;

export interface NudgeInput {
  syncOn: boolean;
  verses: number;
  lastExportAt: number;
  nudgeDismissedAt: number;
  now: number;
}

export function shouldNudgeBackup(i: NudgeInput): boolean {
  if (i.syncOn || i.verses < 3) return false;
  const exportedRecently = i.lastExportAt > 0 && i.now - i.lastExportAt < 30 * DAY;
  const dismissedRecently = i.nudgeDismissedAt > 0 && i.now - i.nudgeDismissedAt < 14 * DAY;
  return !exportedRecently && !dismissedRecently;
}
