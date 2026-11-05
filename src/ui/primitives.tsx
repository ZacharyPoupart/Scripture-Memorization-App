import type { ComponentChildren } from 'preact';
import { Icon } from './common.tsx';
import { Mark, type MarkName } from './marks.tsx';

/** A small line of capitals above or beside a heading. */
export function Kicker({ children }: { children: ComponentChildren }) {
  return <p class="kicker">{children}</p>;
}

/** A titled part of a screen, set off by a rule instead of a box. `aside` sits at the right of the title line. */
export function Section({ title, aside, children, testid }: { title: ComponentChildren; aside?: ComponentChildren; children: ComponentChildren; testid?: string }) {
  return (
    <section class="section" data-testid={testid}>
      <header class="section-head">
        <h2>{title}</h2>
        {aside && <div class="section-aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** One figure with its label. Figures sit in a ruled row (`.stat-row`), not in boxes of their own. */
export function Stat({ value, label, testid, big }: { value: ComponentChildren; label: string; testid?: string; big?: boolean }) {
  return (
    <div class={`stat ${big ? 'stat-big' : ''}`} data-testid={testid}>
      <b class="stat-value">{value}</b>
      <span class="stat-label">{label}</span>
    </div>
  );
}

/** What a screen shows when there is nothing in it yet: a mark, a line, and the way forward. */
export function EmptyState({ mark, title, children, testid }: { mark: MarkName; title: string; children?: ComponentChildren; testid?: string }) {
  return (
    <div class="empty" data-testid={testid}>
      <Mark name={mark} size={52} />
      <h2 class="empty-title">{title}</h2>
      {children}
    </div>
  );
}

/** A full-width row you can press: the label on the left, an arrow on the right. Rows in a `<ul class="rows">` are separated by rules. */
export function ListRow({ children, onClick, testid, disabled }: { children: ComponentChildren; onClick: () => void; testid?: string; disabled?: boolean }) {
  return (
    <button type="button" class="list-row" onClick={onClick} disabled={disabled} data-testid={testid}>
      <span class="list-row-main">{children}</span>
      <Icon name="arrow" />
    </button>
  );
}
