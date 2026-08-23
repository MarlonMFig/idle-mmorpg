'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { characterLabStore } from '@/stores/character-lab-store';
import { formatSignedPx, type SpriteAlignmentContext } from '@/lib/sprite-alignment';
import { fetchDevSaveJson as fetchLabApi } from '@/lib/dev/dev-save-fetch';
import { upsertDevSpriteAlignment, clearDevSpriteAlignment } from '@/lib/dev/dev-runtime-registry';
import type { CharacterAnimSlot } from '@/types/character-definition';

function characterLabel(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const PREVIEW_SLOTS: { id: CharacterAnimSlot | 'skill4'; label: string }[] = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'attack', label: 'Basic' },
  { id: 'special1', label: 'Skill 1' },
  { id: 'special2', label: 'Skill 2' },
  { id: 'special3', label: 'Skill 3' },
  { id: 'skill4', label: 'Skill 4' },
];

function AxisRow({
  label,
  value,
  saved,
  onNudge,
  onSet,
}: {
  label: string;
  value: number;
  saved: number;
  onNudge: (delta: number) => void;
  onSet: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(String(raw).replace(',', '.').replace(/^\+/, ''));
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onSet(Math.round(parsed));
  };

  return (
    <div className={`character-lab__value${value !== saved ? ' is-dirty' : ''}`}>
      <div className="character-lab__value-head">
        <span>{label}</span>
        <span>
          Salvo {formatSignedPx(saved)} · Test {formatSignedPx(value)}
        </span>
      </div>
      <div className="character-lab__chips">
        {([-5, -1, 1, 5] as const).map((delta) => (
          <button key={delta} type="button" onClick={() => onNudge(delta)}>
            {formatSignedPx(delta)}
          </button>
        ))}
      </div>
      <div className="character-lab__stepper">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onNudge(-1)}>
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onNudge(1)}>
          +
        </button>
      </div>
    </div>
  );
}

export function CharacterLabSpriteAlignment({
  alignmentDebug,
}: {
  alignmentDebug: {
    base: { x: number; y: number };
    alignment: { x: number; y: number };
    poseOffset: { x: number; y: number };
    final: { x: number; y: number };
  } | null;
}) {
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const alignContext = useStore(characterLabStore, (s) => s.alignContext);
  const alignHubX = useStore(characterLabStore, (s) => s.alignHubX);
  const alignHubY = useStore(characterLabStore, (s) => s.alignHubY);
  const alignHuntX = useStore(characterLabStore, (s) => s.alignHuntX);
  const alignHuntY = useStore(characterLabStore, (s) => s.alignHuntY);
  const alignSaved = useStore(characterLabStore, (s) => s.alignSaved);
  const showGroundGuide = useStore(characterLabStore, (s) => s.showGroundGuide);
  const showSpriteOrigin = useStore(characterLabStore, (s) => s.showSpriteOrigin);
  const dirty = useStore(characterLabStore, () => characterLabStore.hasUnsavedAlignmentChanges());

  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const label = playerId ? characterLabel(playerId) : '—';
  const x = alignContext === 'hub' ? alignHubX : alignHuntX;
  const y = alignContext === 'hub' ? alignHubY : alignHuntY;
  const savedX = alignContext === 'hub' ? (alignSaved.hub?.x ?? 0) : (alignSaved.hunt?.x ?? 0);
  const savedY = alignContext === 'hub' ? (alignSaved.hub?.y ?? 0) : (alignSaved.hunt?.y ?? 0);

  const setContext = (context: SpriteAlignmentContext) => {
    characterLabStore.setAlignContext(context);
  };

  const persistAlignment = async () => {
    if (!playerId || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    const spriteAlignment = characterLabStore.getDraftAlignment();
    try {
      const { res, json } = await fetchLabApi<{
        ok?: boolean;
        error?: string;
        detail?: string;
        characterId?: string;
        spriteAlignment?: typeof spriteAlignment | null;
      }>('/api/dev/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: playerId,
          changes: { spriteAlignment },
        }),
      });
      if (!res.ok || !json.ok) {
        setSaveError(json.detail ?? json.error ?? 'Erro ao salvar posicionamento.');
        return;
      }
      if (!json.spriteAlignment) {
        setSaveError('Save sem confirmação de releitura do Character Pack.');
        return;
      }
      const packId = json.characterId ?? playerId;
      // Evita overlay velho (ex.: hub.y:24) sobreviver ao Fast Refresh e tapar o fonte.
      clearDevSpriteAlignment(packId);
      upsertDevSpriteAlignment(packId, json.spriteAlignment);
      characterLabStore.markAlignmentSaved(json.spriteAlignment);
      setSaveOk('Salvo ✓ (arquivo confirmado)');
      window.setTimeout(() => setSaveOk(null), 2200);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar posicionamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="character-lab__section">
      <h3>SPRITE ALIGNMENT</h3>
      <p className="character-lab__hint">
        Posicionamento global do personagem. Aplicado a <strong>todas as animações</strong> do
        contexto (Idle, Walk, Basic, Skills, Poses). Não altera PNG, hitbox nem offset de Skill/VFX.
      </p>

      <p>
        <strong>PERSONAGEM</strong> {label}
      </p>

      <div className="character-lab__chips">
        <button
          type="button"
          className={alignContext === 'hub' ? 'is-active' : undefined}
          onClick={() => setContext('hub')}
        >
          HUB
        </button>
        <button
          type="button"
          className={alignContext === 'hunt' ? 'is-active' : undefined}
          onClick={() => setContext('hunt')}
        >
          HUNT
        </button>
      </div>

      <h3>Preview</h3>
      <div className="character-lab__chips">
        {PREVIEW_SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => {
              if (slot.id === 'skill4') {
                const skillId = characterLabStore.getEffectiveHotbar()[3];
                if (skillId) characterLabStore.castSkill(skillId);
                return;
              }
              characterLabStore.playSlot(slot.id);
            }}
          >
            {slot.label}
          </button>
        ))}
      </div>

      <label className="character-lab__toggle">
        <input
          type="checkbox"
          checked={showGroundGuide}
          onChange={(event) => characterLabStore.setFlag('showGroundGuide', event.target.checked)}
        />
        Ground guide (só DEV)
      </label>
      <label className="character-lab__toggle">
        <input
          type="checkbox"
          checked={showSpriteOrigin}
          onChange={(event) => characterLabStore.setFlag('showSpriteOrigin', event.target.checked)}
        />
        Origin / pivot
      </label>

      <h3>Position ({alignContext.toUpperCase()})</h3>
      <AxisRow
        label="X"
        value={x}
        saved={savedX}
        onNudge={(delta) => characterLabStore.nudgeAlign('x', delta)}
        onSet={(value) => characterLabStore.setAlignAxis('x', value)}
      />
      <AxisRow
        label="Y"
        value={y}
        saved={savedY}
        onNudge={(delta) => characterLabStore.nudgeAlign('y', delta)}
        onSet={(value) => characterLabStore.setAlignAxis('y', value)}
      />

      {alignmentDebug ? (
        <>
          <h3>Debug</h3>
          <p className="character-lab__hint">
            Base X {alignmentDebug.base.x} · Y {alignmentDebug.base.y}
            <br />
            Character X {formatSignedPx(alignmentDebug.alignment.x)} · Y{' '}
            {formatSignedPx(alignmentDebug.alignment.y)}
            <br />
            Pose X {formatSignedPx(alignmentDebug.poseOffset.x)} · Y{' '}
            {formatSignedPx(alignmentDebug.poseOffset.y)}
            <br />
            Final X {alignmentDebug.final.x} · Y {alignmentDebug.final.y}
          </p>
        </>
      ) : null}

      <div className="character-lab__actions">
        <button type="button" onClick={() => characterLabStore.resetAlignContext()}>
          Resetar
        </button>
        <button type="button" onClick={() => characterLabStore.reloadAlignSaved()}>
          Recarregar salvo
        </button>
        <button type="button" onClick={() => characterLabStore.copyAlign('hub', 'hunt')}>
          Copiar Hub → Hunt
        </button>
        <button type="button" onClick={() => characterLabStore.copyAlign('hunt', 'hub')}>
          Copiar Hunt → Hub
        </button>
        <button type="button" onClick={() => characterLabStore.applyAlignBothContexts()}>
          Aplicar a Hub e Hunt
        </button>
        <button type="button" disabled={saving || !dirty} onClick={() => void persistAlignment()}>
          {saving ? 'Salvando…' : 'Salvar posicionamento'}
        </button>
      </div>
      {saveOk ? <p className="character-lab__hint">{saveOk}</p> : null}
      {saveError ? <p className="character-lab__hint">{saveError}</p> : null}
      <p className="character-lab__hint">
        {dirty ? 'ALTERAÇÕES NÃO SALVAS' : 'SALVO (confirmado no Character Pack)'}
      </p>
      <p className="character-lab__hint">
        Aplicado a: TODAS AS ANIMAÇÕES DO PERSONAGEM ({alignContext})
      </p>
    </section>
  );
}
