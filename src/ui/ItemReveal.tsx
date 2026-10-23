import { useEffect, useRef } from 'preact/hooks';
import { freshUnlocks, itemById, owns, sceneUrl, unlockedIds, currentLook } from '../core/avatar.ts';
import { feedback } from '../services/feedback.ts';
import { dismissReveal, queueReveal, updateSettings, useApp, wearItem } from '../store.ts';
import { armorUrl } from './ArmorArt.tsx';

/** Twelve little sparkles round the item: where each one flies to and when it twinkles (fixed, so it looks the same every time). */
const SPARKLES = Array.from({ length: 12 }, (_, i) => ({ angle: i * 30 + (i % 2 ? 8 : -6), dist: 118 + (i % 3) * 22, delay: (i * 0.17) % 1.6, size: 6 + (i % 4) * 2 }));

/**
 * "You got something new": the item grows in the middle of the screen with a soft glow and a few sparkles. Shows after buying an
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
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!item) return;
    feedback.milestone();
    btn.current?.focus({ preventScroll: true });
  }, [item?.id]);
  if (!item) {
    if (id && !suppressed && !itemById(id)) dismissReveal(); // something the app no longer knows
    return null;
  }

  const worn = currentLook(data)[item.slot] === item.id;
  const src = sceneUrl(item.id) ?? armorUrl(item.id);
  const calm = settings.celebrations === 'calm';
  const close = () => dismissReveal();

  return (
    <div class={`reveal-layer ${calm ? 'calm' : ''}`} role="dialog" aria-modal="true" aria-label={`New: ${item.name}`} onClick={close} data-testid="item-reveal" key={item.id}>
      <div class="reveal-stage" onClick={(e) => e.stopPropagation()}>
        <div class="reveal-glow" aria-hidden="true" />
        {!calm && <div class="reveal-rays" aria-hidden="true" />}
        {!calm &&
          SPARKLES.map((s, i) => (
            <i key={i} class="reveal-sparkle" aria-hidden="true" style={{ '--a': `${s.angle}deg`, '--d': `${s.dist}px`, '--delay': `${s.delay}s`, '--s': `${s.size}px` } as never} />
          ))}
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
        <div class="row" style={{ justifyContent: 'center', gap: '10px' }}>
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
          <button ref={btn} class="btn primary" onClick={close} data-testid="reveal-close">
            {worn ? 'Nice' : 'Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
