/**
 * Tipos de execução avançada da Skill.
 * Ausente = `single-hit` (compatível com o Combat Engine atual).
 * Não migrar Skills antigas automaticamente.
 *
 * Uma Skill pode combinar vários tipos (`types`), ex.: area + persistent.
 * `type` permanece como tipo primário (compat / debug).
 */

export const SKILL_EXECUTION_TYPES = ['single-hit', 'multi-hit', 'beam', 'area', 'persistent'] as const;
export type SkillExecutionType = (typeof SKILL_EXECUTION_TYPES)[number];

/** Prioridade do tipo primário e do schedule de dano quando há vários. */
export const SKILL_EXECUTION_TYPE_PRIORITY: readonly SkillExecutionType[] = [
  'persistent',
  'beam',
  'multi-hit',
  'area',
  'single-hit',
] as const;

export const SKILL_PERSISTENT_ANCHORS = ['target', 'world-position', 'caster'] as const;
export type SkillPersistentAnchor = (typeof SKILL_PERSISTENT_ANCHORS)[number];

export interface SkillMultiHitDef {
  /** ms desde o início do Effect. */
  delay: number;
  /** Fração do dano da Skill. Não precisa somar 1. */
  damageMultiplier: number;
}

export interface SkillExecutionDef {
  /** Tipo primário (compat). Preferir `resolveExecutionType`. */
  type?: SkillExecutionType;
  /**
   * Tipos ativos. Ausente = só `[type ?? 'single-hit']`.
   * Gravar só quando length > 1.
   */
  types?: SkillExecutionType[];
  hits?: SkillMultiHitDef[];
  beamDuration?: number;
  tickInterval?: number;
  /** Fração por tick. Ausente = 1 / quantidade de ticks. */
  tickDamageMultiplier?: number;
  trackTarget?: boolean;
  radius?: number;
  duration?: number;
  persistentAnchor?: SkillPersistentAnchor;
}

/** Mínimo técnico — evita loop de 1ms. Não é balanceamento. */
export const MIN_TICK_INTERVAL_MS = 50;
export const MAX_EXECUTION_HITS = 24;
export const MAX_EXECUTION_TICKS = 80;
export const MAX_EXECUTION_DURATION_MS = 30_000;

export interface LabExecutionDebug {
  type: SkillExecutionType;
  status: string;
  elapsedMs: number;
  durationMs: number;
  tick: number;
  tickMax: number;
  currentHit: number;
  hitMax: number;
}

export const SKILL_EXECUTION_TYPE_LABELS: Record<SkillExecutionType, string> = {
  'single-hit': 'Single Hit',
  'multi-hit': 'Multi Hit',
  beam: 'Beam',
  area: 'Area',
  persistent: 'Persistent',
};

export const SKILL_PERSISTENT_ANCHOR_LABELS: Record<SkillPersistentAnchor, string> = {
  target: 'Alvo',
  'world-position': 'Posição no mundo',
  caster: 'Personagem',
};

export function isSkillExecutionType(value: unknown): value is SkillExecutionType {
  return typeof value === 'string' && (SKILL_EXECUTION_TYPES as readonly string[]).includes(value);
}

export function isSkillPersistentAnchor(value: unknown): value is SkillPersistentAnchor {
  return typeof value === 'string' && (SKILL_PERSISTENT_ANCHORS as readonly string[]).includes(value);
}

export function primaryExecutionType(types: readonly SkillExecutionType[]): SkillExecutionType {
  for (const candidate of SKILL_EXECUTION_TYPE_PRIORITY) {
    if (types.includes(candidate)) return candidate;
  }
  return 'single-hit';
}

/** Normaliza lista: únicos, ordem estável; `single-hit` some se houver outro tipo. */
export function normalizeExecutionTypes(raw: readonly SkillExecutionType[]): SkillExecutionType[] {
  const set = new Set<SkillExecutionType>();
  for (const entry of raw) {
    if (isSkillExecutionType(entry)) set.add(entry);
  }
  if (set.size === 0) return ['single-hit'];
  if (set.size > 1) set.delete('single-hit');
  const ordered: SkillExecutionType[] = [];
  for (const id of SKILL_EXECUTION_TYPES) {
    if (set.has(id)) ordered.push(id);
  }
  return ordered.length ? ordered : ['single-hit'];
}

export function resolveExecutionTypes(def: SkillExecutionDef | undefined): SkillExecutionType[] {
  if (def?.types?.length) {
    return normalizeExecutionTypes(def.types);
  }
  return normalizeExecutionTypes([def?.type ?? 'single-hit']);
}

export function resolveExecutionType(def: SkillExecutionDef | undefined): SkillExecutionType {
  return primaryExecutionType(resolveExecutionTypes(def));
}

export function hasExecutionType(
  def: SkillExecutionDef | undefined,
  type: SkillExecutionType,
): boolean {
  return resolveExecutionTypes(def).includes(type);
}

/** Single-hit e/ou area sem duração (sem multi-hit / beam / persistent). */
export function isInstantExecution(def: SkillExecutionDef | undefined): boolean {
  const types = resolveExecutionTypes(def);
  return !types.includes('multi-hit') && !types.includes('beam') && !types.includes('persistent');
}

export function formatExecutionTypesLabel(def: SkillExecutionDef | undefined): string {
  return resolveExecutionTypes(def)
    .map((id) => SKILL_EXECUTION_TYPE_LABELS[id])
    .join(' + ');
}

/** Duração oficial da Skill (persistent / beam). Visual loop reutiliza isto quando existir. */
export function officialSkillDurationMs(def: SkillExecutionDef | undefined): number | null {
  const types = resolveExecutionTypes(def);
  if (types.includes('persistent') && def?.duration && def.duration > 0) return def.duration;
  if (types.includes('beam') && def?.beamDuration && def.beamDuration > 0) return def.beamDuration;
  if (def?.duration && def.duration > 0) return def.duration;
  return null;
}

export function cloneExecutionDef(def: SkillExecutionDef | undefined): SkillExecutionDef {
  const types = resolveExecutionTypes(def);
  const primary = primaryExecutionType(types);
  return {
    type: primary,
    types: types.length > 1 ? [...types] : undefined,
    hits: (def?.hits ?? []).map((hit) => ({ delay: hit.delay, damageMultiplier: hit.damageMultiplier })),
    beamDuration: def?.beamDuration,
    tickInterval: def?.tickInterval,
    tickDamageMultiplier: def?.tickDamageMultiplier,
    trackTarget: def?.trackTarget,
    radius: def?.radius,
    duration: def?.duration,
    persistentAnchor: def?.persistentAnchor,
  };
}

export function defaultHits(): SkillMultiHitDef[] {
  return [
    { delay: 150, damageMultiplier: 0.25 },
    { delay: 300, damageMultiplier: 0.25 },
    { delay: 450, damageMultiplier: 0.25 },
    { delay: 800, damageMultiplier: 0.25 },
  ];
}

export function executionsEqual(a: SkillExecutionDef, b: SkillExecutionDef): boolean {
  const typesA = resolveExecutionTypes(a);
  const typesB = resolveExecutionTypes(b);
  if (typesA.length !== typesB.length) return false;
  if (typesA.some((id, index) => id !== typesB[index])) return false;
  if ((a.beamDuration ?? 0) !== (b.beamDuration ?? 0)) return false;
  if ((a.tickInterval ?? 0) !== (b.tickInterval ?? 0)) return false;
  if ((a.tickDamageMultiplier ?? 0) !== (b.tickDamageMultiplier ?? 0)) return false;
  if (Boolean(a.trackTarget) !== Boolean(b.trackTarget)) return false;
  if ((a.radius ?? 0) !== (b.radius ?? 0)) return false;
  if ((a.duration ?? 0) !== (b.duration ?? 0)) return false;
  if ((a.persistentAnchor ?? 'target') !== (b.persistentAnchor ?? 'target')) return false;
  const hitsA = a.hits ?? [];
  const hitsB = b.hits ?? [];
  if (hitsA.length !== hitsB.length) return false;
  return hitsA.every(
    (hit, index) =>
      hit.delay === hitsB[index]?.delay && hit.damageMultiplier === hitsB[index]?.damageMultiplier,
  );
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function normalizeHits(raw: unknown): SkillMultiHitDef[] {
  if (!Array.isArray(raw)) return [];
  const hits: SkillMultiHitDef[] = [];
  for (const entry of raw.slice(0, MAX_EXECUTION_HITS)) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const delay = Math.max(0, Math.round(asFiniteNumber(row.delay, 0)));
    const damageMultiplier = Math.max(0, asFiniteNumber(row.damageMultiplier, 0));
    hits.push({ delay, damageMultiplier });
  }
  return hits.sort((a, b) => a.delay - b.delay);
}

function parseTypesField(raw: unknown, fallbackType: SkillExecutionType): SkillExecutionType[] {
  if (Array.isArray(raw)) {
    const listed = raw.filter(isSkillExecutionType);
    if (listed.length) return normalizeExecutionTypes(listed);
  }
  return normalizeExecutionTypes([fallbackType]);
}

/**
 * Whitelist DEV — rejeita objetos arbitrários.
 * `single-hit` omite campos extras.
 */
export function parseSkillExecution(raw: unknown): SkillExecutionDef {
  if (raw == null || raw === '') return { type: 'single-hit' };
  if (typeof raw === 'string' && isSkillExecutionType(raw)) return { type: raw };
  if (typeof raw !== 'object') throw new Error('execution inválida');
  const value = raw as Record<string, unknown>;
  const allowed = new Set([
    'type',
    'types',
    'hits',
    'beamDuration',
    'tickInterval',
    'tickDamageMultiplier',
    'trackTarget',
    'radius',
    'duration',
    'persistentAnchor',
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Campo de execução não permitido: ${key}`);
  }
  const fallbackType = isSkillExecutionType(value.type) ? value.type : 'single-hit';
  const types = parseTypesField(value.types, fallbackType);
  const primary = primaryExecutionType(types);
  const next: SkillExecutionDef = { type: primary };
  if (types.length > 1) next.types = types;

  if (types.includes('multi-hit')) {
    next.hits = normalizeHits(value.hits);
    if (next.hits.length < 1) next.hits = defaultHits();
  }
  if (types.includes('beam')) {
    next.beamDuration = Math.min(
      MAX_EXECUTION_DURATION_MS,
      Math.max(1, Math.round(asFiniteNumber(value.beamDuration, 2000))),
    );
    next.tickInterval = Math.min(
      MAX_EXECUTION_DURATION_MS,
      Math.max(MIN_TICK_INTERVAL_MS, Math.round(asFiniteNumber(value.tickInterval, 250))),
    );
    if (value.tickDamageMultiplier != null) {
      next.tickDamageMultiplier = Math.max(0, asFiniteNumber(value.tickDamageMultiplier, 0));
    }
    next.trackTarget = value.trackTarget === true;
  }
  if (types.includes('area')) {
    next.radius = Math.max(0, Math.round(asFiniteNumber(value.radius, 80)));
  }
  if (types.includes('persistent')) {
    next.duration = Math.min(
      MAX_EXECUTION_DURATION_MS,
      Math.max(1, Math.round(asFiniteNumber(value.duration, 5000))),
    );
    next.tickInterval = Math.min(
      MAX_EXECUTION_DURATION_MS,
      Math.max(
        MIN_TICK_INTERVAL_MS,
        Math.round(asFiniteNumber(value.tickInterval, types.includes('beam') ? 250 : 1000)),
      ),
    );
    if (value.tickDamageMultiplier != null) {
      next.tickDamageMultiplier = Math.max(0, asFiniteNumber(value.tickDamageMultiplier, 0));
    }
    next.persistentAnchor = isSkillPersistentAnchor(value.persistentAnchor)
      ? value.persistentAnchor
      : 'target';
  }
  return next;
}

/** Monta def a partir da seleção de tipos no Lab, preservando campos já editados. */
export function executionWithTypes(
  previous: SkillExecutionDef | undefined,
  nextTypes: readonly SkillExecutionType[],
): SkillExecutionDef {
  const types = normalizeExecutionTypes(nextTypes);
  return parseSkillExecution({
    ...(previous ?? {}),
    type: primaryExecutionType(types),
    types: types.length > 1 ? types : undefined,
    hits: types.includes('multi-hit')
      ? previous?.hits?.length
        ? previous.hits
        : defaultHits()
      : undefined,
    beamDuration: previous?.beamDuration ?? 2000,
    tickInterval:
      previous?.tickInterval ?? (types.includes('persistent') && !types.includes('beam') ? 1000 : 250),
    trackTarget: previous?.trackTarget === true,
    radius: previous?.radius ?? 80,
    duration: previous?.duration ?? 5000,
    persistentAnchor: previous?.persistentAnchor ?? 'target',
  });
}

export function planTickOffsets(durationMs: number, intervalMs: number): number[] {
  const duration = Math.min(MAX_EXECUTION_DURATION_MS, Math.max(0, durationMs));
  const interval = Math.max(MIN_TICK_INTERVAL_MS, intervalMs);
  const offsets: number[] = [];
  for (let at = 0; at <= duration && offsets.length < MAX_EXECUTION_TICKS; at += interval) {
    offsets.push(at);
  }
  if (offsets.length === 0) offsets.push(0);
  return offsets;
}

export function tickMultiplier(def: SkillExecutionDef, tickCount: number): number {
  if (def.tickDamageMultiplier != null && def.tickDamageMultiplier >= 0) return def.tickDamageMultiplier;
  if (tickCount <= 0) return 1;
  return 1 / tickCount;
}

export function formatExecutionLiteral(def: SkillExecutionDef, indent: string, innerIndent: string): string {
  const types = resolveExecutionTypes(def);
  const primary = primaryExecutionType(types);
  const lines = [`${indent}execution: {`, `${innerIndent}type: '${primary}',`];
  if (types.length > 1) {
    lines.push(`${innerIndent}types: [${types.map((id) => `'${id}'`).join(', ')}],`);
  }
  if (types.includes('multi-hit')) {
    const hits = normalizeHits(def.hits);
    lines.push(`${innerIndent}hits: [`);
    for (const hit of hits) {
      lines.push(
        `${innerIndent}  { delay: ${Math.round(hit.delay)}, damageMultiplier: ${hit.damageMultiplier} },`,
      );
    }
    lines.push(`${innerIndent}],`);
  }
  if (types.includes('beam')) {
    lines.push(`${innerIndent}beamDuration: ${Math.round(def.beamDuration ?? 2000)},`);
    if (!types.includes('persistent')) {
      lines.push(`${innerIndent}tickInterval: ${Math.round(def.tickInterval ?? 250)},`);
    }
    if (def.tickDamageMultiplier != null && !types.includes('persistent')) {
      lines.push(`${innerIndent}tickDamageMultiplier: ${def.tickDamageMultiplier},`);
    }
    lines.push(`${innerIndent}trackTarget: ${def.trackTarget === true},`);
  }
  if (types.includes('area')) {
    lines.push(`${innerIndent}radius: ${Math.round(def.radius ?? 80)},`);
  }
  if (types.includes('persistent')) {
    lines.push(`${innerIndent}duration: ${Math.round(def.duration ?? 5000)},`);
    lines.push(`${innerIndent}tickInterval: ${Math.round(def.tickInterval ?? 1000)},`);
    if (def.tickDamageMultiplier != null) {
      lines.push(`${innerIndent}tickDamageMultiplier: ${def.tickDamageMultiplier},`);
    }
    lines.push(`${innerIndent}persistentAnchor: '${def.persistentAnchor ?? 'target'}',`);
  }
  lines.push(`${indent}},`);
  return lines.join('\n');
}
