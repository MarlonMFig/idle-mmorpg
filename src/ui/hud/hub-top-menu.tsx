'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { forgeStore } from '@/stores/forge-store';
import { huntStore } from '@/stores/hunt-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { helperStore } from '@/stores/helper-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore } from '@/stores/location-store';
import { medicStore } from '@/stores/medic-store';
import { accountStore } from '@/stores/account-store';
import { guildStore } from '@/stores/guild-store';
import { teamStore } from '@/stores/team-store';
import { gemStore } from '@/stores/gem-store';
import { vipStore } from '@/stores/vip-store';
import { achievementsStore } from '@/stores/achievements-store';
import { missionsStore } from '@/stores/missions-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { bossStore } from '@/stores/boss-store';
import { rankingStore } from '@/stores/ranking-store';
import { toggleTeamManager } from '@/ui/team';

type HubMenuId =
  | 'equipe'
  | 'inventario'
  | 'medico'
  | 'vip'
  | 'gemas'
  | 'cla'
  | 'guild'
  | 'conquistas'
  | 'missoes'
  | 'diario'
  | 'bosses'
  | 'ranking'
  | 'mapa'
  | 'hunt-analyzer'
  | 'helper';

interface HubMenuItem {
  id: HubMenuId;
  label: string;
  iconSrc: string;
  tone: string;
  title?: string;
  comingSoon?: boolean;
}

const HUB_MENU_ITEMS: readonly HubMenuItem[] = [
  {
    id: 'equipe',
    label: 'Equipe',
    iconSrc: '/ui/hub-menu/equipe.png?v=color',
    tone: '#6aa8ff',
    title: 'Equipe (E)',
  },
  {
    id: 'inventario',
    label: 'Inventário',
    iconSrc: '/ui/hub-menu/inventario.png?v=color',
    tone: '#ff6b9d',
    title: 'Inventário',
  },
  {
    id: 'medico',
    label: 'Médico',
    iconSrc: '/ui/hub-menu/medico.png?v=color',
    tone: '#f0a0b8',
    title: 'Centro de Cura Ninja',
  },
  {
    id: 'vip',
    label: 'VIP',
    iconSrc: '/ui/hub-menu/vip.png?v=color',
    tone: '#e8b84a',
    title: 'VIP Shinobi',
  },
  {
    id: 'gemas',
    label: 'Gemas',
    iconSrc: '/ui/hub-menu/anime-coins-ac.png?v=color',
    tone: '#b06dff',
    title: 'Loja Geral',
  },
  {
    id: 'cla',
    label: 'Linhagem',
    iconSrc: '/ui/hub-menu/linhagem.png?v=color',
    tone: '#5aa8ff',
    title: 'Linhagem',
  },
  {
    id: 'guild',
    label: 'Guild',
    iconSrc: '/ui/hub-menu/guild.png?v=color',
    tone: '#e05a5a',
    title: 'Guild',
  },
  {
    id: 'conquistas',
    label: 'Conquistas',
    iconSrc: '/ui/hub-menu/conquistas.png?v=color',
    tone: '#d4a84b',
    title: 'Conquistas e Títulos',
  },
  {
    id: 'missoes',
    label: 'Missões',
    iconSrc: '/ui/hub-menu/missoes.png?v=color',
    tone: '#7ad4a8',
    title: 'Missões',
  },
  {
    id: 'diario',
    label: 'Diário',
    iconSrc: '/ui/hub-menu/login-diario.png?v=color',
    tone: '#f0d070',
    title: 'Recompensa Diária',
  },
  {
    id: 'bosses',
    label: 'Bosses',
    iconSrc: '/ui/hub-menu/bosses.png?v=color',
    tone: '#e05a5a',
    title: 'Bosses',
  },
  {
    id: 'ranking',
    label: 'Ranking',
    iconSrc: '/ui/hub-menu/ranking.png?v=color',
    tone: '#e8b84a',
    title: 'Ranking',
  },
  {
    id: 'hunt-analyzer',
    label: 'Analyzer',
    iconSrc: '/ui/hub-menu/hunt-analyzer.png',
    tone: '#5ec8ff',
    title: 'Hunt Analyzer',
  },
  {
    id: 'helper',
    label: 'Helper',
    iconSrc: '/ui/hub-menu/helper.png',
    tone: '#7ad4a8',
    title: 'Auto-Helper',
  },
  {
    id: 'mapa',
    label: 'Mapa',
    iconSrc: '/ui/hub-menu/mapa.png',
    tone: '#6ec8ff',
    title: 'Mapa de caças',
  },
] as const;

const MENU_COLLAPSE_KEY = 'idle-hub-menu-collapsed';

/**
 * Menu superior — hub e caça (mesma strip de atalhos).
 */
export function HubTopMenu() {
  const mode = useStore(locationStore, (s) => s.mode);
  const teamOpen = useStore(teamStore, (s) => s.isOpen);
  const invOpen = useStore(inventoryStore, (s) => s.isOpen);
  const clanOpen = useStore(accountStore, (s) => s.isOpen);
  const guildOpen = useStore(guildStore, (s) => s.isOpen);
  const analyzerOpen = useStore(huntAnalyzerStore, (s) => s.isOpen);
  const helperOpen = useStore(helperStore, (s) => s.isOpen);
  const medicOpen = useStore(medicStore, (s) => s.isOpen);
  const vipOpen = useStore(vipStore, (s) => s.isOpen);
  const gemOpen = useStore(gemStore, (s) => s.isOpen);
  const achvOpen = useStore(achievementsStore, (s) => s.isOpen);
  const missionOpen = useStore(missionsStore, (s) => s.isOpen);
  const dailyOpen = useStore(dailyLoginStore, (s) => s.isOpen);
  const bossOpen = useStore(bossStore, (s) => s.isOpen);
  const rankingOpen = useStore(rankingStore, (s) => s.isOpen);
  const encounterKind = useStore(locationStore, (s) => s.encounterKind);
  const missionTick = useStore(
    missionsStore,
    (s) =>
      `${s.daily.cycleId}:${s.weekly.cycleId}:${Object.keys(s.daily.missions).length}:${s.journey.currentId}`,
  );
  const missionBadge = missionTick ? missionsStore.claimableCount() : 0;
  const dailyTick = useStore(
    dailyLoginStore,
    (s) => `${s.lastClaimCycleId ?? ''}:${s.currentDay}:${s.totalClaims}`,
  );
  const dailyAvailable = dailyTick ? dailyLoginStore.isAvailable() : false;
  const [toast, setToast] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(MENU_COLLAPSE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(MENU_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const activate = useCallback(
    (id: HubMenuId) => {
      switch (id) {
        case 'equipe':
          toggleTeamManager();
          return;
        case 'inventario':
          forgeStore.close();
          teamStore.setOpen(false);
          inventoryStore.toggleOpen();
          return;
        case 'cla':
          accountStore.toggleOpen();
          return;
        case 'mapa':
          huntStore.open();
          return;
        case 'hunt-analyzer':
          huntAnalyzerStore.toggleOpen();
          return;
        case 'helper':
          helperStore.toggleOpen();
          return;
        case 'medico':
          medicStore.toggleOpen();
          return;
        case 'vip':
          vipStore.toggleOpen();
          return;
        case 'gemas':
          gemStore.toggleOpen();
          return;
        case 'guild':
          guildStore.toggleOpen();
          return;
        case 'conquistas':
          achievementsStore.toggleOpen();
          return;
        case 'missoes':
          missionsStore.toggleOpen();
          return;
        case 'diario':
          dailyLoginStore.toggleOpen();
          return;
        case 'bosses':
          bossStore.toggleOpen();
          return;
        case 'ranking':
          rankingStore.toggleOpen();
          return;
      }
    },
    [flash],
  );

  return (
    <div className={`hub-menu${collapsed ? ' is-collapsed' : ''}`} aria-label="Menu superior">
      <nav className="hub-menu__bar" aria-label="Atalhos">
        {HUB_MENU_ITEMS.map((item) => {
          const active =
            (item.id === 'equipe' && teamOpen) ||
            (item.id === 'inventario' && invOpen) ||
            (item.id === 'cla' && clanOpen) ||
            (item.id === 'guild' && guildOpen) ||
            (item.id === 'hunt-analyzer' && analyzerOpen) ||
            (item.id === 'helper' && helperOpen) ||
            (item.id === 'medico' && medicOpen) ||
            (item.id === 'vip' && vipOpen) ||
            (item.id === 'gemas' && gemOpen) ||
            (item.id === 'conquistas' && achvOpen) ||
            (item.id === 'missoes' && missionOpen) ||
            (item.id === 'diario' && dailyOpen) ||
            (item.id === 'bosses' && bossOpen) ||
            (item.id === 'ranking' && rankingOpen);

          return (
            <button
              key={item.id}
              type="button"
              className={`hub-menu__item${active ? ' is-active' : ''}${item.comingSoon ? ' is-soon' : ''}`}
              style={{ ['--hub-tone' as string]: item.tone }}
              title={item.title ?? item.label}
              onClick={() => activate(item.id)}
            >
              <span className="hub-menu__icon" aria-hidden>
                <Image
                  className="hub-menu__icon-img"
                  src={item.iconSrc}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  priority
                />
              </span>
              <span className="hub-menu__label">
                {item.label}
                {item.id === 'missoes' && missionBadge > 0 ? ` [${missionBadge}]` : ''}
                {item.id === 'diario' && dailyAvailable ? ' [•]' : ''}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          className="hub-menu__fold"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          onClick={toggleCollapsed}
        >
          <span className="hub-menu__fold-icon" aria-hidden>
            {collapsed ? '▾' : '▴'}
          </span>
          {collapsed ? (
            <span className="hub-menu__fold-label">
              Menu
              {missionBadge > 0 || dailyAvailable ? ' •' : ''}
            </span>
          ) : null}
        </button>
      </nav>

      {mode === 'combat' ? (
        <button
          type="button"
          className="hub-menu__fight hub-menu__fight--return"
          title="Voltar ao hub"
          onClick={() => {
            if (encounterKind === 'boss') {
              bossStore.setAbandonConfirm(true);
              return;
            }
            locationStore.enterHub();
          }}
        >
          <span className="hub-menu__fight-icon" aria-hidden>
            ↩
          </span>
          <span className="hub-menu__fight-label">Voltar</span>
        </button>
      ) : (
        <button
          type="button"
          className="hub-menu__fight"
          title="Escolher caça"
          onClick={() => huntStore.open()}
        >
          <span className="hub-menu__fight-icon" aria-hidden>
            ⚔
          </span>
          <span className="hub-menu__fight-label">Lutar</span>
        </button>
      )}

      {toast ? (
        <p className="hub-menu__toast" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}
