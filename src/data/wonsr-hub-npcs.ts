/**
 * NPCs do hub Konoha — diálogo/lookType do WONSR, sprite compartilhado do idle.
 * Posições em px na praça ilustrada `konoha-plaza` (3840×2160).
 */
import { NPC_INTERACTION_ICON_KEY } from '@/constants/npc';
import { MAP_KEYS } from '@/maps/map-registry';
import type { NpcDefinition } from '@/types/npc';

const PORTRAIT_DEFAULT = '/sprites/portraits/default.png';

/** Limpa placeholders OTX para o diálogo do idle. */
export function cleanWonsrDialogue(line: string): string {
  return line
    .replaceAll('|PLAYERNAME|', 'shinobi')
    .replace(/\{([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

interface HubNpcSeed {
  id: string;
  name: string;
  lookType: number;
  x: number;
  y: number;
  dialogue: string[];
  portraitUrl?: string;
}

const HUB_SEEDS: readonly HubNpcSeed[] = [
  {
    id: 'wonsr-npc-iruka',
    name: 'Iruka',
    lookType: 587,
    x: 1613,
    y: 1208,
    dialogue: [
      'Ola, entao veio para a academia de shinobis e quer se tornar um {certo}?',
      'Treine na floresta e volte quando estiver mais forte.',
    ],
    portraitUrl: '/sprites/portraits/iruka.png',
  },
  {
    id: 'wonsr-npc-kakashi-sensei',
    name: 'Kakashi Sensei',
    lookType: 891,
    x: 2213,
    y: 1208,
    dialogue: [
      'Ola shinobi, por favor, tenho {missoes} rank a para voce fazer.',
      'Comece pelas criaturas da floresta. Sem pressa — mas sem moleza.',
    ],
    portraitUrl: '/sprites/portraits/sensei.png',
  },
  {
    id: 'wonsr-npc-hiruzen-sarutobi',
    name: 'Hiruzen Sarutobi',
    lookType: 365,
    x: 1920,
    y: 1080,
    dialogue: [
      'Olá Shinobi, recentemente muitos vieram ate min me pedindo para fazer um {treinamento} leve, você também veio por isto?',
      'A Vila da Folha precisa de genin disciplinados.',
    ],
  },
  {
    id: 'wonsr-npc-kuro',
    name: 'Kuro',
    lookType: 734,
    x: 1350,
    y: 1080,
    dialogue: [
      'Olá shinobi. Compro e vendo itens — pergaminhos de selamento e o que sobrar da caça.',
      'Aperte P ou fale comigo na praça quando precisar de cobre ou material.',
    ],
  },
  {
    id: 'wonsr-npc-anko',
    name: 'Anko',
    lookType: 590,
    x: 2550,
    y: 1080,
    dialogue: [
      'Hello |PLAYERNAME|. I see you came to try your luck at the {exame} chunin !!',
      'Quando o exame abrir, eu te aviso. Por agora, sobreviva à floresta.',
    ],
  },
] as const;

export const WONSR_HUB_NPCS: readonly NpcDefinition[] = HUB_SEEDS.map((seed) => ({
  id: seed.id,
  name: seed.name,
  position: { x: seed.x, y: seed.y },
  sprite: `npc-wonsr-${seed.lookType}`,
  spriteUrl: `/sprites/npc-wonsr/${seed.lookType}.png`,
  dialogue: seed.dialogue.map(cleanWonsrDialogue),
  interactionIcon: NPC_INTERACTION_ICON_KEY,
  portraitUrl: seed.portraitUrl ?? PORTRAIT_DEFAULT,
  mapKey: MAP_KEYS.leafVillage,
  /** LookType WONSR usado para montar a sheet DAT em public/sprites/npc-wonsr. */
  lookType: seed.lookType,
}));

export function getHubNpcs(): NpcDefinition[] {
  return [];
}
