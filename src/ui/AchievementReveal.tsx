import { useEffect } from 'preact/hooks';
import { achievementById, earnedMedals, freshMedals, TIER_LABEL, type Tier } from '../core/achievements.ts';
import { feedback } from '../services/feedback.ts';
import { recordEarnedMedals, updateSettings, useApp } from '../store.ts';
import { MEDAL_COINS } from '../core/coins.ts';
import { CloseX, Coin, Confetti, Overlay } from './common.tsx';
import { Medal } from './Medal.tsx';

/**
 * A new medal (v1.85.0): the medal drops in with its tier and what it was for, one at a time, bronze before silver before gold. The
 * first time a device looks it only remembers what is already earned. It waits during reviews and games, the tour and the other
 * celebrations, and never shows the same medal twice on a device.
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
  const id = !suppressed && !sandbox && !celebrating && reveals.length === 0 ? fresh[0] : undefined;
  const [aid, tierName] = id ? id.split(':') : [];
  const achievement = aid ? achievementById(aid) : undefined;
  const tier = tierName as Tier | undefined;
  useEffect(() => {
    if (achievement) feedback.milestone();
  }, [id]);
  if (!id || !achievement || !tier) return null;

  const at = achievement.at[['bronze', 'silver', 'gold'].indexOf(tier)];
  const close = () => updateSettings({ seenAchievements: [...(settings.seenAchievements ?? []), id] });
  return (
    <>
      {tier !== 'bronze' && <Confetti count={tier === 'gold' ? 60 : 24} />}
      <Overlay center label={`${TIER_LABEL[tier]} medal: ${achievement.name}`} onClose={close}>
        <div class={`modal stack center medal-reveal medal-reveal-${tier}`} data-testid="medal-reveal" data-medal={id} key={id}>
          <div class="medal-drop">
            <Medal achievement={achievement} tier={tier} size={112} />
          </div>
          <div class="reveal-kicker">{TIER_LABEL[tier]} medal</div>
          <h2 style={{ margin: 0 }}>{achievement.name}</h2>
          <p class="muted" style={{ margin: 0 }}>
            {achievement.ask(at)}.
          </p>
          {settings.avatarOn && (
            <p class="medal-coins" data-testid="medal-coins">
              +{MEDAL_COINS[tier]} coins <Coin />
            </p>
          )}
          <CloseX onClick={close} testId="milestone-close" />
        </div>
      </Overlay>
    </>
  );
}
