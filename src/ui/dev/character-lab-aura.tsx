'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CharacterAuraDef, CharacterPack } from '@/data/character-packs';
import type { SkillEffect } from '@/types/skill';
import { getVfxDefinition, listVfxDefinitions } from '@/data/vfx';
import { WONSR_AURA_PREFIX } from '@/data/vfx/wonsr-catalog';
import { upsertDevCharacterAura } from '@/lib/dev/dev-runtime-registry';
import { characterLabStore } from '@/stores/character-lab-store';
import { CharacterLabStatusEditor } from '@/ui/dev/character-lab-status';
import { CharacterLabStatusLibrary } from '@/ui/dev/character-lab-status-library';
import { VfxEditorModal } from '@/ui/dev/vfx-editor-modal';

function auraFromPack(pack: CharacterPack | null): CharacterAuraDef {
  return {
    vfxId: pack?.aura?.vfxId ?? '',
    enabled: pack?.aura?.enabled ?? false,
    scale: pack?.aura?.scale ?? 1,
    offsetX: pack?.aura?.offsetX ?? 0,
    offsetY: pack?.aura?.offsetY ?? 0,
  };
}

export function CharacterLabAura({
  playerId,
  pack,
  skillId,
  skillName,
  catalogVersion,
  onSaved,
  onError,
  onGoSkills,
  onSaveSkill,
}: {
  playerId: string | null;
  pack: CharacterPack | null;
  skillId: string | null;
  skillName: string;
  catalogVersion: number;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
  onGoSkills: () => void;
  onSaveSkill: () => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<CharacterAuraDef>(() => auraFromPack(pack));
  const [skillEffect, setSkillEffect] = useState<SkillEffect>(
    () => pack?.skillAnims[skillId ?? '']?.effect ?? 'damage',
  );
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [buffAuraVfxId, setBuffAuraVfxId] = useState(
    () => pack?.skillAnims[skillId ?? '']?.buffAuraVfxId ?? '',
  );
  const [buffAuraEnabled, setBuffAuraEnabled] = useState(
    () => Boolean(pack?.skillAnims[skillId ?? '']?.buffAuraEnabled),
  );

  const auraDefs = useMemo(() => {
    void catalogVersion;
    return listVfxDefinitions()
      .filter(
        (item) =>
          item.id.startsWith(WONSR_AURA_PREFIX) ||
          item.id.startsWith('aura-') ||
          item.name.toLowerCase().includes('aura') ||
          item.id === draft.vfxId ||
          item.id === buffAuraVfxId,
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [catalogVersion, draft.vfxId, buffAuraVfxId]);

  useEffect(() => {
    setDraft(auraFromPack(pack));
    setSkillEffect(pack?.skillAnims[skillId ?? '']?.effect ?? 'damage');
    const nextBuffAura = pack?.skillAnims[skillId ?? '']?.buffAuraVfxId ?? '';
    setBuffAuraVfxId(nextBuffAura);
    characterLabStore.setBuffAuraVfxId(nextBuffAura || null);
    const nextBuffAuraEnabled = Boolean(pack?.skillAnims[skillId ?? '']?.buffAuraEnabled);
    setBuffAuraEnabled(nextBuffAuraEnabled);
    characterLabStore.setBuffAuraEnabled(nextBuffAuraEnabled);
  }, [pack, playerId, skillId]);

  const selectedDef = getVfxDefinition(draft.vfxId);
  const preview = (next: CharacterAuraDef) => {
    setDraft(next);
    characterLabStore.previewAura(next.enabled && next.vfxId ? next : null);
  };

  const save = async () => {
    if (!playerId) return;
    setBusy(true);
    onError('');
    try {
      const aura = draft.enabled && draft.vfxId ? draft : null;
      const response = await fetch('/api/dev/character-aura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: playerId, aura }),
      });
      const json = (await response.json()) as {
        ok?: boolean;
        error?: string;
        aura?: CharacterAuraDef | null;
      };
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'Não foi possível salvar a aura.');
      upsertDevCharacterAura(playerId, json.aura ?? null);
      characterLabStore.noteRuntimeUpdated();
      onSaved('Aura salva ✓');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar a aura.');
    } finally {
      setBusy(false);
    }
  };

  const saveSkillEffect = async () => {
    if (!playerId || !skillId) return;
    setBusy(true);
    onError('');
    try {
      if (!(await onSaveSkill())) throw new Error('Não foi possível salvar a configuração do Buff.');
      const response = await fetch('/api/dev/skill-effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: playerId, skillId, effect: skillEffect }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error ?? 'Não foi possível salvar o tipo da skill.');
      characterLabStore.noteRuntimeUpdated();
      onSaved('Buff salvo ✓');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Não foi possível salvar o tipo da skill.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="character-lab__section">
        <h3>AURA / SKIN OVERLAY</h3>
        <p className="character-lab__hint">
          Efeito animado sobre o corpo, sem substituir a sprite. A configuração acompanha o jogador
          e os companions que usam este pack.
        </p>
        <label className="character-lab__toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            disabled={!playerId}
            onChange={(event) => preview({ ...draft, enabled: event.target.checked })}
          />
          Ativar aura permanente
        </label>
        <label>
          VFX da Aura
          <select
            value={draft.vfxId}
            disabled={!playerId}
            onChange={(event) => preview({ ...draft, vfxId: event.target.value })}
          >
            <option value="">Selecionar aura…</option>
            {auraDefs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {selectedDef ? <p className="character-lab__hint">{selectedDef.id}</p> : null}
        <div className="character-lab__grid character-lab__grid--compact">
          <label>
            Escala
            <input
              type="number"
              min={0.05}
              step={0.05}
              value={draft.scale}
              disabled={!playerId}
              onChange={(event) => preview({ ...draft, scale: Math.max(0.05, Number(event.target.value)) })}
            />
          </label>
          <label>
            Offset X
            <input
              type="number"
              step={1}
              value={draft.offsetX}
              disabled={!playerId}
              onChange={(event) => preview({ ...draft, offsetX: Number(event.target.value) || 0 })}
            />
          </label>
          <label>
            Offset Y
            <input
              type="number"
              step={1}
              value={draft.offsetY}
              disabled={!playerId}
              onChange={(event) => preview({ ...draft, offsetY: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
        <div className="character-lab__actions">
          <button type="button" disabled={!playerId || busy} onClick={() => characterLabStore.previewAura(draft.enabled ? draft : null)}>
            Preview Aura
          </button>
          <button type="button" disabled={!playerId || busy} onClick={() => setImportOpen(true)}>
            Importar GIF / Frames
          </button>
          <button type="button" className="character-lab__save-btn" disabled={!playerId || busy} onClick={() => void save()}>
            Salvar Aura no Código
          </button>
          <button type="button" disabled={!playerId || busy} onClick={() => preview({ ...auraFromPack(null), vfxId: '', enabled: false })}>
            Desativar
          </button>
        </div>
      </section>

      <section className="character-lab__section">
        <h3>BUFF SKILLS</h3>
        <p className="character-lab__hint">
          A skill marcada como Buff não exige inimigo e não causa dano. Associe Status Effects com
          alvo Self para aplicar os bônus ao jogador ou companion.
        </p>
        <label>
          Skill selecionada
          <input value={skillName} readOnly />
        </label>
        <label>
          Tipo da skill
          <select
            value={skillEffect}
            disabled={!playerId || !skillId || busy}
            onChange={(event) => setSkillEffect(event.target.value as SkillEffect)}
          >
            <option value="damage">Ataque</option>
            <option value="heal">Cura</option>
            <option value="buff">Buff</option>
          </select>
        </label>
        <h4>AURA DO BUFF</h4>
        <p className="character-lab__hint">
          Opcional. Esta aura será ativada no jogador ou companion quando o Buff começar e ficará ativa
          até o maior tempo dos Status Effects aplicados em Self.
        </p>
        <label>
          Aura temporária
          <select
            value={buffAuraVfxId}
            disabled={!playerId || !skillId || busy}
            onChange={(event) => {
              const id = event.target.value;
              setBuffAuraVfxId(id);
              characterLabStore.setBuffAuraVfxId(id || null);
              if (!id) {
                setBuffAuraEnabled(false);
                characterLabStore.setBuffAuraEnabled(false);
              }
            }}
          >
            <option value="">Sem aura</option>
            {auraDefs.map((item) => (
              <option key={`buff-${item.id}`} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className={`character-lab__toggle${buffAuraEnabled ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={buffAuraEnabled}
            disabled={!playerId || !skillId || !buffAuraVfxId || busy}
            onChange={(event) => {
              const enabled = event.target.checked;
              setBuffAuraEnabled(enabled);
              characterLabStore.setBuffAuraEnabled(enabled);
            }}
          />
          Ativar Aura ao usar a Skill
        </label>
        <CharacterLabStatusEditor />
        <details>
          <summary>Gerenciar biblioteca de Status Effects</summary>
          <CharacterLabStatusLibrary />
        </details>
        <div className="character-lab__actions">
          <button type="button" onClick={onGoSkills}>
            Ir para Skill selecionada
          </button>
          <button
            type="button"
            className="character-lab__save-btn"
            disabled={!playerId || !skillId || busy}
            onClick={() => void saveSkillEffect()}
          >
            Salvar configuração do Buff
          </button>
        </div>
      </section>
      {importOpen ? (
        <VfxEditorModal
          mode="create"
          canAssociate={false}
          onDirtyChange={() => undefined}
          onClose={() => setImportOpen(false)}
          onSaved={(id) => {
            setImportOpen(false);
            preview({ ...draft, vfxId: id, enabled: true });
          }}
        />
      ) : null}
    </>
  );
}
