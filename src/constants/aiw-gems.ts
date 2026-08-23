/** Economia de Gemas (spec loja-geral). */

/** @deprecated Item 34 — Daily Login legado (+5 gems) removido. Não usar. */
export const DAILY_LOGIN_GEMS = 5;

export const GEM_PACKAGES = [
  { id: 'gem-pequeno', name: 'Pequeno', gems: 60, bonusPercent: 0 },
  { id: 'gem-medio', name: 'Médio', gems: 330, bonusPercent: 10 },
  { id: 'gem-grande', name: 'Grande', gems: 1080, bonusPercent: 20 },
  { id: 'gem-mega', name: 'Mega', gems: 2400, bonusPercent: 33 },
  { id: 'gem-bau', name: 'Baú do Colecionador', gems: 6500, bonusPercent: 50 },
] as const;

/**
 * @deprecated Item 38 — catálogo legado da Loja Geral.
 * Mapping → official em `achievement-legacy-migration.ts`. Não usar para unlock/claim.
 */
export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  gems: number;
}

/** @deprecated Item 38 — ver LEGACY_TO_OFFICIAL_ACHIEVEMENT. */
export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  { id: 'ach-kills-100', title: 'Caçador Iniciante', description: 'Derrote 100 inimigos.', gems: 10 },
  { id: 'ach-kills-1000', title: 'Caçador Veterano', description: 'Derrote 1.000 inimigos.', gems: 25 },
  { id: 'ach-kills-10000', title: 'Lenda da Caça', description: 'Derrote 10.000 inimigos.', gems: 60 },
  { id: 'ach-level-10', title: 'Conta Nv. 10', description: 'Alcance nível 10 de conta.', gems: 20 },
  { id: 'ach-level-25', title: 'Conta Nv. 25', description: 'Alcance nível 25 de conta.', gems: 40 },
  { id: 'ach-level-50', title: 'Conta Nv. 50', description: 'Alcance nível 50 de conta.', gems: 80 },
  { id: 'ach-level-100', title: 'Conta Nv. 100', description: 'Alcance nível 100 de conta.', gems: 150 },
] as const;
