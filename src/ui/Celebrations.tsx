import { addDays, dayKeyOf } from '../core/dates.ts';
import { formatRef } from '../core/reference.ts';
import { markLevelUpsSeen, useApp } from '../store.ts';
import { Confetti, Overlay, PILE_INFO } from './common.tsx';

/** "Level up!" for verses that graduated since you last looked. */
export function Celebrations({ suppressed }: { suppressed: boolean }) {
  const { data, settings } = useApp();
  if (suppressed) return null;
  const cutoff = addDays(dayKeyOf(Date.now()), -14);
  const ups = data.levelUps.filter((l) => l.day >= cutoff && !settings.seenLevelUps.includes(l.id) && data.verses[l.verseId] && !data.verses[l.verseId].deletedAt);
  if (!ups.length) return null;
  const close = () => markLevelUpsSeen(ups.map((u) => u.id));
  return (
    <>
      <Confetti />
      <Overlay center label="Level up" onClose={close}>
        <div class="modal stack center" data-testid="celebration">
          <div class="hero">🎉</div>
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
            It's becoming part of you. Fewer reviews from here — keep it up.
          </p>
          <button class="btn primary block" onClick={close} data-testid="celebration-close">
            Wonderful
          </button>
        </div>
      </Overlay>
    </>
  );
}
