import { useState } from 'preact/hooks';
import {
  ARMOR_NAMES,
  ARMOR_SLOTS,
  sceneUrl,
  armorWorn,
  currentLook,
  describeUnlock,
  isGated,
  isUnlocked,
  itemById,
  itemsIn,
  matchedSet,
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
import { back } from '../router.ts';
import { buyAndWear, showToast, useApp, wearItem } from '../store.ts';
import { armorUrl } from './ArmorArt.tsx';
import { AvatarFigure } from './AvatarFigure.tsx';
import { Coin, Icon } from './common.tsx';

/** Your knight: everyone starts in the same basic armor, and any piece can be swapped for another with coins and streaks. */
export function AvatarScreen() {
  const { data } = useApp();
  const [slot, setSlot] = useState<Slot>('helmet');
  const [pick, setPick] = useState<string | null>(null);
  const look = currentLook(data);
  const balance = seedsBalance(data);
  const picked = pick ? itemById(pick) : undefined;
  const shown = picked ? { ...look, [picked.slot]: picked.id } : look;
  const items = itemsIn(slot);
  const worn = armorWorn(look);
  const matched = matchedSet(look);
  const armorInfo = (ARMOR_SLOTS as readonly string[]).includes(slot) ? ARMOR_NAMES[slot as (typeof ARMOR_SLOTS)[number]] : null;

  const choose = (item: Item) => {
    if (owns(data, item) && look[item.slot] !== item.id) {
      wearItem(item.id);
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
            <span class="chip seeds-chip" data-testid="seeds-balance" aria-label={`${balance} coins`}>
              <Coin /> {balance}
            </span>
          </div>

          {testing.armorFree && (
            <div class="banner info" data-testid="armor-free-banner">
              <strong>Testing:</strong> every piece of armor is free to wear right now. Nothing is bought, and coins are not touched.
            </div>
          )}

          <div class="card center stack avatar-stage">
            <AvatarFigure look={shown} size={200} title="Your knight" />
            <div class="armor-meter" data-testid="armor-meter">
              <strong>
                {matched ? `${matched.name} set — helmet, chest plate, belt and boots match` : worn === ARMOR_SLOTS.length ? 'Full armor of God' : `Armor of God: ${worn} of ${ARMOR_SLOTS.length} upgraded`}
              </strong>
              <span class="armor-pips" aria-hidden="true">
                {ARMOR_SLOTS.map((s) => (
                  <i key={s} class={look[s].endsWith('-none') ? '' : 'on'} />
                ))}
              </span>
            </div>
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
                  {armorUrl(item.id) ? (
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
            <button class="btn primary block" onClick={() => (wearItem(picked.id), setPick(null))} data-testid="wear">
              Wear {picked.name}
            </button>
          )}
        </div>
      )}
    </>
  );
}
