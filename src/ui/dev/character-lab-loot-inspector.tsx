'use client';

import { useMemo, useState } from 'react';
import { ENEMY_DEFINITIONS } from '@/data/enemies';
import { getItemDefinition, inferItemCategory, validateItemRegistry } from '@/data/items';
import { getItemSellValue } from '@/data/shop';
import { setLootRngSeed } from '@/lib/loot-rng';
import { applyRewardResult } from '@/systems/reward-application';
import {
  lootTableIdForHunt,
  normalizeLootEntry,
  resolveLoot,
  validateLootTable,
} from '@/systems/loot-engine';
import { ITEM_RARITY_LABELS } from '@/types/loot';
import type { LootDropEntry, RewardResult } from '@/types/loot';

const KILL_OPTIONS = [1, 10, 100, 1000] as const;

const NARUTO_SOURCE = {
  id: 'naruto-generic',
  name: 'Naruto (pipeline de personagem)',
  enemyLevel: 20,
  table: [] as LootDropEntry[],
  naruto: { lookType: 1, characterId: 'naruto' as string | null },
};

function sources() {
  return [
    ...ENEMY_DEFINITIONS.map((enemy) => ({
      id: enemy.id,
      name: `${enemy.name} (${enemy.id})`,
      enemyLevel: enemy.level,
      table: enemy.loot,
      naruto: undefined as { lookType: number | null; characterId: string | null } | undefined,
    })),
    NARUTO_SOURCE,
  ];
}

export function CharacterLabLootInspector() {
  const list = useMemo(() => sources(), []);
  const [sourceId, setSourceId] = useState(list[0]?.id ?? '');
  const [kills, setKills] = useState<(typeof KILL_OPTIONS)[number]>(1);
  const [seed, setSeed] = useState('');
  const [preview, setPreview] = useState<RewardResult | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const source = list.find((row) => row.id === sourceId) ?? list[0];

  const tableWarnings = source
    ? validateLootTable(
        { entries: source.table },
        lootTableIdForHunt(source.id),
      )
    : [];
  const registryWarnings = validateItemRegistry();

  const simulate = (apply: boolean) => {
    const parsedSeed = seed.trim() === '' ? null : Number(seed);
    setLootRngSeed(parsedSeed != null && Number.isFinite(parsedSeed) ? parsedSeed : null);
    const started = performance.now();
    const result = resolveLoot({
      kills,
      enemyLevel: source?.enemyLevel ?? 1,
      table: source?.table,
      naruto: source?.naruto,
      copperMultiplier: 1,
    });
    setElapsed(performance.now() - started);
    setPreview(result);
    if (apply) applyRewardResult(result);
    setLootRngSeed(null);
  };

  return (
    <section className="character-lab__section">
      <h4>LOOT INSPECTOR</h4>
      <p className="character-lab__hint">Simular não altera o save. Hunt → tabela abaixo.</p>
      <label>
        Hunt
        <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
          {list.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <p className="character-lab__hint">Tabela: {lootTableIdForHunt(source?.id ?? '—')}</p>
      <div className="character-lab__chips">
        {KILL_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            className={kills === count ? 'is-active' : undefined}
            onClick={() => setKills(count)}
          >
            {count}
          </button>
        ))}
      </div>
      <label>
        LOOT RNG SEED
        <input value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="vazio = aleatório" />
      </label>
      <div className="character-lab__actions">
        <button type="button" onClick={() => simulate(false)}>
          Simular Loot
        </button>
        <button type="button" onClick={() => simulate(true)}>
          Aplicar Resultado DEV
        </button>
      </div>
      {source?.table.length ? (
        <ul className="character-lab__hint">
          {source.table.map((entry) => {
            const norm = normalizeLootEntry(entry);
            const def = getItemDefinition(norm.itemId);
            return (
              <li key={`${norm.itemId}-${norm.chance}`}>
                {def?.name ?? norm.itemId} · {(norm.chance * 100).toFixed(1)}% · {norm.quantityMin}–
                {norm.quantityMax}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="character-lab__hint">Naruto: raridade + fragmento em runtime (mesma engine).</p>
      )}
      {preview ? (
        <div className="character-lab__hint">
          <p>
            {elapsed.toFixed(1)} ms · Cobre {preview.copper}
          </p>
          {preview.items.map((item) => {
            const def = getItemDefinition(item.itemId);
            return (
              <p key={item.itemId}>
                {def?.name ?? item.itemId} ×{item.quantity} ·{' '}
                {def ? ITEM_RARITY_LABELS[def.rarity] : '?'} · $
                {getItemSellValue(item.itemId) * item.quantity} · {def ? inferItemCategory(def) : ''}
              </p>
            );
          })}
        </div>
      ) : null}
      {tableWarnings.length + registryWarnings.length > 0 ? (
        <p className="character-lab__hint">
          {[...tableWarnings, ...registryWarnings].slice(0, 6).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}
