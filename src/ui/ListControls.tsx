import { useState } from 'preact/hooks';
import { matchTopics, renameTopic, restoreTopics, SORT_LABELS, topicCounts, TOPIC_CHIPS_MAX, type SortKey } from '../core/organize.ts';
import { act, showToast, updateSettings, useApp } from '../store.ts';
import { Field, Overlay } from './common.tsx';

export interface ListState {
  query: string;
  sort: SortKey;
  ready: boolean;
  topic: string;
}

/** Search and filters are remembered while the app is open, so coming back from a verse keeps them. The sort is a device setting: it stays as you left it. */
let remembered: ListState = { query: '', sort: 'longest', ready: false, topic: '' };
export const useListState = (): [ListState, (p: Partial<ListState>) => void] => {
  const { settings } = useApp();
  const [state, setState] = useState<ListState>(remembered);
  const sort = (settings.listSort in SORT_LABELS ? settings.listSort : 'longest') as SortKey;
  return [
    { ...state, sort },
    (p) => {
      const { sort: chosen, ...rest } = p;
      if (chosen) updateSettings({ listSort: chosen });
      remembered = { ...remembered, ...rest };
      setState(remembered);
    },
  ];
};
export const filtersActive = (s: ListState) => !!(s.query || s.ready || s.topic);

export function ListControls({ state, update, topics }: { state: ListState; update: (p: Partial<ListState>) => void; topics: string[] }) {
  const { data } = useApp();
  const [renaming, setRenaming] = useState(false);
  const [picking, setPicking] = useState(false);
  const [find, setFind] = useState('');
  const [name, setName] = useState('');
  const chip = (active: boolean) => ({ border: 0, background: active ? 'var(--accent)' : undefined, color: active ? 'var(--on-accent)' : undefined });

  const save = () => {
    const from = state.topic;
    const to = name.trim();
    const before = act((d, now) => renameTopic(d, from, to, now));
    setRenaming(false);
    update({ topic: to });
    showToast(to ? `Topic renamed to “${to}”.` : `Removed the topic “${from}”.`, {
      label: 'Undo',
      run: () => {
        act((d, now) => restoreTopics(d, before, now));
        update({ topic: from });
      },
    });
  };

  return (
    <div class="stack" data-testid="list-controls">
      <input
        class="input"
        type="search"
        enterKeyHint="search"
        placeholder="Search verses, topics, references…"
        aria-label="Search verses"
        value={state.query}
        onInput={(e) => update({ query: e.currentTarget.value })}
        autocomplete="off"
        autocapitalize="off"
        data-testid="search"
      />
      <div class="row wrap">
        <select
          class="input grow"
          aria-label="Sort verses"
          value={state.sort}
          onChange={(e) => update({ sort: e.currentTarget.value as SortKey })}
          data-testid="sort"
          style={{ minHeight: '44px' }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          class="chip"
          style={{ ...chip(state.ready), minHeight: '44px', padding: '0 14px' }}
          aria-pressed={state.ready}
          onClick={() => update({ ready: !state.ready })}
          data-testid="ready-only"
        >
          Ready now
        </button>
      </div>
      {topics.length > TOPIC_CHIPS_MAX && (
        <div class="row wrap" role="group" aria-label="Filter by topic">
          <button class={`chip ${state.topic ? 'on' : ''}`} style={{ ...chip(!!state.topic), minHeight: '40px', padding: '0 14px' }} onClick={() => (setFind(''), setPicking(true))} aria-haspopup="dialog" data-testid="topic-open">
            {state.topic ? `#${state.topic}` : `Topic: all (${topics.length})`} ▾
          </button>
          {state.topic && (
            <>
              <button class="chip" style={{ minHeight: '40px' }} onClick={() => update({ topic: '' })} aria-label="Show all topics" data-testid="topic-clear">
                ✕ Clear
              </button>
              <button
                class="chip"
                style={{ minHeight: '40px' }}
                onClick={() => {
                  setName(state.topic);
                  setRenaming(true);
                }}
                data-testid="rename-topic"
              >
                Rename…
              </button>
            </>
          )}
        </div>
      )}
      {topics.length > 0 && topics.length <= TOPIC_CHIPS_MAX && (
        <div class="row wrap" role="group" aria-label="Filter by topic">
          <button
            class="chip"
            style={{ ...chip(state.topic === ''), minHeight: '36px' }}
            aria-pressed={state.topic === ''}
            onClick={() => update({ topic: '' })}
          >
            All topics
          </button>
          {topics.map((t) => (
            <button
              key={t}
              class="chip"
              style={{ ...chip(state.topic === t), minHeight: '36px' }}
              aria-pressed={state.topic === t}
              onClick={() => update({ topic: t })}
            >
              #{t}
            </button>
          ))}
          {state.topic && (
            <button
              class="chip"
              style={{ minHeight: '36px' }}
              onClick={() => {
                setName(state.topic);
                setRenaming(true);
              }}
              data-testid="rename-topic"
            >
              Rename…
            </button>
          )}
        </div>
      )}
      {picking && (
        <Overlay onClose={() => setPicking(false)} label="Choose a topic">
          <div class="sheet stack scrolls" data-testid="topic-sheet">
            <h2>Topics</h2>
            <input
              class="input"
              type="search"
              placeholder="Find a topic…"
              aria-label="Find a topic"
              value={find}
              onInput={(e) => setFind(e.currentTarget.value)}
              autocomplete="off"
              autocapitalize="off"
              data-testid="topic-search"
            />
            <div class="stack topic-list" style={{ '--gap': '4px' } as never}>
              {!find.trim() && (
                <button class={`topic-row ${state.topic === '' ? 'on' : ''}`} onClick={() => (update({ topic: '' }), setPicking(false))} data-testid="topic-option-all">
                  <span>All topics</span>
                  <small>{Object.values(topicCounts(data)).reduce((a, b) => a + b, 0)}</small>
                </button>
              )}
              {matchTopics(topics, find).map((t) => (
                <button key={t} class={`topic-row ${state.topic === t ? 'on' : ''}`} onClick={() => (update({ topic: t }), setPicking(false))} data-testid={`topic-option-${t}`}>
                  <span>#{t}</span>
                  <small>{topicCounts(data)[t]}</small>
                </button>
              ))}
              {matchTopics(topics, find).length === 0 && <p class="muted small">No topic matches that.</p>}
            </div>
            <button class="btn ghost block" onClick={() => setPicking(false)}>
              Close
            </button>
          </div>
        </Overlay>
      )}
      {renaming && (
        <Overlay center onClose={() => setRenaming(false)} label="Rename topic">
          <div class="modal stack">
            <h2>Rename “{state.topic}”</h2>
            <Field
              label="New name"
              hint="Verses with this topic get the new name. Use an existing topic's name to merge them, or leave it empty to remove the topic. You can undo right after."
            >
              <input class="input" value={name} onInput={(e) => setName(e.currentTarget.value)} autofocus data-testid="topic-name" />
            </Field>
            <div class="row">
              <button class="btn grow" onClick={() => setRenaming(false)}>
                Cancel
              </button>
              <button class="btn primary grow" onClick={save} data-testid="topic-save">
                {name.trim() ? 'Rename' : 'Remove topic'}
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
