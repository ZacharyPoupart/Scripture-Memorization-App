import { useState } from 'preact/hooks';
import { newSim, simAdvance, simReview, simView } from '../../core/tourSim.ts';
import { PileBadge } from '../common.tsx';

/** "Watch it happen": one verse on the real schedule rules, at a pretend date. Nothing here touches your own data. */
export function TourSim() {
  const [sim, setSim] = useState(newSim);
  const v = simView(sim);
  return (
    <div class="tour-sim stack" style={{ '--gap': '8px' } as never} data-testid="tour-sim">
      <div class="row spread">
        <PileBadge pile={v.pile} />
        <b data-testid="sim-progress">{v.progress}</b>
      </div>
      <div class="muted small" data-testid="sim-status">
        {v.date} · {v.status}
      </div>
      <div class="row wrap" style={{ gap: '6px' }}>
        <button class="btn small primary" disabled={!v.canReview} onClick={() => setSim(simReview(sim))} data-testid="sim-review">
          Review it
        </button>
        <button class="btn small" onClick={() => setSim(simAdvance(sim, 1, false))} data-testid="sim-next">
          Next day
        </button>
        <button class="btn small" onClick={() => setSim(simAdvance(sim, 7, true))} data-testid="sim-week">
          A week, reviewed
        </button>
        <button class="btn small" onClick={() => setSim(simAdvance(sim, 7, false))} data-testid="sim-skip">
          A week, skipped
        </button>
        <button class="btn small ghost" onClick={() => setSim(newSim())} data-testid="sim-reset">
          Start over
        </button>
      </div>
      {sim.log.length > 0 && (
        <ul class="tour-sim-log small muted" aria-live="polite" data-testid="sim-log">
          {sim.log.slice(-4).map((l, i) => (
            <li key={`${sim.log.length}-${i}`}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
