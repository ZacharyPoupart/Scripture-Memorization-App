// The knight as a companion (v1.75.0, owner-requested): a small pixel portrait and a speech bubble with one warm line from
// core/voice.ts. `mood` picks how he moves: idle breathes, cheer hops. Reduced motion keeps him still.
import type { ComponentChildren } from 'preact';
import type { Look } from '../core/avatar.ts';
import { AvatarFigure } from './AvatarFigure.tsx';

export function KnightSays({ look, line, mood = 'idle', onTap, size = 60, testid = 'knight-says', children }: { look: Look; line: string; mood?: 'idle' | 'cheer'; onTap?: () => void; size?: number; testid?: string; children?: ComponentChildren }) {
  const portrait = (
    <span class={`knight-portrait ${mood}`} aria-hidden="true">
      <AvatarFigure look={look} size={size} view="face" />
    </span>
  );
  return (
    <div class={`knight-says ${mood}`} data-testid={testid}>
      {onTap ? (
        <button class="knight-tap" onClick={onTap} aria-label="Open your knight">
          {portrait}
        </button>
      ) : (
        portrait
      )}
      {/* keyed by the line, so a new line pops in again */}
      <p class="knight-bubble" key={line} data-testid={`${testid}-line`}>
        {line}
        {children}
      </p>
    </div>
  );
}
