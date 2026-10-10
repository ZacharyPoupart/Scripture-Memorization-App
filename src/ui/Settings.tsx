import { useEffect, useRef, useState } from 'preact/hooks';
import { dayKeyOf } from '../core/dates.ts';
import { isPaused } from '../core/schedule.ts';
import { TRANSLATIONS, type AppData, type FillDifficulty, type ThemePref } from '../core/types.ts';
import { cryptoAvailable } from '../services/syncCrypto.ts';
import { navigate } from '../router.ts';
import {
  BackupError,
  disableSync,
  downloadBackup,
  enableSync,
  importBackup,
  listSnapshots,
  previewBackup,
  resetEverything,
  restoreSnapshot,
  setPrefs,
  showToast,
  startBreak,
  stopBreak,
  syncNow,
  updateSettings,
  useApp,
} from '../store.ts';
import { Confirm, Field, Overlay, Seg, Toggle } from './common.tsx';
import { feedback, hapticsSupported } from '../services/feedback.ts';
import { buildReminderIcs, MAX_REMINDERS } from '../core/reminders.ts';
import { ModePicker } from './ModePicker.tsx';

function RemindersCard() {
  const { settings } = useApp();
  // Three fixed slots (an empty one is simply skipped), so clearing one never shifts the others.
  const slots = Array.from({ length: MAX_REMINDERS }, (_, i) => settings.reminderTimes?.[i] ?? '');
  const hasAny = slots.some(Boolean);
  const set = (i: number, v: string) => {
    const next = slots.slice();
    next[i] = v;
    updateSettings({ reminderTimes: next });
  };
  const download = () => {
    const ics = buildReminderIcs(slots, Date.now());
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'memorize-for-life-reminders.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  };
  return (
    <div class="card stack" data-testid="reminders-card">
      <h2>Daily reminders</h2>
      <p class="muted small" style={{ margin: 0 }}>
        Web apps on iPhone can't send their own notifications without a server, so reminders use your Calendar app instead: pick up to three times,
        tap the button, then choose “Add All”. Your Calendar will alert you at those times, even offline. To change them later, delete the “Memorize
        For Life” events and add again.
      </p>
      <div class="grid3">
        {slots.map((t, i) => (
          <label class="field" key={i}>
            <span>Time {i + 1}</span>
            <input
              class="input"
              type="time"
              value={t}
              onInput={(e) => set(i, e.currentTarget.value)}
              aria-label={`Reminder time ${i + 1}`}
              data-testid={`reminder-${i}`}
            />
          </label>
        ))}
      </div>
      <button class="btn block" disabled={!hasAny} onClick={download} data-testid="reminders-download">
        Add reminders to Calendar
      </button>
      <div class="hint-text">Leave a time empty to skip it. If nothing happens on your iPhone, open this page in Safari and try again.</div>
    </div>
  );
}

function SyncCard() {
  const { settings, sync, online } = useApp();
  const [linking, setLinking] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [msg, setMsg] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const secure = cryptoAvailable();

  if (!settings.syncCode) {
    return (
      <div class="card stack" data-testid="sync-card">
        <h2>Sync between devices</h2>
        <p class="muted small" style={{ margin: 0 }}>
          Optional. Link your phone and computer with a private code — no email or password. Your verses are encrypted on your device before they're
          sent.
        </p>
        {!secure && <div class="banner">Sync needs a secure (https) connection. It will work on your live site.</div>}
        {!linking ? (
          <div class="row wrap">
            <button
              class="btn primary grow"
              disabled={!secure}
              onClick={async () => {
                const c = await enableSync();
                if (c) {
                  setShowCode(true);
                }
              }}
              data-testid="sync-enable"
            >
              Turn on sync
            </button>
            <button class="btn grow" disabled={!secure} onClick={() => setLinking(true)} data-testid="sync-link">
              I have a code
            </button>
          </div>
        ) : (
          <div class="stack">
            <Field label="Link code from your other device" error={msg}>
              <input
                class="input"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                value={codeInput}
                onInput={(e) => setCodeInput(e.currentTarget.value)}
                autocapitalize="characters"
                autocomplete="off"
                spellcheck={false}
                data-testid="sync-code-input"
              />
            </Field>
            <div class="row">
              <button class="btn" onClick={() => setLinking(false)}>
                Cancel
              </button>
              <button
                class="btn primary grow"
                onClick={async () => {
                  const c = await enableSync(codeInput);
                  if (!c) setMsg("That code doesn't look right. It has 20 letters and numbers.");
                  else setLinking(false);
                }}
                data-testid="sync-link-go"
              >
                Link this device
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const status =
    sync.kind === 'syncing'
      ? 'Syncing…'
      : sync.kind === 'error'
        ? sync.message
        : !online
          ? 'Offline — will sync when you reconnect.'
          : settings.lastSyncAt
            ? `Last synced ${new Date(settings.lastSyncAt).toLocaleString()}`
            : 'Ready';
  return (
    <div class="card stack" data-testid="sync-card">
      <h2>Sync is on</h2>
      <div class={`small ${sync.kind === 'error' ? 'error-text' : 'muted'}`} role="status" data-testid="sync-status">
        {status}
      </div>
      {sync.kind === 'error' && sync.code === 'not-configured' && (
        <div class="hint-text">The server needs a KV namespace named SYNC (see the README's “Turn on sync” section).</div>
      )}
      <div>
        <div class="muted small" style={{ marginBottom: '4px' }}>
          Link code — enter this on your other device:
        </div>
        <div class="row">
          <code style={{ fontSize: '1.1rem', letterSpacing: '0.04em', flex: 1 }} data-testid="sync-code">
            {showCode ? settings.syncCode : '•••••-•••••-•••••-•••••'}
          </code>
          <button class="btn small" onClick={() => setShowCode(!showCode)}>
            {showCode ? 'Hide' : 'Show'}
          </button>
          <button
            class="btn small"
            onClick={() =>
              navigator.clipboard?.writeText(settings.syncCode).then(
                () => showToast('Code copied.'),
                () => showToast('Could not copy — show the code and copy it by hand.'),
              )
            }
          >
            Copy
          </button>
        </div>
        <div class="hint-text">Anyone with this code can read your verses. Keep it private.</div>
      </div>
      <div class="row wrap">
        <button class="btn grow" onClick={() => void syncNow()} disabled={sync.kind === 'syncing'} data-testid="sync-now">
          Sync now
        </button>
        <button class="btn grow danger" onClick={() => setConfirmOff(true)}>
          Turn off
        </button>
      </div>
      {confirmOff && (
        <Confirm
          title="Turn off sync?"
          body="Your verses stay on this device. Other devices keep their copies too. You can link again any time with the same code."
          confirmLabel="Turn off"
          onConfirm={() => {
            setConfirmOff(false);
            disableSync();
          }}
          onCancel={() => setConfirmOff(false)}
        />
      )}
    </div>
  );
}

function BackupCard() {
  const { settings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ data: AppData; verses: number } | null>(null);
  const [error, setError] = useState('');
  const [snaps, setSnaps] = useState<{ key: string; day: string }[]>([]);
  const [showSnaps, setShowSnaps] = useState(false);

  useEffect(() => {
    void listSnapshots().then(setSnaps);
  }, []);

  const onFile = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setError('');
    try {
      setPending(previewBackup(await file.text()));
    } catch (err) {
      setError(err instanceof BackupError ? err.message : 'Could not read that file.');
    }
  };

  const days = settings.lastExportAt ? Math.floor((Date.now() - settings.lastExportAt) / 86_400_000) : null;
  return (
    <div class="card stack" data-testid="backup-card">
      <h2>Backup</h2>
      <p class="muted small" style={{ margin: 0 }}>
        {days === null
          ? 'You haven’t exported a backup yet.'
          : days === 0
            ? 'Last exported today.'
            : `Last exported ${days} day${days === 1 ? '' : 's'} ago.`}{' '}
        A backup file contains all your verses, progress and streaks.
      </p>
      <div class="row wrap">
        <button class="btn grow" onClick={downloadBackup} data-testid="export">
          Export backup
        </button>
        <button class="btn grow" onClick={() => fileRef.current?.click()} data-testid="import">
          Import backup
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} data-testid="import-file" />
      </div>
      {error && (
        <div class="banner bad" role="alert" data-testid="import-error">
          {error}
        </div>
      )}
      {snaps.length > 0 && (
        <button class="btn ghost small" onClick={() => setShowSnaps(!showSnaps)}>
          {showSnaps ? 'Hide' : 'Show'} automatic daily snapshots
        </button>
      )}
      {showSnaps && (
        <div class="list">
          {snaps.map((s) => (
            <div key={s.key} class="row spread">
              <span>Start of {s.day}</span>
              <button
                class="btn small"
                onClick={async () => {
                  if (await restoreSnapshot(s.key)) showToast('Restored. Undo is available just below.');
                }}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      )}
      {pending && (
        <Overlay center onClose={() => setPending(null)} label="Import backup">
          <div class="modal stack" data-testid="import-dialog">
            <h2>Import this backup?</h2>
            <p class="muted">
              The file has {pending.verses} verse{pending.verses === 1 ? '' : 's'}.
            </p>
            <button
              class="btn primary block"
              onClick={() => {
                importBackup(pending.data, 'merge');
                setPending(null);
              }}
              data-testid="import-merge"
            >
              Merge with what I have (safe)
            </button>
            <button
              class="btn block danger"
              onClick={() => {
                importBackup(pending.data, 'replace');
                setPending(null);
              }}
              data-testid="import-replace"
            >
              Replace everything with the backup
            </button>
            <button class="btn ghost block" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

const BREAK_CHOICES = [
  { days: 3, label: '3 days' },
  { days: 7, label: 'A week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'A month' },
];

/** "Take a break": nothing is due, the streak waits, nothing freezes, nothing is lost. */
function BreakCard() {
  const { data } = useApp();
  const today = dayKeyOf(Date.now());
  const active = isPaused(data, today);
  const [days, setDays] = useState(7);
  const until = data.pause ? new Date(data.pause.until + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : '';
  return (
    <div class="card stack" data-testid="break-card">
      <h2>Take a break</h2>
      {active ? (
        <>
          <p style={{ margin: 0 }} data-testid="break-status">
            On a break until {until}. Nothing is due, your streak waits, and nothing is lost.
          </p>
          <button class="btn" onClick={stopBreak} data-testid="break-end">
            End the break now
          </button>
        </>
      ) : (
        <>
          <p class="muted" style={{ margin: 0 }}>
            Away or busy? Pause for a while: nothing is due, your streak waits, and nothing freezes. Verses just don't move up while you're away.
          </p>
          <div class="row">
            <select class="input grow" aria-label="Length of the break" value={days} onChange={(e) => setDays(Number(e.currentTarget.value))} data-testid="break-length">
              {BREAK_CHOICES.map((c) => (
                <option key={c.days} value={c.days}>
                  {c.label}
                </option>
              ))}
            </select>
            <button class="btn primary" onClick={() => startBreak(days)} data-testid="break-start">
              Start break
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const SPACING_PRESETS = [
  { hours: 0, label: 'No wait' },
  { hours: 0.5, label: '30 minutes' },
  { hours: 1, label: '1 hour' },
  { hours: 2, label: '2 hours' },
  { hours: 3, label: '3 hours' },
  { hours: 4, label: '4 hours' },
];

/** Time between a Daily verse's counted reviews: presets plus a custom number of minutes. */
function SpacingField({ hours, onChange }: { hours: number; onChange: (hours: number) => void }) {
  const isPreset = SPACING_PRESETS.some((p) => p.hours === hours);
  const [custom, setCustom] = useState(!isPreset);
  const [minutes, setMinutes] = useState(String(Math.round(hours * 60)));
  const selected = custom ? 'custom' : String(hours);
  return (
    <Field label="Time between Daily reviews" hint="Each Daily verse is reviewed 3 times a day, at least this far apart.">
      <select
        class="input"
        value={selected}
        data-testid="spacing"
        onChange={(e) => {
          const v = e.currentTarget.value;
          if (v === 'custom') {
            setCustom(true);
            setMinutes(String(Math.round(hours * 60)));
          } else {
            setCustom(false);
            onChange(Number(v));
          }
        }}
      >
        {SPACING_PRESETS.map((p) => (
          <option key={p.hours} value={p.hours}>
            {p.label}
          </option>
        ))}
        <option value="custom">Custom…</option>
      </select>
      {custom && (
        <label class="row" style={{ marginTop: 'var(--s-2, 8px)', gap: '8px', alignItems: 'center' }}>
          <input
            class="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={720}
            step={5}
            value={minutes}
            aria-label="Minutes between Daily reviews"
            data-testid="spacing-custom"
            style={{ maxWidth: '7rem' }}
            onInput={(e) => {
              const raw = e.currentTarget.value;
              setMinutes(raw);
              const m = Number(raw);
              if (raw !== '' && Number.isFinite(m) && m >= 0 && m <= 720) onChange(m / 60);
            }}
          />
          <span>minutes (0–720)</span>
        </label>
      )}
    </Field>
  );
}

export function Settings({ onShowIntro }: { onShowIntro: () => void }) {
  const { data, settings } = useApp();
  const [reset, setReset] = useState(false);
  const [resetText, setResetText] = useState('');
  return (
    <div class="scroll">
      <div class="narrow stack">
        <h1>Settings</h1>

        <div class="card stack">
          <h2>Appearance</h2>
          <Seg<ThemePref>
            label="Theme"
            value={settings.theme}
            options={[
              { value: 'system', label: 'Match device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => updateSettings({ theme })}
          />
        </div>

        <BreakCard />

        <div class="card stack">
          <h2>Reviewing</h2>
          <Field label="Default translation for new verses">
            <select
              class="input"
              value={data.prefs.value.defaultTranslation}
              onChange={(e) => setPrefs({ defaultTranslation: e.currentTarget.value })}
              data-testid="default-translation"
            >
              {TRANSLATIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <SpacingField hours={data.prefs.value.spacingHours} onChange={(spacingHours) => setPrefs({ spacingHours })} />
          <Field
            group
            label="Fill-in-the-blank difficulty (Daily verses)"
            hint="Verses in Weekly, Monthly and Yearly always use the hardest version."
          >
            <Seg<FillDifficulty>
              label="Difficulty"
              value={settings.fillDifficulty}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'medium', label: 'Medium' },
                { value: 'hard', label: 'Hard' },
              ]}
              onChange={(fillDifficulty) => updateSettings({ fillDifficulty })}
            />
          </Field>
          <Field group label="Default review mode">
            <ModePicker />
          </Field>
        </div>

        <div class="card stack" data-testid="feedback-card">
          <h2>Feedback &amp; celebrations</h2>
          <p class="muted small" style={{ margin: 0 }}>
            Gentle by design. Everything here is optional and can be switched off.
          </p>
          <Toggle
            label="Quiet sounds"
            hint="A soft tone for correct answers and finished reviews. Off by default."
            checked={settings.soundOn}
            onChange={(soundOn) => {
              updateSettings({ soundOn });
              if (soundOn) feedback.complete();
            }}
            testid="toggle-sound"
          />
          <Toggle
            label="Vibration"
            hint={
              hapticsSupported() ? 'A tiny tap on correct answers.' : 'Not available here — iPhone web apps can’t vibrate. Many Android phones can.'
            }
            checked={settings.hapticsOn && hapticsSupported()}
            disabled={!hapticsSupported()}
            onChange={(hapticsOn) => {
              updateSettings({ hapticsOn });
              if (hapticsOn) feedback.correct();
            }}
            testid="toggle-haptics"
          />
          <Toggle
            label="Avatar and seeds"
            hint="Earn seeds for reviewing and dress your avatar. Hides it from Today when off; nothing is lost."
            checked={settings.avatarOn}
            onChange={(avatarOn) => updateSettings({ avatarOn })}
            testid="toggle-avatar"
          />
          <Field
            group
            label="Celebrations"
            hint="Full adds confetti for big moments (a verse moving up, long streaks). Calm keeps it to a quiet message."
          >
            <Seg<'full' | 'calm'>
              label="Celebrations"
              value={settings.celebrations}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'calm', label: 'Calm' },
              ]}
              onChange={(celebrations) => updateSettings({ celebrations })}
            />
          </Field>
        </div>

        <RemindersCard />
        <SyncCard />
        <BackupCard />

        <div class="card stack">
          <h2>Help</h2>
          <button class="btn block" onClick={onShowIntro} data-testid="show-intro">
            Show the walkthrough again
          </button>
          <button class="btn block" onClick={() => navigate('/about')} data-testid="open-about">
            About Memorize For Life
          </button>
        </div>

        <div class="card stack">
          <h2>Danger zone</h2>
          <button class="btn block danger" onClick={() => setReset(true)}>
            Erase all data on this device
          </button>
          <div class="hint-text">If sync is on, other devices keep their copies and would sync them back. Export a backup first.</div>
        </div>
      </div>
      {reset && (
        <Overlay center onClose={() => setReset(false)} label="Erase everything">
          <div class="modal stack">
            <h2>Erase everything?</h2>
            <p class="muted">This removes all verses and progress from this device. Type ERASE to confirm.</p>
            <input class="input" value={resetText} onInput={(e) => setResetText(e.currentTarget.value)} autocapitalize="characters" />
            <div class="row">
              <button class="btn grow" onClick={() => setReset(false)}>
                Cancel
              </button>
              <button
                class="btn grow danger"
                disabled={resetText.trim().toUpperCase() !== 'ERASE'}
                onClick={() => {
                  resetEverything();
                  setReset(false);
                  setResetText('');
                }}
              >
                Erase
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
