import { useEffect } from 'preact/hooks';
import { earnedMedals, freshMedals, newMedalGroups, TIER_LABEL, TIERS, type Tier } from '../core/achievements.ts';
import { feedback } from '../services/feedback.ts';
import { recordEarnedMedals, updateSettings, useApp } from '../store.ts';
import { MEDAL_COINS } from '../core/coins.ts';
import { CloseX, Coin, Confetti, Overlay } from './common.tsx';
import { Medal } from './Medal.tsx';

/**
 * A new medal (v1.85.0): the medallion turns in with its tier and what it was for. Several new at once (a restored backup, a sync, a
 * long streak passing two marks) are one card with the medals in a row, never a chain of pop-ups. The first time a device looks it
 * only remembers what is already earned. It waits during reviews and games, the tour and the other celebrations, and never shows
 * the same medal twice on a device.
 */
export function AchievementReveal({ suppressed }: { suppressed: boolean }) {
  const { data, settings, sandbox, celebrating, reveals } = useApp();
  const ctx = { data, now: Date.now(), gameBest: settings.gameBest };
  const earned = [...new Set([...earnedMedals(ctx), ...(data.medals ?? [])])]; // earned here, or recorded on another device

  // a medal just earned is recorded in the synced data at once, which pays its coins
  useEffect(() => {
    recordEarnedMedals();
  }, [data, settings.gameBest]);

  useEffect(() => {
    if (sandbox || settings.seenAchievements !== null) return;
    updateSettings({ seenAchievements: earned });
  }, [sandbox, settings.seenAchievements === null]);

  const fresh = freshMedals(earned, settings.seenAchievements);
  const show = !suppressed && !sandbox && !celebrating && reveals.length === 0 && fresh.length > 0;
  const key = fresh.join(' ');
  useEffect(() => {
    if (show) feedback.milestone();
  }, [show, key]);
  if (!show) return null;

  const groups = newMedalGroups(fresh);
  const best = Math.max(...groups.map((g) => TIERS.indexOf(g.tier)));
  const coins = fresh.reduce((n, id) => n + (MEDAL_COINS[id.split(':')[1] as Tier] ?? 0), 0);
  const close = () => updateSettings({ seenAchievements: [...new Set([...(settings.seenAchievements ?? []), ...fresh])] });
  const one = groups.length === 1 ? groups[0] : null;
  const label = one ? `${TIER_LABEL[one.tier]} medal: ${one.achievement.name}` : `${groups.length} new medals`;
  return (
    <>
      {best > 0 && <Confetti count={best === 2 ? 60 : 24} />}
      <Overlay center label={label} onClose={close}>
        <div
          class={`modal center medal-reveal medal-reveal-${TIERS[best]}`}
          data-testid="medal-reveal"
          data-medal={fresh.join(' ')}
          key={key}
        >
          {one ? (
            <>
              <div class="medal-drop">
                <Medal achievement={one.achievement} tier={one.tier} size={112} />
              </div>
              <div class="reveal-kicker">{TIER_LABEL[one.tier]} medal</div>
              <h2 style={{ margin: 0 }}>{one.achievement.name}</h2>
              <p class="muted" style={{ margin: 0 }}>
                {one.achievement.ask(one.achievement.at[TIERS.indexOf(one.tier)])}.
              </p>
            </>
          ) : (
            <>
              <ul class="medal-drop-row">
                {groups.map((g, i) => (
                  <li key={g.achievement.id} class="medal-drop" style={{ animationDelay: `${i * 0.12}s` }}>
                    <Medal achievement={g.achievement} tier={g.tier} size={64} />
                    <small>{g.achievement.name}</small>
                  </li>
                ))}
              </ul>
              <h2 style={{ margin: 'var(--sp-2) 0 0' }}>{groups.length} new medals</h2>
            </>
          )}
          {settings.avatarOn && (
            <p class="medal-coins" data-testid="medal-coins">
              +{coins.toLocaleString()} coins <Coin />
            </p>
          )}
          <CloseX onClick={close} testId="medal-close" />
        </div>
      </Overlay>
    </>
  );
}
