'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { STARTERS } from '@/data/starters';
import { getVillageName } from '@/data/villages';
import { useStore } from '@/hooks/use-store';
import { useVitalsStore } from '@/hooks/use-vitals-store';
import { inventoryStore } from '@/stores/inventory-store';
import { huntStore } from '@/stores/hunt-store';
import { locationStore } from '@/stores/location-store';
import { questStore } from '@/stores/quest-store';
import { shopStore } from '@/stores/shop-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import type { HudPlayerInfo } from '@/types/hud';
import { AttributesPanel } from '@/ui/attributes';
import { ChatPlaceholder } from '@/ui/hud/chat-placeholder';
import { MinimapPlaceholder } from '@/ui/hud/minimap-placeholder';
import { MultiplayerStatus } from '@/ui/hud/multiplayer-status';
import { ResourceBar } from '@/ui/hud/resource-bar';
import { InventoryPanel } from '@/ui/inventory';
import { HuntStatusPanel } from '@/ui/hunts';
import { QuestLog } from '@/ui/quests';
import { SkillHotbar } from '@/ui/skills';
import { ShopPanel } from '@/ui/shop';
import { VillagePanel } from '@/ui/villages';

export interface GameHudProps {
  player: HudPlayerInfo;
}

/**
 * HUD clássica de MMORPG em React — vitals via vitalsStore.
 */
export function GameHud({ player }: GameHudProps) {
  const vitals = useVitalsStore();
  const mode = useStore(locationStore, (s) => s.mode);
  const activeMember = useStore(teamStore, (s) => {
    const active = s.collection.find((entry) => entry.id === s.activeId);
    return active ?? null;
  });
  const starter = STARTERS.find((entry) => entry.id === player.starterCharacterId);
  const avatarUrl = activeMember?.previewUrl ?? starter?.previewUrl;
  const activeName = activeMember?.name ?? starter?.name ?? 'Shinobi';

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.code === 'KeyI') {
        event.preventDefault();
        inventoryStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyJ') {
        event.preventDefault();
        questStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyV') {
        event.preventDefault();
        villageStore.toggleOpen();
        return;
      }

      if (event.code === 'KeyP') {
        event.preventDefault();
        shopStore.toggleOpen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`game-hud game-hud--${mode}`} aria-label="Interface do jogo">
      <div className="game-hud__vitals">
        <div className="game-hud__profile">
          {avatarUrl ? (
            <Image
              className="game-hud__avatar"
              src={avatarUrl}
              alt={activeName}
              width={52}
              height={52}
              unoptimized
            />
          ) : null}
          <div className="game-hud__identity">
            <p className="game-hud__name">{player.nickname}</p>
            <p className="game-hud__meta">
              Nv. {vitals.level} · {getVillageName(player.villageId)}
              {' · '}
              <span className="game-hud__mode">{mode === 'hub' ? 'Vila' : 'Caçando'}</span>
            </p>
            <p className="game-hud__active">Ativo: {activeName}</p>
            <MultiplayerStatus />
          </div>
        </div>
        <ResourceBar label="HP" value={vitals.hp} max={vitals.hpMax} variant="hp" />
        <ResourceBar label="XP" value={vitals.xp} max={vitals.xpMax} variant="xp" />
        <AttributesPanel />
        {mode === 'combat' ? <HuntStatusPanel /> : null}
      </div>

      {mode === 'combat' ? (
        <>
          <nav className="game-hud__toolbar" aria-label="Atalhos da caça">
            <button type="button" onClick={() => huntStore.open()} title="Mapa-múndi">
              <span>◎</span> Mapas
            </button>
            <button type="button" onClick={() => inventoryStore.toggleOpen()} title="Inventário">
              <span>▣</span> Bolsa
            </button>
            <button type="button" onClick={() => questStore.toggleOpen()} title="Missões">
              <span>◆</span> Missões
            </button>
            <button type="button" onClick={() => villageStore.toggleOpen()} title="Vilas">
              <span>火</span> Vila
            </button>
            <button
              type="button"
              className="game-hud__toolbar-return"
              onClick={() => locationStore.enterHub()}
            >
              ↩ Voltar
            </button>
          </nav>
          <div className="game-hud__combat-panels">
            <VillagePanel />
            <QuestLog />
          </div>
        </>
      ) : (
        <div className="game-hud__top-right">
          <MinimapPlaceholder />
          <ShopPanel />
          <VillagePanel />
          <QuestLog />
          <button type="button" className="game-hud__return" onClick={() => huntStore.open()}>
            Escolher caça
          </button>
        </div>
      )}

      <div className="game-hud__bottom-center">
        <SkillHotbar />
      </div>

      <div className="game-hud__bottom-right">
        <InventoryPanel />
      </div>

      <div className="game-hud__bottom-left">
        <ChatPlaceholder />
      </div>
    </div>
  );
}
