'use client';

import { isDevMode } from '@/config/devConfig';
import { MAX_AWAKENING_LEVEL, formatAwakeningRoman } from '@/constants/character-awakening';
import { getPassiveDefinition } from '@/data/passives/registry';
import { useStore } from '@/hooks/use-store';
import { nextAwakeningLabel } from '@/lib/character-awakening';
import { getActiveAwakeningRewards, getAwakeningModifiers } from '@/lib/awakening-rewards';
import { validateAwakeningConfigs } from '@/lib/awakening-validation';
import { attributesStore } from '@/stores/attributes-store';
import { characterLabStore } from '@/stores/character-lab-store';
import { teamStore } from '@/stores/team-store';

export function CharacterLabAwakeningDebug() {
  const collection = useStore(teamStore, (s) => s.collection);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const preview = useStore(characterLabStore, (s) => s.previewAwakening);
  const instance = collection.find((entry) => entry.id === activeId) ?? null;

  if (!isDevMode()) return null;

  const current = instance?.awakeningLevel ?? 0;
  const mods = getAwakeningModifiers(playerId, preview);
  const activeRewards = getActiveAwakeningRewards(playerId, preview);
  const validationWarnings = validateAwakeningConfigs();

  return (
    <section className="character-lab__section">
      <h4>AWAKENING</h4>
      <p>
        <strong>Awakening Level</strong> {current} / {MAX_AWAKENING_LEVEL} (
        {formatAwakeningRoman(current)})
      </p>
      <p>
        <strong>Preview Awakening</strong> {preview === 0 ? 'Base' : formatAwakeningRoman(preview)}
      </p>
      <p>
        <strong>Active Awakening Rewards</strong>{' '}
        {activeRewards.length === 0
          ? 'nenhum'
          : activeRewards.map((row) => formatAwakeningRoman(row.level)).join(' + ')}
      </p>
      <p>
        <strong>Active Skill Overrides</strong>{' '}
        {mods.skillOverrides.length === 0
          ? 'nenhum'
          : mods.skillOverrides.map((row) => row.skillId).join(', ')}
      </p>
      <p>
        <strong>Active Passive</strong>{' '}
        {mods.passives.length === 0
          ? 'nenhuma'
          : mods.passives.map((id) => getPassiveDefinition(id)?.name ?? id).join(', ')}
      </p>
      {validationWarnings.length > 0 ? (
        <p className="character-lab__hint">
          Validação: {validationWarnings.join(' · ')}
        </p>
      ) : (
        <p className="character-lab__hint">Validação: ok</p>
      )}
      {instance ? (
        <>
          <p className="character-lab__hint">
            Instance: {instance.name} #{instance.id.slice(0, 8)} · Next {nextAwakeningLabel(current)}
          </p>
          <div className="character-lab__actions">
            {[0, 1, 2, 3].map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => {
                  teamStore.setCharacterAwakening(instance.id, level);
                  attributesStore.onActiveCharacterChanged(false);
                }}
              >
                Set {level}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                teamStore.setCharacterAwakening(instance.id, 0);
                attributesStore.onActiveCharacterChanged(false);
              }}
            >
              Reset
            </button>
          </div>
        </>
      ) : (
        <p className="character-lab__hint">Sem CharacterInstance ativa da coleção.</p>
      )}
    </section>
  );
}
