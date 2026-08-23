'use client';

import { useMemo, useState } from 'react';
import { formatCapturePercent } from '@/constants/capture';
import { CAPTURE_QUALITY_MODIFIERS, spawnQualityPercents } from '@/constants/capture-rarity';
import { CHARACTER_QUALITY_LABELS } from '@/constants/character-progression';
import { qualityStatMidpoint } from '@/constants/character-quality-stats';
import { SEALING_SCROLL_TIERS, type SealingScrollTierId } from '@/constants/sealing';
import { CharacterRegistry } from '@/data/characters';
import { MAP_KEYS } from '@/maps/map-registry';
import {
  getCaptureForceMode,
  getForceSpawnQuality,
  setCaptureForceMode,
  setForceSpawnQuality,
  type CaptureForceMode,
  type ForceSpawnQuality,
} from '@/lib/capture-dev';
import { simulateSpawnQualityCounts } from '@/lib/hunt-spawn';
import { resolveEnemyCaptureQuality } from '@/lib/resolve-character-quality';
import {
  getCaptureChance,
  getSealingScrollConfig,
  simulateCaptureBatch,
} from '@/systems/capture-engine';
import { CHARACTER_QUALITIES, type CharacterQuality } from '@/types/character-meta';
import type { EnemyDefinition } from '@/types/enemy';

function enemyFromCharacterId(characterId: string, quality: CharacterQuality): EnemyDefinition {
  const def = CharacterRegistry.get(characterId);
  const lookType = def?.lookTypes[0] ?? 0;
  return {
    id: `dev-seal-${characterId}`,
    name: def?.pack.id ?? characterId,
    hp: 1,
    level: 1,
    xp: 0,
    loot: [],
    spawn: { x: 0, y: 0 },
    speed: 0,
    chaseRadius: 0,
    sprite: 'enemy',
    mapKey: MAP_KEYS.leafVillage,
    sealable: {
      characterId,
      sourceId: characterId,
      name: def?.pack.id ?? characterId,
      lookType,
      level: 1,
      quality,
      qualityStatMultiplier: qualityStatMidpoint(quality),
    },
  };
}

export function CharacterLabCaptureInspector() {
  const roster = useMemo(
    () => CharacterRegistry.list().filter((entry) => entry.active),
    [],
  );
  const defaultId = roster.some((entry) => entry.id === 'uchiha-itachi')
    ? 'uchiha-itachi'
    : (roster[0]?.id ?? 'naruto-classic');
  const [characterId, setCharacterId] = useState(defaultId);
  const [forceQuality, setForceQuality] = useState<ForceSpawnQuality>('random');
  const [scrollId, setScrollId] = useState<SealingScrollTierId>(SEALING_SCROLL_TIERS[0].itemId);
  const [force, setForce] = useState<CaptureForceMode>('off');
  const [spawnSim, setSpawnSim] = useState<Record<CharacterQuality, number> | null>(null);
  const [batch, setBatch] = useState<{
    success: number;
    failure: number;
    expectedRate: number;
    observedRate: number;
    n: number;
  } | null>(null);

  const previewQuality: CharacterQuality = forceQuality === 'random' ? 'D' : forceQuality;
  const target = useMemo(
    () => enemyFromCharacterId(characterId, previewQuality),
    [characterId, previewQuality],
  );
  const quality = resolveEnemyCaptureQuality(target);
  const scroll = getSealingScrollConfig(scrollId);
  const chance = useMemo(() => getCaptureChance(target, scroll), [target, scroll]);
  const percents = spawnQualityPercents();

  const applyForceQuality = (value: ForceSpawnQuality) => {
    setForceQuality(value);
    setForceSpawnQuality(value);
  };

  const runBatch = (n: number) => {
    setCaptureForceMode(force);
    const result = simulateCaptureBatch(target, scrollId, n);
    setBatch({ ...result, n });
    setCaptureForceMode('off');
    setForce('off');
  };

  return (
    <section className="character-lab__section">
      <h4>CAPTURE QUALITY TESTER</h4>
      <p className="character-lab__hint">
        Quality é rolada só após selamento com sucesso. A chance de selar é o poder do
        pergaminho (sem quality no inimigo). Force quality aplica no personagem capturado, não
        no HP da Hunt. Simular não altera o save.
      </p>
      <label>
        Character
        <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
          {roster.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Force Quality
        <select
          value={forceQuality}
          onChange={(event) => applyForceQuality(event.target.value as ForceSpawnQuality)}
        >
          <option value="random">RANDOM</option>
          {CHARACTER_QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q} / {CHARACTER_QUALITY_LABELS[q]}
            </option>
          ))}
        </select>
      </label>
      <p className="character-lab__hint">
        Spawn quality (preview): {quality} · {CHARACTER_QUALITY_LABELS[quality]} · force{' '}
        {getForceSpawnQuality() ?? 'off'}
      </p>
      <label>
        Scroll
        <select
          value={scrollId}
          onChange={(event) => setScrollId(event.target.value as SealingScrollTierId)}
        >
          {SEALING_SCROLL_TIERS.map((tier) => (
            <option key={tier.itemId} value={tier.itemId}>
              Tier {tier.rank} · {tier.label} · {Math.round(tier.successChance * 100)}%
            </option>
          ))}
        </select>
      </label>
      <p className="character-lab__hint">Base Scroll Chance: {formatCapturePercent(chance.baseChance)}</p>
      <p className="character-lab__hint">
        Quality Modifier: ×{CAPTURE_QUALITY_MODIFIERS[quality]} ({chance.rarityModifier})
      </p>
      <p className="character-lab__hint">Final Capture Chance: {formatCapturePercent(chance.finalChance)}</p>
      <div className="character-lab__chips">
        {(['off', 'success', 'failure'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={force === mode ? 'is-active' : undefined}
            onClick={() => {
              setForce(mode);
              setCaptureForceMode(mode);
            }}
          >
            {mode === 'off' ? 'RNG' : mode === 'success' ? 'Force Success' : 'Force Fail'}
          </button>
        ))}
      </div>
      <p className="character-lab__hint">Force capture: {getCaptureForceMode()}</p>
      <div className="character-lab__actions">
        <button type="button" onClick={() => runBatch(1)}>
          Simular 1
        </button>
        <button type="button" onClick={() => runBatch(100)}>
          Simular 100
        </button>
        <button type="button" onClick={() => runBatch(1000)}>
          Simular 1000
        </button>
        <button type="button" onClick={() => setSpawnSim(simulateSpawnQualityCounts(1000))}>
          SIMULAR 1.000 SPAWNS
        </button>
      </div>
      {batch ? (
        <p className="character-lab__hint">
          Success {batch.success} · Failure {batch.failure} · Observed{' '}
          {(batch.observedRate * 100).toFixed(1)}% · Expected {(batch.expectedRate * 100).toFixed(1)}%
        </p>
      ) : null}
      {spawnSim ? (
        <p className="character-lab__hint">
          {CHARACTER_QUALITIES.map(
            (q) =>
              `${CHARACTER_QUALITY_LABELS[q]} ${spawnSim[q]} (peso ${percents[q].toFixed(0)}%)`,
          ).join(' · ')}
        </p>
      ) : null}
    </section>
  );
}
