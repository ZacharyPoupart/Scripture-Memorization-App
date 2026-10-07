// Link-code based sync, end-to-end encrypted. The 20-character code never leaves your devices;
// the server only sees a derived id and an AES-GCM encrypted blob.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I L O U)

export function generateSyncCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 32];
  return formatSyncCode(out);
}

export function formatSyncCode(clean: string): string {
  return clean.match(/.{1,5}/g)?.join('-') ?? clean;
}

/** Accepts what people type: any case, spaces/dashes, and the ambiguous O/I/L characters. */
export function normalizeSyncCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (s.length !== 20 || [...s].some((c) => !ALPHABET.includes(c))) return null;
  return formatSyncCode(s);
}

const enc = new TextEncoder();

export interface SyncKeys {
  id: string;
  key: CryptoKey;
}

export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle;
}

export async function deriveKeys(code: string): Promise<SyncKeys> {
  const clean = code.replace(/-/g, '');
  const base = await crypto.subtle.importKey('raw', enc.encode(clean), 'HKDF', false, ['deriveBits', 'deriveKey']);
  const salt = enc.encode('memorize-for-life/v1');
  const idBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('id') }, base, 128);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('aes') },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const id = [...new Uint8Array(idBits)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { id, key };
}


export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(value))));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  // chunked to avoid call-stack limits on big payloads
  let bin = '';
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function decryptJson(key: CryptoKey, blob: string): Promise<unknown> {
  const raw = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt));
}
