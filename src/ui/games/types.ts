import type { Look } from '../../core/avatar.ts';
import type { Verse } from '../../core/types.ts';

/** How a game ended: won or not, the slips (for `gameCounts`) and the score (for personal bests). */
export interface Outcome {
  won: boolean;
  slips: number;
  score: number;
}

export interface GameProps {
  verse: Verse;
  seed: number;
  look: Look;
  backdrop?: Record<string, string>;
  onDone: (r: Outcome) => void;
}
