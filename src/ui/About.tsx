import { FEEDBACK_URL } from '../config.ts';
import { GRADUATION_DAYS } from '../core/schedule.ts';
import { back } from '../router.ts';
import { Icon } from './common.tsx';

export function About({ onShowIntro }: { onShowIntro: () => void }) {
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
          <p style={{ margin: 0 }}>
            Memorize For Life helps you make Scripture memory a daily habit and keep it for good. A new verse is practiced often, then reviewed less and less as it becomes solid — without ever being forgotten.
          </p>
        </div>

        <div class="card stack">
          <h2>The four piles</h2>
          <p style={{ margin: 0 }}>Every verse lives in one pile and moves up on its own as time passes.</p>
          <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li><strong>Daily</strong> — reviewed 3 times a day, with some time between reviews. After {GRADUATION_DAYS.daily} days it moves to Weekly.</li>
            <li><strong>Weekly</strong> — reviewed once a week. After {GRADUATION_DAYS.weekly} days it moves to Monthly.</li>
            <li><strong>Monthly</strong> — reviewed once a month. After {GRADUATION_DAYS.monthly} days it moves to Yearly.</li>
            <li><strong>Yearly</strong> — reviewed once a year. It stays here for life.</li>
          </ul>
          <p class="muted small" style={{ margin: 0 }}>
            You can move a verse to another pile yourself (with undo), and you can always practice extra — extra practice never counts toward the schedule. In each pile, the verses you've held longest are at the top.
          </p>
        </div>

        <div class="card stack">
          <h2>Streaks and freezes</h2>
          <p style={{ margin: 0 }}>
            <strong>Streak:</strong> it grows by one each day every due verse gets at least one review (three a day is the goal, but one keeps your flame), and resets if a due verse is missed for a day. Practising on any day, even your first, earns it. Verses you add today don't count against you, and days when nothing is due don't break it.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Freeze:</strong> if you go 3 days without reviewing, your verses stop gaining days toward their next pile until you review again. A freeze only pauses progress — nothing is lost, and a verse that has already earned its promotion still moves up.
          </p>
        </div>

        <div class="card stack">
          <h2>Review modes</h2>
          <p style={{ margin: 0 }}>Flashcard, fill in the blank, type the first letters, or speak it aloud. After the verse, you also recall where it is found. New verses allow a few slips; once a verse has moved past Daily it has to be perfect.</p>
          <button class="btn block" onClick={onShowIntro}>
            Show the walkthrough
          </button>
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
