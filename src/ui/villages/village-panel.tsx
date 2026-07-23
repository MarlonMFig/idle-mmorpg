'use client';

import { VILLAGE_WAR_DURATION_MS } from '@/constants/village';
import { getVillage, getVillageName } from '@/data/villages';
import { useStore } from '@/hooks/use-store';
import { villageStore } from '@/stores/village-store';
import { HudPanel, HudPanelCollapsed } from '@/ui/hud/hud-panel';

/**
 * Painel de vilas — ranking, pontuação, jogadores e guerras (preparado).
 */
export function VillagePanel() {
  const isOpen = useStore(villageStore, (s) => s.isOpen);
  const playerVillageId = useStore(villageStore, (s) => s.playerVillageId);
  const standings = useStore(villageStore, (s) => s.standings);
  const wars = useStore(villageStore, (s) => s.wars);
  const ranking = villageStore.getRanking();
  const playerStanding = playerVillageId ? standings[playerVillageId] : null;
  const playerRank = villageStore.getPlayerRank();
  const activeWars = wars.filter((war) => war.status === 'declared' || war.status === 'active');

  if (!isOpen) {
    return (
      <HudPanelCollapsed
        label="Vilas (V)"
        ariaLabel="Abrir ranking de vilas"
        className="hud-villages"
        onOpen={() => villageStore.setOpen(true)}
      />
    );
  }

  const playerVillage = playerVillageId ? getVillage(playerVillageId) : null;

  return (
    <HudPanel
      title="Vilas"
      badge="V"
      ariaLabel="Vilas"
      className="hud-villages"
      onClose={() => villageStore.setOpen(false)}
    >
      {playerVillage && playerStanding ? (
        <div className="hud-villages__yours" style={{ borderColor: playerVillage.accent }}>
          <p className="hud-villages__yours-label">Sua vila</p>
          <p className="hud-villages__yours-name" style={{ color: playerVillage.accent }}>
            {playerVillage.name}
          </p>
          <p className="hud-villages__yours-meta">
            Rank #{playerRank} · {playerStanding.score} pts · {playerStanding.playerCount}{' '}
            jogadores
          </p>
        </div>
      ) : null}

      <ol className="hud-villages__ranking" aria-label="Ranking">
        {ranking.map((entry) => {
          const village = getVillage(entry.villageId);
          const isYours = entry.villageId === playerVillageId;
          return (
            <li
              key={entry.villageId}
              className={`hud-villages__row${isYours ? ' is-yours' : ''}`}
            >
              <span className="hud-villages__rank">#{entry.rank}</span>
              <span className="hud-villages__name" style={{ color: village.accent }}>
                {entry.name}
              </span>
              <span className="hud-villages__score">{entry.score}</span>
              <span className="hud-villages__players">{entry.playerCount}</span>
            </li>
          );
        })}
      </ol>
      <div className="hud-villages__legend">
        <span>Pts</span>
        <span>Jogadores</span>
      </div>

      <div className="hud-villages__wars">
        <header className="hud-villages__wars-head">
          <h3 className="hud-villages__wars-title">Guerras</h3>
          {playerVillageId ? (
            <button
              type="button"
              className="hud-villages__war-btn"
              onClick={() => villageStore.declareWarOnRival()}
              title="Declara guerra ao rival histórico (preparação)"
            >
              Declarar vs rival
            </button>
          ) : null}
        </header>

        {activeWars.length === 0 ? (
          <p className="hud-villages__wars-empty">
            Nenhuma guerra ativa. Estrutura pronta para conflitos entre vilas.
          </p>
        ) : (
          <ul className="hud-villages__wars-list">
            {activeWars.map((war) => (
              <li key={war.id}>
                <span>
                  {getVillageName(war.attackerId)} vs {getVillageName(war.defenderId)}
                </span>
                <span className="hud-villages__war-status">
                  {war.status === 'declared' ? 'Declarada' : 'Em curso'}
                  {war.status === 'active' && war.endsAt
                    ? ` · ${Math.max(0, Math.ceil((war.endsAt - Date.now()) / 60000))}m`
                    : war.status === 'declared'
                      ? ` · ~${Math.round(VILLAGE_WAR_DURATION_MS / 60000)}m`
                      : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HudPanel>
  );
}
