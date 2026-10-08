// Tiny safety nets for older iPhones (iOS before 15.4 lacks structuredClone). All app data is plain JSON.
export function installPolyfills(g: { structuredClone?: unknown } = globalThis as never): void {
  if (typeof g.structuredClone !== 'function') {
    g.structuredClone = <T,>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));
  }
}
installPolyfills();
