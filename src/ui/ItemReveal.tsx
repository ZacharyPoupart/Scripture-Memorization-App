import { useEffect } from 'preact/hooks';
import { freshUnlocks, itemById, owns, sceneUrl, unlockedIds, currentLook } from '../core/avatar.ts';
import { feedback } from '../services/feedback.ts';
import { dismissReveal, queueReveal, updateSettings, useApp, wearItem } from '../store.ts';
import { armorUrl } from './ArmorArt.tsx';
import { CloseX } from './common.tsx';

/**
 * "You got something new": the item is set in the middle of the screen on a flat plate, with its name under a rule. Shows after buying an
 * item and when an achievement item (the sword, the shield) is earned. Never during the tour or a review.
 */
export function ItemReveal({ suppressed }: { suppressed: boolean }) {
  const { data, settings, reveals, sandbox, celebrating } = useApp();

  // notice achievement items that were just earned (the first time it only remembers what you already had)
  useEffect(() => {
    if (sandbox || suppressed) return;
    if (settings.seenUnlocks === null) {
      updateSettings({ seenUnlocks: unlockedIds(data) });
      return;
    }
    const fresh = freshUnlocks(data, settings.seenUnlocks);
    if (!fresh.length) return;
    updateSettings({ seenUnlocks: [...settings.seenUnlocks, ...fresh] });
    fresh.forEach(queueReveal);
  }, [data, settings.seenUnlocks, sandbox, suppressed]);

  const id = reveals[0];
  const item = id && !suppressed && !celebrating ? itemById(id) : undefined;
  useEffect(() => {
    if (!item) return;
    feedback.milestone();
  }, [item?.id]);
  if (!item) {
    if (id && !suppressed && !itemById(id)) dismissReveal(); // something the app no longer knows
    return null;
  }

  const worn = currentLook(data)[item.slot] === item.id;
  const src = sceneUrl(item.id) ?? armorUrl(item.id);
  const close = () => dismissReveal();

  return (
    <div class="reveal-layer" role="dialog" aria-modal="true" aria-label={`New: ${item.name}`} onClick={close} data-testid="item-reveal" key={item.id}>
      <div class="reveal-x" onClick={(e) => e.stopPropagation()}>
        <CloseX onClick={close} testId="reveal-close" />
      </div>
      <div class="reveal-stage" onClick={(e) => e.stopPropagation()}>
        {src && (
          <div class="reveal-imgwrap" style={item.slot === 'weapon' ? { transform: 'rotate(180deg)' } : undefined}>
            <img class={`reveal-img ${item.slot === 'scene' ? 'scene' : ''}`} src={src} alt="" />
          </div>
        )}
      </div>
      <div class="reveal-text" onClick={(e) => e.stopPropagation()}>
        <div class="reveal-kicker">{item.unlock ? 'You earned' : 'You got'}</div>
        <h2 class="reveal-name" data-testid="reveal-name">
          {item.name}
        </h2>
        <div class="row reveal-actions">
          {!worn && owns(data, item) && (
            <button
              class="btn"
              onClick={() => {
                wearItem(item.id);
                close();
              }}
              data-testid="reveal-wear"
            >
              Wear it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
