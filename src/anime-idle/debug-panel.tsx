'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BALANCE,
  GameLoop,
  ZONES,
  canPrestige,
  combatTimeToKill,
  createInitialState,
  dps,
  enemyLevelFor,
  executePrestige,
  killsPerMinute,
  predictedPrestigeGain,
  sealChance,
  secondsToNextLevel,
  shownFragments,
  xpRateFor,
  zoneById,
  type GameState,
  type LoopSpeed,
  type ReturnSummary,
} from '@/anime-idle';

function fmt(value: { toString(): string }): string {
  return value.toString();
}

function fmtSeconds(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 60) return `${value.toFixed(1)}s`;
  if (value < 3600) return `${(value / 60).toFixed(1)}m`;
  return `${(value / 3600).toFixed(2)}h`;
}

export function AnimeIdleDebugPanel() {
  const loop = useMemo(() => new GameLoop(), []);
  const [state, setState] = useState<GameState>(loop.getState());
  const [summary, setSummary] = useState<ReturnSummary | null>(loop.getLastSummary());
  const [speed, setSpeed] = useState<LoopSpeed>(1);

  useEffect(() => {
    const unsub = loop.subscribe((next, nextSummary) => {
      setState(next);
      setSummary(nextSummary);
      setSpeed(loop.getSpeed());
    });
    loop.start();
    return () => {
      unsub();
      loop.stop();
    };
  }, [loop]);

  const claimable = shownFragments(state);
  const zone = zoneById(state.currentZoneId);
  const ttk = combatTimeToKill(state);
  const kpm = killsPerMinute(state);
  const slot0 = state.characters.find((character) => character.teamSlot === 0);
  const delta = slot0 ? enemyLevelFor(zone, slot0.level) - slot0.level : zone.levelOffset;

  return (
    <main style={{ fontFamily: 'ui-monospace, monospace', padding: 24, maxWidth: 1200 }}>
      <h1>Anime Idle World — debug</h1>
      <p>
        Curva: tempo/nível dobra ~a cada{' '}
        {Math.round(Math.log(2) / Math.log(BALANCE.XP_GROWTH / BALANCE.RATE_GROWTH))} níveis
        (XP_GROWTH/RATE_GROWTH = {(BALANCE.XP_GROWTH / BALANCE.RATE_GROWTH).toFixed(4)}). XP só de
        kills; captura não dá XP.
      </p>

      <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
        {([1, 100, 10000] as const).map((value) => (
          <button key={value} type="button" onClick={() => loop.setSpeed(value)} disabled={speed === value}>
            {value}x
          </button>
        ))}
        <button type="button" onClick={() => loop.skipHours(8)}>
          Avançar 8 horas
        </button>
        <label>
          Zona{' '}
          <select value={state.currentZoneId} onChange={(event) => loop.setZone(event.target.value)}>
            {ZONES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!canPrestige(state)} onClick={() => loop.setState(executePrestige(state))}>
          Prestígio (+{predictedPrestigeGain(state)})
        </button>
        <button type="button" onClick={() => loop.setState(createInitialState())}>
          Reset save
        </button>
      </section>

      <p>
        Zona {zone.name} · inimigo {zone.enemyName} HP {fmt(zone.enemyHp)} · Δ slot0 {delta} · ttk {fmt(ttk)}s ·{' '}
        {kpm.toFixed(2)} kills/min · recrutamento {(sealChance(delta) * 100).toFixed(2)}%
      </p>
      <p>
        Fragmentos resgatados: {state.fragments} · possíveis: {claimable + state.fragments} · na UI: {claimable} ·
        bônus DPS: {(1 + state.fragments * BALANCE.PRESTIGE_BONUS).toFixed(2)}x · XP histórico:{' '}
        {fmt(state.xpTotalHistoric)}
      </p>

      {summary ? (
        <p>
          Último retorno: {fmtSeconds(summary.absentSeconds)} · XP {fmt(summary.xpTotal)} · kills{' '}
          {summary.enemiesKilled} · níveis:{' '}
          {summary.characters.map((row) => `${row.name} ${row.fromLevel}→${row.toLevel}`).join(', ') || 'nenhum'}
        </p>
      ) : null}

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            {['Nome', 'Slot', 'Raridade', 'Nível', 'XP', 'DPS', 'XP/s', 'Próx. nível'].map((head) => (
              <th key={head} style={{ textAlign: 'left', borderBottom: '1px solid #444', padding: 6 }}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {state.characters.map((character) => (
            <tr key={character.id}>
              <td style={{ padding: 6 }}>{character.name}</td>
              <td style={{ padding: 6 }}>{character.teamSlot === null ? 'fora' : character.teamSlot}</td>
              <td style={{ padding: 6 }}>{character.rarity}</td>
              <td style={{ padding: 6 }}>{character.level}</td>
              <td style={{ padding: 6 }}>{fmt(character.xpCurrent)}</td>
              <td style={{ padding: 6 }}>{fmt(dps(character.level, state.fragments, character.rarity))}</td>
              <td style={{ padding: 6 }}>{fmt(xpRateFor(character, state))}</td>
              <td style={{ padding: 6 }}>{fmtSeconds(secondsToNextLevel(state, character))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
