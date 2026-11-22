import { achievementStates, medalTally, TIER_LABEL } from '../core/achievements.ts';
import { MEDAL_COINS } from '../core/coins.ts';
import { formatRef } from '../core/reference.ts';
import { Medal } from './Medal.tsx';
import { RankLine } from './Rank.tsx';
import { EmptyState, Section, Stat } from './primitives.tsx';
import { streakInfo } from '../core/schedule.ts';
import { bestRuns, heatmap, nextGraduations, pileCounts, totals } from '../core/stats.ts';
import { navigate } from '../router.ts';
import { useApp } from '../store.ts';
import { PILE_INFO, progressUnitPlural } from './common.tsx';

const WEEKS = 26;
const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function Stats() {
  const { data, settings } = useApp();
  const now = Date.now();
  const streak = streakInfo(data, now);
  const t = totals(data);
  const cols = heatmap(data, now, WEEKS);
  const cells = cols.flat().filter((c) => !c.future);
  const full = cells.filter((c) => c.kind === 'full').length;
  const complete = cells.filter((c) => c.kind === 'complete').length;
  const practiced = cells.filter((c) => c.kind === 'practiced').length;
  const saved = cells.filter((c) => c.kind === 'saved').length;
  const piles = pileCounts(data);
  const maxPile = Math.max(1, ...piles.map((p) => p.count));
  const near = nextGraduations(data, now, 3);
  const runs = bestRuns(data, now, 5);
  const medals = achievementStates({ data, now, gameBest: settings.gameBest }, settings.seenAchievements ?? []);
  const tally = medalTally(medals);

  if (!t.verses && !t.daysPracticed) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1>Honors</h1>
          <EmptyState mark="sprout" title="Your honors will be won here" testid="stats-empty">
            <button class="btn primary" onClick={() => navigate('/add')}>Add a verse</button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div class="scroll">
      <div class="narrow stack" data-testid="stats">
        <h1>Honors</h1>

        <div class="stat-hero">
          <Stat big value={streak.count} label={streak.count === 1 ? 'day streak' : 'day streak'} testid="stat-streak" />
          <div class="stat-aside">
            <Stat value={streak.longest} label="longest streak" testid="stat-longest" />
            <Stat value={t.reviews} label="reviews completed" testid="stat-reviews" />
            <Stat value={t.verses} label={`verses, ${t.memorizedYearly} kept for life`} testid="stat-verses" />
          </div>
        </div>

        <Section title="Medals" aside={<span data-testid="medal-tally">{tally.held} of {tally.total}</span>} testid="achievements">
          <RankLine testid="rank" />
          <ul class="medal-list">
            {medals.map((m) => (
              <li key={m.achievement.id} class="medal-row" data-testid="achievement" data-id={m.achievement.id} data-tier={m.tier ?? 'none'}>
                <Medal achievement={m.achievement} tier={m.tier} size={44} />
                <div class="medal-text">
                  <div class="row spread">
                    <strong>{m.achievement.name}</strong>
                    <span class={`medal-tier ${m.tier ?? ''}`}>{m.tier ? TIER_LABEL[m.tier] : ''}</span>
                  </div>
                  {m.next ? (
                    <>
                      <div class="muted small">
                        {TIER_LABEL[m.next.tier]}: {m.achievement.ask(m.next.at)} · {Math.min(m.count, m.next.at).toLocaleString()} of {m.next.at.toLocaleString()}
                        {settings.avatarOn ? ` · +${MEDAL_COINS[m.next.tier]} coins` : ''}
                      </div>
                      <div class={`bar medal-bar ${m.next.tier}`} role="img" aria-label={`${Math.round(m.progress * 100)}% of the way to ${TIER_LABEL[m.next.tier]}`}>
                        <i style={{ width: `${m.progress * 100}%` }} />
                      </div>
                    </>
                  ) : (
                    <div class="muted small">All three medals: {m.achievement.ask(m.achievement.at[2]).toLowerCase()}.</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Your practice">
          <p class="sr-only" data-testid="heat-summary">
            In the last {WEEKS} weeks: {full} full days, {complete} days with every verse reviewed, {practiced} other days practiced{saved ? `, ${saved} streak ${saved === 1 ? 'save' : 'saves'} used` : ''}.
          </p>
          <div class="heat-wrap" aria-hidden="true">
            <div class="heat-days">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div class="heat" data-testid="heatmap" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
              {cols.map((col, w) =>
                col.map((c) => <i key={`${w}-${c.day}`} class={`cell k-${c.future ? 'future' : c.kind}`} title={`${fmt(c.day)}: ${c.future ? '' : c.kind === 'full' ? 'full day' : c.kind === 'complete' ? 'all done' : c.kind === 'practiced' ? 'practiced' : c.kind === 'saved' ? 'streak saved' : 'no practice'}`} />),
              )}
            </div>
          </div>
          <div class="row small muted heat-legend">
            <span><i class="cell k-none" /> Rest</span>
            <span><i class="cell k-practiced" /> Practiced</span>
            <span><i class="cell k-complete" /> All done</span>
            <span><i class="cell k-full" /> Full day</span>
            {saved > 0 && (
              <span data-testid="heat-saved">
                <i class="cell k-saved" /> Streak saved
              </span>
            )}
            <span class="grow" />
            <span data-testid="heat-counts">{full} full · {complete} all-done · {practiced} practiced</span>
          </div>
        </Section>

        {near.length > 0 && (
          <Section title="Nearly there">
            {near.map((n) => (
              <button key={n.verse.id} class={`row nearly pile-${n.verse.pile}`} onClick={() => navigate(`/verse/${n.verse.id}`)} data-testid="nearly">
                <span class="grow" style={{ textAlign: 'left' }}>
                  <strong>{formatRef(n.verse)}</strong>
                  <span class="muted small" style={{ display: 'block' }}>
                    {n.remaining === 0 ? `Ready to move to ${PILE_INFO[n.to].label}` : `${n.remaining} ${n.remaining === 1 ? progressUnitPlural(n.verse.pile).slice(0, -1) : progressUnitPlural(n.verse.pile)} to ${PILE_INFO[n.to].label}`}
                  </span>
                  <span class="bar block mt-2">
                    <i style={{ width: `${Math.round((n.earned / n.target) * 100)}%` }} />
                  </span>
                </span>
              </button>
            ))}
          </Section>
        )}

        <Section title="Verses in each pile">
          {piles.map((p) => (
            <div key={p.pile} class={`pile-${p.pile}`} data-testid={`pile-stat-${p.pile}`}>
              <div class="row spread small">
                <span>{PILE_INFO[p.pile].label}</span>
                <strong>{p.count}</strong>
              </div>
              <div class="bar mt-1">
                <i style={{ width: `${(p.count / maxPile) * 100}%` }} />
              </div>
            </div>
          ))}
        </Section>

        <Section title="Streak history">
          {runs.map((r) => (
            <div key={r.start} class="row spread" data-testid="run">
              <span>
                {fmt(r.start)} – {fmt(r.end)}
              </span>
              <strong>{r.length} days</strong>
            </div>
          ))}
          <p class="muted small" style={{ margin: 0 }}>
            {t.completeDays} day{t.completeDays === 1 ? '' : 's'} with everything done · {t.daysPracticed} day{t.daysPracticed === 1 ? '' : 's'} practiced.
          </p>
        </Section>
      </div>
    </div>
  );
}
