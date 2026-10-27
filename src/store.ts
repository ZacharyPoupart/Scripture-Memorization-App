// App-wide state: the data document, device settings, and the glue to storage and sync.
import { useEffect, useState } from 'preact/hooks';
import { BackupError, exportBackup, parseBackup } from './core/backup.ts';
import { buyItem, currentLook, equipItem, GUILD_WIN_COINS, resetAvatar, seedsEarned, testing, type BuyResult } from './core/avatar.ts';
import { reconcileFlag } from './core/banner.ts';
import { addDays, dayKeyOf } from './core/dates.ts';
import { mergeData } from './core/merge.ts';
import { createData, endPause, recordReview, setPause, settle } from './core/schedule.ts';
import { LESSONS, START, doneLessons, nextPos, sampleTourData, type TourPos } from './core/tour.ts';
import { navigate } from './router.ts';
import type { AppData, LevelUp, Settings } from './core/types.ts';
import { setFeedbackPrefs } from './services/feedback.ts';
import { cleanName, guildWinsToClaim, MAX_GUILD_NAME, type Cheer, newIdentity, sameSnapshot, socialSnapshot, type FriendCard, type GuildView, type Snapshot } from './core/social.ts';
import { api, socialMessage, SocialError, type Auth } from './services/social.ts';
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

export interface SocialState {
  friends: FriendCard[] | null;
  /** Friends who cheered you in the last week, and the friends you have cheered today (this session). */
  cheers: Cheer[];
  cheered: string[];
  guilds: GuildView[] | null;
  busy: boolean;
  /** A short sentence for the screen when the last attempt failed; '' when all is well. */
  error: string;
  loadedAt: number;
  invite: { code: string; expiresAt: number } | null;
  guildInvites: Record<string, { code: string; expiresAt: number }>;
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
  /** The guided tour is running on throw-away practice verses: nothing is saved, synced or counted until it ends. */
  sandbox: boolean;
  /** Where the tour is, and whether its lesson list is open. `null` when no tour is running. */
  tour: { pos: TourPos; menu: boolean } | null;
  /** The lesson list on its own (from Settings or the welcome), before the tour has begun. */
  tourMenu: boolean;
  /** Items waiting to be shown in the "new item" popup, first one on screen. */
  reveals: string[];
  /** A level-up or streak celebration is on screen: the "new item" popup waits for it to be closed. */
  celebrating: boolean;
  /** Friends and guilds, as last fetched (null until the first load). */
  social: SocialState;
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
    seenMilestones: [],
    nudgeDismissedAt: 0,
    avatarOn: true,
    speakWords: true,
    practice: { before: [], after: ['citation', 'topic'] },
    shuffle: false,
    tour: { done: [] },
    seenUnlocks: null,
    seenSaved: '',
    listSort: 'longest',
    flagGuild: '',
  },
  tick: 0,
  toast: null,
  sync: { kind: 'off' },
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  updateReady: false,
  sandbox: false,
  tour: null,
  tourMenu: false,
  reveals: [],
  celebrating: false,
  social: { friends: null, cheers: [], cheered: [], guilds: null, busy: false, error: '', loadedAt: 0, invite: null, guildInvites: {} },
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
  if (state.sandbox) return; // the tour's practice verses are never saved
  const snapshot = state.data;
  const today = dayKeyOf(Date.now());
  saveChain = saveChain
    .then(() => storage.saveData(snapshot, today))
    .catch((e) => console.error('save failed', e));
}

/** Resolves once everything saved so far is on disk (used by tests and before risky transitions). */
export const flushSaves = (): Promise<void> => saveChain;

function persistSettings() {
  if (state.sandbox) return;
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
  const r = act((d, now, device) => {
    const before = seedsEarned(d);
    const r = recordReview(d, verseId, now, device);
    return { ...r, seeds: Math.max(0, seedsEarned(d) - before) };
  });
  schedulePush();
  return r;
}

/** Spend seeds on an item and wear it right away. */
export function buyAndWear(id: string): BuyResult {
  const r = act((d, now) => {
    const r = buyItem(d, id, now);
    if (r.ok) equipItem(d, id, now);
    return r;
  });
  if (r.ok) queueReveal(id);
  return r;
}

/** Show the "new item" popup for an item (one at a time, in order). */
export function queueReveal(id: string) {
  if (!state.reveals.includes(id)) set({ reveals: [...state.reveals, id] });
}

export function setCelebrating(on: boolean) {
  if (state.celebrating !== on) set({ celebrating: on });
}

export function dismissReveal() {
  set({ reveals: state.reveals.slice(1) });
}

/** Take off and forget everything bought or worn (seeds come back). */
export function resetArmor() {
  act((d, now) => resetAvatar(d, now));
}

/** Wear an item you already have (or one an achievement has unlocked). */
export function wearItem(id: string): boolean {
  return act((d, now) => equipItem(d, id, now));
}

/** Put a group's flag on the stand (or take it off with `guild` null); the flag then follows that group's banner. */
export function wearFlag(guildId: string | null, id: string): boolean {
  const ok = wearItem(id);
  if (ok) updateSettings({ flagGuild: guildId ?? '' });
  return ok;
}

/** After the groups load: a redesigned banner changes the flag you wear, and leaving the group takes it off. */
function reconcileFlagNow(guilds: { id: string; banner?: string }[]) {
  if (state.sandbox) return;
  const worn = currentLook(state.data).flag;
  const r = reconcileFlag(worn, state.settings.flagGuild, guilds);
  if (r.flag !== worn) wearItem(r.flag);
  if (r.guild !== state.settings.flagGuild) updateSettings({ flagGuild: r.guild });
}

export function updateSettings(patch: Partial<Settings>) {
  set({ settings: { ...state.settings, ...patch } });
  persistSettings();
  applyTheme();
  setFeedbackPrefs({ sound: state.settings.soundOn });
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
  syncBrowserColor();
}

/**
 * The strip the phone draws behind the clock (the status bar) takes its colour from the page's `theme-color`. The tags in
 * index.html follow the phone's light/dark setting, so someone whose app is on Light while the phone is on Dark got a black box
 * above a light page. Keep one tag, always the colour the page itself is using.
 */
let watchingSystemTheme = false;
function syncBrowserColor() {
  if (typeof document === 'undefined') return;
  const color = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (color) {
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
  }
  if (!watchingSystemTheme && typeof matchMedia === 'function') {
    watchingSystemTheme = true;
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => syncBrowserColor());
  }
}

// ---------------------------------------------------------------- friends and guilds

const PUSH_EVERY = 30 * 60_000; // an unchanged-or-changed profile is sent at most this often (the server's free storage allows few writes)
let lastPush = { at: 0, snap: null as Snapshot | null, name: '' };
let pushTimer: ReturnType<typeof setTimeout> | undefined;

const patchSocial = (p: Partial<SocialState>) => set({ social: { ...state.social, ...p } });
/** The private id and secret, when friends are on and this is not the tour. */
function authOf(): Auth | null {
  const d = state.data;
  return !state.sandbox && d.social && d.sharing?.on ? { id: d.social.id, secret: d.social.secret } : null;
}
export const sharingOn = (): boolean => !!authOf();

async function guarded<T>(fn: () => Promise<T>): Promise<T | undefined> {
  patchSocial({ busy: true, error: '' });
  try {
    const r = await fn();
    patchSocial({ busy: false });
    return r;
  } catch (e) {
    patchSocial({ busy: false, error: socialMessage(e) });
    return undefined;
  }
}

/** Send what friends can see (if it changed, and not too often). `force` sends it now. */
export async function pushProfile(force = false): Promise<void> {
  const auth = authOf();
  const name = state.data.sharing?.name ?? '';
  if (!auth || !name) return;
  const now = Date.now();
  const snap = socialSnapshot(state.data, now);
  const unchanged = sameSnapshot(lastPush.snap, snap) && lastPush.name === name;
  if (!force && (unchanged || now - lastPush.at < PUSH_EVERY)) return;
  try {
    await api.profile(auth, name, snap);
    lastPush = { at: now, snap, name };
  } catch (e) {
    if (e instanceof SocialError && e.code !== 'offline') patchSocial({ error: socialMessage(e) });
  }
}

/** Soon after a review, send the new numbers (one send for a whole run of reviews). */
function schedulePush() {
  if (!authOf()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void pushProfile(), 60_000);
}

export async function refreshSocial(): Promise<void> {
  const auth = authOf();
  if (!auth) return;
  await pushProfile();
  await guarded(async () => {
    const [f, g] = await Promise.all([api.friends(auth), api.guilds(auth)]);
    patchSocial({ friends: f.friends, cheers: f.cheers ?? [], guilds: g.guilds, loadedAt: Date.now() });
    reconcileFlagNow(g.guilds);
    // a group that reached its weekly goal pays coins, once
    const me = state.data.social?.id;
    const wins = me && !state.sandbox ? guildWinsToClaim(state.data, g.guilds, me, Date.now()) : [];
    if (wins.length) {
      act((d) => void (d.guildWins = [...new Set([...(d.guildWins ?? []), ...wins])].sort()));
      showToast(`Your group reached its weekly goal! +${wins.length * GUILD_WIN_COINS} coins`);
    }
  });
}

/** Turn friends on: makes this person's private identity (once), saves the name, sends the profile and loads friends. */
export async function enableSharing(rawName: string): Promise<boolean> {
  const name = cleanName(rawName);
  if (!name || state.sandbox) return false;
  act((d, now) => {
    d.social ??= newIdentity(now);
    d.sharing = { name, on: true, at: now };
  });
  lastPush = { at: 0, snap: null, name: '' };
  const auth = authOf()!;
  const ok = await guarded(async () => {
    await api.profile(auth, name, socialSnapshot(state.data, Date.now()));
    lastPush = { at: Date.now(), snap: socialSnapshot(state.data, Date.now()), name };
    return true;
  });
  if (!ok) {
    act((d, now) => void (d.sharing = { name, on: false, at: now })); // could not reach the server: stay off rather than half on
    return false;
  }
  void refreshSocial();
  return true;
}

export async function renameSharing(rawName: string): Promise<boolean> {
  const name = cleanName(rawName);
  if (!name || !state.data.sharing) return false;
  act((d, now) => {
    d.sharing = { name, on: d.sharing?.on ?? true, at: now };
  });
  await pushProfile(true);
  return true;
}

/** Stop sharing. With `erase`, also remove this person's profile, friendships and guild places from the server. */
export async function stopSharing(erase: boolean): Promise<boolean> {
  const d = state.data;
  const auth = d.social ? { id: d.social.id, secret: d.social.secret } : null;
  if (erase && auth) {
    const ok = await guarded(() => api.remove(auth));
    if (ok === undefined) return false;
  }
  act((dd, now) => {
    dd.sharing = { name: dd.sharing?.name ?? '', on: false, at: now };
  });
  patchSocial({ friends: null, cheers: [], cheered: [], guilds: null, invite: null, guildInvites: {}, error: '' });
  return true;
}

export async function makeInvite(): Promise<string | null> {
  const auth = authOf();
  if (!auth) return null;
  if (state.social.invite && state.social.invite.expiresAt > Date.now() + 86_400_000) return state.social.invite.code;
  await pushProfile(true);
  const r = await guarded(() => api.invite(auth));
  if (!r) return null;
  patchSocial({ invite: r });
  return r.code;
}

export async function acceptFriend(code: string): Promise<FriendCard | null> {
  const auth = authOf();
  if (!auth) return null;
  await pushProfile(true);
  const r = await guarded(() => api.accept(auth, code));
  if (!r) return null;
  void refreshSocial();
  return r.friend;
}

export async function removeFriend(id: string): Promise<boolean> {
  const auth = authOf();
  if (!auth) return false;
  const r = await guarded(() => api.unfriend(auth, id));
  if (r) patchSocial({ friends: (state.social.friends ?? []).filter((f) => f.id !== id) });
  return !!r;
}

/** A friendly 👏 for a friend (one a day each; the server keeps the count honest). */
export async function cheerFriend(id: string): Promise<boolean> {
  const auth = authOf();
  if (!auth) return false;
  const r = await guarded(() => api.cheer(auth, id));
  if (r) patchSocial({ cheered: [...new Set([...state.social.cheered, id])] });
  return !!r;
}

export async function createGuild(rawName: string): Promise<boolean> {
  const auth = authOf();
  const name = cleanName(rawName, MAX_GUILD_NAME);
  if (!auth || !name) return false;
  await pushProfile(true);
  const r = await guarded(() => api.guildCreate(auth, name));
  if (r) await refreshSocial();
  return !!r;
}

export async function makeGuildInvite(gid: string): Promise<string | null> {
  const auth = authOf();
  if (!auth) return null;
  const have = state.social.guildInvites[gid];
  if (have && have.expiresAt > Date.now() + 86_400_000) return have.code;
  const r = await guarded(() => api.guildInvite(auth, gid));
  if (!r) return null;
  patchSocial({ guildInvites: { ...state.social.guildInvites, [gid]: r } });
  return r.code;
}

export async function joinGuild(code: string): Promise<boolean> {
  const auth = authOf();
  if (!auth) return false;
  await pushProfile(true);
  const r = await guarded(() => api.guildJoin(auth, code));
  if (r) await refreshSocial();
  return !!r;
}

export async function renameGuild(gid: string, rawName: string): Promise<boolean> {
  const auth = authOf();
  const name = cleanName(rawName, MAX_GUILD_NAME);
  if (!auth || !name) return false;
  const r = await guarded(() => api.guildRename(auth, gid, name));
  if (r) patchSocial({ guilds: (state.social.guilds ?? []).map((g) => (g.id === gid ? { ...g, name } : g)) });
  return !!r;
}

export async function setGuildBanner(gid: string, banner: string): Promise<boolean> {
  const auth = authOf();
  if (!auth) return false;
  const r = await guarded(() => api.guildBanner(auth, gid, banner));
  if (r) {
    patchSocial({ guilds: (state.social.guilds ?? []).map((g) => (g.id === gid ? { ...g, banner } : g)) });
    reconcileFlagNow(state.social.guilds ?? []);
  }
  return !!r;
}

export async function leaveGuild(gid: string): Promise<boolean> {
  const auth = authOf();
  if (!auth) return false;
  const r = await guarded(() => api.guildLeave(auth, gid));
  if (r) {
    patchSocial({ guilds: (state.social.guilds ?? []).filter((g) => g.id !== gid) });
    reconcileFlagNow(state.social.guilds ?? []);
  }
  return !!r;
}

// ---------------------------------------------------------------- the guided tour

/** True (and says so) while the tour is running: real backups, imports, sync and erasing are switched off in it. */
function inTour(): boolean {
  if (!state.sandbox) return false;
  showToast('That is switched off in the tour, so your own data stays safe.');
  return true;
}

let real: { data: AppData; settings: Settings } | null = null;
let doneInTour: string[] = [];

/** Begin (or jump within) the tour on throw-away practice verses. The owner's own data is set aside and comes back untouched. */
export function startTour(pos: TourPos = START) {
  if (!state.sandbox) {
    real = { data: state.data, settings: state.settings };
    doneInTour = [];
    const now = Date.now();
    set({
      sandbox: true,
      data: sampleTourData(now),
      settings: { ...state.settings, practice: { before: [], after: ['citation', 'topic'] }, shuffle: false, defaultMode: 'flashcard', nudgeDismissedAt: now, onboarded: true },
      tour: { pos, menu: false },
      tourMenu: false,
    });
  } else {
    set({ tour: { pos, menu: false } });
  }
}

export function setTourPos(pos: TourPos) {
  if (!state.tour) return;
  // finishing a lesson (moving past its last step) ticks it off
  if (pos.lesson > state.tour.pos.lesson) doneInTour = [...new Set([...doneInTour, LESSONS[state.tour.pos.lesson].id])];
  set({ tour: { ...state.tour, pos } });
}

export function openTourMenu(open: boolean) {
  if (state.tour) set({ tour: { ...state.tour, menu: open } });
  else set({ tourMenu: open });
}

/** Leave the tour: practice verses are dropped and the real data and settings come back. `finished` also earns the shield. */
export function endTour(finished: boolean) {
  if (!state.sandbox || !real) {
    set({ tour: null, tourMenu: false });
    return;
  }
  const lastDone = finished ? LESSONS.map((l) => l.id) : doneInTour;
  const back = real;
  real = null;
  set({ sandbox: false, tour: null, tourMenu: false, data: back.data, settings: back.settings });
  applyTheme();
  setFeedbackPrefs({ sound: state.settings.soundOn });
  updateSettings({ onboarded: true, tour: { done: doneLessons([...state.settings.tour.done, ...lastDone]) } });
  doneInTour = [];
  scheduleSync();
  if (finished) {
    act((d, now) => {
      d.tourAt = Math.max(d.tourAt ?? 0, now);
    });
    navigate('/avatar');
    showToast('Tour finished. You earned the Shield of Faith.');
  } else navigate('/');
}

/** After the last step. */
export function finishTour() {
  endTour(true);
}

/** Move on one step (ending the tour after the last one). */
export function tourNext() {
  if (!state.tour) return;
  const n = nextPos(state.tour.pos);
  if (n) setTourPos(n);
  else finishTour();
}

// ---------------------------------------------------------------- backup

export function downloadBackup() {
  if (inTour()) return;
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
  if (inTour()) return;
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
  if (inTour()) return false;
  const snap = await storage.loadSnapshot(key);
  if (!snap) return false;
  importBackup(snap, 'replace');
  return true;
}

/** Erase everything on this device. The previous data is kept in memory and (as always) in the saved
 *  "previous copy" + daily snapshots, so the toast can offer a real undo. */
export function resetEverything() {
  if (inTour()) return;
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
  if (state.sandbox || !state.settings.syncCode) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void syncNow(), 6000);
}

export async function syncNow(): Promise<void> {
  const code = state.settings.syncCode;
  if (!code || syncing || state.sandbox) return;
  if (!state.online) {
    set({ sync: { kind: 'idle' } });
    return;
  }
  syncing = true;
  set({ sync: { kind: 'syncing' } });
  try {
    const result = await runSync(code, state.data);
    if (state.sandbox) {
      // the tour began while this sync was in flight: its practice verses must never mix with the real data; sync again afterwards
      set({ sync: { kind: 'idle' } });
      return;
    }
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
  if (inTour()) return null;
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
  setFeedbackPrefs({ sound: settings.soundOn });
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
      void pushProfile();
    }
  });
  setInterval(refresh, 30_000);
  if (settings.syncCode) void syncNow();
  void pushProfile();
}

// For tests / debugging
declare global {
  interface Window {
    __mfl?: { getState: typeof getState; flush: typeof flushSaves; crash: (v: boolean) => void; armorFree: (v: boolean) => void };
  }
}
if (typeof window !== 'undefined') window.__mfl = { getState, flush: flushSaves, crash: (v: boolean) => set({ debugCrash: v }), armorFree: (v: boolean) => void (testing.armorFree = v) };
