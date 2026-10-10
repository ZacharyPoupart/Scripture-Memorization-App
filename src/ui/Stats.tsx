import { formatRef } from "../core/reference.ts";
import { streakInfo } from "../core/schedule.ts";
import {
  bestRuns,
  heatmap,
  nextGraduations,
  pileCounts,
  totals,
} from "../core/stats.ts";
import { navigate } from "../router.ts";
import { useApp } from "../store.ts";
import { PILE_INFO } from "./common.tsx";

const WEEKS = 26;
const fmt = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export function Stats() {
  const { data } = useApp();
  const now = Date.now();
  const streak = streakInfo(data, now);
  const t = totals(data);
  const cols = heatmap(data, now, WEEKS);
  const cells = cols.flat().filter((c) => !c.future);
  const complete = cells.filter((c) => c.kind === "complete").length;
  const practiced = cells.filter((c) => c.kind === "practiced").length;
  const piles = pileCounts(data);
  const maxPile = Math.max(1, ...piles.map((p) => p.count));
  const near = nextGraduations(data, now, 3);
  const runs = bestRuns(data, now, 5);

  if (!t.verses && !t.daysPracticed) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1>Progress</h1>
          <div class="card center stack" data-testid="stats-empty">
            <div class="hero">🌱</div>
            <h2>Your progress will grow here</h2>
            <p class="muted" style={{ margin: 0 }}>
              Add a verse and start reviewing. Streaks, a calendar of your
              practice and how close each verse is to its next pile will show up
              on this page.
            </p>
            <button class="btn primary" onClick={() => navigate("/add")}>
              Add a verse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="scroll">
      <div class="narrow stack" data-testid="stats">
        <h1>Progress</h1>

        <div class="grid2">
          <div class="card stat" data-testid="stat-streak">
            <div class="stat-num">{streak.count}</div>
            <div class="muted small">
              Current streak{streak.count === 1 ? "" : ""} (days)
            </div>
          </div>
          <div class="card stat" data-testid="stat-longest">
            <div class="stat-num">{streak.longest}</div>
            <div class="muted small">Longest streak (days)</div>
          </div>
          <div class="card stat" data-testid="stat-reviews">
            <div class="stat-num">{t.reviews}</div>
            <div class="muted small">Reviews completed</div>
          </div>
          <div class="card stat" data-testid="stat-verses">
            <div class="stat-num">{t.verses}</div>
            <div class="muted small">
              Verses ({t.memorizedYearly} kept for life)
            </div>
          </div>
        </div>

        <div class="card stack">
          <h2>Your practice</h2>
          <p class="sr-only" data-testid="heat-summary">
            In the last {WEEKS} weeks: {complete} days with everything done,{" "}
            {practiced} other days practiced.
          </p>
          <div class="heat-wrap" aria-hidden="true">
            <div class="heat-days">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div
              class="heat"
              data-testid="heatmap"
              style={{
                gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))`,
              }}
            >
              {cols.map((col, w) =>
                col.map((c) => (
                  <i
                    key={`${w}-${c.day}`}
                    class={`cell k-${c.future ? "future" : c.kind}`}
                    title={`${fmt(c.day)}: ${c.future ? "" : c.kind === "complete" ? "all done" : c.kind === "practiced" ? "practiced" : "no practice"}`}
                  />
                )),
              )}
            </div>
          </div>
          <div class="row small muted heat-legend">
            <span>
              <i class="cell k-none" /> Rest
            </span>
            <span>
              <i class="cell k-practiced" /> Practiced
            </span>
            <span>
              <i class="cell k-complete" /> All done
            </span>
            <span class="grow" />
            <span data-testid="heat-counts">
              {complete} all-done · {practiced} practiced
            </span>
          </div>
        </div>

        {near.length > 0 && (
          <div class="card stack">
            <h2>Nearly there</h2>
            {near.map((n) => (
              <button
                key={n.verse.id}
                class={`row nearly pile-${n.verse.pile}`}
                onClick={() => navigate(`/verse/${n.verse.id}`)}
                data-testid="nearly"
              >
                <span class="grow" style={{ textAlign: "left" }}>
                  <strong>{formatRef(n.verse)}</strong>
                  <span class="muted small" style={{ display: "block" }}>
                    {n.remaining === 0
                      ? `Ready to move to ${PILE_INFO[n.to].label}`
                      : `${n.remaining} day${n.remaining === 1 ? "" : "s"} to ${PILE_INFO[n.to].label}`}
                  </span>
                  <span
                    class="bar"
                    style={{ display: "block", marginTop: "6px" }}
                  >
                    <i
                      style={{
                        width: `${Math.round((n.earned / n.target) * 100)}%`,
                      }}
                    />
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div class="card stack">
          <h2>Verses in each pile</h2>
          {piles.map((p) => (
            <div
              key={p.pile}
              class={`pile-${p.pile}`}
              data-testid={`pile-stat-${p.pile}`}
            >
              <div class="row spread small">
                <span>{PILE_INFO[p.pile].label}</span>
                <strong>{p.count}</strong>
              </div>
              <div class="bar" style={{ marginTop: "4px" }}>
                <i style={{ width: `${(p.count / maxPile) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div class="card stack">
          <h2>Streak history</h2>
          {runs.length === 0 && (
            <p class="muted small" style={{ margin: 0 }}>
              Streaks of two days or more will be listed here.
            </p>
          )}
          {runs.map((r) => (
            <div key={r.start} class="row spread" data-testid="run">
              <span>
                {fmt(r.start)} – {fmt(r.end)}
              </span>
              <strong>{r.length} days</strong>
            </div>
          ))}
          <p class="muted small" style={{ margin: 0 }}>
            {t.completeDays} day{t.completeDays === 1 ? "" : "s"} with
            everything done · {t.daysPracticed} day
            {t.daysPracticed === 1 ? "" : "s"} practiced.
          </p>
        </div>
      </div>
    </div>
  );
}
