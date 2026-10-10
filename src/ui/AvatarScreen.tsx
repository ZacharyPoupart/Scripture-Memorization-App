import { useState } from 'preact/hooks';
import { currentLook, describeUnlock, isUnlocked, itemsIn, itemById, owns, seedsBalance, SLOTS, SLOT_LABELS, type Item, type Slot } from '../core/avatar.ts';
import { back } from '../router.ts';
import { buyAndWear, showToast, useApp, wearItem } from '../store.ts';
import { AvatarFigure } from './AvatarFigure.tsx';
import { Icon } from './common.tsx';

/** Your avatar: try things on, spend seeds, wear what you own. Seeds only ever come from reviewing. */
export function AvatarScreen() {
  const { data } = useApp();
  const [slot, setSlot] = useState<Slot>('outfit');
  const [pick, setPick] = useState<string | null>(null);
  const look = currentLook(data);
  const balance = seedsBalance(data);
  const picked = pick ? itemById(pick) : undefined;
  const shown = picked ? { ...look, [picked.slot]: picked.id } : look;
  const items = itemsIn(slot);

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

  const locked = !!picked && !!picked.unlock && !isUnlocked(data, picked);
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
            <AvatarFigure look={shown} size={168} title="Your avatar" />
            <p class="muted small" style={{ margin: 0 }}>
              Seeds come from reviewing: 1 per review, 5 for a finished day, 25 when a verse moves up. They are never taken away.
            </p>
          </div>

          <div class="slot-chips" role="tablist" aria-label="What to change">
            {SLOTS.map((s) => (
              <button key={s} role="tab" aria-selected={s === slot} class={`chip-btn ${s === slot ? 'on' : ''}`} onClick={() => (setSlot(s), setPick(null))} data-testid={`slot-${s}`}>
                {SLOT_LABELS[s]}
              </button>
            ))}
          </div>

          <div class="item-grid" data-testid="item-grid">
            {items.map((item) => {
              const have = owns(data, item);
              const worn = look[item.slot] === item.id;
              const lockedItem = !!item.unlock && !have;
              return (
                <button
                  key={item.id}
                  class={`item-tile ${worn ? 'worn' : ''} ${pick === item.id ? 'picked' : ''} ${have ? '' : 'unowned'}`}
                  onClick={() => choose(item)}
                  data-testid={`item-${item.id}`}
                  aria-pressed={worn || pick === item.id}
                >
                  <AvatarFigure look={{ ...look, [item.slot]: item.id }} size={64} />
                  <span class="item-name">{item.name}</span>
                  <small class="muted">{worn ? 'Wearing' : have ? 'Owned' : lockedItem ? 'Earn it' : `🌱 ${item.cost}`}</small>
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
              {picked.name}: {describeUnlock(picked.unlock!)}.
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
