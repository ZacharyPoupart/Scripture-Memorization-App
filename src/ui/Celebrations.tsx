import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { Mark } from './marks.tsx';
import { addDays, dayKeyOf } from '../core/dates.ts';
import { isStreakMilestone, streakMilestoneId, streakMilestoneSize, streakMilestoneText } from '../core/milestones.ts';
import { formatRef } from '../core/reference.ts';
import { streakInfo } from '../core/schedule.ts';
import { feedback } from '../services/feedback.ts';
import { markLevelUpsSeen, markMilestoneSeen, setCelebrating, updateSettings, useApp } from '../store.ts';
import { CloseX, Confetti, Icon, Overlay, PILE_INFO } from './common.tsx';

/**
 * Celebrations scale with the achievement:
 *  small  (3 / 7-day streak)            -> a quiet card, no confetti
 *  medium (verse moves up; 14-99 days)  -> card + a little confetti
 *  large  (moves to Yearly; 100+ days)  -> card + full confetti
 * Nothing here ever scolds; missed days are simply not mentioned.
 */
export function Celebrations({ suppressed }: { suppressed: boolean }) {
  const { data, settings } = useApp();
  const now = Date.now();
  const cutoff = addDays(dayKeyOf(now), -14);
  const ups = data.levelUps.filter((l) => l.day >= cutoff && !settings.seenLevelUps.includes(l.id) && data.verses[l.verseId] && !data.verses[l.verseId].deletedAt);
  const streak = streakInfo(data, now);
  const mid = streakMilestoneId(streak.count, now);
  const milestone = streak.todayDone && isStreakMilestone(streak.count) && !settings.seenMilestones.includes(mid);
  // every other day the streak is earned gets its own small celebration (v1.84.1, owner-requested), once a day on this device
  const today = dayKeyOf(now);
  const earned = streak.todayDone && !isStreakMilestone(streak.count) && settings.streakLitDay !== today;
  const show = !suppressed && (ups.length > 0 || milestone || earned);
  const key = ups.length ? ups.map((u) => u.id).join(',') : milestone ? mid : `earned:${today}`;

  useEffect(() => {
    if (show) feedback.milestone();
  }, [show, key]);
  useEffect(() => {
    setCelebrating(show);
    return () => setCelebrating(false);
  }, [show]);

  if (!show) return null;

  if (ups.length) {
    const toYearly = ups.some((u) => u.to === 'yearly');
    const close = () => markLevelUpsSeen(ups.map((u) => u.id));
    return (
      <>
        <Confetti count={toYearly ? 90 : 40} />
        <Overlay center label="Promoted" onClose={close}>
          <div class="modal stack center" data-testid="celebration">
            <Mark name={toYearly ? 'tree' : 'burst'} size={52} />
            <h2 class="headline">{ups.length === 1 ? 'A verse was promoted!' : `${ups.length} verses were promoted!`}</h2>
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
            <CloseX onClick={close} testId="celebration-close" />
          </div>
        </Overlay>
      </>
    );
  }

  // this week at a glance: the last seven days, a lit flame for each one that kept the streak
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    const lit = d === today ? streak.todayDone : data.ledger[d]?.o === 'c';
    return { d, lit, letter: new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }) };
  });

  if (!milestone) {
    const close = () => updateSettings({ streakLitDay: today });
    return (
      <Overlay center label="Streak earned for today" onClose={close}>
        <StreakCard count={streak.count} week={week} today={today} testid="streak-earned" onClose={close}>
          <p class="earned-sub">Earned for today</p>
        </StreakCard>
      </Overlay>
    );
  }

  const size = streakMilestoneSize(streak.count);
  const text = streakMilestoneText(streak.count);
  const close = () => (markMilestoneSeen(mid), updateSettings({ streakLitDay: today })); // a milestone day is celebrated once
  return (
    <>
      {size !== 'small' && <Confetti count={size === 'large' ? 90 : 36} />}
      <Overlay center label="Streak milestone" onClose={close}>
        <StreakCard count={streak.count} week={week} today={today} testid="milestone" onClose={close}>
          <h2 class="earned-title">{text.title}</h2>
          <p class="earned-sub">{text.body}</p>
        </StreakCard>
      </Overlay>
    </>
  );
}

/**
 * The streak card (v1.84.1, owner-requested rework: "it looks bad with all that empty space"): a big flickering flame with sparks
 * flying off it, the count, what it is for, and this week's flames, in a narrow card. Used for every day the streak is earned and,
 * with the milestone's own words, for the milestones.
 */
function StreakCard({ count, week, today, testid, onClose, children }: { count: number; week: { d: string; lit: boolean; letter: string }[]; today: string; testid: string; onClose: () => void; children: ComponentChildren }) {
  return (
    <div class="modal center streak-earned" data-testid={testid}>
      <CloseX onClick={onClose} testId="milestone-close" />
      <div class="earned-flame" aria-hidden="true">
        <i class="spark s1" />
        <i class="spark s2" />
        <i class="spark s3" />
        <Icon name="flame" fill />
      </div>
      <div class="earned-count">
        <b>{count}</b>
        <span>day streak</span>
      </div>
      {children}
      <ol class="earned-week" aria-label="This week">
        {week.map((w, i) => (
          <li key={w.d} class={`${w.lit ? 'lit' : ''} ${w.d === today ? 'today' : ''}`} style={{ animationDelay: `${0.5 + i * 0.06}s` }}>
            <Icon name="flame" fill={w.lit} />
            <small>{w.letter}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}
