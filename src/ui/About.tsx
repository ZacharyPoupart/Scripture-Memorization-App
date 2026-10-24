import { FEEDBACK_URL } from '../config.ts';
import { GRADUATION_DAYS } from '../core/schedule.ts';
import { back } from '../router.ts';
import { Icon } from './common.tsx';

export function About() {
  return (
    <div class="scroll">
      <div class="narrow stack">
        <div class="page-head">
          <button class="icon-btn" aria-label="Back" onClick={() => back('/settings')}>
            <Icon name="back" />
          </button>
          <h1>About</h1>
        </div>

        <div class="card stack">
          <h2>Why this app exists</h2>
          <p style={{ margin: 0 }}>Make Scripture memory a daily habit, and keep it for good.</p>
        </div>

        <div class="card stack">
          <h2>The four piles</h2>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li><strong>Daily</strong> — 3 reviews a day, for {GRADUATION_DAYS.daily} days.</li>
            <li><strong>Weekly</strong> — once a week, for {GRADUATION_DAYS.weekly} weeks.</li>
            <li><strong>Monthly</strong> — once a month, for {GRADUATION_DAYS.monthly} months.</li>
            <li><strong>Yearly</strong> — once a year, for life.</li>
          </ul>
        </div>

        <div class="card stack">
          <h2>Streaks and progress</h2>
          <p style={{ margin: 0 }}>
            <strong>Streak:</strong> grows each day every due verse gets at least one review. Weekly verses are due by Saturday, Monthly by the last day of the month.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Progress:</strong> a verse moves up after enough days (Daily), weeks (Weekly) or months (Monthly) with a review. A skipped week or month just does not count.
          </p>
        </div>

        <div class="card stack">
          <h2>Feedback</h2>
          <p style={{ margin: 0 }}>Something broken, or an idea to make this better?</p>
          <a class="btn block primary" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer" data-testid="feedback">
            Send feedback
          </a>
        </div>

        <div class="center muted small" data-testid="version">
          Memorize For Life · version {__APP_VERSION__}
          <br />
          Built {__BUILD_DATE__}
        </div>
      </div>
    </div>
  );
}
