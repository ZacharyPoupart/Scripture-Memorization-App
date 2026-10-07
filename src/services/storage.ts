// Local persistence. Primary store is IndexedDB; if it isn't available (some private modes)
// we fall back to localStorage. Every save keeps the previous copy, and one snapshot per day
// (last 7 days) is kept, so a bug or bad import can always be undone from Settings.
import { normalizeData } from '../core/backup.ts';
import { createData } from '../core/schedule.ts';
import type { AppData, Settings } from '../core/types.ts';
import { uid } from '../core/ids.ts';

const DB_NAME = 'memorize-for-life';
const STORE = 'kv';

interface Backend {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
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
    del: async (k) => void (await run('readwrite', (s) => s.delete(k))),
    keys: async () => (await run('readonly', (s) => s.getAllKeys())).map(String),
  };
}

function localStorageBackend(): Backend {
  const P = 'mfl:';
  return {
    get: async (k) => localStorage.getItem(P + k) ?? undefined,
    set: async (k, v) => localStorage.setItem(P + k, v),
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
  async loadData(now: number): Promise<{ data: AppData; recoveredFrom?: string }> {
    for (const key of ['data', 'data.prev']) {
      const raw = await this.backend.get(key);
      if (!raw) continue;
      try {
        return { data: normalizeData(JSON.parse(raw)), recoveredFrom: key === 'data' ? undefined : key };
      } catch {
        /* try next */
      }
    }
    return { data: createData(now) };
  }

  async saveData(data: AppData, today: string): Promise<void> {
    const prev = await this.backend.get('data');
    const next = JSON.stringify(data);
    if (prev === next) return;
    if (prev) await this.backend.set('data.prev', prev);
    await this.backend.set('data', next);
    const snapKey = `snap:${today}`;
    if (!(await this.backend.get(snapKey)) && prev) {
      await this.backend.set(snapKey, prev);
      const snaps = (await this.backend.keys()).filter((k) => k.startsWith('snap:')).sort();
      for (const old of snaps.slice(0, Math.max(0, snaps.length - 7))) await this.backend.del(old);
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
