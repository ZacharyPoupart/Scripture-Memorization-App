import type { ReviewMode } from '../core/types.ts';
import { updateSettings, useApp } from '../store.ts';
import { Icon, Seg } from './common.tsx';

export const MODES: { value: ReviewMode; label: string; long: string; blurb: string }[] = [
  { value: 'flashcard', label: 'Flashcard', long: 'Flashcard', blurb: 'See the reference, recall the verse, flip to check.' },
  { value: 'blanks', label: 'Blanks', long: 'Fill in the blank', blurb: 'Choose the missing words.' },
  { value: 'type', label: 'Type', long: 'Type it out', blurb: 'Type the first letter of each word.' },
  { value: 'speak', label: 'Speak', long: 'Speak it', blurb: 'Recite aloud and get word-by-word feedback.' },
];

export function ModePicker({ onChange }: { onChange?: (m: ReviewMode) => void }) {
  const { settings } = useApp();
  return (
    <div class="stack" style={{ '--gap': '8px' } as never}>
      <div class="mode-row" data-testid="mode-picker">
        <Seg
          label="Review mode"
          value={settings.defaultMode}
          options={MODES.map((m) => ({ value: m.value, label: m.label }))}
          onChange={(m) => {
            updateSettings({ defaultMode: m });
            onChange?.(m);
          }}
        />
        <button
          type="button"
          class="shuffle-btn"
          aria-pressed={settings.shuffle}
          aria-label="Shuffle the order of verses in a review"
          title={settings.shuffle ? 'Shuffle is on: verses come in a random order' : 'Shuffle off: longest-held verses first'}
          onClick={() => updateSettings({ shuffle: !settings.shuffle })}
          data-testid="shuffle-toggle"
        >
          <Icon name="shuffle" />
        </button>
      </div>
    </div>
  );
}
