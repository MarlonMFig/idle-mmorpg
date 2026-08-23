'use client';

import { useMemo, useState } from 'react';
import type { CharacterPack } from '@/data/character-packs';
import { getSkill, listCatalogSkills } from '@/data/skills';
import { DAMAGE_ELEMENT_LABELS, resolveSkillElement } from '@/data/damage-elements';
import { resolveSkillAi } from '@/data/skill-ai-def';
import { extraLegacySkillIds, LAB_SKILL_SLOTS, type LabSkillSlot, type OfficialHotbar } from '@/lib/dev/lab-skill-slots';
import { upsertDevHotbar, upsertDevSkillAnim } from '@/lib/dev/dev-runtime-registry';
import { fetchDevSave } from '@/lib/dev/dev-save-fetch';
import { characterLabStore } from '@/stores/character-lab-store';

function skillLabel(skillId: string | null): string {
  if (!skillId) return 'Vazio';
  return getSkill(skillId)?.name ?? skillId;
}

export function CharacterLabSkillsTab({
  playerId,
  pack,
  slots,
  selectedSlot,
  orderDirty,
  saveBusy,
  onSelectSlot,
  onEditSlot,
  onSaved,
  onError,
}: {
  playerId: string | null;
  pack: CharacterPack | null;
  slots: OfficialHotbar;
  selectedSlot: LabSkillSlot;
  orderDirty: boolean;
  saveBusy: boolean;
  onSelectSlot: (slot: LabSkillSlot) => void;
  onEditSlot: (slot: LabSkillSlot) => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [replaceSlot, setReplaceSlot] = useState<LabSkillSlot | null>(null);
  const [replaceId, setReplaceId] = useState('');
  const [busy, setBusy] = useState(false);
  const catalog = useMemo(() => listCatalogSkills(), [pack, slots]);
  const extras = pack ? extraLegacySkillIds(pack) : [];

  const post = async (body: Record<string, unknown>) => {
    if (!playerId) return null;
    setBusy(true);
    try {
      const res = await fetchDevSave('/api/dev/lab-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: playerId, slots, ...body }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        slots?: OfficialHotbar;
        skillAnim?: Record<string, unknown>;
        skillId?: string | null;
      };
      if (!res.ok || !json.ok) {
        onError(json.error ?? 'Não foi possível salvar.');
        return null;
      }
      return json;
    } catch (error: unknown) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="character-lab__section">
      <h3>SKILLS</h3>
      <p className="character-lab__hint">
        Quatro slots oficiais. Reordenar troca a referência completa (skillId, VFX, pose, efeito).
        Remover ou substituir não apaga a SkillDefinition.
      </p>
      {orderDirty ? <p className="character-lab__hint is-ok">Skill Order Changed</p> : null}

      <div className="character-lab__skill-slots">
        {LAB_SKILL_SLOTS.map((slot) => {
          const skillId = slots[slot - 1] ?? null;
          const skill = skillId ? getSkill(skillId) : null;
          const ai = resolveSkillAi(pack?.skillAnims[skillId ?? '']?.ai, skill?.ai, slot);
          return (
            <article
              key={slot}
              className={`character-lab__skill-slot${selectedSlot === slot ? ' is-active' : ''}`}
            >
              <button
                type="button"
                className="character-lab__skill-slot-main"
                onClick={() => onSelectSlot(slot)}
              >
                <strong>[ Slot {slot} ]</strong>
                <span>{skillLabel(skillId)}</span>
                {skillId ? (
                  <span>
                    {DAMAGE_ELEMENT_LABELS[resolveSkillElement(skill)]} · P{ai.priority}{' '}
                    {ai.autoUse ? 'Auto' : 'Manual'}
                  </span>
                ) : null}
                {skillId ? <code>{skillId}</code> : null}
              </button>
              <div className="character-lab__skill-slot-tools">
                <button
                  type="button"
                  aria-label={`Mover slot ${slot} para cima`}
                  disabled={slot === 1 || busy || saveBusy}
                  onClick={() => characterLabStore.moveSkillSlot(slot, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Mover slot ${slot} para baixo`}
                  disabled={slot === 4 || busy || saveBusy}
                  onClick={() => characterLabStore.moveSkillSlot(slot, 1)}
                >
                  ↓
                </button>
              </div>
              {skillId ? (
                <div className="character-lab__actions">
                  <button type="button" onClick={() => onEditSlot(slot)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplaceSlot(slot);
                      setReplaceId(skillId);
                    }}
                  >
                    Substituir Skill
                  </button>
                  <button
                    type="button"
                    disabled={busy || saveBusy}
                    onClick={() => {
                      void post({ action: 'clear-slot', slot }).then((json) => {
                        if (!json?.slots) return;
                        upsertDevHotbar(playerId!, json.slots);
                        characterLabStore.applySavedHotbar(json.slots, { selectSlot: slot });
                        onSaved('Slot esvaziado ✓');
                      });
                    }}
                  >
                    Remover do Slot
                  </button>
                </div>
              ) : (
                <div className="character-lab__actions">
                  <button type="button" onClick={() => onEditSlot(slot)}>
                    + Criar Skill neste Slot
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <div className="character-lab__actions">
        <button
          type="button"
          className="character-lab__save-btn"
          disabled={!playerId || !orderDirty || busy || saveBusy}
          onClick={() => {
            void post({ action: 'reorder', slots }).then((json) => {
              if (!json?.slots) return;
              upsertDevHotbar(playerId!, json.slots);
              characterLabStore.applySavedHotbar(json.slots);
              onSaved('Ordem salva ✓');
            });
          }}
        >
          Salvar Ordem
        </button>
        <button
          type="button"
          disabled={!orderDirty || busy}
          onClick={() => characterLabStore.setDraftHotbar(null)}
        >
          Descartar Ordem
        </button>
      </div>

      {extras.length > 0 ? (
        <p className="character-lab__hint">
          Skills extra de legado (fora dos 4 slots, não apagadas):{' '}
          {extras.map((id) => getSkill(id)?.name ?? id).join(', ')}
        </p>
      ) : null}

      {replaceSlot ? (
        <div className="character-lab__confirm" role="dialog" aria-label="Substituir Skill">
          <strong>Substituir Skill do Slot {replaceSlot}</strong>
          <p className="character-lab__hint">A Skill antiga permanece no catálogo.</p>
          <label>
            Skill
            <select value={replaceId} onChange={(event) => setReplaceId(event.target.value)}>
              <option value="">Selecionar…</option>
              {catalog.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name} ({skill.id})
                </option>
              ))}
            </select>
          </label>
          <div className="character-lab__actions">
            <button
              type="button"
              className="character-lab__save-btn"
              disabled={busy || !replaceId}
              onClick={() => {
                void post({ action: 'assign', slot: replaceSlot, skillId: replaceId }).then((json) => {
                  if (!json?.slots) return;
                  upsertDevHotbar(playerId!, json.slots);
                  if (json.skillAnim && json.skillId) {
                    upsertDevSkillAnim(playerId!, json.skillId, json.skillAnim as never);
                  }
                  characterLabStore.applySavedHotbar(json.slots, { selectSlot: replaceSlot });
                  setReplaceSlot(null);
                  onSaved('Skill substituída ✓');
                });
              }}
            >
              Substituir
            </button>
            <button type="button" disabled={busy} onClick={() => setReplaceSlot(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
