import { useEffect, useRef } from 'preact/hooks';
import { forgivenDays } from '../core/schedule.ts';
import { feedback } from '../services/feedback.ts';
import { updateSettings, useApp } from '../store.ts';
import { Icon, Overlay } from './common.tsx';

/**
 * Streak forgiveness: when the monthly save has just covered a missed day, say so once. It waits during a review, the tour
 * and other celebrations, and never shows twice for the same day.
 */
export function StreakSaved({ suppressed }: { suppressed: boolean }) {
  const { data, settings, sandbox, celebrating, reveals } = useApp();
  const latest = forgivenDays(data, Date.now()).pop() ?? '';
  const show = !!latest && latest > settings.seenSaved && !suppressed && !sandbox && !celebrating && reveals.length === 0;
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!show) return;
    feedback.milestone();
    btn.current?.focus({ preventScroll: true });
  }, [show]);
  if (!show) return null;
  const close = () => updateSettings({ seenSaved: latest });
  return (
    <Overlay onClose={close} center label="Your streak was saved">
      <div class="sheet stack center" data-testid="streak-saved">
        <span class="saved-flame" aria-hidden="true">
          <Icon name="flame" fill />
        </span>
        <p class="saved-text" style={{ margin: 0 }}>
          God may be the only one who can save you, but we can save your streak! Enjoy one free streak save each month. Use it wisely!
        </p>
        <button ref={btn} class="btn primary block" onClick={close} data-testid="streak-saved-close">
          Thank you
        </button>
      </div>
    </Overlay>
  );
}
