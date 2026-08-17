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

/**
 * Hub lateral (4096×2160). X = centro da porta de cada prédio, Y = altura da
 * entrada, onde a luz do hover vaza para o passeio.
 * Coordenadas geradas por `scripts/install-interdimensional-hub.js`.
 */
const HUB_DOOR_Y = 1415;
/** Passeio de pedra: base comum das fachadas. */
const HUB_BUILDING_BASE = 1489;

export const HUB_INTERACTABLES: readonly HubInteractableDef[] = [
  {
    id: 'hub-shop',
    label: 'Loja',
    action: 'shop',
    color: 0x7cc0ff,
    position: { x: 372, y: HUB_DOOR_Y },
    building: { width: 620, top: 700, bottom: HUB_BUILDING_BASE },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'hub-heal',
    label: 'Clínica',
    action: 'heal',
    color: 0x8fe3d0,
    position: { x: 1131, y: HUB_DOOR_Y },
    building: { width: 470, top: 1010, bottom: HUB_BUILDING_BASE },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'hub-guild',
    label: 'Guild',
    action: 'guild',
    color: 0xffc46a,
    position: { x: 2048, y: HUB_DOOR_Y },
    building: { width: 820, top: 880, bottom: HUB_BUILDING_BASE },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'hub-forge',
    label: 'Forja',
    action: 'forge',
    color: 0xffab5e,
    position: { x: 2910, y: HUB_DOOR_Y },
    building: { width: 430, top: 1050, bottom: HUB_BUILDING_BASE },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
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
