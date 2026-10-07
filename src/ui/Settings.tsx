import { useEffect, useRef, useState } from 'preact/hooks';
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
  syncNow,
  updateSettings,
  useApp,
} from '../store.ts';
import { Confirm, Field, Overlay, Seg } from './common.tsx';
import { ModePicker } from './ModePicker.tsx';

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
          Optional. Link your phone and computer with a private code — no email or password. Your verses are encrypted on your device before they're sent.
        </p>
        {!secure && <div class="banner">Sync needs a secure (https) connection. It will work on your live site.</div>}
        {!linking ? (
          <div class="row wrap">
            <button class="btn primary grow" disabled={!secure} onClick={async () => { const c = await enableSync(); if (c) { setShowCode(true); } }} data-testid="sync-enable">
              Turn on sync
            </button>
            <button class="btn grow" disabled={!secure} onClick={() => setLinking(true)} data-testid="sync-link">
              I have a code
            </button>
          </div>
        ) : (
          <div class="stack">
            <Field label="Link code from your other device" error={msg}>
              <input class="input" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" value={codeInput} onInput={(e) => setCodeInput(e.currentTarget.value)} autocapitalize="characters" autocomplete="off" spellcheck={false} data-testid="sync-code-input" />
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
    sync.kind === 'syncing' ? 'Syncing…' : sync.kind === 'error' ? sync.message : !online ? 'Offline — will sync when you reconnect.' : settings.lastSyncAt ? `Last synced ${new Date(settings.lastSyncAt).toLocaleString()}` : 'Ready';
  return (
    <div class="card stack" data-testid="sync-card">
      <h2>Sync is on</h2>
      <div class={`small ${sync.kind === 'error' ? 'error-text' : 'muted'}`} role="status" data-testid="sync-status">
        {status}
      </div>
      {sync.kind === 'error' && sync.code === 'not-configured' && <div class="hint-text">The server needs a KV namespace named SYNC (see the README's “Turn on sync” section).</div>}
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
            onClick={() => navigator.clipboard?.writeText(settings.syncCode).then(() => showToast('Code copied.'), () => showToast('Could not copy — show the code and copy it by hand.'))}
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
        {days === null ? 'You haven’t exported a backup yet.' : days === 0 ? 'Last exported today.' : `Last exported ${days} day${days === 1 ? '' : 's'} ago.`} A backup file contains all your verses, progress and streaks.
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
            <p class="muted">The file has {pending.verses} verse{pending.verses === 1 ? '' : 's'}.</p>
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

        <div class="card stack">
          <h2>Reviewing</h2>
          <Field label="Default translation for new verses">
            <select class="input" value={data.prefs.value.defaultTranslation} onChange={(e) => setPrefs({ defaultTranslation: e.currentTarget.value })} data-testid="default-translation">
              {TRANSLATIONS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Time between Daily reviews" hint="Each Daily verse is reviewed 3 times a day, at least this far apart.">
            <select class="input" value={data.prefs.value.spacingHours} onChange={(e) => setPrefs({ spacingHours: Number(e.currentTarget.value) })} data-testid="spacing">
              {[1, 2, 3, 4].map((h) => (
                <option key={h} value={h}>
                  {h} hour{h === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fill-in-the-blank difficulty (Daily verses)" hint="Verses in Weekly, Monthly and Yearly always use the hardest version.">
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
          <Field label="Default review mode">
            <ModePicker />
          </Field>
        </div>

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
                  showToast('All data erased.');
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
