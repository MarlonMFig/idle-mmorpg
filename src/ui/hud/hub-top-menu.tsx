'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import { huntStore } from '@/stores/hunt-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore } from '@/stores/location-store';
import { accountStore } from '@/stores/account-store';
import { teamStore } from '@/stores/team-store';

type HubMenuId =
  | 'equipe'
  | 'inventario'
  | 'medico'
  | 'anime-coins'
  | 'cla'
  | 'guild'
  | 'ranking'
  | 'mapa'
  | 'hunt-analyzer';

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
    iconSrc: '/ui/hub-menu/equipe.png',
    tone: '#6aa8ff',
    title: 'Equipe (E)',
  },
  {
    id: 'inventario',
    label: 'Inventário',
    iconSrc: '/ui/hub-menu/inventario.png',
    tone: '#ff6b9d',
    title: 'Inventário (I)',
  },
  {
    id: 'medico',
    label: 'Médico',
    iconSrc: '/ui/hub-menu/medico.png',
    tone: '#f0a0b8',
    comingSoon: true,
  },
  {
    id: 'anime-coins',
    label: 'Anime Coins',
    iconSrc: '/ui/hub-menu/anime-coins.png',
    tone: '#e8b84a',
    comingSoon: true,
  },
  {
    id: 'cla',
    label: 'Clã',
    iconSrc: '/ui/hub-menu/cla.png',
    tone: '#5aa8ff',
    title: 'Clãs',
  },
  {
    id: 'guild',
    label: 'Guild',
    iconSrc: '/ui/hub-menu/guild.png',
    tone: '#e05a5a',
    comingSoon: true,
  },
  {
    id: 'ranking',
    label: 'Ranking',
    iconSrc: '/ui/hub-menu/ranking.png',
    tone: '#e8b84a',
    comingSoon: true,
  },
  {
    id: 'hunt-analyzer',
    label: 'Analyzer',
    iconSrc: '/ui/hub-menu/hunt-analyzer.png',
    tone: '#5ec8ff',
    title: 'Hunt Analyzer',
  },
  {
    id: 'mapa',
    label: 'Mapa',
    iconSrc: '/ui/hub-menu/mapa.png',
    tone: '#6ec8ff',
    title: 'Mapa de caças',
  },
] as const;

/**
 * Menu superior — hub e caça (mesma strip de atalhos).
 */
export function HubTopMenu() {
  const mode = useStore(locationStore, (s) => s.mode);
  const teamOpen = useStore(teamStore, (s) => s.isOpen);
  const invOpen = useStore(inventoryStore, (s) => s.isOpen);
  const clanOpen = useStore(accountStore, (s) => s.isOpen);
  const analyzerOpen = useStore(huntAnalyzerStore, (s) => s.isOpen);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  const activate = useCallback(
    (id: HubMenuId) => {
      switch (id) {
        case 'equipe':
          teamStore.toggleOpen();
          return;
        case 'inventario':
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
        case 'medico':
          flash('Médico — em breve');
          return;
        case 'anime-coins':
          flash('Anime Coins — em breve');
          return;
        case 'guild':
          flash('Guild — em breve');
          return;
        case 'ranking':
          flash('Ranking — em breve');
          return;
      }
    },
    [flash],
  );

  return (
    <div className="hub-menu" aria-label="Menu superior">
      <nav className="hub-menu__bar" aria-label="Atalhos">
        {HUB_MENU_ITEMS.map((item) => {
          const active =
            (item.id === 'equipe' && teamOpen) ||
            (item.id === 'inventario' && invOpen) ||
            (item.id === 'cla' && clanOpen) ||
            (item.id === 'hunt-analyzer' && analyzerOpen);

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
              <span className="hub-menu__label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {mode === 'combat' ? (
        <button
          type="button"
          className="hub-menu__fight hub-menu__fight--return"
          title="Voltar ao hub"
          onClick={() => locationStore.enterHub()}
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
