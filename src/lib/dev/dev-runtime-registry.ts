import type { CharacterAuraDef, CharacterPack, CharacterSkillAnimDef } from '@/data/character-packs';
import type { StatusEffectDefinition } from '@/data/status-effect-def';
import type { SharedVfxDefinition } from '@/data/vfx/types';
import type { MapKey } from '@/maps/map-registry';
import type { SkillDefinition } from '@/types/skill';
import { padOfficialHotbar, type OfficialHotbar } from '@/lib/dev/lab-skill-slots';
import {
  normalizeSpriteAlignment,
  type SpriteAlignmentConfig,
} from '@/lib/sprite-alignment';

const RUNTIME_KEY = '__idleMmorpgDevDataRuntime';

export interface DevMapConfigOverlay {
  layoutScale?: number;
  cameraZoom?: number | null;
  /** Chão lateral (pés). Hub e hunts laterais. */
  lateralFloorY?: number;
}

interface DevDataRuntime {
  version: number;
  skillAnims: Record<string, Record<string, CharacterSkillAnimDef>>;
  hotbars: Record<string, OfficialHotbar>;
  skills: Record<string, SkillDefinition>;
  vfx: Record<string, SharedVfxDefinition>;
  vfxRemoved: Record<string, true>;
  status: Record<string, StatusEffectDefinition>;
  statusRemoved: Record<string, true>;
  spriteAlignments: Record<string, SpriteAlignmentConfig>;
  auras: Record<string, CharacterAuraDef | null>;
  mapConfigs: Record<string, DevMapConfigOverlay>;
}

type RuntimeGlobal = { [RUNTIME_KEY]?: DevDataRuntime };

function emptyRuntime(): DevDataRuntime {
  return {
    version: 0,
    skillAnims: {},
    hotbars: {},
    skills: {},
    vfx: {},
    vfxRemoved: {},
    status: {},
    statusRemoved: {},
    spriteAlignments: {},
    auras: {},
    mapConfigs: {},
  };
}

function hydrateRuntime(raw: Partial<DevDataRuntime> | undefined): DevDataRuntime {
  const next = emptyRuntime();
  if (!raw || typeof raw !== 'object') return next;
  if (typeof raw.version === 'number' && Number.isFinite(raw.version)) next.version = raw.version;
  if (raw.skillAnims && typeof raw.skillAnims === 'object') next.skillAnims = raw.skillAnims;
  if (raw.hotbars && typeof raw.hotbars === 'object') next.hotbars = raw.hotbars;
  if (raw.skills && typeof raw.skills === 'object') next.skills = raw.skills;
  if (raw.vfx && typeof raw.vfx === 'object') next.vfx = raw.vfx;
  if (raw.vfxRemoved && typeof raw.vfxRemoved === 'object') next.vfxRemoved = raw.vfxRemoved;
  if (raw.status && typeof raw.status === 'object') next.status = raw.status;
  if (raw.statusRemoved && typeof raw.statusRemoved === 'object') next.statusRemoved = raw.statusRemoved;
  if (raw.spriteAlignments && typeof raw.spriteAlignments === 'object') {
    next.spriteAlignments = raw.spriteAlignments;
  }
  if (raw.auras && typeof raw.auras === 'object') next.auras = raw.auras;
  if (raw.mapConfigs && typeof raw.mapConfigs === 'object') next.mapConfigs = raw.mapConfigs;
  return next;
}

function getRuntime(): DevDataRuntime {
  const g = globalThis as RuntimeGlobal;
  const current = g[RUNTIME_KEY];
  if (
    !current ||
    !current.skillAnims ||
    !current.hotbars ||
    !current.skills ||
    !current.vfx ||
    !current.vfxRemoved ||
    !current.status ||
    !current.statusRemoved ||
    !current.spriteAlignments ||
    !current.mapConfigs
  ) {
    g[RUNTIME_KEY] = hydrateRuntime(current);
  }
  return g[RUNTIME_KEY]!;
}

function bump(): number {
  const runtime = getRuntime();
  runtime.version += 1;
  return runtime.version;
}

/** Overlay DEV em memória — sobrevive ao Fast Refresh e não espera o Webpack. */
export function getDevDataVersion(): number {
  return getRuntime().version;
}

export function applyDevPackOverlay(pack: CharacterPack): CharacterPack {
  const runtime = getRuntime();
  const patches = runtime.skillAnims[pack.id];
  const hotbar = runtime.hotbars[pack.id];
  const alignment = runtime.spriteAlignments[pack.id];
  const hasAura = Object.prototype.hasOwnProperty.call(runtime.auras, pack.id);
  const aura = hasAura ? runtime.auras[pack.id] ?? undefined : pack.aura;
  const nextAnims = patches && Object.keys(patches).length > 0 ? { ...pack.skillAnims, ...patches } : pack.skillAnims;
  const nextHotbar = hotbar ?? pack.hotbarSkillIds;
  const nextAlignment = alignment
    ? normalizeSpriteAlignment({
        hub: alignment.hub ?? pack.spriteAlignment?.hub,
        hunt: alignment.hunt ?? pack.spriteAlignment?.hunt,
      })
    : pack.spriteAlignment;
  if (
    nextAnims === pack.skillAnims &&
    nextHotbar === pack.hotbarSkillIds &&
    nextAlignment === pack.spriteAlignment
    && aura === pack.aura
  ) {
    return pack;
  }
  return {
    ...pack,
    skillAnims: nextAnims,
    hotbarSkillIds: nextHotbar,
    ...(nextAlignment ? { spriteAlignment: nextAlignment } : {}),
    aura,
  };
}

export function upsertDevSpriteAlignment(
  characterId: string,
  spriteAlignment: SpriteAlignmentConfig,
): number {
  getRuntime().spriteAlignments[characterId] = normalizeSpriteAlignment(spriteAlignment);
  return bump();
}

/** Remove overlay de alignment (volta ao valor do fonte). */
export function clearDevSpriteAlignment(characterId: string): number {
  delete getRuntime().spriteAlignments[characterId];
  return bump();
}

export function upsertDevCharacterAura(
  characterId: string,
  aura: CharacterAuraDef | null,
): number {
  getRuntime().auras[characterId] = aura;
  return bump();
}

export function upsertDevHotbar(characterId: string, slots: OfficialHotbar): number {
  getRuntime().hotbars[characterId] = padOfficialHotbar(slots);
  return bump();
}

export function upsertDevSkillDef(def: SkillDefinition): number {
  getRuntime().skills[def.id] = def;
  return bump();
}

export function getDevSkill(skillId: string): SkillDefinition | undefined {
  return getRuntime().skills[skillId];
}

export function listDevSkills(): SkillDefinition[] {
  return Object.values(getRuntime().skills);
}

export function upsertDevSkillAnim(
  characterId: string,
  skillId: string,
  anim: CharacterSkillAnimDef,
): number {
  const runtime = getRuntime();
  runtime.skillAnims[characterId] = {
    ...runtime.skillAnims[characterId],
    [skillId]: anim,
  };
  return bump();
}

export function upsertDevVfx(def: SharedVfxDefinition): number {
  const runtime = getRuntime();
  runtime.vfx[def.id] = def;
  delete runtime.vfxRemoved[def.id];
  return bump();
}

export function removeDevVfx(id: string): number {
  const runtime = getRuntime();
  delete runtime.vfx[id];
  runtime.vfxRemoved[id] = true;
  return bump();
}

export function getDevVfx(id: string): SharedVfxDefinition | null {
  const runtime = getRuntime();
  if (runtime.vfxRemoved[id]) return null;
  return runtime.vfx[id] ?? null;
}

export function mergeDevVfxCatalog(
  catalog: Record<string, SharedVfxDefinition>,
): Record<string, SharedVfxDefinition> {
  const runtime = getRuntime();
  const merged: Record<string, SharedVfxDefinition> = { ...catalog, ...runtime.vfx };
  for (const id of Object.keys(runtime.vfxRemoved)) {
    delete merged[id];
  }
  return merged;
}

export function upsertDevStatus(def: StatusEffectDefinition): number {
  const runtime = getRuntime();
  runtime.status[def.id] = def;
  delete runtime.statusRemoved[def.id];
  return bump();
}

export function removeDevStatus(id: string): number {
  const runtime = getRuntime();
  delete runtime.status[id];
  runtime.statusRemoved[id] = true;
  return bump();
}

export function getDevStatus(id: string): StatusEffectDefinition | null {
  const runtime = getRuntime();
  if (runtime.statusRemoved[id]) return null;
  return runtime.status[id] ?? null;
}

export function mergeDevStatusCatalog(
  catalog: Record<string, StatusEffectDefinition>,
): Record<string, StatusEffectDefinition> {
  const runtime = getRuntime();
  const merged: Record<string, StatusEffectDefinition> = { ...catalog, ...runtime.status };
  for (const id of Object.keys(runtime.statusRemoved)) {
    delete merged[id];
  }
  return merged;
}

export function getDevMapConfig(mapKey: MapKey | string): DevMapConfigOverlay | undefined {
  return getRuntime().mapConfigs[mapKey];
}

export function upsertDevMapConfig(
  mapKey: MapKey | string,
  config: DevMapConfigOverlay,
): number {
  const runtime = getRuntime();
  runtime.mapConfigs[mapKey] = {
    ...runtime.mapConfigs[mapKey],
    ...config,
  };
  return bump();
}
