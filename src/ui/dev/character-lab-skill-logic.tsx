'use client';

import { CharacterRegistry } from '@/data/characters';
import { SKILL_DAMAGE_TRIGGERS, type SkillDamageTrigger } from '@/data/character-packs';
import { getSkill } from '@/data/skills';
import { CAST_DELAY_PRESETS_MS } from '@/lib/dev/lab-save-fields';
import type { LabSkillSlot } from '@/lib/dev/lab-skill-slots';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';
import { CharacterLabAiEditor } from '@/ui/dev/character-lab-ai';
import { CharacterLabElementEditor } from '@/ui/dev/character-lab-element';
import { CharacterLabExecutionEditor } from '@/ui/dev/character-lab-execution';
import { CharacterLabStatusEditor } from '@/ui/dev/character-lab-status';
import { CharacterLabJutsuFps } from '@/ui/dev/character-lab-jutsu-fps';
import { ValueRow } from '@/ui/dev/character-lab-value-row';

const TRIGGER_LABELS: Record<SkillDamageTrigger, string> = {
  'hit-delay': 'Hit Delay',
  'on-arrival': 'On Arrival',
  'on-effect-start': 'On Effect Start',
};

export function CharacterLabSkillLogic({
  characterName,
  selectedSlot,
  lastSkillId,
  skillName,
  saveBusy,
  logicDirty,
  onManageStatus,
  onSave,
}: {
  characterName: string;
  selectedSlot: LabSkillSlot;
  lastSkillId: string | null;
  skillName: string;
  saveBusy: boolean;
  logicDirty: boolean;
  onManageStatus: () => void;
  onSave: () => void;
}) {
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const dataEpoch = useStore(characterLabStore, (s) => s.dataEpoch);
  const castDelayMs = useStore(characterLabStore, (s) => s.castDelayMs);
  const originals = useStore(characterLabStore, (s) => s.skillOriginals);
  const skill = lastSkillId ? getSkill(lastSkillId) : null;
  const selectedAnim =
    playerId && lastSkillId
      ? CharacterRegistry.get(playerId)?.pack.skillAnims[lastSkillId]
      : undefined;
  void dataEpoch;
  const damageTrigger = (selectedAnim?.damageTrigger ?? 'hit-delay') as SkillDamageTrigger;

  return (
    <section className="character-lab__section">
      <p className="character-lab__hint">
        PERSONAGEM {characterName} · SLOT {selectedSlot} · SKILL {skillName}
      </p>

      <h4>IDENTIDADE</h4>
      <label>
        Nome
        <input type="text" value={skill?.name ?? skillName} readOnly disabled />
      </label>
      <label>
        ID
        <input type="text" value={lastSkillId ?? '—'} readOnly disabled />
      </label>
      <p className="character-lab__hint">Slot: {selectedSlot}</p>

      <CharacterLabExecutionEditor />
      <CharacterLabElementEditor />

      <h4>CAST DELAY</h4>
      <ValueRow
        label="Cast Delay"
        original={originals.castDelayMs}
        value={castDelayMs}
        presets={[...CAST_DELAY_PRESETS_MS]}
        step={50}
        suffix=" ms"
        onChange={(value) => characterLabStore.setFlag('castDelayMs', Math.max(0, Math.round(value)))}
      />
      <p className="character-lab__hint">Pose → Cast Delay → Effect</p>

      <CharacterLabJutsuFps disabled={!lastSkillId} />

      <h4>MOMENTO DO DANO</h4>
      <p className="character-lab__hint">
        {TRIGGER_LABELS[SKILL_DAMAGE_TRIGGERS.includes(damageTrigger) ? damageTrigger : 'hit-delay']}
        {damageTrigger === 'hit-delay' && selectedAnim ? ` · Hit Delay: ${selectedAnim.hitDelayMs} ms` : ''}
      </p>
      <p className="character-lab__hint">Somente leitura — valor já salvo na Skill.</p>

      <CharacterLabStatusEditor onManageLibrary={onManageStatus} />
      <CharacterLabAiEditor />

      <div className="character-lab__actions">
        <button
          type="button"
          className="character-lab__save-btn"
          disabled={saveBusy || (!logicDirty && Boolean(lastSkillId))}
          onClick={onSave}
        >
          {saveBusy ? 'Salvando...' : 'Salvar Alterações da Skill'}
        </button>
      </div>
    </section>
  );
}
