'use client';

import { useMemo, useState } from 'react';
import {
  STATUS_STACK_MODE_LABELS,
  STATUS_STACK_MODES,
  STATUS_TYPE_LABELS,
  STATUS_TYPES,
  categoryForStatusType,
  defaultStatusDraft,
  parseStatusEffectDefinition,
  type StatusEffectDefinition,
  type StatusStackMode,
  type StatusType,
} from '@/data/status-effect-def';
import { listStatusDefinitions } from '@/data/status';
import { removeDevStatus, upsertDevStatus } from '@/lib/dev/dev-runtime-registry';
import { characterLabStore } from '@/stores/character-lab-store';

export function CharacterLabStatusLibrary() {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<StatusEffectDefinition>(() => ({
    id: 'new-status',
    name: 'Novo Status',
    ...defaultStatusDraft('burn'),
  }));
  const catalog = listStatusDefinitions();
  const filtered = useMemo(
    () =>
      catalog.filter(
        (item) =>
          item.id.includes(query.toLowerCase()) ||
          item.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [catalog, query],
  );
  const category = categoryForStatusType(draft.type);

  const save = async (mode: 'create' | 'update') => {
    setBusy(true);
    setError(null);
    try {
      const parsed = parseStatusEffectDefinition(draft);
      const res = await fetch('/api/dev/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: mode, ...parsed }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; status?: StatusEffectDefinition };
      if (!json.ok || !json.status) throw new Error(json.error ?? 'falha ao salvar Status');
      upsertDevStatus(json.status);
      characterLabStore.noteRuntimeUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'falha');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="character-lab__section">
      <h3>STATUS LIBRARY</h3>
      <p className="character-lab__hint">Definitions persistidas em código. Instâncias não entram no save.</p>
      <input
        className="character-lab__search"
        type="search"
        placeholder="Buscar Status..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="character-lab__chips">
        {filtered.map((item) => (
          <button
            key={item.id}
            type="button"
            className={draft.id === item.id ? 'is-active' : undefined}
            onClick={() => setDraft({ ...item })}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="character-lab__actions">
        <button
          type="button"
          onClick={() =>
            setDraft({
              id: 'new-status',
              name: 'Novo Status',
              ...defaultStatusDraft('burn'),
            })
          }
        >
          Novo Status
        </button>
      </div>
      <label>
        Nome
        <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      </label>
      <label>
        ID
        <input value={draft.id} onChange={(event) => setDraft({ ...draft, id: event.target.value })} />
      </label>
      <label>
        Tipo
        <select
          value={draft.type}
          onChange={(event) => {
            const type = event.target.value as StatusType;
            setDraft({ ...draft, id: draft.id, name: draft.name, ...defaultStatusDraft(type), type });
          }}
        >
          {STATUS_TYPES.map((id) => (
            <option key={id} value={id}>
              {STATUS_TYPE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Duração (ms)
        <input
          type="number"
          min={1}
          value={draft.duration}
          onChange={(event) => setDraft({ ...draft, duration: Math.max(1, Number(event.target.value)) })}
        />
      </label>
      <label>
        Stack Mode
        <select
          value={draft.stackMode}
          onChange={(event) => setDraft({ ...draft, stackMode: event.target.value as StatusStackMode })}
        >
          {STATUS_STACK_MODES.map((id) => (
            <option key={id} value={id}>
              {STATUS_STACK_MODE_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Max Stacks
        <input
          type="number"
          min={1}
          value={draft.maxStacks}
          onChange={(event) => setDraft({ ...draft, maxStacks: Math.max(1, Number(event.target.value)) })}
        />
      </label>
      {category === 'damage-over-time' || category === 'heal-over-time' ? (
        <>
          <label>
            Tick Interval (ms)
            <input
              type="number"
              min={50}
              value={draft.tickInterval ?? 1000}
              onChange={(event) =>
                setDraft({ ...draft, tickInterval: Math.max(50, Number(event.target.value)) })
              }
            />
          </label>
          {category === 'damage-over-time' ? (
            <label>
              Damage/Tick
              <input
                type="number"
                min={0}
                value={draft.damagePerTick ?? 0}
                onChange={(event) => setDraft({ ...draft, damagePerTick: Math.max(0, Number(event.target.value)) })}
              />
            </label>
          ) : (
            <label>
              Heal/Tick
              <input
                type="number"
                min={0}
                value={draft.healPerTick ?? 0}
                onChange={(event) => setDraft({ ...draft, healPerTick: Math.max(0, Number(event.target.value)) })}
              />
            </label>
          )}
        </>
      ) : null}
      {category === 'shield' ? (
        <label>
          Shield Amount
          <input
            type="number"
            min={0}
            value={draft.shieldAmount ?? 0}
            onChange={(event) => setDraft({ ...draft, shieldAmount: Math.max(0, Number(event.target.value)) })}
          />
        </label>
      ) : null}
      {category === 'modifier' ? (
        <>
          <label>
            Attack ×
            <input
              type="number"
              step={0.05}
              min={0.05}
              value={draft.modifiers?.attackMultiplier ?? ''}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setDraft({
                  ...draft,
                  modifiers: {
                    ...draft.modifiers,
                    attackMultiplier: value === '' ? undefined : Math.max(0.05, Number(value)),
                  },
                });
              }}
            />
          </label>
          <label>
            Defense ×
            <input
              type="number"
              step={0.05}
              min={0.05}
              value={draft.modifiers?.defenseMultiplier ?? ''}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setDraft({
                  ...draft,
                  modifiers: {
                    ...draft.modifiers,
                    defenseMultiplier: value === '' ? undefined : Math.max(0.05, Number(value)),
                  },
                });
              }}
            />
          </label>
          <label>
            Movement Speed ×
            <input
              type="number"
              step={0.05}
              min={0.05}
              value={draft.modifiers?.movementSpeedMultiplier ?? ''}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setDraft({
                  ...draft,
                  modifiers: {
                    ...draft.modifiers,
                    movementSpeedMultiplier: value === '' ? undefined : Math.max(0.05, Number(value)),
                  },
                });
              }}
            />
          </label>
          <label>
            Attack Speed ×
            <input
              type="number"
              step={0.05}
              min={0.05}
              value={draft.modifiers?.attackSpeedMultiplier ?? ''}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setDraft({
                  ...draft,
                  modifiers: {
                    ...draft.modifiers,
                    attackSpeedMultiplier: value === '' ? undefined : Math.max(0.05, Number(value)),
                  },
                });
              }}
            />
          </label>
          <label>
            Crit Chance ×
            <input
              type="number"
              step={0.05}
              min={0.05}
              value={draft.modifiers?.criticalChanceMultiplier ?? ''}
              placeholder="—"
              onChange={(event) => {
                const value = event.target.value;
                setDraft({
                  ...draft,
                  modifiers: {
                    ...draft.modifiers,
                    criticalChanceMultiplier: value === '' ? undefined : Math.max(0.05, Number(value)),
                  },
                });
              }}
            />
          </label>
        </>
      ) : null}
      {error ? <p className="character-lab__hint is-error">{error}</p> : null}
      <div className="character-lab__actions">
        <button type="button" disabled={busy} onClick={() => void save('create')}>
          Criar
        </button>
        <button type="button" disabled={busy} onClick={() => void save('update')}>
          Atualizar
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void fetch('/api/dev/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', id: draft.id }),
            })
              .then(async (res) => {
                const json = (await res.json()) as { ok?: boolean; error?: string };
                if (!json.ok) throw new Error(json.error ?? 'falha');
                removeDevStatus(draft.id);
                characterLabStore.noteRuntimeUpdated();
              })
              .catch((err: unknown) => setError(err instanceof Error ? err.message : 'falha'))
              .finally(() => setBusy(false));
          }}
        >
          Excluir
        </button>
      </div>
    </section>
  );
}
