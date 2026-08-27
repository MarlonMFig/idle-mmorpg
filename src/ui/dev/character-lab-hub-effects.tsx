'use client';

import { useEffect, useState } from 'react';
import { HUB_NATIVE_HEIGHT, HUB_NATIVE_WIDTH } from '@/data/hub-backgrounds';
import { isHubSmokeEffect, type HubEffect } from '@/data/hub-effects';
import { fetchDevSaveJson } from '@/lib/dev/dev-save-fetch';
import { saveLog } from '@/lib/dev/save-log';
import { useStore } from '@/hooks/use-store';
import { locationStore } from '@/stores/location-store';
import { hubEffectsLabStore } from '@/stores/hub-effects-lab-store';
import { mapViewportLabStore } from '@/stores/map-viewport-lab-store';

function NumberRow({
  label,
  value,
  dirty,
  onNudge,
  onSet,
  nudgeStep = 8,
}: {
  label: string;
  value: number;
  dirty?: boolean;
  onNudge: (d: number) => void;
  onSet: (v: number) => void;
  nudgeStep?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number(String(raw).replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onSet(parsed);
  };

  return (
    <div className={`character-lab__value${dirty ? ' is-dirty' : ''}`}>
      <div className="character-lab__value-head">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="character-lab__chips">
        {[-64, -32, -8, 8, 32, 64].map((delta) => (
          <button key={delta} type="button" onClick={() => onNudge(delta)}>
            {delta > 0 ? `+${delta}` : delta}
          </button>
        ))}
      </div>
      <div className="character-lab__stepper">
        <button type="button" aria-label={`Diminuir ${label}`} onClick={() => onNudge(-nudgeStep)}>
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button type="button" aria-label={`Aumentar ${label}`} onClick={() => onNudge(nudgeStep)}>
          +
        </button>
      </div>
    </div>
  );
}

export function CharacterLabHubEffects() {
  const mode = useStore(locationStore, (s) => s.mode);
  const effects = useStore(hubEffectsLabStore, (s) => s.effects);
  const selectedId = useStore(hubEffectsLabStore, (s) => s.selectedId);
  const pickMode = useStore(hubEffectsLabStore, (s) => s.pickMode);
  const pointerWorldX = useStore(hubEffectsLabStore, (s) => s.pointerWorldX);
  const pointerWorldY = useStore(hubEffectsLabStore, (s) => s.pointerWorldY);
  const diagnostics = useStore(mapViewportLabStore, (s) => s.diagnostics);
  const dirty = useStore(hubEffectsLabStore, () => hubEffectsLabStore.isDirty());
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selected = effects.find((e) => e.id === selectedId) ?? null;
  const selectedSmoke = selected && isHubSmokeEffect(selected) ? selected : null;

  useEffect(() => {
    hubEffectsLabStore.setActive(true);
    return () => hubEffectsLabStore.setActive(false);
  }, []);

  const setSmokeCoord = (axis: 'x' | 'y', value: number) => {
    if (!selectedSmoke) return;
    hubEffectsLabStore.setSmokePosition(
      selectedSmoke.id,
      axis === 'x' ? value : selectedSmoke.x,
      axis === 'y' ? value : selectedSmoke.y,
    );
  };

  const save = async () => {
    setSaving(true);
    setSaveOk(null);
    setSaveError(null);
    saveLog('save click', 'hub-effects');
    try {
      const { res, json } = await fetchDevSaveJson<{
        success: boolean;
        ok?: boolean;
        error?: string;
        detail?: string;
        effects?: HubEffect[];
      }>('/api/dev/hub-effects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ effects }),
      });
      if (!res.ok || !json.success) throw new Error(json.detail || json.error || 'Falha ao salvar');
      if (json.effects) hubEffectsLabStore.markOfficialSaved(json.effects);
      setSaveOk('Efeitos salvos em hub-effects.ts');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const cursorX = pointerWorldX ?? diagnostics?.worldX ?? null;
  const cursorY = pointerWorldY ?? diagnostics?.worldY ?? null;

  return (
    <div className="character-lab__section">
      <h3>Hub — Efeitos ambientais</h3>
      <p className="character-lab__hint">
        Fumaça, pássaros e futuros VFX do hub. Preview ao vivo na vila; clique no mapa com{' '}
        <strong>Posicionar</strong> ativo para mover emissores de fumaça.
      </p>

      {dirty ? (
        <p className="character-lab__hint" style={{ color: '#f0c060' }}>
          TESTE TEMPORÁRIO — salve para gravar em `src/data/hub-effects.ts`.
        </p>
      ) : null}

      {mode !== 'hub' ? (
        <p className="character-lab__hint" style={{ color: '#f08080' }}>
          Selecione o hub no Map Viewport acima (ou volte à vila) para posicionar efeitos.
        </p>
      ) : null}

      <ul className="character-lab__list" style={{ listStyle: 'none', padding: 0, margin: '0 0 12px' }}>
        {effects.map((entry) => {
          const isSelected = entry.id === selectedId;
          return (
            <li
              key={entry.id}
              className={`character-lab__value${isSelected ? ' is-dirty' : ''}`}
              style={{ marginBottom: 8 }}
            >
              <div className="character-lab__value-head">
                <button type="button" onClick={() => hubEffectsLabStore.select(entry.id)}>
                  {isSelected ? '▸ ' : '  '}
                  {entry.label}
                </button>
                <span>
                  {entry.kind}
                  {isHubSmokeEffect(entry) ? ` · ${entry.x}, ${entry.y}` : ''}
                </span>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={entry.enabled}
                  onChange={() => hubEffectsLabStore.toggleEnabled(entry.id)}
                />
                Ativo
              </label>
            </li>
          );
        })}
      </ul>

      <div className="character-lab__chips" style={{ marginBottom: 12 }}>
        <button type="button" onClick={() => hubEffectsLabStore.addSmoke()}>
          + Fumaça
        </button>
        <button
          type="button"
          disabled={!selectedSmoke}
          onClick={() => hubEffectsLabStore.removeSelected()}
        >
          Remover fumaça
        </button>
        <button type="button" onClick={() => hubEffectsLabStore.resetTest()}>
          Reset
        </button>
      </div>

      {selectedSmoke ? (
        <>
          <NumberRow
            label="X (mundo)"
            value={selectedSmoke.x}
            dirty={dirty}
            onNudge={(d) => setSmokeCoord('x', selectedSmoke.x + d)}
            onSet={(v) => setSmokeCoord('x', v)}
          />
          <NumberRow
            label="Y (mundo)"
            value={selectedSmoke.y}
            dirty={dirty}
            onNudge={(d) => setSmokeCoord('y', selectedSmoke.y + d)}
            onSet={(v) => setSmokeCoord('y', v)}
          />
        </>
      ) : selected ? (
        <p className="character-lab__hint">Pássaros usam faixa automática no céu — só liga/desliga.</p>
      ) : null}

      <div className="character-lab__chips" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={pickMode ? 'is-selected' : ''}
          disabled={!selectedSmoke || mode !== 'hub'}
          onClick={() => hubEffectsLabStore.setPickMode(!pickMode)}
        >
          {pickMode ? 'Posicionar: ON' : 'Posicionar no mapa'}
        </button>
        <button
          type="button"
          disabled={cursorX == null || cursorY == null || !selectedSmoke}
          onClick={() => hubEffectsLabStore.applyPointerToSelected()}
        >
          Usar cursor ({cursorX ?? '—'}, {cursorY ?? '—'})
        </button>
      </div>

      <p className="character-lab__hint">
        Mundo {HUB_NATIVE_WIDTH}×{HUB_NATIVE_HEIGHT}. Marcadores verdes = emissores; cruz = selecionado.
      </p>

      <div className="character-lab__chips" style={{ marginTop: 12 }}>
        <button type="button" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? 'Salvando…' : 'Salvar efeitos'}
        </button>
      </div>
      {saveOk ? <p className="character-lab__hint" style={{ color: '#8fe3d0' }}>{saveOk}</p> : null}
      {saveError ? <p className="character-lab__hint" style={{ color: '#f08080' }}>{saveError}</p> : null}
    </div>
  );
}
