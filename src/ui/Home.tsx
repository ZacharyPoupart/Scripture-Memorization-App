import { dayKeyOf, daysBetween, formatDays } from '../core/dates.ts';
import { daysUntilFreeze, isFrozen, liveVerses, pileVerses, streakInfo, todaySummary, verseStatus } from '../core/schedule.ts';
import { PILES } from '../core/types.ts';
import { navigate } from '../router.ts';
import { useApp } from '../store.ts';
import { Icon, PILE_INFO } from './common.tsx';
import { ModePicker } from './ModePicker.tsx';

export function Home() {
  const { data, settings } = useApp();
  const now = Date.now();
  const verses = liveVerses(data);
  const today = todaySummary(data, now);
  const streak = streakInfo(data, now);
  const frozen = isFrozen(data, now) && verses.length > 0;
  const untilFreeze = daysUntilFreeze(data, now);
  const readyAll = verses.filter((v) => verseStatus(data, v, now).state === 'ready').length;
  const pct = today.total ? Math.round((today.met / today.total) * 100) : 100;
  const hour = new Date(now).getHours();
  const greet = hour < 5 ? 'Still up?' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!verses.length) {
    return (
      <div class="scroll">
        <div class="narrow stack">
          <h1>Memorize For Life</h1>
          <div class="card center stack" data-testid="empty-home">
            <div class="hero">📖</div>
            <h2>Add your first verse</h2>
            <p class="muted">Pick a verse, and it will be in your Daily pile. Review it three times a day and it will become part of you.</p>
            <button class="btn primary block" onClick={() => navigate('/add')}>
              Add a verse
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div class="scroll">
        <div class="narrow stack">
          <div class="row spread">
            <div>
              <div class="muted small">{new Date(now).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              <h1>{greet}</h1>
            </div>
            <div class="streak" title={`Longest streak: ${streak.longest}`} data-testid="streak">
              <Icon name="flame" fill />
              <span>{streak.count}</span>
            </div>
          </div>

          {frozen && (
            <div class="banner" data-testid="freeze-banner">
              <strong>Progress is paused.</strong> You've gone more than 3 days without reviewing. Do any review today and your verses start counting
              days toward their next pile again.
            </div>
          )}
          {!frozen && untilFreeze !== null && untilFreeze <= 1 && today.total > 0 && (
            <div class="banner">Review today to keep your verses moving — progress pauses after 3 days without a review.</div>
          )}

          <div class="card stack">
            <div class="row">
              <div class="ring" style={{ '--p': pct } as never}>
                <div data-testid="today-ring">{today.total ? `${today.met}/${today.total}` : '✓'}</div>
              </div>
              <div class="grow">
                <h2>{today.outcome === 'c' ? 'All done for today!' : today.total === 0 ? 'Nothing required today' : "Today's reviews"}</h2>
                <div class="muted small">
                  {today.outcome === 'c'
                    ? streak.count > 0
                      ? `Streak: ${streak.count} day${streak.count === 1 ? '' : 's'}. Longest: ${streak.longest}.`
                      : 'Nice work.'
                    : today.total === 0
                      ? 'Newly added verses are optional on their first day.'
                      : today.readyNow > 0
                        ? `${today.readyNow} ready now · ${today.remaining} to go today`
                        : `${today.remaining} to go — next ones unlock soon`}
                </div>
              </div>
            </div>
            <ModePicker />
          </div>

          <div>
            <h2 style={{ margin: '4px 0 10px' }}>Your piles</h2>
            <div class="list">
              {PILES.map((p) => {
                const vs = pileVerses(data, p);
                const ready = vs.filter((v) => verseStatus(data, v, now).state === 'ready').length;
                const oldest = vs[0];
                return (
                  <button key={p} class={`card tap pile-tile pile-${p}`} onClick={() => navigate(`/pile/${p}`)} data-testid={`pile-${p}`}>
                    <div class="row spread">
                      <div>
                        <h3>{PILE_INFO[p].label}</h3>
                        <div class="muted small">{PILE_INFO[p].blurb}</div>
                        {oldest && <div class="muted small">Longest: {formatDays(Math.max(0, daysBetween(oldest.pileSince, dayKeyOf(now))))}</div>}
                      </div>
                      <div class="center">
                        <div class="count" data-testid={`count-${p}`}>
                          {vs.length}
                        </div>
                        <div class={`small ${ready ? 'status-ready' : 'muted'}`}>{ready ? `${ready} ready` : 'none due'}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {settings.syncCode === '' && settings.lastExportAt === 0 && verses.length >= 3 && (
            <div class="banner info small">
              Tip: your verses live on this device. Turn on <a href="#/settings">sync</a> or export a backup in Settings so they're never lost.
            </div>
          )}
        </div>
      </div>
      <div class="action-bar">
        <button
          class="btn primary block"
          disabled={readyAll === 0}
          onClick={() => navigate(`/review?today=1&mode=${settings.defaultMode}`)}
          data-testid="start-today"
        >
          {readyAll > 0 ? `Review ${readyAll} ready` : 'Nothing ready right now'}
        </button>
      </div>
    </>
  );
}
