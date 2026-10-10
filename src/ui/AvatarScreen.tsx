import { useState } from 'preact/hooks';
import {
  ARMOR_NAMES,
  ARMOR_SLOTS,
  armorWorn,
  completedSet,
  currentLook,
  describeUnlock,
  isGated,
  isUnlocked,
  itemById,
  itemsIn,
  owns,
  seedsBalance,
  SLOT_GROUPS,
  SLOT_LABELS,
  type Item,
  type Slot,
} from '../core/avatar.ts';
import { back } from '../router.ts';
import { buyAndWear, showToast, useApp, wearItem } from '../store.ts';
import { AvatarFigure } from './AvatarFigure.tsx';
import { Icon } from './common.tsx';

/** Your knight: look like yourself for free, then put on the armor of God and earn the rest with seeds and streaks. */
export function AvatarScreen() {
  const { data } = useApp();
  const [group, setGroup] = useState<(typeof SLOT_GROUPS)[number]['key']>('me');
  const [slot, setSlot] = useState<Slot>('skin');
  const [pick, setPick] = useState<string | null>(null);
  const look = currentLook(data);
  const balance = seedsBalance(data);
  const picked = pick ? itemById(pick) : undefined;
  const shown = picked ? { ...look, [picked.slot]: picked.id } : look;
  const items = itemsIn(slot);
  const grp = SLOT_GROUPS.find((g) => g.key === group)!;
  const worn = armorWorn(look);
  const set = completedSet(look);
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
    } else if (r.reason === 'funds') showToast('Not enough seeds yet — every review plants more.');
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
            <h1 class="grow" style={{ margin: 0 }}>Your avatar</h1>
            <span class="chip seeds-chip" data-testid="seeds-balance" aria-label={`${balance} seeds`}>
              🌱 {balance}
            </span>
          </div>

          <div class="card center stack avatar-stage">
            <AvatarFigure look={shown} size={200} title="Your knight" />
            <div class="armor-meter" data-testid="armor-meter">
              <strong>
                {set ? `${set.name} — set complete` : worn === ARMOR_SLOTS.length ? 'Full armor of God' : `Armor of God: ${worn} of ${ARMOR_SLOTS.length}`}
              </strong>
              <span class="armor-pips" aria-hidden="true">
                {ARMOR_SLOTS.map((s) => (
                  <i key={s} class={look[s].endsWith('-none') ? '' : 'on'} />
                ))}
              </span>
            </div>
            {set && (
              <p class="muted small" style={{ margin: 0 }} data-testid="set-tagline">
                {set.tagline}
              </p>
            )}
            <p class="muted small" style={{ margin: 0 }}>
              Looking like yourself is always free. Armor, capes and companions come from seeds (1 per review, 5 for a finished day, 25 when a verse
              moves up) or from long streaks. Seeds are never taken away.
            </p>
          </div>

          <div class="seg" role="group" aria-label="Part of the avatar">
            {SLOT_GROUPS.map((g) => (
              <button
                key={g.key}
                aria-pressed={g.key === group}
                onClick={() => {
                  setGroup(g.key);
                  setSlot(g.slots[0]);
                  setPick(null);
                }}
                data-testid={`group-${g.key}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div class="slot-chips" role="group" aria-label="What to change">
            {grp.slots.map((s) => (
              <button key={s} aria-pressed={s === slot} class={`chip-btn ${s === slot ? 'on' : ''}`} onClick={() => (setSlot(s), setPick(null))} data-testid={`slot-${s}`}>
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>
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
                  <AvatarFigure look={{ ...look, [item.slot]: item.id }} size={72} view={group === 'me' || slot === 'helmet' || slot === 'crown' ? 'face' : 'full'} />
                  <span class="item-name">{item.name}</span>
                  <small class="muted">
                    {item.rarity ? `${item.rarity} · ` : ''}
                    {isWorn ? 'Wearing' : have ? 'Owned' : lockedItem ? `🔒 ${describeUnlock((item.unlock ?? item.requires)!).replace('Reach a ', '').replace(' streak', '')}${item.cost ? ` + 🌱 ${item.cost}` : ''}` : `🌱 ${item.cost}`}
                  </small>
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
              {gated ? `${picked.name}: ${describeUnlock(picked.requires!).toLowerCase()} first, then it costs 🌱 ${picked.cost}.` : `${picked.name}: ${describeUnlock(picked.unlock!)}.`}
            </p>
          ) : canBuy ? (
            <button class="btn primary block" onClick={buy} disabled={balance < picked.cost} data-testid="buy">
              {balance < picked.cost ? `${picked.name} · 🌱 ${picked.cost} (need ${picked.cost - balance} more)` : `Get ${picked.name} · 🌱 ${picked.cost}`}
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
