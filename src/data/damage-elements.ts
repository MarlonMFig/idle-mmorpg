/**
 * Tipos de dano / elemento de combate.
 *
 * Um único eixo (`DamageElement`) — o projeto tem uma fórmula de defesa,
 * não defesa física vs mágica separada. `physical` passa pela defesa atual
 * e ainda pode ter resistência própria.
 *
 * Não há tabela de vantagem (Fire > Wind). Resistência é por entidade.
 * Aliases (Katon, Suiton, …) só normalizam IDs; o engine não tem regras Naruto.
 */

export const DAMAGE_ELEMENTS = [
  'physical',
  'fire',
  'water',
  'wind',
  'earth',
  'lightning',
  'ice',
  'dark',
  'light',
  'energy',
  'magic',
  'yin',
  'yang',
  'neutral',
] as const;

export type DamageElement = (typeof DAMAGE_ELEMENTS)[number];

/** Ataque básico sem configuração: physical. */
export const BASIC_ATTACK_ELEMENT: DamageElement = 'physical';

/** Skill sem `element`: legado / sem modificador elemental. */
export const DEFAULT_SKILL_ELEMENT: DamageElement = 'neutral';

export const DAMAGE_ELEMENT_LABELS: Record<DamageElement, string> = {
  physical: 'Physical',
  fire: 'Fire',
  water: 'Water',
  wind: 'Wind',
  earth: 'Earth',
  lightning: 'Lightning',
  ice: 'Ice',
  dark: 'Dark',
  light: 'Light',
  energy: 'Energy',
  magic: 'Magic',
  yin: 'Yin',
  yang: 'Yang',
  neutral: 'Neutral',
};

/**
 * Nomes temáticos / legado → elemento central.
 * Display da Skill (ex.: "Katon: Gōkakyū") permanece no `name`.
 */
export const DAMAGE_ELEMENT_ALIASES: Record<string, DamageElement> = {
  katon: 'fire',
  suiton: 'water',
  raiton: 'lightning',
  fuuton: 'wind',
  futon: 'wind',
  doton: 'earth',
  hyoton: 'ice',
  mokuton: 'earth',
  yoton: 'fire',
  inton: 'yin',
  yonton: 'yang',
  spiritual: 'energy',
  ki: 'energy',
  reiatsu: 'energy',
  mana: 'magic',
  arcane: 'magic',
  holy: 'light',
  shadow: 'dark',
  poison: 'neutral',
};

export type ElementResistanceMap = Partial<Record<DamageElement, number>>;

export interface CombatAffinityFields {
  /** 0.20 = −20% dano daquele elemento. −0.10 = +10% (vulnerabilidade). */
  resistances?: ElementResistanceMap;
  /** Imunidade explícita. Não usar resistência 1.0 no lugar disto. */
  immunities?: readonly DamageElement[];
  /**
   * Reservado — resistência a Status (burn, stun, …).
   * Não é aplicada neste item. Fire Resistance ≠ Burn Immunity.
   */
  statusResistances?: Readonly<Record<string, number>>;
  /** Reservado — imunidade a Status. Não aplicada neste item. */
  statusImmunities?: readonly string[];
}

export function isDamageElement(value: unknown): value is DamageElement {
  return typeof value === 'string' && (DAMAGE_ELEMENTS as readonly string[]).includes(value);
}

export function normalizeDamageElement(raw: unknown, fallback: DamageElement = DEFAULT_SKILL_ELEMENT): {
  element: DamageElement;
  unknown: boolean;
  aliasFrom: string | null;
} {
  if (raw == null || raw === '') {
    return { element: fallback, unknown: false, aliasFrom: null };
  }
  if (typeof raw !== 'string') {
    return { element: fallback, unknown: true, aliasFrom: null };
  }
  const key = raw.trim().toLowerCase();
  if (isDamageElement(key)) return { element: key, unknown: false, aliasFrom: null };
  const aliased = DAMAGE_ELEMENT_ALIASES[key];
  if (aliased) return { element: aliased, unknown: false, aliasFrom: raw };
  return { element: fallback, unknown: true, aliasFrom: null };
}

export function resolveSkillElement(
  skill: { element?: string } | null | undefined,
  overlay?: { element?: string } | null,
): DamageElement {
  const fromOverlay = overlay?.element != null && overlay.element !== ''
    ? normalizeDamageElement(overlay.element)
    : null;
  if (fromOverlay && !fromOverlay.unknown) return fromOverlay.element;
  return normalizeDamageElement(skill?.element).element;
}

export function emptyCombatAffinity(): Required<Pick<CombatAffinityFields, 'resistances' | 'immunities'>> &
  CombatAffinityFields {
  return {
    resistances: {},
    immunities: [],
    statusResistances: {},
    statusImmunities: [],
  };
}

export function cloneResistances(map: ElementResistanceMap | undefined): ElementResistanceMap {
  return { ...(map ?? {}) };
}

export function cloneImmunities(list: readonly DamageElement[] | undefined): DamageElement[] {
  return [...(list ?? [])];
}
