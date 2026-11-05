/** Line pictograms for empty states, the welcome slides and pop-ups: one hairline weight, drawn on a 48-unit grid, coloured by the text around them. */
const PATHS = {
  book: 'M6 10c6-2 12-2 18 2 6-4 12-4 18-2v26c-6-2-12-2-18 2-6-4-12-4-18-2zM24 12v26',
  plus: 'M24 10v28M10 24h28',
  piles: 'M8 12h32M8 20h26M8 28h20M8 36h14',
  cards: 'M14 10h24v28H14zM10 15v28h24',
  flame: 'M24 6c2 7 11 11 11 22a11 11 0 0 1-22 0c0-4 2-7 4-9 0 4 2 6 4 6 0-6-2-10 3-19z',
  sprout: 'M24 42V22M24 24c0-8-5-12-13-12 0 8 4 12 13 12zM24 30c0-6 4-10 12-10 0 7-4 10-12 10z',
  leaf: 'M10 38C10 20 20 10 38 10c0 18-10 28-28 28zM10 38l16-16',
  tree: 'M24 42V26M24 26c-9 0-14-5-14-12 8 0 12 3 14 8 2-5 6-8 14-8 0 7-5 12-14 12zM18 42h12',
  burst: 'M24 6v10M24 32v10M6 24h10M32 24h10M11 11l7 7M30 30l7 7M37 11l-7 7M18 30l-7 7',
  lock: 'M12 22h24v18H12zM17 22v-6a7 7 0 0 1 14 0v6',
  pair: 'M17 34a9 9 0 1 1 0-18 9 9 0 0 1 0 18zM31 34a9 9 0 1 1 0-18 9 9 0 0 1 0 18z',
} as const;

export type MarkName = keyof typeof PATHS;

export function Mark({ name, size = 44 }: { name: MarkName; size?: number }) {
  return (
    <svg class="mark" width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
