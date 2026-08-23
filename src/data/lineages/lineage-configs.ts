import {
  LINEAGE_COLORS,
  LINEAGE_ICONS,
  LINEAGE_LABELS,
} from '@/constants/lineage';
import type { LineageId } from '@/types/character-meta';
import type { LineageDefinition, LineageSpecializationModifiers } from '@/types/lineage';
import { buildLineageDefinition, type LineageSpecializationBuildInput } from '@/data/lineages/build-lineage';

const attack2: LineageSpecializationModifiers = { attackPercent: 0.02 };
const attack1: LineageSpecializationModifiers = { attackPercent: 0.01 };
const hp2: LineageSpecializationModifiers = { hpPercent: 0.02 };
const hp1: LineageSpecializationModifiers = { hpPercent: 0.01 };
const def2: LineageSpecializationModifiers = { defensePercent: 0.02 };
const def1: LineageSpecializationModifiers = { defensePercent: 0.01 };
const skill2: LineageSpecializationModifiers = { skillDamagePercent: 0.02 };
const skill1: LineageSpecializationModifiers = { skillDamagePercent: 0.01 };
const heal2: LineageSpecializationModifiers = { healingPercent: 0.02 };
const acc2: LineageSpecializationModifiers = { accuracy: 0.02 };
const acc1: LineageSpecializationModifiers = { accuracy: 0.01 };
const crit1: LineageSpecializationModifiers = { criticalChance: 0.01 };
const crit05: LineageSpecializationModifiers = { criticalChance: 0.005 };
const cdr1: LineageSpecializationModifiers = { cooldownReduction: 0.01 };
const cdr05: LineageSpecializationModifiers = { cooldownReduction: 0.005 };
/** ~1.333% × peso 1.5 = 2 budget (Attack Speed / Evasion / Status / Crit Damage). */
const w15 = 0.04 / 3;
const as15: LineageSpecializationModifiers = { attackSpeedPercent: w15 };
const evasion15: LineageSpecializationModifiers = { evasion: w15 };
const status15: LineageSpecializationModifiers = { statusEffectiveness: w15 };
const critDmg15: LineageSpecializationModifiers = { criticalDamage: w15 };

function spec(
  key: string,
  name: string,
  description: string,
  focus: string,
  role: LineageSpecializationBuildInput['role'],
  modifiers: LineageSpecializationBuildInput['modifiers'],
): LineageSpecializationBuildInput {
  return { key, name, description, focus, role, modifiers };
}

/** Especializações definitivas — são as builds da Linhagem (sem camada extra de Poder). */
const NINJA_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'sharingan',
    'Sharingan',
    'Olho ofensivo: crítico e poder das técnicas.',
    'Ofensivo / Crítico',
    'offensive',
    [crit1, skill2, critDmg15, { ...crit05, ...skill1 }],
  ),
  spec(
    'byakugan',
    'Byakugan',
    'Olho técnico: precisão, leitura e evasão.',
    'Precisão / Técnica',
    'utility',
    [acc2, crit1, evasion15, { ...acc1, ...crit05 }],
  ),
  spec(
    'rinnegan',
    'Rinnegan',
    'Olho de controle: skills, cooldown e efeitos.',
    'Skills / Controle',
    'mixed',
    [skill2, cdr1, status15, { ...skill1, ...cdr05 }],
  ),
];

const SHINIGAMI_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'zanjutsu',
    'Zanjutsu',
    'Combate com espada: ataque e crítico direto.',
    'Attack / Dano direto',
    'offensive',
    [attack2, attack2, crit1, { ...attack1, ...skill1 }],
  ),
  spec(
    'kido',
    'Kidō',
    'Técnicas espirituais: skill damage, cooldown e status.',
    'Skills / Controle',
    'utility',
    [skill2, cdr1, status15, { ...skill1, ...cdr05 }],
  ),
  spec(
    'hakuda',
    'Hakuda',
    'Combate corporal: velocidade, crítico e ataque.',
    'Attack Speed / Crítico',
    'mixed',
    [as15, crit1, attack2, as15],
  ),
];

const PIRATA_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'armament-haki',
    'Haki do Armamento',
    'Haki ofensivo e defensivo: ataque e defesa.',
    'Attack / Defense',
    'offensive',
    [attack2, def2, attack2, { ...attack1, ...def1 }],
  ),
  spec(
    'observation-haki',
    'Haki da Observação',
    'Haki técnico: evasão, precisão e crítico.',
    'Evasion / Precisão',
    'utility',
    [evasion15, acc2, crit1, { ...acc1, ...crit05 }],
  ),
  spec(
    'conqueror-haki',
    'Haki do Conquistador',
    'Haki de burst: ataque, crítico e skill damage.',
    'Burst / Poder',
    'offensive',
    [attack2, skill2, critDmg15, { ...attack1, ...skill1 }],
  ),
];

const CACADOR_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'enhancement',
    'Reforço',
    'Nen de reforço: combate direto com ataque, HP e defesa.',
    'Attack / HP / Defense',
    'offensive',
    [attack2, hp2, def2, { ...attack1, ...hp1 }],
  ),
  spec(
    'emission',
    'Emissão',
    'Nen de emissão: skills, cooldown e ataque.',
    'Skills / Cooldown',
    'utility',
    [skill2, cdr1, attack2, { ...skill1, ...cdr05 }],
  ),
  spec(
    'specialization',
    'Especialização',
    'Nen de especialização: crítico, status e utilidade.',
    'Critical / Status',
    'mixed',
    [crit1, status15, crit1, evasion15],
  ),
];

const FEITICEIRO_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'cursed-technique',
    'Técnica Amaldiçoada',
    'Técnica ofensiva: skill damage, ataque e crítico.',
    'Skill Damage / Attack',
    'offensive',
    [skill2, attack2, crit1, { ...skill1, ...attack1 }],
  ),
  spec(
    'reverse-energy',
    'Energia Reversa',
    'Sustentação: HP, cura e defesa.',
    'HP / Cura / Defense',
    'defensive',
    [hp2, heal2, def2, { ...hp1, ...def1 }],
  ),
  spec(
    'domain-expansion',
    'Expansão de Domínio',
    'Controle e burst: skill damage, status e critical damage.',
    'Skills / Status / Burst',
    'mixed',
    [skill2, status15, critDmg15, { ...skill1, ...crit05 }],
  ),
];

const GUERREIRO_SPECS: [
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
  LineageSpecializationBuildInput,
] = [
  spec(
    'power',
    'Poder',
    'Força bruta: ataque, critical damage e skill damage.',
    'Attack / Crit Damage',
    'offensive',
    [attack2, skill2, critDmg15, { ...attack1, ...skill1 }],
  ),
  spec(
    'ki-control',
    'Controle de Ki',
    'Eficiência energética: skill damage, cooldown e ataque.',
    'Skills / Cooldown',
    'utility',
    [skill2, cdr1, skill2, { ...skill1, ...attack1 }],
  ),
  spec(
    'combat-instinct',
    'Instinto de Combate',
    'Velocidade e técnica: attack speed, evasão e crítico.',
    'Attack Speed / Evasion',
    'mixed',
    [as15, evasion15, crit1, as15],
  ),
];

/**
 * Configurações das seis Linhagens principais.
 * Especializações = builds definitivas da Linhagem (4×3×4). Sem camada extra de Poder.
 */
export const LINEAGE_CONFIGS: Record<LineageId, LineageDefinition> = {
  ninja: buildLineageDefinition({
    id: 'ninja',
    name: LINEAGE_LABELS.ninja,
    description:
      'Uma Linhagem focada no universo dos Shinobi. Desbloqueia progressões e especializações exclusivas da Linhagem Ninja.',
    icon: LINEAGE_ICONS.ninja,
    color: LINEAGE_COLORS.ninja,
    rankNames: ['Genin', 'Chunin', 'Jonin', 'Kage'],
    specializations: NINJA_SPECS,
  }),
  shinigami: buildLineageDefinition({
    id: 'shinigami',
    name: LINEAGE_LABELS.shinigami,
    description:
      'Uma Linhagem focada no universo dos Shinigami. Desbloqueia progressões e especializações exclusivas da Linhagem Shinigami.',
    icon: LINEAGE_ICONS.shinigami,
    color: LINEAGE_COLORS.shinigami,
    rankNames: ['Shinigami', 'Oficial', 'Tenente', 'Capitão'],
    specializations: SHINIGAMI_SPECS,
  }),
  pirata: buildLineageDefinition({
    id: 'pirata',
    name: LINEAGE_LABELS.pirata,
    description:
      'Uma Linhagem focada no universo dos Piratas. Desbloqueia progressões e especializações exclusivas da Linhagem Pirata.',
    icon: LINEAGE_ICONS.pirata,
    color: LINEAGE_COLORS.pirata,
    rankNames: ['Novato', 'Supernova', 'Comandante', 'Imperador'],
    specializations: PIRATA_SPECS,
  }),
  cacador: buildLineageDefinition({
    id: 'cacador',
    name: LINEAGE_LABELS.cacador,
    description:
      'Uma Linhagem focada no universo dos Caçadores. Desbloqueia progressões e especializações exclusivas da Linhagem Caçador.',
    icon: LINEAGE_ICONS.cacador,
    color: LINEAGE_COLORS.cacador,
    rankNames: ['Caçador Licenciado', 'Caçador Experiente', 'Caçador de Elite', 'Caçador Lendário'],
    specializations: CACADOR_SPECS,
  }),
  feiticeiro: buildLineageDefinition({
    id: 'feiticeiro',
    name: LINEAGE_LABELS.feiticeiro,
    description:
      'Uma Linhagem focada no universo dos Feiticeiros. Desbloqueia progressões e especializações exclusivas da Linhagem Feiticeiro.',
    icon: LINEAGE_ICONS.feiticeiro,
    color: LINEAGE_COLORS.feiticeiro,
    rankNames: ['Grau 3', 'Grau 2', 'Grau 1', 'Grau Especial'],
    specializations: FEITICEIRO_SPECS,
  }),
  guerreiro: buildLineageDefinition({
    id: 'guerreiro',
    name: LINEAGE_LABELS.guerreiro,
    description:
      'Uma Linhagem focada no universo dos Guerreiros. Desbloqueia progressões e especializações exclusivas da Linhagem Guerreiro.',
    icon: LINEAGE_ICONS.guerreiro,
    color: LINEAGE_COLORS.guerreiro,
    rankNames: ['Lutador', 'Guerreiro de Elite', 'Mestre Guerreiro', 'Guerreiro Lendário'],
    specializations: GUERREIRO_SPECS,
  }),
};
