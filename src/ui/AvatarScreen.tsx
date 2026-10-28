import { useEffect, useState } from 'preact/hooks';
import {
  ARMOR_NAMES,
  ARMOR_SLOTS,
  flagItem,
  sceneUrl,
  currentLook,
  describeUnlock,
  isGated,
  isUnlocked,
  itemById,
  itemsIn,
  owns,
  seedsBalance,
  shortUnlock,
  SLOTS,
  EXTRA_SLOTS,
  SLOT_LABELS,
  testing,
  type Item,
  type Slot,
} from '../core/avatar.ts';
import { bannerFromFlag, bannerOf, bannerSpec, flagId } from '../core/banner.ts';
import { nextMultiplier, SEEDS_PER_DAY, SEEDS_PER_FULL_DAY, SEEDS_PER_LEVELUP, SEEDS_PER_REVIEW, STREAK_MULTIPLIERS, streakMultiplier } from '../core/coins.ts';
import { GUILD_WIN_COINS } from '../core/avatar.ts';
import { streakInfo } from '../core/schedule.ts';
import { back } from '../router.ts';
import { buyAndWear, refreshSocial, showToast, useApp, wearFlag, wearItem } from '../store.ts';
import { armorUrl } from './ArmorArt.tsx';
import { AvatarFigure } from './AvatarFigure.tsx';
import { BannerFigure } from './Banner.tsx';
import { CloseX, Coin, Icon } from './common.tsx';

/** Your knight: everyone starts in the same basic armor, and any piece can be swapped for another with coins and streaks. */
export function AvatarScreen() {
  const { data, social } = useApp();
  const [slot, setSlot] = useState<Slot>('helmet');
  const [pick, setPick] = useState<string | null>(null);
  const look = currentLook(data);
  const balance = seedsBalance(data);
  const streak = streakInfo(data, Date.now()).count;
  const multiplier = streakMultiplier(streak);
  const [guide, setGuide] = useState<'coins' | 'multiplier' | null>(null);
  const picked = pick ? itemById(pick) : undefined;
  const shown = picked ? { ...look, [picked.slot]: picked.id } : look;
  // the flags of the groups you are in (the one on the stand stays listed even if its group has not loaded yet)
  const guilds = social.guilds ?? [];
  const flags = slot === 'flag' ? guilds.map((g) => ({ g, item: flagItem(flagId(bannerSpec(bannerOf(g))), `${g.name} flag`) })) : [];
  const flagList = flags.map((f) => f.item);
  if (slot === 'flag' && bannerFromFlag(look.flag) && !flagList.some((b) => b.id === look.flag)) flagList.push(flagItem(look.flag, 'Group flag'));
  const items = [...itemsIn(slot), ...flagList];
  const sharing = !!data.sharing?.on && !!data.social;
  useEffect(() => {
    if (sharing && social.guilds === null) void refreshSocial();
  }, [sharing]);
  const armorInfo = (ARMOR_SLOTS as readonly string[]).includes(slot) ? ARMOR_NAMES[slot as (typeof ARMOR_SLOTS)[number]] : null;

  const choose = (item: Item) => {
    if (owns(data, item) && look[item.slot] !== item.id) {
      if (item.slot === 'flag') wearFlag(flags.find((f) => f.item.id === item.id)?.g.id ?? null, item.id);
      else wearItem(item.id);
      setPick(null);
    } else setPick(item.id === pick ? null : item.id);
  };

  const buy = () => {
    if (!picked) return;
    const r = buyAndWear(picked.id);
    if (r.ok) {
      showToast(`${picked.name} is yours.`);
      setPick(null);
    } else if (r.reason === 'funds') showToast('Not enough coins yet — every review earns more.');
  };

  const gated = !!picked && !owns(data, picked) && isGated(data, picked);
  const locked = (!!picked && !!picked.unlock && !isUnlocked(data, picked)) || gated;
  const canBuy = !!picked && !picked.unlock && !owns(data, picked);

  return (
    <>
      <div class="scroll">
        <div class="narrow stack">
          <div class="row spread">
            <button class="icon-btn" aria-label="Back" onClick={() => back('/')}>
              <Icon name="back" />
            </button>
            <h1 class="grow" style={{ margin: 0 }}>
              Your avatar
            </h1>
            {multiplier > 1 && (
              <button class="chip" aria-expanded={guide === 'multiplier'} onClick={() => setGuide(guide === 'multiplier' ? null : 'multiplier')} data-testid="streak-multiplier" aria-label={`Streak multiplier ${multiplier}. Tap to see why.`}>
                ×{multiplier}
              </button>
            )}
            <button class="chip seeds-chip" aria-expanded={guide === 'coins'} onClick={() => setGuide(guide === 'coins' ? null : 'coins')} data-testid="seeds-balance" aria-label={`${balance} coins. Tap to see how you earn them.`}>
              <Coin /> {balance}
            </button>
          </div>
          {guide && (
            <div class="card stack coins-guide" data-testid="coins-guide" role="region" aria-label={guide === 'coins' ? 'How you earn coins' : 'Your streak multiplier'}>
              <div class="row spread">
                <strong>{guide === 'coins' ? 'How you earn coins' : `Why it is ×${multiplier}`}</strong>
                <CloseX onClick={() => setGuide(null)} label="Close" />
              </div>
              {guide === 'coins' && (
                <ul class="guide-list">
                  <li>
                    <Coin /> {SEEDS_PER_REVIEW} for every review that counts
                  </li>
                  <li>
                    <Coin /> {SEEDS_PER_DAY} for every day you finish, and {SEEDS_PER_FULL_DAY} more when it is a full day (every verse all the way)
                  </li>
                  <li>
                    <Coin /> {SEEDS_PER_LEVELUP} when a verse moves up a pile
                  </li>
                  <li>
                    <Coin /> {GUILD_WIN_COINS} when your group reaches its weekly goal
                  </li>
                  <li>A bonus the first time your streak reaches 3, 7, 14, 30 days and beyond</li>
                  <li class="muted">Extra practice is always welcome, but it does not earn coins.</li>
                </ul>
              )}
              <p class="muted small" style={{ margin: 0 }} data-testid="multiplier-line">
                {multiplier > 1 ? (
                  <>
                    Your streak is {streak} days, so coins from reviews, finished days and level-ups are worth <strong>×{multiplier}</strong>. A part of a coin is a chance: 0.3 of a coin is a 30% chance of one more.
                  </>
                ) : (
                  <>Your streak is {streak} day{streak === 1 ? '' : 's'}. From 3 days in a row, coins are worth more.</>
                )}{' '}
                {nextMultiplier(streak) ? `Next: ×${nextMultiplier(streak)!.x} at ${nextMultiplier(streak)!.days} days (${nextMultiplier(streak)!.days - streak} to go).` : 'That is the top step.'}
              </p>
              <p class="muted small" style={{ margin: 0 }}>
                {STREAK_MULTIPLIERS.map((m) => `×${m.x} from ${m.days} days`).join(' · ')}
              </p>
            </div>
          )}

          {testing.armorFree && (
            <div class="banner info" data-testid="armor-free-banner">
              <strong>Testing:</strong> every piece of armor is free to wear right now. Nothing is bought, and coins are not touched.
            </div>
          )}

          <div class="card center stack avatar-stage">
            <AvatarFigure look={shown} size={200} title="Your knight" />
          </div>

          {[
            { label: 'Armor', slots: SLOTS.filter((s) => !EXTRA_SLOTS.includes(s)) },
            { label: 'Extras', slots: EXTRA_SLOTS },
          ].map((group) => (
            <div key={group.label} class="stack" style={{ '--gap': '6px' } as never}>
              <div class="muted small slot-group-label">{group.label}</div>
              <div class="slot-chips wrap" role="group" aria-label={group.label}>
                {group.slots.map((s) => (
                  <button
                    key={s}
                    aria-pressed={s === slot}
                    class={`chip-btn ${s === slot ? 'on' : ''}`}
                    onClick={() => (setSlot(s), setPick(null))}
                    data-testid={`slot-${s}`}
                  >
                    {SLOT_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {armorInfo && (
            <p class="muted small" style={{ margin: 0 }} data-testid="armor-verse">
              {armorInfo.title} · {armorInfo.verse}
            </p>
          )}

          {slot === 'flag' && !flagList.length && (
            <p class="muted small" style={{ margin: 0 }}>
              Join a group on the Friends tab to hang its flag here.
            </p>
          )}
          <div class="item-grid" data-testid="item-grid">
            {items.map((item) => {
              const have = owns(data, item);
              const isWorn = look[item.slot] === item.id;
              const lockedItem = (!!item.unlock || isGated(data, item)) && !have;
              return (
                <button
                  key={item.id}
                  class={`item-tile ${isWorn ? 'worn' : ''} ${pick === item.id ? 'picked' : ''} ${have ? '' : 'unowned'}`}
                  onClick={() => choose(item)}
                  data-testid={`item-${item.id}`}
                  aria-pressed={isWorn || pick === item.id}
                >
                  {bannerFromFlag(item.id) ? (
                    <span class="piece-img banner-tile">
                      <BannerFigure banner={bannerFromFlag(item.id)!} size={50} title={item.name} />
                    </span>
                  ) : armorUrl(item.id) ? (
                    <img class="piece-img" src={armorUrl(item.id)!} alt="" width="72" height="72" loading="lazy" style={item.slot === 'weapon' ? { transform: 'rotate(180deg)' } : undefined} />
                  ) : sceneUrl(item.id) ? (
                    <img class="piece-img scene-img" src={sceneUrl(item.id)!} alt="" width="72" height="72" loading="lazy" />
                  ) : item.id.endsWith('-none') ? (
                    <span class="piece-img piece-none" aria-hidden="true">
                      —
                    </span>
                  ) : (
                    <AvatarFigure look={{ ...look, [item.slot]: item.id }} size={72} view={'full'} />
                  )}
                  <span class="item-name">{item.name}</span>
                  <span class="item-status muted">
                    {isWorn ? (
                      'Wearing'
                    ) : have ? (
                      'Owned'
                    ) : (
                      <>
                        {lockedItem &&
                          (item.unlock ? [item.unlock] : item.requires!).map((u, n) => (
                            <span class="item-need" key={n}>
                              {n === 0 ? '🔒 ' : ''}
                              {shortUnlock(u)}
                            </span>
                          ))}
                        {(!item.unlock || !lockedItem) && (
                          <span class="item-price">
                            <Coin />
                            {item.cost.toLocaleString('en-US')}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {picked && (
        <div class="action-bar">
          {locked ? (
            <p class="muted center" style={{ margin: 0 }} data-testid="unlock-hint">
              {gated ? (
                <>
                  {picked.name}: {picked.requires!.map(describeUnlock).join(' and ').toLowerCase()} first, then it costs <Coin />
                  {picked.cost}.
                </>
              ) : (
                `${picked.name}: ${describeUnlock(picked.unlock!)}.`
              )}
            </p>
          ) : canBuy ? (
            <button class="btn primary block" onClick={buy} disabled={balance < picked.cost} data-testid="buy">
              {balance < picked.cost ? (
                <>
                  {picked.name} · <Coin />
                  {picked.cost} (need {picked.cost - balance} more)
                </>
              ) : (
                <>
                  Get {picked.name} · <Coin />
                  {picked.cost}
                </>
              )}
            </button>
          ) : (
            <button class="btn primary block" onClick={() => (picked.slot === 'flag' ? wearFlag(flags.find((f) => f.item.id === picked.id)?.g.id ?? null, picked.id) : wearItem(picked.id), setPick(null))} data-testid="wear">
              Wear {picked.name}
            </button>
          )}
        </div>
      )}
    </>
  );
}
