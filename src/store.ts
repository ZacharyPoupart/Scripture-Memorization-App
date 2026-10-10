// App-wide state: the data document, device settings, and the glue to storage and sync.
import { useEffect, useState } from 'preact/hooks';
import { BackupError, exportBackup, parseBackup } from './core/backup.ts';
import { buyItem, equipItem, seedsEarned, type BuyResult } from './core/avatar.ts';
import { addDays, dayKeyOf } from './core/dates.ts';
import { mergeData } from './core/merge.ts';
import { createData, endPause, recordReview, setPause, settle } from './core/schedule.ts';
import type { AppData, LevelUp, Settings } from './core/types.ts';
import { setFeedbackPrefs } from './services/feedback.ts';
import { Storage, requestPersistence } from './services/storage.ts';
import { runSync, stable, SyncError } from './services/sync.ts';
import { generateSyncCode, normalizeSyncCode } from './services/syncCrypto.ts';

export type SyncState =
  | { kind: 'off' }
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'error'; message: string; code: string };

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export interface AppState {
  ready: boolean;
  data: AppData;
  settings: Settings;
  /** Bumped on every change so components re-render (also once a minute for time-based labels). */
  tick: number;
  toast: Toast | null;
  sync: SyncState;
  online: boolean;
  recoveredFrom?: string;
  updateReady: boolean;
  /** Test hook: makes a screen throw so the friendly error screen can be verified. */
  debugCrash?: boolean;
}

const storage = new Storage();
let toastId = 0;

let state: AppState = {
  ready: false,
  data: createData(Date.now()),
  settings: {
    deviceId: 'pending',
    theme: 'system',
    defaultMode: 'flashcard',
    fillDifficulty: 'medium',
    onboarded: true,
    syncCode: '',
    lastExportAt: 0,
    lastSyncAt: 0,
    seenLevelUps: [],
    soundOn: false,
    hapticsOn: false,
    celebrations: 'full',
    seenMilestones: [],
    reminderTimes: ['08:00', '13:00', '19:00'],
    nudgeDismissedAt: 0,
    avatarOn: true,
  },
  tick: 0,
  toast: null,
  sync: { kind: 'off' },
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  updateReady: false,
};

const listeners = new Set<() => void>();
function set(patch: Partial<AppState>) {
  state = { ...state, ...patch, tick: state.tick + 1 };
  for (const l of listeners) l();
}

export const getState = () => state;

export function useApp(): AppState {
  const [, force] = useState(0);
  const seen = state.tick;
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    // The store may have changed between this render and the subscription (e.g. storage finished
    // loading very quickly): catch up so the UI never sticks on stale state.
    if (state.tick !== seen) l();
    return () => void listeners.delete(l);
  }, []);
  return state;
}

// ---------------------------------------------------------------- persistence

let saveChain: Promise<void> = Promise.resolve();
function persist() {
  const snapshot = state.data;
  const today = dayKeyOf(Date.now());
  saveChain = saveChain
    .then(() => storage.saveData(snapshot, today))
    .catch((e) => console.error('save failed', e));
}

/** Resolves once everything saved so far is on disk (used by tests and before risky transitions). */
export const flushSaves = (): Promise<void> => saveChain;

function persistSettings() {
  const s = state.settings;
  saveChain = saveChain.then(() => storage.saveSettings(s)).catch((e) => console.error('settings save failed', e));
}

// ---------------------------------------------------------------- mutations

/** Run a change against a copy of the data (after settling the days), save it, and re-render. */
export function act<T>(fn: (data: AppData, now: number, deviceId: string) => T): T {
  const now = Date.now();
  const next = structuredClone(state.data);
  settle(next, now);
  const result = fn(next, now, state.settings.deviceId);
  set({ data: next });
  persist();
  scheduleSync();
  return result;
}

export function completeReview(verseId: string): { counted: boolean; levelUps: LevelUp[]; todayComplete: boolean; seeds: number } {
  return act((d, now, device) => {
    const before = seedsEarned(d);
    const r = recordReview(d, verseId, now, device);
    return { ...r, seeds: Math.max(0, seedsEarned(d) - before) };
  });
}

/** Spend seeds on an item and wear it right away. */
export function buyAndWear(id: string): BuyResult {
  return act((d, now) => {
    const r = buyItem(d, id, now);
    if (r.ok) equipItem(d, id, now);
    return r;
  });
}

/** Wear an item you already have (or one an achievement has unlocked). */
export function wearItem(id: string): boolean {
  return act((d, now) => equipItem(d, id, now));
}

export function updateSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
  persistSettings();
  applyTheme();
  setFeedbackPrefs({ sound: state.settings.soundOn, haptics: state.settings.hapticsOn });
}

export function markMilestoneSeen(id: string) {
  updateSettings({ seenMilestones: [...state.settings.seenMilestones, id].slice(-300) });
}

export function markLevelUpsSeen(ids: string[]) {
  if (!ids.length) return;
  const seen = [...state.settings.seenLevelUps, ...ids].slice(-300);
  updateSettings({ seenLevelUps: seen });
}

export function showToast(message: string, action?: Toast['action']) {
  const id = ++toastId;
  set({ toast: { id, message, action } });
  setTimeout(() => {
    if (state.toast?.id === id) set({ toast: null });
  }, action ? 7000 : 3500);
}

export function dismissToast() {
  set({ toast: null });
}

export function setPrefs(patch: Partial<AppData['prefs']['value']>) {
  act((d, now) => {
    d.prefs = { value: { ...d.prefs.value, ...patch }, at: now };
  });
}

/** Take a break: today and the next `days - 1` days are paused (nothing due, nothing lost). */
export function startBreak(days: number) {
  act((d, now) => {
    const today = dayKeyOf(now);
    setPause(d, today, addDays(today, Math.max(1, Math.floor(days)) - 1), now);
  });
}

export function stopBreak() {
  act((d, now) => endPause(d, now));
}

// ---------------------------------------------------------------- theme

export function applyTheme() {
  const t = state.settings.theme;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

// ---------------------------------------------------------------- backup

export function downloadBackup() {
  const text = exportBackup(state.data, __APP_VERSION__, Date.now());
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `memorize-for-life-${dayKeyOf(Date.now())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  updateSettings({ lastExportAt: Date.now() });
}

export function previewBackup(text: string): { data: AppData; verses: number } {
  const data = parseBackup(text); // throws BackupError with a readable message
  return { data, verses: Object.values(data.verses).filter((v) => !v.deletedAt).length };
}

/** Merge (default) keeps everything you have; replace swaps your data for the file's. */
export function importBackup(data: AppData, mode: 'merge' | 'replace') {
  const before = state.data;
  const next = mode === 'merge' ? mergeData(before, data) : data;
  set({ data: next });
  act((d, now) => void settle(d, now));
  showToast(mode === 'merge' ? 'Backup merged into your data.' : 'Backup restored.', {
    label: 'Undo',
    run: () => {
      set({ data: before });
      persist();
      scheduleSync();
    },
  });
}

export async function listSnapshots() {
  return storage.listSnapshots();
}

export async function restoreSnapshot(key: string): Promise<boolean> {
  const snap = await storage.loadSnapshot(key);
  if (!snap) return false;
  importBackup(snap, 'replace');
  return true;
}

/** Erase everything on this device. The previous data is kept in memory and (as always) in the saved
 *  "previous copy" + daily snapshots, so the toast can offer a real undo. */
export function resetEverything() {
  const before = state.data;
  set({ data: createData(Date.now()) });
  persist();
  showToast('All data erased.', {
    label: 'Undo',
    run: () => {
      set({ data: before });
      persist();
      scheduleSync();
    },
  });
}

export { BackupError };

// ---------------------------------------------------------------- sync

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncing = false;

function scheduleSync() {
  if (!state.settings.syncCode) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 6000);
}

export async function syncNow(): Promise<void> {
  const code = state.settings.syncCode;
  if (!code || syncing) return;
  if (!state.online) {
    set({ sync: { kind: 'idle' } });
    return;
  }
  syncing = true;
  set({ sync: { kind: 'syncing' } });
  try {
    const result = await runSync(code, state.data);
    // Merge into the *current* data: changes made while syncing are kept (merge is idempotent).
    const merged = mergeData(state.data, result.merged);
    const changed = stable(merged) !== stable(state.data);
    if (changed) set({ data: merged });
    act((d, now) => void settle(d, now));
    updateSettings({ lastSyncAt: Date.now() });
    set({ sync: { kind: 'idle' } });
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError('server', 'Sync failed.');
    set({ sync: { kind: 'error', message: err.message, code: err.code } });
  } finally {
    syncing = false;
  }
}

export async function enableSync(input?: string): Promise<string | null> {
  const code = input ? normalizeSyncCode(input) : generateSyncCode();
  if (!code) return null;
  updateSettings({ syncCode: code });
  set({ sync: { kind: 'idle' } });
  await syncNow();
  return code;
}

export function disableSync() {
  updateSettings({ syncCode: '', lastSyncAt: 0 });
  set({ sync: { kind: 'off' } });
}

// ---------------------------------------------------------------- startup

export function refresh() {
  const next = structuredClone(state.data);
  settle(next, Date.now());
  if (stable(next) !== stable(state.data)) {
    set({ data: next });
    persist();
  } else {
    set({});
  }
}

export function setUpdateReady(v: boolean) {
  set({ updateReady: v });
}

export async function init(): Promise<void> {
  const settings = await storage.loadSettings();
  const loaded = await storage.loadData(Date.now());
  state = { ...state, settings, data: loaded.data, recoveredFrom: loaded.recoveredFrom };
  if (loaded.quarantinedAs)
    window.setTimeout(() => showToast('Your saved verses could not be read, so a copy was kept safe. You can restore from a backup in Settings.'), 800);
  const next = structuredClone(state.data);
  settle(next, Date.now());
  state = { ...state, data: next, sync: settings.syncCode ? { kind: 'idle' } : { kind: 'off' } };
  applyTheme();
  setFeedbackPrefs({ sound: settings.soundOn, haptics: settings.hapticsOn });
  persist();
  set({ ready: true });
  void requestPersistence();

  addEventListener('online', () => {
    set({ online: true });
    void syncNow();
  });
  addEventListener('offline', () => set({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refresh();
      void syncNow();
    }
  });
  setInterval(refresh, 30_000);
  if (settings.syncCode) void syncNow();
}

// For tests / debugging
declare global {
  interface Window {
    __mfl?: { getState: typeof getState; flush: typeof flushSaves; crash: (v: boolean) => void };
  }
}
if (typeof window !== 'undefined') window.__mfl = { getState, flush: flushSaves, crash: (v: boolean) => set({ debugCrash: v }) };
