'use client';

import { attributesStore } from '@/stores/attributes-store';
import { characterLabStore } from '@/stores/character-lab-store';

const LEVELS: Array<{ id: 0 | 1 | 2 | 3; label: string }> = [
  { id: 0, label: 'Base' },
  { id: 1, label: 'I' },
  { id: 2, label: 'II' },
  { id: 3, label: 'III' },
];

/** Preview visual/config. Não altera awakeningLevel da CharacterInstance. */
export function LabPreviewAwakening({ preview }: { preview: 0 | 1 | 2 | 3 }) {
  return (
    <section className="character-lab__section">
      <h4>PREVIEW AWAKENING</h4>
      <p className="character-lab__hint">Só preview. Não salva o Despertar da instância.</p>
      <div className="character-lab__chips">
        {LEVELS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={preview === entry.id ? 'is-active' : undefined}
            onClick={() => {
              characterLabStore.setPreviewAwakening(entry.id);
              attributesStore.onActiveCharacterChanged(false);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>
    </section>
  );
}
