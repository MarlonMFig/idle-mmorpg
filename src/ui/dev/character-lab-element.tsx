'use client';

import { DAMAGE_ELEMENTS, DAMAGE_ELEMENT_LABELS, type DamageElement } from '@/data/damage-elements';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';

export function CharacterLabElementEditor() {
  const skillElement = useStore(characterLabStore, (s) => s.skillElement);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const dirty = skillElement !== originals.skillElement;

  return (
    <section className="character-lab__section">
      <h4>ELEMENTO</h4>
      <p className="character-lab__hint">
        Vem da SkillDefinition (overlay do pack). Não é inferido pelo VFX. Ausente = Neutral.
        {dirty ? ' · alteração não salva' : ''}
      </p>
      <label>
        Elemento
        <select
          value={skillElement}
          onChange={(event) => characterLabStore.setSkillElement(event.target.value as DamageElement)}
        >
          {DAMAGE_ELEMENTS.map((id) => (
            <option key={id} value={id}>
              {DAMAGE_ELEMENT_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
