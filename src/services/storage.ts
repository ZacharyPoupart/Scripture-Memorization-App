// Local persistence. Primary store is IndexedDB; if it isn't available (some private modes)
// we fall back to localStorage. Every save keeps the previous copy, and one snapshot per day
// (last 7 days) is kept, so a bug or bad import can always be undone from Settings.
import { normalizeData } from '../core/backup.ts';
import { createData } from '../core/schedule.ts';
import type { AppData, Settings } from '../core/types.ts';
import { uid } from '../core/ids.ts';

const DB_NAME = 'memorize-for-life';
const STORE = 'kv';

export interface Backend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  /** Write several keys atomically (one transaction): all land or none do. */
  setMany(entries: [string, string][]): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

function idbBackend(): Backend | null {
  if (typeof indexedDB === 'undefined') return null;
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k) as IDBRequest<string | undefined>),
    set: async (k, v) => void (await run('readwrite', (s) => s.put(v, k))),
    setMany: async (entries) => {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        for (const [k, v] of entries) store.put(v, k);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    del: async (k) => void (await run('readwrite', (s) => s.delete(k))),
    keys: async () => (await run('readonly', (s) => s.getAllKeys())).map(String),
  };
}

function localStorageBackend(): Backend {
  const P = 'mfl:';
  return {
    get: async (k) => localStorage.getItem(P + k) ?? undefined,
    set: async (k, v) => localStorage.setItem(P + k, v),
    setMany: async (entries) => {
      for (const [k, v] of entries) localStorage.setItem(P + k, v);
    },
    del: async (k) => localStorage.removeItem(P + k),
    keys: async () => Object.keys(localStorage).filter((k) => k.startsWith(P)).map((k) => k.slice(P.length)),
  };
}

export function defaultSettings(): Settings {
  return {
    deviceId: uid(),
    theme: 'system',
    defaultMode: 'flashcard',
    fillDifficulty: 'medium',
    onboarded: false,
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
  };
}

export interface Snapshot {
  key: string;
  day: string;
}

export class Storage {
  private backend: Backend;
  constructor(backend?: Backend) {
    this.backend = backend ?? idbBackend() ?? localStorageBackend();
  }

  async loadSettings(): Promise<Settings> {
    const raw = await this.backend.get('settings');
    const base = defaultSettings();
    if (!raw) {
      await this.saveSettings(base);
      return base;
    }
    try {
      return { ...base, ...JSON.parse(raw), deviceId: JSON.parse(raw).deviceId || base.deviceId };
    } catch {
      return base;
    }
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.backend.set('settings', JSON.stringify(s));
  }

  /** Load data; falls back to the previous copy if the main one is unreadable. Never throws on corruption. */
  async loadData(now: number): Promise<{ data: AppData; recoveredFrom?: string; quarantinedAs?: string }> {
    const unreadable: [string, string][] = [];
    for (const key of ['data', 'data.prev']) {
      const raw = await this.backend.get(key);
      if (!raw) continue;
      try {
        const data = normalizeData(JSON.parse(raw));
        // Remember which copy is the good one, so the next save keeps it as "previous" (never a damaged file).
        this.lastData = raw;
        this.haveLastData = true;
        return { data, recoveredFrom: key === 'data' ? undefined : key };
      } catch {
        unreadable.push([key, raw]);
      }
    }
    // Nothing readable. Starting empty must never be what destroys the only copy of someone's verses
    // (e.g. data written by a newer version, then the app rolled back): keep the unreadable text aside
    // under its own key, where later saves never touch it, before anything new is written.
    if (unreadable.length) {
      const key = `unreadable:${now}`;
      try {
        await this.backend.setMany([[key, unreadable[0][1]]]);
        return { data: createData(now), quarantinedAs: key };
      } catch {
        /* if even that fails, carry on with an empty start rather than a blank screen */
      }
    }
    return { data: createData(now) };
  }

  // What is on disk right now, remembered so a save needs no read first. Every step between
  // "the user finished something" and "it is on disk" is a chance to lose it if the app closes,
  // so a save is exactly ONE atomic write: the new data, the previous copy, and (once a day) a snapshot.
  private lastData: string | undefined;
  private haveLastData = false;
  private snapKeys: Set<string> | undefined;

  async saveData(data: AppData, today: string): Promise<void> {
    const next = JSON.stringify(data);
    if (!this.haveLastData) {
      this.lastData = await this.backend.get('data');
      this.haveLastData = true;
    }
    const prev = this.lastData;
    if (prev === next) return;
    this.snapKeys ??= new Set((await this.backend.keys()).filter((k) => k.startsWith('snap:')));

    const entries: [string, string][] = [['data', next]];
    if (prev) entries.push(['data.prev', prev]);
    const snapKey = `snap:${today}`;
    const addSnapshot = !!prev && !this.snapKeys.has(snapKey);
    if (addSnapshot) entries.push([snapKey, prev as string]);

    await this.backend.setMany(entries); // throws => nothing changed, cache untouched, next save retries
    this.lastData = next;
    if (addSnapshot) {
      this.snapKeys.add(snapKey);
      // Tidying old snapshots is not urgent; it never delays or endangers the save itself.
      const old = [...this.snapKeys].sort().slice(0, Math.max(0, this.snapKeys.size - 7));
      for (const k of old) {
        this.snapKeys.delete(k);
        void this.backend.del(k).catch(() => {});
      }
    }
  }

  async listSnapshots(): Promise<Snapshot[]> {
    return (await this.backend.keys())
      .filter((k) => k.startsWith('snap:'))
      .sort()
      .reverse()
      .map((key) => ({ key, day: key.slice(5) }));
  }

  async loadSnapshot(key: string): Promise<AppData | null> {
    const raw = await this.backend.get(key);
    if (!raw) return null;
    try {
      return normalizeData(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
