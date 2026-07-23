import {
  NPC_INTERACTION_ICON_KEY,
  NPC_TEXTURE_KEY,
} from '@/constants/npc';
import { MAP_KEYS } from '@/maps/map-registry';
import type { NpcDefinition } from '@/types/npc';

const PORTRAIT = {
  iruka: '/sprites/portraits/iruka.png',
  teuchi: '/sprites/portraits/teuchi.png',
  scout: '/sprites/portraits/scout.png',
  sensei: '/sprites/portraits/sensei.png',
  default: '/sprites/portraits/default.png',
} as const;

/** NPCs por mapa (fonte usada pelo NPCManager). */
export const NPC_DEFINITIONS: readonly NpcDefinition[] = [
  {
    id: 'npc-iruka',
    name: 'Iruka',
    position: { x: 320, y: 280 },
    sprite: NPC_TEXTURE_KEY,
    dialogue: [
      'Bem-vindo à Academia.',
      'Treine duro e proteja seus companheiros.',
      'Quando estiver pronto, fale comigo sobre as primeiras missões.',
    ],
    interactionIcon: NPC_INTERACTION_ICON_KEY,
    portraitUrl: PORTRAIT.iruka,
    mapKey: MAP_KEYS.leafVillage,
    questHook: {
      questId: 'quest-academy-intro',
      onCompleteEvent: 'dialogue:npc-iruka:complete',
    },
  },
  {
    id: 'npc-teuchi',
    name: 'Teuchi',
    position: { x: 480, y: 400 },
    sprite: NPC_TEXTURE_KEY,
    dialogue: [
      'Ichiraku Ramen, o melhor de Konoha!',
      'Um dia o Naruto vai pagar a conta… talvez.',
    ],
    interactionIcon: NPC_INTERACTION_ICON_KEY,
    portraitUrl: PORTRAIT.teuchi,
    mapKey: MAP_KEYS.leafVillage,
  },
  {
    id: 'npc-scout',
    name: 'ANBU Scout',
    position: { x: 200, y: 360 },
    sprite: NPC_TEXTURE_KEY,
    dialogue: ['A floresta não perdoa descuido.', 'Mantenha o chakra estável.'],
    interactionIcon: NPC_INTERACTION_ICON_KEY,
    portraitUrl: PORTRAIT.scout,
    mapKey: MAP_KEYS.forest,
  },
  {
    id: 'npc-sensei',
    name: 'Sensei',
    position: { x: 320, y: 300 },
    sprite: NPC_TEXTURE_KEY,
    dialogue: [
      'A Academia forja shinobi, não heróis.',
      'Mostre disciplina nos fundamentos.',
    ],
    interactionIcon: NPC_INTERACTION_ICON_KEY,
    portraitUrl: PORTRAIT.sensei,
    mapKey: MAP_KEYS.academy,
    questHook: {
      questId: 'quest-academy-basics',
      onCompleteEvent: 'dialogue:npc-sensei:complete',
    },
  },
] as const;

export function getNpcsForMap(mapKey: string): NpcDefinition[] {
  return NPC_DEFINITIONS.filter((npc) => npc.mapKey === mapKey);
}
