// Word-by-word feedback for "Speak it": align what was heard with what was expected.
import { normalizeWord } from './text.ts';

export type WordResult = 'ok' | 'wrong' | 'missed' | 'pending';

function lev(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Speech recognizers fumble endings and spellings, so allow a small edit distance on longer words. */
export function wordsMatch(expected: string, heard: string): boolean {
  if (expected === heard) return true;
  const len = Math.max(expected.length, heard.length);
  if (len >= 8) return lev(expected, heard) <= 2;
  if (len >= 5) return lev(expected, heard) <= 1;
  return false;
}

export function tokenizeSpeech(transcript: string): string[] {
  return transcript
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean);
}

export interface Alignment {
  results: WordResult[];
  mistakes: number;
  /** Number of expected words reached so far. */
  progress: number;
}

/**
 * Align spoken words to the expected words (edit-distance alignment).
 * final=false: the speaker may not be finished, so unreached words stay 'pending'.
 * final=true: unreached words count as missed.
 */
export function alignSpeech(expected: string[], spoken: string[], final: boolean): Alignment {
  const n = expected.length;
  const m = spoken.length;
  const INF = 1e9;
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  const back: ('d' | 'i' | 's' | 'm' | null)[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  cost[0][0] = 0;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      if (i === 0 && j === 0) continue;
      let best = INF;
      let op: 'd' | 'i' | 's' | 'm' | null = null;
      if (i > 0 && j > 0) {
        const eq = wordsMatch(expected[i - 1], spoken[j - 1]);
        const c = cost[i - 1][j - 1] + (eq ? 0 : 1);
        if (c < best) (best = c), (op = eq ? 'm' : 's');
      }
      if (i > 0 && cost[i - 1][j] + 1 < best) (best = cost[i - 1][j] + 1), (op = 'd'); // expected word skipped
      if (j > 0 && cost[i][j - 1] + 1 < best) (best = cost[i][j - 1] + 1), (op = 'i'); // extra spoken word
      cost[i][j] = best;
      back[i][j] = op;
    }
  }
  // Where does the alignment end? Final: consume everything. Live: best prefix of the expected words.
  let endI = n;
  if (!final) {
    let bestScore = INF;
    for (let i = 0; i <= n; i++) {
      // prefer reaching further when costs tie
      if (cost[i][m] <= bestScore) (bestScore = cost[i][m]), (endI = i);
    }
  }
  const results: WordResult[] = new Array(n).fill(final ? 'missed' : 'pending');
  let i = endI;
  let j = m;
  while (i > 0 || j > 0) {
    const op = back[i][j];
    if (op === 'm') results[i - 1] = 'ok', i--, j--;
    else if (op === 's') results[i - 1] = 'wrong', i--, j--;
    else if (op === 'd') results[i - 1] = 'missed', i--;
    else if (op === 'i') j--;
    else break;
  }
  if (!final) {
    // words before the last confirmed one that were skipped are real misses; the rest are pending
    for (let k = endI; k < n; k++) results[k] = 'pending';
  }
  const mistakes = results.filter((r) => r === 'wrong' || r === 'missed').length;
  return { results, mistakes, progress: endI };
}
