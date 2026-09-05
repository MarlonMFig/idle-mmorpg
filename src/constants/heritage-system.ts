/**
 * Sistema de Herança — configuração pura (balanceamento).
 * IDs estáveis; não misturar com lógica de combate/UI.
 */

export type HeritageUnlockRank = 0 | 1 | 2 | 3 | 4;

/** Labels de unlock na UI (rank 4 = ANBU no desenho da Herança). */
export const HERITAGE_RANK_UNLOCK_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Genin',
  2: 'Chunin',
  3: 'Jounin',
  4: 'ANBU',
};

/**
 * Modificadores percentuais (0.08 = +8%).
 * Todos multiplicativos sobre o status já progressado.
 */
export interface HeritageModifiers {
  ataque?: number;
  defesa?: number;
  hp?: number;
  velocidadeAtaque?: number;
  critico?: number;
  chanceDrop?: number;
  chanceCaptura?: number;
  /** Fração do HP máx curada por kill (0.01 = 1%). */
  regenPorKill?: number;
  /**
   * Multiplica a penalidade dos portões (ex.: 0.8 = −20% na penalidade).
   * Nv5 Salamandra = 0.8.
   */
  reducaoPenalidadePortoes?: number;
  /** Regeneração contínua enquanto Sennin ativo (fração do HP máx / segundo). */
  regenContinuoPorSegundo?: number;
}

/** Teto global (Clã / Invocação). Sennin e Selo usam 3 via `levels.length`. */
export const HERITAGE_OPTION_MAX_LEVEL = 5;
export const HERITAGE_SHORT_OPTION_MAX_LEVEL = 3;

export type HeritageOptionLevelTuple3 = readonly [
  HeritageModifiers,
  HeritageModifiers,
  HeritageModifiers,
];

export type HeritageOptionLevelTuple5 = readonly [
  HeritageModifiers,
  HeritageModifiers,
  HeritageModifiers,
  HeritageModifiers,
  HeritageModifiers,
];

export type HeritageOptionLevelTuple = HeritageOptionLevelTuple3 | HeritageOptionLevelTuple5;

/** Opção com níveis fixos (index 0 = Nv1). Sem interpolação. */
export interface HeritageOptionDefinition {
  id: string;
  name: string;
  /** Técnica de assinatura / kekkei (UI: subtítulo). */
  tecnica?: string;
  /** Rank mínimo de graduação (1=Genin … 4=ANBU). 0 = sempre. */
  requiredRank: HeritageUnlockRank;
  levels: HeritageOptionLevelTuple;
  description?: string;
}

export interface HeritageGateDefinition {
  id: string;
  name: string;
  requiredRank: HeritageUnlockRank;
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  modifiers: HeritageModifiers;
}

/** Piso: status nunca abaixo de 10% do valor pré-Herança. */
export const HERITAGE_STAT_FLOOR_RATIO = 0.1;

/** Ciclo do Modo Sennin (ms). */
export const SENNIN_CHARGE_MS = 30_000;
export const SENNIN_ACTIVE_MS = 60_000;
export const SENNIN_COOLDOWN_MS = 90_000;

/**
 * Portões do Chakra — um único portão ativo por vez.
 * Os valores NÃO são cumulativos: o portão ativo substitui o anterior.
 */
export const HERITAGE_GATES: readonly HeritageGateDefinition[] = [
  {
    id: 'gate-1',
    level: 1,
    name: 'Kaimon',
    requiredRank: 0,
    modifiers: { ataque: 0.03 },
  },
  {
    id: 'gate-2',
    level: 2,
    name: 'Kyumon',
    requiredRank: 0,
    modifiers: { ataque: 0.06, velocidadeAtaque: 0.03 },
  },
  {
    id: 'gate-3',
    level: 3,
    name: 'Seimon',
    requiredRank: 0,
    modifiers: { ataque: 0.1, velocidadeAtaque: 0.05 },
  },
  {
    id: 'gate-4',
    level: 4,
    name: 'Shomon',
    requiredRank: 0,
    modifiers: { ataque: 0.15, velocidadeAtaque: 0.08, hp: -0.05, defesa: -0.05 },
  },
  {
    id: 'gate-5',
    level: 5,
    name: 'Tomon',
    requiredRank: 0,
    modifiers: { ataque: 0.2, velocidadeAtaque: 0.12, hp: -0.1, defesa: -0.1 },
  },
  {
    id: 'gate-6',
    level: 6,
    name: 'Keimon',
    requiredRank: 0,
    modifiers: { ataque: 0.28, velocidadeAtaque: 0.16, hp: -0.15, defesa: -0.15 },
  },
  {
    id: 'gate-7',
    level: 7,
    name: 'Kyomon',
    requiredRank: 0,
    modifiers: { ataque: 0.35, velocidadeAtaque: 0.22, hp: -0.25, defesa: -0.25 },
  },
  {
    id: 'gate-8',
    level: 8,
    name: 'Shimon',
    requiredRank: 0,
    modifiers: { ataque: 0.45, velocidadeAtaque: 0.3, hp: -0.4, defesa: -0.4 },
  },
] as const;

export const HERITAGE_CLANS: readonly HeritageOptionDefinition[] = [
  {
    id: 'cla-uchiha',
    name: 'Uchiha',
    tecnica: 'Sharingan',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, critico: 0.01 },
      { ataque: 0.04, critico: 0.02 },
      { ataque: 0.06, critico: 0.03 },
      { ataque: 0.08, critico: 0.04 },
      { ataque: 0.1, critico: 0.05 },
    ],
  },
  {
    id: 'cla-hyuga',
    name: 'Hyuga',
    tecnica: 'Byakugan',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, chanceDrop: 0.02 },
      { ataque: 0.03, chanceDrop: 0.03 },
      { ataque: 0.04, chanceDrop: 0.04 },
      { ataque: 0.05, chanceDrop: 0.05 },
      { ataque: 0.06, chanceDrop: 0.06 },
    ],
  },
  {
    id: 'cla-kaguya',
    name: 'Kaguya',
    tecnica: 'Shikotsumyaku',
    requiredRank: 1,
    levels: [
      { defesa: 0.02, hp: 0.02, ataque: -0.01 },
      { defesa: 0.04, hp: 0.04, ataque: -0.02 },
      { defesa: 0.06, hp: 0.06, ataque: -0.03 },
      { defesa: 0.08, hp: 0.08, ataque: -0.04 },
      { defesa: 0.1, hp: 0.08, ataque: -0.05 },
    ],
  },
  {
    id: 'cla-senju',
    name: 'Senju',
    tecnica: 'Mokuton',
    requiredRank: 1,
    levels: [
      { hp: 0.02, regenPorKill: 0.002 },
      { hp: 0.04, regenPorKill: 0.004 },
      { hp: 0.06, regenPorKill: 0.006 },
      { hp: 0.08, regenPorKill: 0.008 },
      { hp: 0.08, regenPorKill: 0.01 },
    ],
  },
  {
    id: 'cla-yuki',
    name: 'Yuki',
    tecnica: 'Hyoton',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, velocidadeAtaque: -0.01 },
      { ataque: 0.04, velocidadeAtaque: -0.01 },
      { ataque: 0.06, velocidadeAtaque: -0.02 },
      { ataque: 0.08, velocidadeAtaque: -0.02 },
      { ataque: 0.1, velocidadeAtaque: -0.03 },
    ],
  },
  {
    id: 'cla-uzumaki',
    name: 'Uzumaki',
    tecnica: 'Fuinjutsu',
    requiredRank: 1,
    levels: [
      { hp: 0.03, chanceCaptura: 0.01, ataque: -0.01 },
      { hp: 0.05, chanceCaptura: 0.02, ataque: -0.02 },
      { hp: 0.07, chanceCaptura: 0.04, ataque: -0.03 },
      { hp: 0.09, chanceCaptura: 0.05, ataque: -0.04 },
      { hp: 0.12, chanceCaptura: 0.06, ataque: -0.05 },
    ],
  },
  {
    id: 'cla-nara',
    name: 'Nara',
    tecnica: 'Kagemane',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, critico: 0.01 },
      { ataque: 0.03, critico: 0.02 },
      { ataque: 0.05, critico: 0.02 },
      { ataque: 0.06, critico: 0.03 },
      { ataque: 0.08, critico: 0.04 },
    ],
  },
  {
    id: 'cla-akimichi',
    name: 'Akimichi',
    tecnica: 'Baika no Jutsu',
    requiredRank: 1,
    levels: [
      { hp: 0.03, defesa: 0.02, ataque: -0.01 },
      { hp: 0.05, defesa: 0.03, ataque: -0.02 },
      { hp: 0.07, defesa: 0.04, ataque: -0.03 },
      { hp: 0.09, defesa: 0.05, ataque: -0.04 },
      { hp: 0.12, defesa: 0.06, ataque: -0.06 },
    ],
  },
  {
    id: 'cla-aburame',
    name: 'Aburame',
    tecnica: 'Kikaichu',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, chanceCaptura: 0.02 },
      { ataque: 0.03, chanceCaptura: 0.03 },
      { ataque: 0.04, chanceCaptura: 0.04 },
      { ataque: 0.05, chanceCaptura: 0.05 },
      { ataque: 0.06, chanceCaptura: 0.06 },
    ],
  },
  {
    id: 'cla-inuzuka',
    name: 'Inuzuka',
    tecnica: 'Faro Aguçado',
    requiredRank: 1,
    levels: [
      { velocidadeAtaque: 0.02, chanceDrop: 0.01 },
      { velocidadeAtaque: 0.04, chanceDrop: 0.02 },
      { velocidadeAtaque: 0.05, chanceDrop: 0.02 },
      { velocidadeAtaque: 0.06, chanceDrop: 0.03 },
      { velocidadeAtaque: 0.08, chanceDrop: 0.04 },
    ],
  },
  {
    id: 'cla-yamanaka',
    name: 'Yamanaka',
    tecnica: 'Shintenshin',
    requiredRank: 1,
    levels: [
      { ataque: 0.02, chanceCaptura: 0.02 },
      { ataque: 0.03, chanceCaptura: 0.03 },
      { ataque: 0.04, chanceCaptura: 0.05 },
      { ataque: 0.05, chanceCaptura: 0.06 },
      { ataque: 0.06, chanceCaptura: 0.08 },
    ],
  },
  {
    id: 'cla-namikaze',
    name: 'Namikaze',
    tecnica: 'Hiraishin',
    requiredRank: 1,
    levels: [
      { velocidadeAtaque: 0.03, ataque: 0.01 },
      { velocidadeAtaque: 0.05, ataque: 0.02 },
      { velocidadeAtaque: 0.07, ataque: 0.04 },
      { velocidadeAtaque: 0.09, ataque: 0.05 },
      { velocidadeAtaque: 0.12, ataque: 0.06 },
    ],
  },
  {
    id: 'cla-sabaku',
    name: 'Sabaku',
    tecnica: 'Jiton',
    requiredRank: 1,
    levels: [
      { defesa: 0.02, ataque: 0.01 },
      { defesa: 0.04, ataque: 0.02 },
      { defesa: 0.05, ataque: 0.04 },
      { defesa: 0.07, ataque: 0.05 },
      { defesa: 0.08, ataque: 0.06 },
    ],
  },
] as const;

/** @deprecated use HERITAGE_CLANS */
export const HERITAGE_KEKKEI = HERITAGE_CLANS;

/** Migração de ids antigos (Kekkei Genkai) → Clã. */
export const LEGACY_KEKKEI_TO_CLA: Readonly<Record<string, string>> = {
  'kekkei-sharingan': 'cla-uchiha',
  'kekkei-byakugan': 'cla-hyuga',
  'kekkei-hyoton': 'cla-yuki',
  'kekkei-shikotsumyaku': 'cla-kaguya',
  'kekkei-mokuton': 'cla-senju',
};

export function migrateHeritageClanOptionId(optionId: string | null | undefined): string | null {
  if (!optionId) return null;
  return LEGACY_KEKKEI_TO_CLA[optionId] ?? optionId;
}

export const HERITAGE_SUMMONS: readonly HeritageOptionDefinition[] = [
  {
    id: 'summon-sapo',
    name: 'Sapo',
    requiredRank: 2,
    levels: [
      { ataque: 0.01, defesa: 0.01, hp: 0.01, velocidadeAtaque: 0.01, critico: 0.01 },
      { ataque: 0.02, defesa: 0.02, hp: 0.02, velocidadeAtaque: 0.02, critico: 0.02 },
      { ataque: 0.03, defesa: 0.03, hp: 0.03, velocidadeAtaque: 0.03, critico: 0.03 },
      { ataque: 0.04, defesa: 0.04, hp: 0.04, velocidadeAtaque: 0.04, critico: 0.04 },
      { ataque: 0.05, defesa: 0.05, hp: 0.05, velocidadeAtaque: 0.05, critico: 0.05 },
    ],
  },
  {
    id: 'summon-cobra',
    name: 'Cobra',
    requiredRank: 2,
    levels: [
      { ataque: 0.03 },
      { ataque: 0.05 },
      { ataque: 0.07 },
      { ataque: 0.09 },
      { ataque: 0.12 },
    ],
  },
  {
    id: 'summon-lesma',
    name: 'Lesma',
    requiredRank: 2,
    levels: [
      { hp: 0.02, regenPorKill: 0.002 },
      { hp: 0.04, regenPorKill: 0.004 },
      { hp: 0.06, regenPorKill: 0.006 },
      { hp: 0.08, regenPorKill: 0.008 },
      { hp: 0.1, regenPorKill: 0.01 },
    ],
  },
  {
    id: 'summon-macaco',
    name: 'Macaco',
    requiredRank: 2,
    levels: [
      { defesa: 0.03, hp: 0.02 },
      { defesa: 0.05, hp: 0.04 },
      { defesa: 0.07, hp: 0.05 },
      { defesa: 0.09, hp: 0.07 },
      { defesa: 0.12, hp: 0.08 },
    ],
  },
  {
    id: 'summon-fuinha',
    name: 'Fuinha',
    requiredRank: 2,
    levels: [
      { velocidadeAtaque: 0.02 },
      { velocidadeAtaque: 0.04 },
      { velocidadeAtaque: 0.06 },
      { velocidadeAtaque: 0.08 },
      { velocidadeAtaque: 0.1 },
    ],
  },
  {
    id: 'summon-caes',
    name: 'Cães',
    requiredRank: 2,
    levels: [
      { chanceDrop: 0.02 },
      { chanceDrop: 0.03 },
      { chanceDrop: 0.04 },
      { chanceDrop: 0.06 },
      { chanceDrop: 0.08 },
    ],
  },
  {
    id: 'summon-passaros',
    name: 'Pássaros',
    requiredRank: 2,
    levels: [
      { chanceCaptura: 0.02 },
      { chanceCaptura: 0.03 },
      { chanceCaptura: 0.04 },
      { chanceCaptura: 0.06 },
      { chanceCaptura: 0.08 },
    ],
  },
  {
    id: 'summon-salamandra',
    name: 'Salamandra',
    requiredRank: 2,
    description: 'Reduz a penalidade dos Portões (Nv5: ×0.8).',
    levels: [
      { defesa: 0.02, hp: 0.02, reducaoPenalidadePortoes: 0.96 },
      { defesa: 0.04, hp: 0.04, reducaoPenalidadePortoes: 0.92 },
      { defesa: 0.05, hp: 0.05, reducaoPenalidadePortoes: 0.88 },
      { defesa: 0.07, hp: 0.07, reducaoPenalidadePortoes: 0.84 },
      { defesa: 0.08, hp: 0.08, reducaoPenalidadePortoes: 0.8 },
    ],
  },
] as const;

export const HERITAGE_SENNIN: readonly HeritageOptionDefinition[] = [
  {
    id: 'sennin-sapo',
    name: 'Modo Sennin — Sapo',
    requiredRank: 3,
    levels: [
      { ataque: 0.07, defesa: 0.07 },
      { ataque: 0.14, defesa: 0.14 },
      { ataque: 0.2, defesa: 0.2 },
    ],
  },
  {
    id: 'sennin-cobra',
    name: 'Modo Sennin — Cobra',
    requiredRank: 3,
    levels: [
      { ataque: 0.08, defesa: -0.03 },
      { ataque: 0.17, defesa: -0.05 },
      { ataque: 0.25, defesa: -0.08 },
    ],
  },
  {
    id: 'sennin-lesma',
    name: 'Modo Sennin — Lesma',
    requiredRank: 3,
    levels: [
      { ataque: 0.05, regenContinuoPorSegundo: 0.004 },
      { ataque: 0.1, regenContinuoPorSegundo: 0.007 },
      { ataque: 0.15, regenContinuoPorSegundo: 0.01 },
    ],
  },
] as const;

export const HERITAGE_CURSED_SEALS: readonly HeritageOptionDefinition[] = [
  {
    id: 'seal-ceu',
    name: 'Selo — Céu',
    requiredRank: 4,
    levels: [
      { ataque: 0.05, hp: -0.03 },
      { ataque: 0.1, hp: -0.06 },
      { ataque: 0.15, hp: -0.1 },
    ],
  },
  {
    id: 'seal-terra',
    name: 'Selo — Terra',
    requiredRank: 4,
    levels: [
      { defesa: 0.05, hp: 0.03, ataque: -0.03 },
      { defesa: 0.1, hp: 0.06, ataque: -0.05 },
      { defesa: 0.15, hp: 0.1, ataque: -0.08 },
    ],
  },
  {
    id: 'seal-lua',
    name: 'Selo — Lua',
    requiredRank: 4,
    levels: [
      { velocidadeAtaque: 0.04, chanceDrop: 0.03, defesa: -0.03 },
      { velocidadeAtaque: 0.08, chanceDrop: 0.05, defesa: -0.06 },
      { velocidadeAtaque: 0.12, chanceDrop: 0.08, defesa: -0.1 },
    ],
  },
  {
    id: 'seal-sol',
    name: 'Selo — Sol',
    requiredRank: 4,
    levels: [
      { ataque: 0.03, velocidadeAtaque: 0.03, hp: -0.03, defesa: -0.03 },
      { ataque: 0.07, velocidadeAtaque: 0.07, hp: -0.05, defesa: -0.05 },
      { ataque: 0.1, velocidadeAtaque: 0.1, hp: -0.08, defesa: -0.08 },
    ],
  },
] as const;

export type HeritageSlotId = 'cla' | 'summon' | 'sennin' | 'cursedSeal';

export const HERITAGE_SLOTS: Record<
  HeritageSlotId,
  {
    id: HeritageSlotId;
    name: string;
    requiredRank: 1 | 2 | 3 | 4;
    options: readonly HeritageOptionDefinition[];
  }
> = {
  cla: { id: 'cla', name: 'Clã', requiredRank: 1, options: HERITAGE_CLANS },
  summon: { id: 'summon', name: 'Invocação', requiredRank: 2, options: HERITAGE_SUMMONS },
  sennin: { id: 'sennin', name: 'Modo Sennin', requiredRank: 3, options: HERITAGE_SENNIN },
  cursedSeal: { id: 'cursedSeal', name: 'Selo Amaldiçoado', requiredRank: 4, options: HERITAGE_CURSED_SEALS },
};

export function getHeritageOptionMaxLevel(option: HeritageOptionDefinition): number {
  return option.levels.length;
}

export function clampHeritageOptionLevel(
  level: unknown,
  maxLevel: number = HERITAGE_OPTION_MAX_LEVEL,
): number {
  const max = Math.max(1, Math.floor(maxLevel));
  if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(max, Math.floor(level)));
}

export function clampHeritageOptionLevelFor(
  option: HeritageOptionDefinition,
  level: unknown,
): number {
  return clampHeritageOptionLevel(level, getHeritageOptionMaxLevel(option));
}

export function getHeritageOption(
  slot: HeritageSlotId | 'gates',
  optionId: string | null | undefined,
): HeritageOptionDefinition | HeritageGateDefinition | null {
  if (!optionId) return null;
  if (slot === 'gates') return HERITAGE_GATES.find((row) => row.id === optionId) ?? null;
  const migrated = slot === 'cla' ? migrateHeritageClanOptionId(optionId) : optionId;
  return HERITAGE_SLOTS[slot].options.find((row) => row.id === migrated) ?? null;
}

export function getHeritageOptionById(optionId: string | null | undefined): HeritageOptionDefinition | null {
  if (!optionId) return null;
  const migrated = migrateHeritageClanOptionId(optionId);
  for (const slot of Object.values(HERITAGE_SLOTS)) {
    const found = slot.options.find((row) => row.id === migrated);
    if (found) return found;
  }
  return null;
}

/** Modificadores do nível atual (1–max da opção). Sem interpolação. */
export function getHeritageOptionModifiersAtLevel(
  option: HeritageOptionDefinition,
  level: number,
): HeritageModifiers {
  const idx = clampHeritageOptionLevelFor(option, level) - 1;
  return { ...option.levels[idx]! };
}

export function formatHeritagePercent(value: number): string {
  const pct = value * 100;
  const rounded = Math.abs(pct - Math.round(pct)) < 0.05 ? Math.round(pct) : Number(pct.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

export function describeHeritageModifiers(mods: HeritageModifiers): string[] {
  const lines: string[] = [];
  const push = (key: keyof HeritageModifiers, label: string) => {
    const value = mods[key];
    if (value == null || value === 0) return;
    if (key === 'regenPorKill' || key === 'regenContinuoPorSegundo') {
      lines.push(`${label} ${formatHeritagePercent(value)}`);
      return;
    }
    if (key === 'reducaoPenalidadePortoes') {
      const reductionPct = (1 - value) * 100;
      const rounded =
        Math.abs(reductionPct - Math.round(reductionPct)) < 0.05
          ? Math.round(reductionPct)
          : Number(reductionPct.toFixed(1));
      lines.push(`Pen. portões −${rounded}%`);
      return;
    }
    lines.push(`${label} ${formatHeritagePercent(value)}`);
  };
  push('ataque', 'Ataque');
  push('defesa', 'Defesa');
  push('hp', 'HP');
  push('velocidadeAtaque', 'Vel. ataque');
  push('critico', 'Crítico');
  push('chanceDrop', 'Drop');
  push('chanceCaptura', 'Captura');
  push('regenPorKill', 'Regen/kill');
  push('regenContinuoPorSegundo', 'Regen/s');
  push('reducaoPenalidadePortoes', 'Portões');
  return lines;
}
