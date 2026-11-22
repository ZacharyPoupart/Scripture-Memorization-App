// The knight's rank (v1.87.0, owner-requested knight theme): Page to Legend, earned by medals held (`rankFor` in core/achievements.ts).
import { achievementStates, medalTally, rankFor } from '../core/achievements.ts';
import { useApp } from '../store.ts';

/** The rank held now and the next one, from the same count of medals Honors shows. */
export function useRank() {
  const { data, settings } = useApp();
  const held = medalTally(achievementStates({ data, now: Date.now(), gameBest: settings.gameBest }, settings.seenAchievements ?? [])).held;
  return { held, ...rankFor(held) };
}

/** "Knight · Captain at 9 medals": the rank in serif, the way to the next one quietly after it. */
export function RankLine({ testid }: { testid: string }) {
  const r = useRank();
  return (
    <p class="rank-line" data-testid={testid} data-rank={r.name}>
      <span class="rank-kicker">Rank</span> <b>{r.name}</b>
      <span class="muted">{r.next ? ` · ${r.next.name} at ${r.next.at} medals` : ' · every medal won'}</span>
    </p>
  );
}
