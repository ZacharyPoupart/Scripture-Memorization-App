import { useState } from 'preact/hooks';
import { filterVerses, sortVerses, topicsOf } from '../core/organize.ts';
import { pileVerses, verseStatus } from '../core/schedule.ts';
import { PILES, type Pile } from '../core/types.ts';
import { back, navigate } from '../router.ts';
import { useApp } from '../store.ts';
import { GearLink, Icon, PILE_INFO, Seg, VerseCard } from './common.tsx';
import { filtersActive, ListControls, useListState } from './ListControls.tsx';
import { ModePicker } from './ModePicker.tsx';

export function PilesOverview() {
  const { data } = useApp();
  const now = Date.now();
  const [list, update] = useListState();
  const topics = topicsOf(data);
  const shown = PILES.map((p) => ({ pile: p, vs: sortVerses(filterVerses(pileVerses(data, p), list, data, now), list.sort, data, now) }));
  const total = shown.reduce((n, g) => n + g.vs.length, 0);
  return (
    <div class="scroll">
      <div class="narrow stack">
        <div class="row spread">
          <h1>All verses</h1>
          <span class="row">
            <button class="btn small" onClick={() => navigate('/add')} data-testid="add-verse">
              + Add verse
            </button>
            <GearLink />
          </span>
        </div>
        <ListControls state={list} update={update} topics={topics} />
        {filtersActive(list) && (
          <div class="row spread small muted" role="status" data-testid="match-count">
            <span>
              {total} verse{total === 1 ? '' : 's'} match
            </span>
            <button class="btn ghost small" onClick={() => update({ query: '', ready: false, topic: '' })}>
              Clear filters
            </button>
          </div>
        )}
        {filtersActive(list) && total === 0 && (
          <div class="card center muted" data-testid="no-matches">
            Nothing matches. Try fewer words, or clear the filters.
          </div>
        )}
        {shown.map(({ pile: p, vs }) => (
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
              {!vs.length && !filtersActive(list) && <div class="muted small">No verses here yet.</div>}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function PilePage({ pile }: { pile: Pile }) {
  const { data, settings } = useApp();
  const now = Date.now();
  const [scope, setScope] = useState<'due' | 'all'>('due');
  const [list, update] = useListState();
  const all = pileVerses(data, pile);
  const vs = sortVerses(filterVerses(all, list, data, now), list.sort, data, now);
  const statuses = new Map(all.map((v) => [v.id, verseStatus(data, v, now)]));
  const ready = all.filter((v) => statuses.get(v.id)!.state === 'ready').length;
  const count = scope === 'due' ? ready : all.length;
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
          {all.length > 0 && (
            <div class="card stack">
              <h2>Review this pile</h2>
              <ModePicker />
              <Seg
                label="Which verses"
                value={scope}
                options={[
                  { value: 'due', label: `Only due (${ready})` },
                  { value: 'all', label: `All (${all.length})` },
                ]}
                onChange={setScope}
              />
              {scope === 'all' && (
                <div class="hint-text">Extra practice beyond what's due is welcome — it just doesn't count toward the schedule.</div>
              )}
            </div>
          )}
          {all.length > 1 && <ListControls state={list} update={update} topics={topicsOf(data)} />}
          <div class="list">
            {vs.map((v) => (
              <VerseCard key={v.id} data={data} verse={v} now={now} status={statuses.get(v.id)!} />
            ))}
            {!vs.length && all.length > 0 && filtersActive(list) && (
              <div class="card center muted" data-testid="no-matches">
                Nothing matches.{' '}
                <button class="btn ghost small" onClick={() => update({ query: '', ready: false, topic: '' })}>
                  Clear filters
                </button>
              </div>
            )}
            {!all.length && (
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
      {all.length > 0 && (
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
