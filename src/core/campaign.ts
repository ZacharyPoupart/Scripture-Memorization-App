// Campaign mode (v1.82.0, owner-requested): game after game, verse after verse, until you stop. The verses that are due come first
// (they count as their reviews and earn coins), in a random order, and then any of your verses at random as extra practice, round
// and round, never the same verse twice in a row; each in a random game, never the same game twice in a row. Pure: `random` is
// passed in, so tests can fix it.
import { GAMES, type GameId } from './games.ts';

export interface CampaignStep {
  verseId: string;
  game: GameId;
}

/** A copy of `ids` in a random order (Fisher-Yates). */
export function shuffle<T>(ids: readonly T[], random: () => number): T[] {
  const out = [...ids];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The game after `prev`: any game but that one. */
export function nextGame(prev: GameId | null, random: () => number): GameId {
  const pool = GAMES.map((g) => g.id).filter((id) => id !== prev);
  return pool[Math.floor(random() * pool.length)];
}

/**
 * The verses still to come: the due ones (`due`, still due right now) first in a random order, then every other verse in a random
 * order. When that runs out the caller asks again with `due` empty, and gets all the verses afresh; `last` (the verse just played)
 * never comes straight back, unless it is the only verse.
 */
export function campaignVerses(due: readonly string[], all: readonly string[], last: string | null, random: () => number): string[] {
  const dueSet = new Set(due);
  const first = shuffle(due.filter((id) => all.includes(id)), random);
  const rest = shuffle(all.filter((id) => !dueSet.has(id)), random);
  const order = [...first, ...rest];
  if (order.length > 1 && order[0] === last) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

/** What a campaign has done so far, for the pot and the payout at the end. */
export interface CampaignTally {
  played: number;
  won: number;
  counted: number;
  stars: number;
  score: number;
  /** Coins, before and after the multipliers, and the biggest multiplier seen (for the payout's slot machine). */
  seeds: number;
  base: number;
  multiplier: number;
}

export const emptyTally = (): CampaignTally => ({ played: 0, won: 0, counted: 0, stars: 0, score: 0, seeds: 0, base: 0, multiplier: 1 });

export function addToTally(
  t: CampaignTally,
  game: { won: boolean; stars: number; score: number },
  rec: { counted: boolean; seeds: number; base: number; multiplier: number } | null,
): CampaignTally {
  return {
    played: t.played + 1,
    won: t.won + (game.won ? 1 : 0),
    counted: t.counted + (rec?.counted ? 1 : 0),
    stars: t.stars + (game.won ? game.stars : 0),
    score: t.score + (game.won ? game.score : 0),
    seeds: t.seeds + (rec?.seeds ?? 0),
    base: t.base + (rec?.base ?? 0),
    multiplier: Math.max(t.multiplier, rec?.counted && rec.seeds > 0 ? rec.multiplier : 1),
  };
}
