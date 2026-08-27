import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

export type HubAction = 'map' | 'bag' | 'heal' | 'return' | 'shop' | 'forge' | 'guild';

/**
 * Silhueta clicável de um prédio do hub. O prédio inteiro é o botão: no hover
 * ele acende e o nome sobe acima do telhado (ver `HubInteractableManager`).
 */
export interface HubBuildingArea {
  /** Largura da fachada (px), centrada em `position.x`. */
  width: number;
  /** Topo do telhado (px) — o nome para um pouco acima disso. */
  top: number;
  /** Base da fachada (px) — o passeio de pedra do hub. */
  bottom: number;
}

export interface HubInteractableDef {
  id: string;
  label: string;
  action: HubAction;
  /** Cor do brilho/borda (hex Phaser). */
  color: number;
  /** Centro da porta: âncora do brilho de entrada e do disco no modo combate. */
  position: { x: number; y: number };
  /** Presente = prédio do hub com hover; ausente = disco flutuante. */
  building?: HubBuildingArea;
  /** Só aparece neste modo. */
  mode: 'hub' | 'combat';
  /** Mapa onde o ícone existe (opcional = qualquer do modo). */
  mapKey?: MapKey;
}

/** @deprecated Use hub-effects (`forge-chimney-smoke`). Mantido para referência legada. */
export const HUB_FORGE_CHIMNEY = { x: 6660, y: 2500 };

/**
 * Zonas dos 5 prédios da praça Konoha (arte 8192×4320).
 * Mapeamento: loja NW, Hokage N, hospital NE, guilda SW, forja SE.
 */
export const HUB_INTERACTABLES: readonly HubInteractableDef[] = [
  {
    id: 'hub-shop',
    label: 'Loja',
    action: 'shop',
    color: 0x7cc0ff,
    position: { x: 2792, y: 2104 },
    building: { width: 1408, top: 976, bottom: 2160 },
    mode: 'hub',
  },
  {
    id: 'hub-bag',
    label: 'Equipe',
    action: 'bag',
    color: 0xc9a0ff,
    position: { x: 4104, y: 1816 },
    building: { width: 1376, top: 640, bottom: 1728 },
    mode: 'hub',
  },
  {
    id: 'hub-heal',
    label: 'Clínica',
    action: 'heal',
    color: 0x8fe3d0,
    position: { x: 5416, y: 2104 },
    building: { width: 1408, top: 976, bottom: 2160 },
    mode: 'hub',
  },
  {
    id: 'hub-guild',
    label: 'Guild',
    action: 'guild',
    color: 0xffc46a,
    position: { x: 2792, y: 2984 },
    building: { width: 1536, top: 2768, bottom: 3920 },
    mode: 'hub',
  },
  {
    id: 'hub-forge',
    label: 'Forja',
    action: 'forge',
    color: 0xffab5e,
    position: { x: 5416, y: 2984 },
    building: { width: 1664, top: 2752, bottom: 3936 },
    mode: 'hub',
  },
  {
    id: 'combat-return',
    label: 'Vila',
    action: 'return',
    color: 0xe070a0,
    position: { x: 912, y: 656 },
    mode: 'combat',
    mapKey: MAP_KEYS.forest,
  },
  {
    id: 'combat-return-clearing',
    label: 'Vila',
    action: 'return',
    color: 0xe070a0,
    position: { x: 2625, y: 1500 },
    mode: 'combat',
    mapKey: MAP_KEYS.huntForestClearing,
  },
] as const;

export function getHubInteractablesFor(
  mode: 'hub' | 'combat',
  mapKey: MapKey,
): HubInteractableDef[] {
  return HUB_INTERACTABLES.filter(
    (entry) => entry.mode === mode && (entry.mapKey == null || entry.mapKey === mapKey),
  );
}
