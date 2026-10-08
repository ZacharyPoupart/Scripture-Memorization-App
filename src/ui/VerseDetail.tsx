import { useState } from 'preact/hooks';
import { BOOKS } from '../core/books.ts';
import { bibleGatewayUrl, formatRef } from '../core/reference.ts';
import { GRADUATION_DAYS, deleteVerse, isFrozen, maxDaysIn, movePile, nextPile, restorePile, restoreVerse, verseStatus } from '../core/schedule.ts';
import { PILES, type Pile } from '../core/types.ts';
import { back, navigate } from '../router.ts';
import { act, showToast, useApp } from '../store.ts';
import { Confirm, DaysSlider, Icon, Overlay, PILE_INFO, PileBadge, pileProgress, statusLabel } from './common.tsx';
import { MODES } from './ModePicker.tsx';
import { formatDays } from '../core/dates.ts';

export function VerseDetail({ id }: { id: string }) {
  const { data } = useApp();
  const [moving, setMoving] = useState(false);
  const [daysIn, setDaysIn] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const v = data.verses[id];
  const now = Date.now();
  if (!v || v.deletedAt) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <div class="page-head">
            <button class="icon-btn" aria-label="Back" onClick={() => back('/')}>
              <Icon name="back" />
            </button>
            <h1>Verse not found</h1>
          </div>
          <p class="muted">It may have been deleted on another device.</p>
        </div>
      </div>
    );
  }
  const status = verseStatus(data, v, now);
  const label = statusLabel(status);
  const p = pileProgress(data, v, now);
  const next = nextPile(v.pile);
  const frozen = isFrozen(data, now);

  const doMove = (to: Pile) => {
    setMoving(false);
    if (to === v.pile) return;
    const used = Math.min(daysIn, maxDaysIn(to));
    const snap = act((d, t) => movePile(d, v.id, to, t, used));
    setDaysIn(0);
    showToast(`Moved to ${PILE_INFO[to].label}${used ? ` (${used} days in)` : ''}.`, {
      label: 'Undo',
      run: () => act((d, t) => restorePile(d, v.id, snap, t)),
    });
  };
  const doDelete = () => {
    setDeleting(false);
    act((d, t) => deleteVerse(d, v.id, t));
    showToast(`Deleted ${formatRef(v)}.`, { label: 'Undo', run: () => act((d, t) => restoreVerse(d, v.id, t)) });
    back('/');
  };

  return (
    <div class="scroll">
      <div class={`narrow stack pile-${v.pile}`}>
        <div class="page-head">
          <button class="icon-btn" aria-label="Back" onClick={() => back('/')}>
            <Icon name="back" />
          </button>
          <h1 data-testid="verse-title">{formatRef(v)}</h1>
        </div>
        <div class="row wrap">
          <PileBadge pile={v.pile} />
          <span class="chip">{v.translation}</span>
          {v.topic && <span class="chip">#{v.topic}</span>}
        </div>

        <div class="card">
          <p class="verse-text" style={{ margin: 0, fontSize: '1.2rem' }} data-testid="verse-text">
            {v.text}
          </p>
        </div>

        <div class="card stack flat">
          <div class="row spread">
            <span class={label.cls} data-testid="detail-status">{label.text}</span>
          </div>
          <div class="small muted">
            In {PILE_INFO[v.pile].label} for {p.days === 0 ? 'less than a day' : formatDays(p.days)}.
            {p.target && next && (
              <>
                {' '}
                {p.earned} of {GRADUATION_DAYS[v.pile as keyof typeof GRADUATION_DAYS]} days toward {PILE_INFO[next].label}
                {frozen ? ' (paused — review to resume)' : ''}.
              </>
            )}
            {!next && ' Kept for life — reviewed once a year.'}
          </div>
          {p.target && (
            <div class="bar">
              <i style={{ width: `${p.pct}%` }} />
            </div>
          )}
        </div>

        <div class="card stack">
          <h2>Review this verse</h2>
          <div class="grid2">
            {MODES.map((m) => (
              <button key={m.value} class="btn" onClick={() => navigate(`/review?verse=${v.id}&mode=${m.value}`)} data-testid={`review-${m.value}`}>
                {m.long}
              </button>
            ))}
          </div>
          {status.state !== 'ready' && <div class="hint-text">This one isn't due yet, so it will be extra practice (not counted toward the schedule).</div>}
        </div>

        <div class="row wrap">
          <button class="btn grow" onClick={() => navigate(`/edit/${v.id}`)}>
            Edit
          </button>
          <a class="btn grow" href={bibleGatewayUrl(v, v.translation)} target="_blank" rel="noopener noreferrer">
            Open in Bible <Icon name="external" />
          </a>
        </div>
        <div class="row wrap">
          <button class="btn grow" onClick={() => setMoving(true)} data-testid="move">
            Move to another pile
          </button>
          <button class="btn grow danger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
        <div class="hint-text">Opens {BOOKS[v.book - 1].name} {v.chapter} on BibleGateway so you can read the verse in context.</div>
      </div>

      {moving && (
        <Overlay onClose={() => (setMoving(false), setDaysIn(0))} label="Move to pile">
          <div class="sheet stack">
            <h2>Move to which pile?</h2>
            <div class="hint-text">Its time-in-pile starts over in the new pile, unless you say it has already been there a while. You can undo right after.</div>
            <details class="quiet-details" open={daysIn > 0}>
              <summary>Already know this one? Start partway</summary>
              <DaysSlider value={daysIn} max={366} onChange={setDaysIn} testid="days-in" />
              <div class="hint-text">Up to {maxDaysIn('daily')} days for Daily and Weekly, {maxDaysIn('monthly')} for Monthly, {maxDaysIn('yearly')} for Yearly.</div>
            </details>
            {PILES.map((p2) => (
              <button key={p2} class={`btn block pile-${p2}`} disabled={p2 === v.pile} onClick={() => doMove(p2)} data-testid={`move-${p2}`}>
                <PileBadge pile={p2} /> {PILE_INFO[p2].blurb}
              </button>
            ))}
            <button class="btn ghost block" onClick={() => setMoving(false)}>
              Cancel
            </button>
          </div>
        </Overlay>
      )}
      {deleting && <Confirm title="Delete this verse?" body={`${formatRef(v)} and its progress will be removed. You'll be able to undo right after.`} confirmLabel="Delete" danger onConfirm={doDelete} onCancel={() => setDeleting(false)} />}
    </div>
  );
}
