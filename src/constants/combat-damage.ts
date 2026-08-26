/**
 * Constantes de dano em combate (player / companion).
 *
 * Básico: flat + ATK × fator.
 * Jutsu:  skill.damage + ATK × fator (maior que o básico para o jutsu valer a pena).
 */
export const BASIC_ATTACK_FLAT = 8;
export const BASIC_ATTACK_ATK_FACTOR = 0.85;

/**
 * Coeficiente de ATK dos jutsus. Deve ser > BASIC_ATTACK_ATK_FACTOR para o
 * skill flat não ser engolido no mid/late game.
 */
export const SKILL_ATTACK_ATK_FACTOR = 1.15;

/** Companion: básico usa flat próprio + ATK × COMPANION_DAMAGE_FACTOR (já existente). */
export const COMPANION_BASIC_ATTACK_FLAT = 5;
