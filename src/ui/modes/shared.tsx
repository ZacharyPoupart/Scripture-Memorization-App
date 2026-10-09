import type { ComponentChildren } from 'preact';
import type { Verse } from '../../core/types.ts';
import { mistakesAllowed } from '../../core/quiz.ts';

export interface ModeProps {
  verse: Verse;
  /** Report a mistake. Returns true when that was one too many (the attempt restarts). */
  onMistake: (n?: number) => boolean;
  onDone: () => void;
  onRestart: () => void;
  mistakes: number;
  /** Reference recall: skip the typed reference and ask only the topic (modes that already asked for the reference). */
  topicOnly?: boolean;
}

export function MistakeDots({ verse, mistakes }: { verse: Verse; mistakes: number }) {
  const allowed = mistakesAllowed(verse.pile);
  if (allowed === 0) return <div class="mistakes">Perfect recall needed — no mistakes allowed</div>;
  return (
    <div class="mistakes" aria-label={`${mistakes} of ${allowed} mistakes used`} data-testid="mistakes">
      {Array.from({ length: allowed }, (_, i) => (
        <span key={i} class={`dot ${i < mistakes ? 'used' : ''}`} />
      ))}
      <span style={{ marginLeft: '6px' }}>{allowed} slips allowed</span>
    </div>
  );
}

export function Dock({ children }: { children: ComponentChildren }) {
  return (
    <div class="dock">
      <div class="dock-inner">{children}</div>
    </div>
  );
}
