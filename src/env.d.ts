/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

declare module '*/functions/_lib/sync.js' {
  export function handleSync(
    request: Request,
    kv: { get(key: string, type?: string): Promise<any>; put(key: string, value: string): Promise<void> } | undefined,
    id: string,
  ): Promise<Response>;
}

declare module '*/functions/_lib/social.js' {
  export function cleanName(raw: unknown, max?: number): string;
  export function cleanSnap(raw: unknown): Record<string, unknown> | null;
  export function handleSocial(
    request: Request,
    kv:
      | {
          get(key: string, type?: string): Promise<any>;
          put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
          delete(key: string): Promise<void>;
        }
      | undefined,
    action: string,
    now?: number,
  ): Promise<Response>;
}

declare module '*/functions/_lib/verse.js' {
  export const USFM: string[];
  export function clearBibleIdCache(): void;
  export function handleVerse(
    request: Request,
    env: Record<string, string | undefined>,
    fetchFn?: typeof fetch,
  ): Promise<Response>;
}
