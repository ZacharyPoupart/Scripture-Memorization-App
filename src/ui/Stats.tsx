import { formatRef } from '../core/reference.ts';
import { EmptyState, Section, Stat } from './primitives.tsx';
import { streakInfo } from '../core/schedule.ts';
import { bestRuns, heatmap, nextGraduations, pileCounts, totals } from '../core/stats.ts';
import { navigate } from '../router.ts';
import { useApp } from '../store.ts';
import { PILE_INFO, progressUnitPlural } from './common.tsx';

const WEEKS = 26;
const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function Stats() {
  const { data } = useApp();
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

  if (!t.verses && !t.daysPracticed) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1>Progress</h1>
          <EmptyState mark="sprout" title="Your progress will grow here" testid="stats-empty">
            <button class="btn primary" onClick={() => navigate('/add')}>Add a verse</button>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div class="scroll">
      <div class="narrow stack" data-testid="stats">
        <h1>Progress</h1>

        <div class="stat-hero">
          <Stat big value={streak.count} label={streak.count === 1 ? 'day streak' : 'day streak'} testid="stat-streak" />
          <div class="stat-aside">
            <Stat value={streak.longest} label="longest streak" testid="stat-longest" />
            <Stat value={t.reviews} label="reviews completed" testid="stat-reviews" />
            <Stat value={t.verses} label={`verses, ${t.memorizedYearly} kept for life`} testid="stat-verses" />
          </div>
        </div>

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
