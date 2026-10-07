import { normalizeData } from '../core/backup.ts';
import { mergeData } from '../core/merge.ts';
import type { AppData } from '../core/types.ts';
import { decryptJson, deriveKeys, encryptJson } from './syncCrypto.ts';

export type SyncErrorCode = 'offline' | 'not-configured' | 'wrong-code' | 'server' | 'insecure';

export class SyncError extends Error {
  constructor(
    public code: SyncErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface SyncResult {
  merged: AppData;
  pushed: boolean;
  pulled: boolean;
}

type Fetch = typeof fetch;

/** Stable stringify so equal data compares equal regardless of key order. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val).sort(([a], [b]) => (a < b ? -1 : 1)))
      : val,
  );
}

/**
 * Pull -> merge -> push. Safe to run repeatedly and from several devices: merge is
 * commutative/idempotent, and the server rejects stale writes (409) so we simply re-merge.
 */
export async function runSync(code: string, local: AppData, fetchFn: Fetch = fetch): Promise<SyncResult> {
  if (typeof crypto === 'undefined' || !crypto.subtle)
    throw new SyncError('insecure', 'Sync needs a secure (https) connection.');
  const { id, key } = await deriveKeys(code);
  const url = `/api/sync/${id}`;
  let merged = local;
  let pulled = false;

  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetchFn(url, { cache: 'no-store' });
    } catch {
      throw new SyncError('offline', 'You appear to be offline.');
    }
    if (res.status === 501) throw new SyncError('not-configured', 'Sync is not set up on this server yet.');
    if (res.status !== 200 && res.status !== 404) throw new SyncError('server', `Sync server error (${res.status}).`);

    let rev = 0;
    let remote: AppData | null = null;
    if (res.status === 200) {
      const body = (await res.json()) as { rev: number; blob: string };
      rev = body.rev;
      try {
        remote = normalizeData(await decryptJson(key, body.blob));
      } catch {
        throw new SyncError('wrong-code', 'Could not read the synced data. Check the link code.');
      }
    }

    merged = remote ? mergeData(merged, remote) : merged;
    pulled = pulled || (remote !== null && stable(merged) !== stable(local));

    if (remote && stable(merged) === stable(remote)) return { merged, pushed: false, pulled };

    const blob = await encryptJson(key, merged);
    let put: Response;
    try {
      put = await fetchFn(url, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseRev: rev, blob }),
      });
    } catch {
      throw new SyncError('offline', 'You appear to be offline.');
    }
    if (put.status === 200) return { merged, pushed: true, pulled };
    if (put.status === 409) continue; // someone else wrote first: pull again and re-merge
    throw new SyncError('server', `Sync server error (${put.status}).`);
  }
  throw new SyncError('server', 'Sync kept conflicting. Try again in a moment.');
}
