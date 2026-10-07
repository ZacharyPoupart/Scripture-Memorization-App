import { useState } from 'preact/hooks';
import { pileVerses, verseStatus } from '../core/schedule.ts';
import { PILES, type Pile } from '../core/types.ts';
import { back, navigate } from '../router.ts';
import { useApp } from '../store.ts';
import { Icon, PILE_INFO, Seg, VerseCard } from './common.tsx';
import { ModePicker } from './ModePicker.tsx';

export function PilesOverview() {
  const { data } = useApp();
  const now = Date.now();
  const [topic, setTopic] = useState('');
  const topics = [
    ...new Set(
      Object.values(data.verses)
        .filter((v) => !v.deletedAt && v.topic)
        .map((v) => v.topic),
    ),
  ].sort();
  return (
    <div class="scroll">
      <div class="narrow stack">
        <h1>All verses</h1>
        {topics.length > 0 && (
          <div class="row wrap" role="group" aria-label="Filter by topic">
            <button
              class="chip"
              aria-pressed={topic === ''}
              style={{ border: 0, background: topic === '' ? 'var(--accent)' : undefined, color: topic === '' ? 'var(--on-accent)' : undefined }}
              onClick={() => setTopic('')}
            >
              All
            </button>
            {topics.map((t) => (
              <button
                key={t}
                class="chip"
                aria-pressed={topic === t}
                style={{ border: 0, background: topic === t ? 'var(--accent)' : undefined, color: topic === t ? 'var(--on-accent)' : undefined }}
                onClick={() => setTopic(t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
        {PILES.map((p) => {
          const vs = pileVerses(data, p).filter((v) => !topic || v.topic === topic);
          return (
            <section key={p} class={`pile-${p}`}>
              <div class="row spread" style={{ marginBottom: '8px' }}>
                <h2>
                  {PILE_INFO[p].label} <span class="muted">({vs.length})</span>
                </h2>
                <a class="small" href={`#/pile/${p}`}>
                  Open
                </a>
              </div>
              <div class="list">
                {vs.map((v) => (
                  <VerseCard key={v.id} data={data} verse={v} now={now} status={verseStatus(data, v, now)} />
                ))}
                {!vs.length && <div class="muted small">No verses here.</div>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function PilePage({ pile }: { pile: Pile }) {
  const { data, settings } = useApp();
  const now = Date.now();
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const vs = pileVerses(data, pile);
  const statuses = new Map(vs.map((v) => [v.id, verseStatus(data, v, now)]));
  const ready = vs.filter((v) => statuses.get(v.id)!.state === 'ready').length;
  const count = scope === 'due' ? ready : vs.length;
  return (
    <>
      <div class="scroll">
        <div class={`narrow stack pile-${pile}`}>
          <div class="page-head">
            <button class="icon-btn" aria-label="Back" onClick={() => back('/')}>
              <Icon name="back" />
            </button>
            <h1>{PILE_INFO[pile].label}</h1>
          </div>
          <p class="muted" style={{ marginTop: '-8px' }}>
            {PILE_INFO[pile].blurb} Longest-held verses are at the top.
          </p>
          {vs.length > 0 && (
            <div class="card stack">
              <h2>Review this pile</h2>
              <ModePicker />
              <Seg
                label="Which verses"
                value={scope}
                options={[
                  { value: 'due', label: `Only due (${ready})` },
                  { value: 'all', label: `All (${vs.length})` },
                ]}
                onChange={setScope}
              />
              {scope === 'all' && (
                <div class="hint-text">Extra practice beyond what's due is welcome — it just doesn't count toward the schedule.</div>
              )}
            </div>
          )}
          <div class="list">
            {vs.map((v) => (
              <VerseCard key={v.id} data={data} verse={v} now={now} status={statuses.get(v.id)!} />
            ))}
            {!vs.length && (
              <div class="card center muted">
                No verses in {PILE_INFO[pile].label} yet.
                {pile === 'daily' && (
                  <div style={{ marginTop: '10px' }}>
                    <button class="btn primary" onClick={() => navigate('/add')}>
                      Add a verse
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {vs.length > 0 && (
        <div class="action-bar">
          <button
            class="btn primary block"
            disabled={count === 0}
            onClick={() => navigate(`/review?pile=${pile}&scope=${scope}&mode=${settings.defaultMode}`)}
            data-testid="start-pile"
          >
            {count === 0 ? 'Nothing due in this pile' : `Start · ${count} verse${count === 1 ? '' : 's'}`}
          </button>
        </div>
      )}
    </>
  );
}
