import { useEffect } from 'preact/hooks';
import { addDays, dayKeyOf } from '../core/dates.ts';
import { isStreakMilestone, streakMilestoneId, streakMilestoneSize, streakMilestoneText } from '../core/milestones.ts';
import { formatRef } from '../core/reference.ts';
import { streakInfo } from '../core/schedule.ts';
import { feedback } from '../services/feedback.ts';
import { markLevelUpsSeen, markMilestoneSeen, useApp } from '../store.ts';
import { Confetti, Icon, Overlay, PILE_INFO } from './common.tsx';

/**
 * Celebrations scale with the achievement:
 *  small  (3 / 7-day streak)            -> a quiet card, no confetti
 *  medium (verse moves up; 14-99 days)  -> card + a little confetti
 *  large  (moves to Yearly; 100+ days)  -> card + full confetti
 * "Calm" mode never shows confetti. Nothing here ever scolds; missed days are simply not mentioned.
 */
export function Celebrations({ suppressed }: { suppressed: boolean }) {
  const { data, settings } = useApp();
  const now = Date.now();
  const cutoff = addDays(dayKeyOf(now), -14);
  const ups = data.levelUps.filter((l) => l.day >= cutoff && !settings.seenLevelUps.includes(l.id) && data.verses[l.verseId] && !data.verses[l.verseId].deletedAt);
  const streak = streakInfo(data, now);
  const mid = streakMilestoneId(streak.count, now);
  const milestone = streak.todayDone && isStreakMilestone(streak.count) && !settings.seenMilestones.includes(mid);
  const show = !suppressed && (ups.length > 0 || milestone);
  const key = ups.length ? ups.map((u) => u.id).join(',') : mid;

  useEffect(() => {
    if (show) feedback.milestone();
  }, [show, key]);

  if (!show) return null;
  const calm = settings.celebrations === 'calm';

  if (ups.length) {
    const toYearly = ups.some((u) => u.to === 'yearly');
    const close = () => markLevelUpsSeen(ups.map((u) => u.id));
    return (
      <>
        {!calm && <Confetti count={toYearly ? 90 : 40} />}
        <Overlay center label="Level up" onClose={close}>
          <div class="modal stack center" data-testid="celebration">
            <div class="hero">{toYearly ? '🌳' : '🎉'}</div>
            <h2>{ups.length === 1 ? 'A verse levelled up!' : `${ups.length} verses levelled up!`}</h2>
            <div class="stack">
              {ups.map((u) => (
                <div key={u.id}>
                  <strong>{formatRef(data.verses[u.verseId])}</strong>
                  <div class="muted">
                    {PILE_INFO[u.from].label} → {PILE_INFO[u.to].label}
                  </div>
                </div>
              ))}
            </div>
            <p class="muted small" style={{ margin: 0 }}>
              {toYearly ? 'Kept for life — you will see it once a year.' : 'It is becoming part of you. Fewer reviews from here.'}
            </p>
            <button class="btn primary block" onClick={close} data-testid="celebration-close">
              Wonderful
            </button>
          </div>
        </Overlay>
      </>
    );
  }

  const size = streakMilestoneSize(streak.count);
  const text = streakMilestoneText(streak.count);
  const close = () => markMilestoneSeen(mid);
  return (
    <>
      {!calm && size !== 'small' && <Confetti count={size === 'large' ? 90 : 36} />}
      <Overlay center label="Streak milestone" onClose={close}>
        <div class="modal stack center" data-testid="milestone">
          <div class="milestone-flame">
            <Icon name="flame" fill />
          </div>
          <h2>{text.title}</h2>
          <p class="muted" style={{ margin: 0 }}>
            {text.body}
          </p>
          <button class="btn primary block" onClick={close} data-testid="milestone-close">
            Thank you
          </button>
        </div>
      </Overlay>
    </>
  );
}
