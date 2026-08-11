import { MAP_KEYS, type MapKey } from '@/maps/map-registry';

export type HubAction = 'map' | 'bag' | 'heal' | 'return';

export interface HubInteractableDef {
  id: string;
  label: string;
  action: HubAction;
  /** Cor do marcador (hex Phaser). */
  color: number;
  position: { x: number; y: number };
  /** Só aparece neste modo. */
  mode: 'hub' | 'combat';
  /** Mapa onde o ícone existe (opcional = qualquer do modo). */
  mapKey?: MapKey;
}

/**
 * Ícones clicáveis no mundo (hub Folha 1024×576 + retorno do combate).
 * Posições na praça / treino / ramen — tiles caminháveis do leaf-village-hub.
 */
export const HUB_INTERACTABLES: readonly HubInteractableDef[] = [
  {
    id: 'hub-map',
    label: 'Mapa',
    action: 'map',
    color: 0x3ecf6a,
    // Path leste junto à área de treino.
    position: { x: 720, y: 240 },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'hub-bag',
    label: 'Bag',
    action: 'bag',
    color: 0xf0c14a,
    // Próximo aos edifícios / telhado roxo (SE da praça).
    position: { x: 688, y: 368 },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'hub-heal',
    label: 'Curar',
    action: 'heal',
    color: 0x5eb0ff,
    // Perto do ramen (SW, entrada da ponte).
    position: { x: 272, y: 400 },
    mode: 'hub',
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'combat-return',
    label: 'Vila',
    action: 'return',
    color: 0xe070a0,
    // Próximo ao spawn do jogador no recorte de floresta (tile caminhável).
    position: { x: 912, y: 656 },
    mode: 'combat',
    mapKey: MAP_KEYS.forest,
  },
  {
    id: 'combat-return-clearing',
    label: 'Vila',
    action: 'return',
    color: 0xe070a0,
    // Borda inferior da arena oval (clareira nível 1).
    position: { x: 700, y: 400 },
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
