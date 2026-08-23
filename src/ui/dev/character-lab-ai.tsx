'use client';

import { listStatusDefinitions } from '@/data/status/registry';
import { COMBAT_ENERGY } from '@/constants/combat-energy';
import {
  SKILL_AI_CONDITION_LABELS,
  SKILL_AI_CONDITION_TYPES,
  SKILL_AI_PRIORITIES,
  type SkillAiCondition,
  type SkillAiConditionType,
  type SkillAiConfig,
} from '@/data/skill-ai-def';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';

export function CharacterLabAiEditor() {
  const skillAi = useStore(characterLabStore, (s) => s.skillAi);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const statuses = listStatusDefinitions();

  const patch = (partial: Partial<SkillAiConfig>) => {
    characterLabStore.setSkillAi({ ...skillAi, ...partial });
  };

  const setCondition = (index: number, next: SkillAiCondition) => {
    const conditions = [...(skillAi.conditions ?? [])];
    conditions[index] = next;
    patch({ conditions });
  };

  return (
    <section className="character-lab__section">
      <h4>PRIORIDADE DA IA</h4>
      <p className="character-lab__hint">
        1 = maior prioridade. Independente da ordem visual dos slots. Reordenar o hotbar não
        altera este valor.
      </p>
      <div className="character-lab__chips">
        {SKILL_AI_PRIORITIES.map((priority) => (
          <button
            key={priority}
            type="button"
            className={(skillAi.priority ?? originals.skillAi.priority) === priority ? 'is-active' : undefined}
            onClick={() => patch({ priority })}
          >
            {priority}
          </button>
        ))}
      </div>
      <label>
        <input
          type="checkbox"
          checked={skillAi.autoUse !== false}
          onChange={(event) => patch({ autoUse: event.target.checked })}
        />
        Usar automaticamente
      </label>
      <label>
        Energy Cost
        <input
          type="number"
          min={0}
          value={skillAi.energyCost ?? skillAi.chakraCost ?? COMBAT_ENERGY.defaultSkillEnergyCost}
          onChange={(event) => {
            const n = Number(event.target.value);
            patch({ energyCost: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0 });
          }}
        />
      </label>
      <h4>Condições (AND)</h4>
      {(skillAi.conditions ?? []).map((row, index) => (
        <div key={`${row.type}-${index}`} className="character-lab__actions">
          <select
            value={row.type}
            onChange={(event) =>
              setCondition(index, { ...row, type: event.target.value as SkillAiConditionType })
            }
          >
            {SKILL_AI_CONDITION_TYPES.map((type) => (
              <option key={type} value={type}>
                {SKILL_AI_CONDITION_LABELS[type]}
              </option>
            ))}
          </select>
          {row.type === 'self-hp-below' || row.type === 'target-hp-below' || row.type === 'target-hp-above' ? (
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round((row.value ?? 0.5) * 100)}
              onChange={(event) =>
                setCondition(index, { ...row, value: Math.min(1, Math.max(0, Number(event.target.value) / 100)) })
              }
            />
          ) : null}
          {row.type === 'status-present' || row.type === 'status-absent' ? (
            <select
              value={row.statusId ?? ''}
              onChange={(event) => setCondition(index, { ...row, statusId: event.target.value })}
            >
              <option value="">status…</option>
              {statuses.map((def) => (
                <option key={def.id} value={def.id}>
                  {def.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={() =>
              patch({ conditions: (skillAi.conditions ?? []).filter((_, i) => i !== index) })
            }
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => patch({ conditions: [...(skillAi.conditions ?? []), { type: 'always' }] })}
      >
        + Condição
      </button>
    </section>
  );
}
