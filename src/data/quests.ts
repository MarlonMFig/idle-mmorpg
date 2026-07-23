import type { QuestDefinition } from '@/types/quest';

/**
 * Catálogo de missões.
 * Cadeias: use `requiresQuestId` / `nextQuestId`.
 * Para adicionar: incluir nova entrada (id único).
 */
const QUEST_LIST: QuestDefinition[] = [
  {
    id: 'quest-academy-intro',
    name: 'Primeiros Passos',
    description: 'Iruka pede que você derrote slimes perto da vila.',
    npcId: 'npc-iruka',
    requiresQuestId: undefined,
    nextQuestId: 'quest-academy-report',
    objectives: [
      {
        id: 'obj-kill-slime',
        kind: 'kill',
        description: 'Derrotar Slimes da Folha',
        targetId: 'leaf-slime',
        amount: 2,
      },
    ],
    rewards: {
      xp: 40,
      items: [{ itemId: 'item-copper-coin', quantity: 10 }],
    },
    dialogue: {
      offer: [
        'Bem-vindo à Academia.',
        'Antes das missões oficiais, quero ver seu básico em campo.',
        'Derrote dois Slimes da Folha e volte a falar comigo.',
      ],
      active: [
        'Ainda faltam slimes. Treine perto da entrada da floresta.',
      ],
      turnIn: [
        'Bom trabalho. Isso é digno de um genin em formação.',
        'Leve estas moedas — e prepare-se para o próximo pedido.',
      ],
      completed: ['Continue treinando. A próxima tarefa já está liberada.'],
    },
  },
  {
    id: 'quest-academy-report',
    name: 'Recado ao Ichiraku',
    description: 'Leve um recado de Iruka até Teuchi no Ichiraku.',
    npcId: 'npc-iruka',
    requiresQuestId: 'quest-academy-intro',
    nextQuestId: 'quest-teuchi-gel',
    objectives: [
      {
        id: 'obj-talk-teuchi',
        kind: 'talk',
        description: 'Falar com Teuchi',
        targetId: 'npc-teuchi',
        amount: 1,
      },
    ],
    rewards: {
      xp: 25,
      items: [{ itemId: 'item-leaf-band', quantity: 1 }],
    },
    dialogue: {
      offer: [
        'Leve este recado ao Teuchi no Ichiraku.',
        'Diga que a Academia agradece o caldo especial para os exames.',
        'Depois volte aqui para confirmar.',
      ],
      active: ['Teuchi fica no Ichiraku Ramen. Não demore.'],
      turnIn: [
        'Teuchi recebeu o recado? Ótimo.',
        'Tome esta bandana — símbolo dos primeiros passos.',
      ],
      completed: ['O Teuchi pode precisar de ajuda em seguida.'],
    },
  },
  {
    id: 'quest-teuchi-gel',
    name: 'Gel para o Caldo',
    description: 'Teuchi precisa de gel de slime para um caldo experimental.',
    npcId: 'npc-teuchi',
    requiresQuestId: 'quest-academy-report',
    objectives: [
      {
        id: 'obj-collect-gel',
        kind: 'collect',
        description: 'Coletar Gel de Slime',
        targetId: 'item-slime-gel',
        amount: 3,
      },
    ],
    rewards: {
      xp: 35,
      items: [
        { itemId: 'item-copper-coin', quantity: 15 },
        { itemId: 'item-chakra-shard', quantity: 1 },
      ],
    },
    dialogue: {
      offer: [
        'Iruka mandou o recado — e eu tenho um favor.',
        'Me traga três Géis de Slime para o caldo especial.',
        'Os slimes soltam isso com frequência.',
      ],
      active: ['Ainda preciso de mais gel. Combata os slimes da vila.'],
      turnIn: [
        'Perfeito! O caldo vai ficar lendário.',
        'Aqui está sua parte — e um fragmento de chakra por garantia.',
      ],
      completed: ['Volte quando quiser um ramen. Genin come de graça… às vezes.'],
    },
  },
];

export type QuestId = (typeof QUEST_LIST)[number]['id'];

export const QUESTS: Record<string, QuestDefinition> = Object.fromEntries(
  QUEST_LIST.map((quest) => [quest.id, quest]),
);

export const QUEST_DEFINITIONS: readonly QuestDefinition[] = QUEST_LIST;

export function getQuest(questId: string): QuestDefinition | undefined {
  return QUESTS[questId];
}

export function listQuestsForNpc(npcId: string): QuestDefinition[] {
  return QUEST_DEFINITIONS.filter((quest) => quest.npcId === npcId);
}

/** Missões que têm objetivo de falar com este NPC (mesmo se o giver for outro). */
export function listQuestsWithTalkTarget(npcId: string): QuestDefinition[] {
  return QUEST_DEFINITIONS.filter((quest) =>
    quest.objectives.some((obj) => obj.kind === 'talk' && obj.targetId === npcId),
  );
}
