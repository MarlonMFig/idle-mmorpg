'use client';

import { useMemo, useState } from 'react';
import {
  NARUTO_CHARACTER_LABEL,
  NARUTO_CHARACTER_TIER,
} from '@/data/naruto-loot-tiers';
import {
  analyzeCharacterLootEconomy,
  inspectWorldGeneralLoot,
  simulateLootHourValue,
} from '@/lib/loot-economy-analyzer';
import type { NarutoLootTier } from '@/data/naruto-loot-tiers';

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function CharacterLabLootEconomyAnalyzer() {
  const characterIds = useMemo(
    () =>
      Object.keys(NARUTO_CHARACTER_TIER).sort((a, b) => {
        const ta = NARUTO_CHARACTER_TIER[a] ?? 9;
        const tb = NARUTO_CHARACTER_TIER[b] ?? 9;
        if (ta !== tb) return ta - tb;
        return a.localeCompare(b);
      }),
    [],
  );
  const [characterId, setCharacterId] = useState(characterIds[0] ?? 'naruto-classic');
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<ReturnType<typeof simulateLootHourValue> | null>(null);
  const [generalTier, setGeneralTier] = useState<NarutoLootTier>(1);

  const row = analyzeCharacterLootEconomy(characterId);
  const general = useMemo(() => inspectWorldGeneralLoot('naruto', generalTier), [generalTier]);

  const run = (hours: number) => {
    setBusy(true);
    window.setTimeout(() => {
      setSim(simulateLootHourValue({ characterId, hours, seed: 20260823 }));
      setBusy(false);
    }, 10);
  };

  return (
    <section className="character-lab__section">
      <h4>LOOT ECONOMY ANALYZER</h4>
      <p className="character-lab__hint">
        Rolls independentes: General / Secondary / Signature / Fragmento. Quality não entra no loot.
      </p>
      <label>
        Personagem
        <select value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
          {characterIds.map((id) => (
            <option key={id} value={id}>
              T{NARUTO_CHARACTER_TIER[id]} · {NARUTO_CHARACTER_LABEL[id] ?? id}
            </option>
          ))}
        </select>
      </label>
      {row ? (
        <ul className="character-lab__hint">
          <li>
            Secondary: {row.secondaryName} · {pct(row.secondaryChance)} · sell {fmt(row.secondarySell)} · EV{' '}
            {row.secondaryEv.toFixed(2)}
          </li>
          <li>
            Signature: {row.signatureName} · {pct(row.signatureChance)} · sell {fmt(row.signatureSell)} · EV{' '}
            {row.signatureEv.toFixed(2)}
          </li>
          <li>
            Fragment: {pct(row.fragmentChance)} · sell {fmt(row.fragmentSell)} · EV {row.fragmentEv.toFixed(2)}
          </li>
          <li>
            General (mundo Naruto T{row.tier}): EV {row.generalEv.toFixed(2)} / kill
          </li>
          <li>Copper direto / kill: {row.copperPerKill.toFixed(2)}</li>
          <li>EV econômico / kill: {row.economicEvPerKill.toFixed(2)}</li>
          <li>Kills/h: {fmt(row.killsPerHour)}</li>
          <li>Esperado / h: {fmt(row.expectedPerHour)}</li>
        </ul>
      ) : (
        <p className="character-lab__hint">Perfil em falta.</p>
      )}
      <div className="character-lab__actions">
        <button type="button" disabled={busy} onClick={() => run(1)}>
          Simular 1 hora
        </button>
        <button type="button" disabled={busy} onClick={() => run(10_000)}>
          Simular 10.000 horas
        </button>
      </div>
      {busy ? <p className="character-lab__hint">A simular…</p> : null}
      {sim ? (
        <p className="character-lab__hint">
          P10 {fmt(sim.summary.p10)} · P25 {fmt(sim.summary.p25)} · P50 {fmt(sim.summary.p50)} · P75{' '}
          {fmt(sim.summary.p75)} · P90 {fmt(sim.summary.p90)} · Média {fmt(sim.summary.average)}
        </p>
      ) : null}
      <h4>GENERAL NARUTO LOOT</h4>
      <label>
        Tier
        <select
          value={generalTier}
          onChange={(event) => setGeneralTier(Number(event.target.value) as NarutoLootTier)}
        >
          <option value={1}>T1</option>
          <option value={2}>T2</option>
          <option value={3}>T3</option>
          <option value={4}>T4</option>
          <option value={5}>T5</option>
        </select>
      </label>
      <p className="character-lab__hint">
        Mundo Naruto · chance {pct(general.dropChance)} · EV geral / kill {general.expectedEvPerKill.toFixed(2)}
      </p>
      <ul className="character-lab__hint">
        {general.rows.map((entry) => (
          <li key={entry.itemId}>
            {entry.name} · w {entry.weight} · {pct(entry.normalized)} · sell {fmt(entry.sellPrice)} · EV kill{' '}
            {entry.evPerKill.toFixed(2)}
          </li>
        ))}
      </ul>
    </section>
  );
}
