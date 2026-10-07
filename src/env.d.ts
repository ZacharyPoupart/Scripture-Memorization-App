/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

declare module '*/functions/_lib/sync.js' {
  export function handleSync(
    request: Request,
    kv: { get(key: string, type?: string): Promise<any>; put(key: string, value: string): Promise<void> } | undefined,
    id: string,
  ): Promise<Response>;
}
