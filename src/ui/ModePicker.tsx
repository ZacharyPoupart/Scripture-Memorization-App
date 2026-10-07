import type { ReviewMode } from '../core/types.ts';
import { updateSettings, useApp } from '../store.ts';
import { Seg } from './common.tsx';

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
      <Seg
        label="Review mode"
        value={settings.defaultMode}
        options={MODES.map((m) => ({ value: m.value, label: m.label }))}
        onChange={(m) => {
          updateSettings({ defaultMode: m });
          onChange?.(m);
        }}
      />
      <div class="hint-text">{MODES.find((m) => m.value === settings.defaultMode)?.blurb}</div>
    </div>
  );
}
