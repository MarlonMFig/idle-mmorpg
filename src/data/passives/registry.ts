/**
 * Registry de passivas. Combat Engine não ramifica por personagem.
 * Efeitos de combate ainda não são aplicados neste item.
 */

export interface PassiveDefinition {
  id: string;
  name: string;
  description: string;
}

export const PASSIVES: Record<string, PassiveDefinition> = {
  'awakening-test-focus': {
    id: 'awakening-test-focus',
    name: 'Foco (DEV)',
    description: 'Passiva temporária de teste do Despertar. Sem efeito de combate ainda.',
  },
};

export function getPassiveDefinition(passiveId: string | null | undefined): PassiveDefinition | null {
  if (!passiveId) return null;
  return PASSIVES[passiveId] ?? null;
}

export function listPassiveDefinitions(): PassiveDefinition[] {
  return Object.values(PASSIVES);
}
