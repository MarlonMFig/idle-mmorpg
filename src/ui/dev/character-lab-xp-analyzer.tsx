'use client';

import { useEffect, useMemo, useState } from 'react';
import { applyForcedHuntLevels } from '@/constants/combat';
import { computeHuntKillXp } from '@/lib/hunt-kill-xp';
import {
  analyzeHuntForPlayer,
  recommendedHuntForLevel,
  simulateExactMinutes,
  simulateXpProgression,
} from '@/lib/xp-progression-sim';
import { getXpRequiredForLevel } from '@/lib/player-progression';
import type { HuntCatalog, HuntDefinition } from '@/types/hunt';

const HUNTS_URL = '/data/wonsr/hunts.json?v=wonsr-10maps';

const SHORTCUTS = [
  { label: '1 → 10', start: 1, target: 10 },
  { label: '1 → 20', start: 1, target: 20 },
  { label: '1 → 30', start: 1, target: 30 },
  { label: '1 → 40', start: 1, target: 40 },
  { label: '1 → 50', start: 1, target: 50 },
  { label: '1 → 100', start: 1, target: 100 },
] as const;

function fmtMin(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const m = Math.floor(value);
  const s = Math.round((value - m) * 60);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function CharacterLabXpAnalyzer() {
  const [hunts, setHunts] = useState<HuntDefinition[]>([]);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [huntId, setHuntId] = useState('');
  const [startLevel, setStartLevel] = useState(1);
  const [targetLevel, setTargetLevel] = useState(50);
  const [xpMultiplier, setXpMultiplier] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetch(HUNTS_URL)
      .then((response) => response.json() as Promise<HuntCatalog>)
      .then((catalog) => {
        if (cancelled) return;
        const next = applyForcedHuntLevels(catalog).hunts;
        setHunts(next);
        setHuntId((current) => current || next.find((hunt) => hunt.requiredLevel === 1)?.id || next[0]?.id || '');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hunt = hunts.find((entry) => entry.id === huntId) ?? hunts[0];
  const analyzer = hunt ? analyzeHuntForPlayer(hunt, playerLevel, { xpMultiplier }) : null;
  const kill = hunt
    ? computeHuntKillXp({
        playerLevel,
        enemyLevel: hunt.targets[0]?.level ?? hunt.requiredLevel,
        xpMultiplier,
        expBoostMultiplier: 1,
      })
    : null;
  const comparator = useMemo(
    () =>
      hunts
        .filter((entry) => entry.tab !== 'bosses' && !entry.id.startsWith('hunt-teste'))
        .map((entry) => analyzeHuntForPlayer(entry, playerLevel, { xpMultiplier }))
        .filter((row): row is NonNullable<typeof row> => row != null)
        .sort((a, b) => b.xpPerMin - a.xpPerMin)
        .slice(0, 12),
    [hunts, playerLevel, xpMultiplier],
  );
  const best = recommendedHuntForLevel(hunts, playerLevel, { xpMultiplier });
  const sim = useMemo(() => {
    if (hunts.length === 0) return null;
    try {
      return simulateXpProgression(hunts, startLevel, targetLevel, { xpMultiplier });
    } catch {
      return null;
    }
  }, [hunts, startLevel, targetLevel, xpMultiplier]);
  const hour = useMemo(() => {
    if (hunts.length === 0) return null;
    return simulateExactMinutes(hunts, 60, { xpMultiplier, startLevel: 1 });
  }, [hunts, xpMultiplier]);

  return (
    <section className="character-lab__section">
      <h3>XP PROGRESSION ANALYZER</h3>
      <p className="character-lab__hint">
        Somente diagnóstico. Não grava save, não concede XP, VIP=off, stage/gap aplicados no Final XP.
      </p>
      <label className="character-lab__hint">
        Player Level
        <input
          type="number"
          min={1}
          max={9999}
          value={playerLevel}
          onChange={(event) => setPlayerLevel(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
      <label className="character-lab__hint">
        Hunt
        <select value={hunt?.id ?? ''} onChange={(event) => setHuntId(event.target.value)}>
          {hunts.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.requiredLevel} · {entry.name}
            </option>
          ))}
        </select>
      </label>
      {analyzer && kill ? (
        <p className="character-lab__hint">
          Enemy Lv {kill.enemyLevel} · gap {kill.levelGap} · base {kill.baseXp} · gap×
          {kill.levelGapMultiplier.toFixed(2)} · final/kill {kill.finalXp} · kills/min{' '}
          {analyzer.killsPerMin.toFixed(2)} · XP/min {analyzer.xpPerMin.toFixed(0)} · to next{' '}
          {getXpRequiredForLevel(playerLevel)} · ETA {fmtMin(getXpRequiredForLevel(playerLevel) / analyzer.xpPerMin)}
        </p>
      ) : null}
      <h4>COMPARADOR / RECOMENDADA</h4>
      <p className="character-lab__hint">
        Melhor XP/min neste Level: {best ? `${best.name} (${best.xpPerMin.toFixed(0)} XP/min)` : '—'}
      </p>
      <pre className="character-lab__hint" style={{ whiteSpace: 'pre-wrap' }}>
        {comparator
          .map(
            (row) =>
              `${row.requiredLevel.toString().padStart(3)} ${row.name.slice(0, 22).padEnd(22)} base ${row.baseXp} ×${row.gapMultiplier.toFixed(2)} → ${row.finalXpPerKill}/k  ${row.killsPerMin.toFixed(1)} k/m  ${row.xpPerMin.toFixed(0)} XP/min`,
          )
          .join('\n')}
      </pre>
      <h3>XP PROGRESSION SIMULATOR</h3>
      <label className="character-lab__hint">
        Start
        <input
          type="number"
          min={1}
          value={startLevel}
          onChange={(event) => setStartLevel(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
      <label className="character-lab__hint">
        Target
        <input
          type="number"
          min={2}
          value={targetLevel}
          onChange={(event) => setTargetLevel(Math.max(2, Number(event.target.value) || 2))}
        />
      </label>
      <label className="character-lab__hint">
        XP multiplier (simulação)
        <input
          type="number"
          min={1}
          step={0.1}
          value={xpMultiplier}
          onChange={(event) => setXpMultiplier(Math.max(1, Number(event.target.value) || 1))}
        />
      </label>
      <p className="character-lab__hint">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            onClick={() => {
              setStartLevel(shortcut.start);
              setTargetLevel(shortcut.target);
            }}
          >
            {shortcut.label}
          </button>
        ))}
      </p>
      {sim ? (
        <p className="character-lab__hint">
          {sim.startLevel}→{sim.targetLevel} · {fmtMin(sim.estimatedMinutes)} · XP {sim.totalXpRequired} ·
          média {sim.averageXpPerMin.toFixed(0)}/min · kills ~{Math.round(sim.estimatedKills)}
          {sim.stuckOnFirstHuntMinutes != null
            ? ` · parado no 1º mapa ${fmtMin(sim.stuckOnFirstHuntMinutes)}`
            : ''}
        </p>
      ) : null}
      {sim ? (
        <pre className="character-lab__hint" style={{ whiteSpace: 'pre-wrap' }}>
          {sim.huntsUsed
            .map((used) => `${used.huntName}: ${fmtMin(used.minutes)} (~${Math.round(used.kills)} kills)`)
            .join('\n')}
        </pre>
      ) : null}
      {hour ? (
        <p className="character-lab__hint">
          60 min exatos: Lv{hour.level} +{Math.round(hour.xp)} XP ({hour.percentToNext.toFixed(1)}% next) ·
          kills ~{Math.round(hour.kills)}
        </p>
      ) : null}
    </section>
  );
}
