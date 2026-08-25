import { isDevMode, setDevTestCatalogLookType, setDevLabSessionActive, resetDangerousDevOverrides } from '@/config/devConfig';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import type { LabExecutionDebug } from '@/data/skill-execution-def';
import type { SkillVfxTargetMode } from '@/data/character-packs';
import { CharacterRegistry } from '@/data/characters';
import { STARTERS } from '@/data/starters';
import {
  cloneLabPoseSheet,
  labDraftHasVisual,
  labPoseHasContent,
  type LabPoseSheet,
} from '@/lib/dev/lab-pose-sheet';
import {
  DEFAULT_TRAVEL_SPEED_PX,
  readLabSkillOriginals,
  skillLogicDirty,
  skillVisualDirty,
  skillFieldsDirty,
  type LabSkillOriginals,
} from '@/lib/dev/lab-save-fields';
import { cloneExecutionDef, type SkillExecutionDef } from '@/data/skill-execution-def';
import { cloneSkillAi, defaultSkillAi, type SkillAiConfig } from '@/data/skill-ai-def';
import { cloneSkillStatusEffects, type SkillStatusApplication } from '@/data/status-effect-def';
import {
  cloneImmunities,
  cloneResistances,
  DEFAULT_SKILL_ELEMENT,
  type DamageElement,
  type ElementResistanceMap,
} from '@/data/damage-elements';
import type { ElementFloaterTag } from '@/systems/elemental-resistance';
import { getSkill } from '@/data/skills';
import {
  hotbarsEqual,
  moveOfficialSlot,
  padOfficialHotbar,
  skillIdForSlot,
  slotForSkillId,
  type LabSkillSlot,
  type OfficialHotbar,
} from '@/lib/dev/lab-skill-slots';
import { createStore, type WritableStore } from '@/stores/create-store';
import { locationStore } from '@/stores/location-store';
import type { CharacterAnimSlot } from '@/types/character-definition';
import type { LineageId } from '@/types/character-meta';
import type { LineageSpecializationSlot } from '@/types/lineage';
import {
  alignmentsEqual,
  normalizeSpriteAlignment,
  type SpriteAlignmentContext,
  type SpriteAlignmentConfig,
} from '@/lib/sprite-alignment';

export const CHARACTER_LAB_STORAGE_KEY = 'idle-mmorpg:dev-character-lab-v1';
export const LAB_DUMMY_ID = 'dev-lab-dummy';

export type LabEnemyHpMode = 'normal' | 'x2' | 'x5' | 'x10' | 'infinite';
export type LabDistancePreset = 'very-close' | 'close' | 'normal' | 'far' | 'very-far';
export type LabTab = 'geral' | 'skills' | 'sprite' | 'vfx' | 'mapas' | 'debug';

export interface LabEnemyAffinityOverride {
  resistances: ElementResistanceMap;
  immunities: DamageElement[];
}

export interface LabDamageDebug {
  rawOutgoing: import('@/lib/decimal').Decimal;
  afterShield: import('@/lib/decimal').Decimal;
  afterDefense: import('@/lib/decimal').Decimal;
  element: DamageElement;
  resistance: number;
  immune: boolean;
  skipped: boolean;
  afterResistance: import('@/lib/decimal').Decimal;
  finalDamage: import('@/lib/decimal').Decimal;
  tag: ElementFloaterTag | null;
  targetId: string;
}

export type LabCommand =
  | { kind: 'play-slot'; slot: CharacterAnimSlot }
  | { kind: 'cast-skill'; skillId: string }
  | { kind: 'play-pose' }
  | { kind: 'play-effect' }
  | { kind: 'play-complete' }
  | { kind: 'basic-attack' }
  | { kind: 'reset' }
  | { kind: 'restore-visuals' }
  | { kind: 'clear-fx' }
  | { kind: 'sync-runtime' };

export interface LabEvent {
  t: number;
  text: string;
}

export interface LabFrameDebug {
  anim: string;
  frame: number;
  total: number;
  timeMs: number;
  actionLocked?: boolean;
}

export interface LabHitDebug {
  configuredMs: number;
  appliedAtMs: number;
}

export interface LabTravelDebug {
  forceOn: boolean;
  mode: 'caster' | 'travel-to-target' | 'instant-target' | 'legacy' | 'no-vfx';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  distance: number;
  speedPx: number;
  estimatedImpactMs: number;
  note: string | null;
}

export interface CharacterLabState {
  isOpen: boolean;
  playerId: string | null;
  enemyId: string | null;
  loopSkill: boolean;
  loopIntervalMs: number;
  /** Slot oficial 1–4. Independente de `editingVfxId` e do Registry. */
  selectedSkillSlot: LabSkillSlot;
  lastSkillId: string | null;
  /**
   * Preview de Despertar (0–3). Não grava CharacterInstance.
   * `null` = Base (0).
   */
  previewAwakening: 0 | 1 | 2 | 3;
  /** Preview Linhagem DEV — não persiste. null = usa conta. */
  previewLineageId: LineageId | null;
  previewLineageRank: 0 | 1 | 2 | 3 | 4;
  previewSpecializationId: LineageSpecializationSlot | null;
  previewSpecializationLevel: 0 | 1 | 2 | 3 | 4;
  ignoreCooldown: boolean;
  infiniteChakra: boolean;
  playerInvincible: boolean;
  enemyInvincible: boolean;
  enemyHpMode: LabEnemyHpMode;
  distance: LabDistancePreset;
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  /** Contexto editado no painel SPRITE ALIGNMENT. */
  alignContext: SpriteAlignmentContext;
  alignHubX: number;
  alignHubY: number;
  alignHuntX: number;
  alignHuntY: number;
  /** Último alignment persistido no Character Pack (para RECARREGAR SALVO). */
  alignSaved: SpriteAlignmentConfig;
  showGroundGuide: boolean;
  vfxScale: number;
  vfxOffsetX: number;
  vfxOffsetY: number;
  vfxLoopMode: import('@/lib/frame-loop').FrameLoopMode;
  vfxLoopStartFrame: number;
  vfxLoopEndFrame: number;
  vfxLoopDurationMs: number;
  vfxLoopUntilSkillEnd: boolean;
  vfxFlipX: boolean;
  vfxFlipY: boolean;
  animationSpeed: number;
  gameSpeed: number;
  showFrameDebug: boolean;
  showHitTiming: boolean;
  showHitbox: boolean;
  showHurtbox: boolean;
  showSpriteOrigin: boolean;
  showVfxOrigin: boolean;
  showVfxPath: boolean;
  showAreaRadius: boolean;
  showLog: boolean;
  tab: LabTab;
  targetMode: SkillVfxTargetMode;
  travelSpeed: number;
  spawnOffsetX: number;
  spawnOffsetY: number;
  targetOffsetX: number;
  targetOffsetY: number;
  /**
   * VFX Efeito de teste da Skill selecionada.
   * Independente de `editingVfxId` e de `poseVfxId`. Persistido com Salvar no Código.
   */
  vfxId: string | null;
  /** VFX Pose / cast da Skill selecionada. Mesmo VfxRegistry do efeito. */
  poseVfxId: string | null;
  poseScale: number;
  poseOffsetX: number;
  poseOffsetY: number;
  /** Delay (ms) entre início da pose e lançamento do efeito. Não é travelSpeed. */
  castDelayMs: number;
  /** Animação de pose (`special1`, `idle`, …). Opcional. */
  castAnimationId: string | null;
  /** Folha corporal da pose (spritesheet ou sequência). Pertence ao personagem. */
  poseSheet: LabPoseSheet | null;
  execution: SkillExecutionDef;
  statusEffects: SkillStatusApplication[];
  skillElement: DamageElement;
  skillAi: SkillAiConfig;
  showAiDecisions: boolean;
  aiDecision: import('@/systems/combat-decision').CombatAiDecision | null;
  skillRotationDebug: import('@/systems/combat-decision').CombatSkillRotationDebug | null;
  /** Override temporário do dummy. Não entra em localStorage nem no CharacterDefinition. */
  enemyAffinityOverride: LabEnemyAffinityOverride | null;
  damageDebug: LabDamageDebug | null;
  /**
   * Hotbar rascunho (reordenar). `null` = igual ao pack oficial.
   * Troca atômica das referências de slot — não copia configs.
   */
  draftHotbar: OfficialHotbar | null;
  /** VFX global aberto para edição no Registry. Não associa à Skill. */
  editingVfxId: string | null;
  /** Modal VFX aberto — sobrevive a remount do Fast Refresh. */
  vfxEditorMode: 'create' | 'edit' | 'duplicate' | null;
  /** Incrementa quando o overlay DEV muda, para o React/Phaser re-ler Registry. */
  dataEpoch: number;
  skillOriginals: LabSkillOriginals;
  travelDebug: LabTravelDebug | null;
  command: LabCommand | null;
  events: LabEvent[];
  frameDebug: LabFrameDebug | null;
  hitDebug: LabHitDebug | null;
  executionDebug: LabExecutionDebug | null;
  activeVfxKey: string | null;
  sessionStartedAt: number;
  alignmentDebug: {
    base: { x: number; y: number };
    alignment: { x: number; y: number };
    poseOffset: { x: number; y: number };
    final: { x: number; y: number };
  } | null;
}

const MAX_EVENTS = 48;

const DEFAULT_SPRITE = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
  animationSpeed: 1,
} as const;

const DEFAULT_VFX = {
  vfxScale: 1,
  vfxOffsetX: 0,
  vfxOffsetY: 0,
  vfxLoopMode: 'none' as const,
  vfxLoopStartFrame: 1,
  vfxLoopEndFrame: 1,
  vfxLoopDurationMs: 3000,
  vfxLoopUntilSkillEnd: false,
  vfxFlipX: false,
  vfxFlipY: false,
} as const;

const DEFAULT_VISUALS = {
  ...DEFAULT_SPRITE,
  ...DEFAULT_VFX,
  gameSpeed: 1,
} as const;

const DEFAULT_SKILL_ORIGINALS: LabSkillOriginals = {
  targetMode: 'caster',
  hasOfficialTargetMode: false,
  travelSpeed: DEFAULT_TRAVEL_SPEED_PX,
  vfxId: null,
  vfxScale: 1,
  vfxOffsetX: 0,
  vfxOffsetY: 0,
  vfxLoopMode: 'none',
  vfxLoopStartFrame: 1,
  vfxLoopEndFrame: 1,
  vfxLoopDurationMs: 3000,
  vfxLoopUntilSkillEnd: false,
  vfxFlipX: false,
  vfxFlipY: false,
  spawnOffsetX: 0,
  spawnOffsetY: 0,
  targetOffsetX: 0,
  targetOffsetY: 0,
  poseVfxId: null,
  poseScale: 1,
  poseOffsetX: 0,
  poseOffsetY: 0,
  castDelayMs: 0,
  castAnimationId: null,
  poseSheet: null,
  execution: cloneExecutionDef({ type: 'single-hit' }),
  statusEffects: [],
  skillElement: DEFAULT_SKILL_ELEMENT,
  skillAi: defaultSkillAi(1),
};

const emptyState = (): CharacterLabState => ({
  isOpen: false,
  playerId: null,
  enemyId: null,
  loopSkill: false,
  loopIntervalMs: 1000,
  selectedSkillSlot: 1,
  lastSkillId: null,
  previewAwakening: 0,
  previewLineageId: null,
  previewLineageRank: 0,
  previewSpecializationId: null,
  previewSpecializationLevel: 0,
  ignoreCooldown: false,
  infiniteChakra: false,
  playerInvincible: false,
  enemyInvincible: false,
  enemyHpMode: 'x2',
  distance: 'normal',
  ...DEFAULT_VISUALS,
  showFrameDebug: false,
  showHitTiming: false,
  showHitbox: false,
  showHurtbox: false,
  showSpriteOrigin: false,
  showVfxOrigin: false,
  showVfxPath: false,
  showAreaRadius: false,
  showGroundGuide: true,
  showLog: true,
  showAiDecisions: false,
  tab: 'geral',
  alignContext: 'hunt',
  alignHubX: 0,
  alignHubY: 0,
  alignHuntX: 0,
  alignHuntY: 0,
  alignSaved: { hub: { x: 0, y: 0 }, hunt: { x: 0, y: 0 } },
  targetMode: 'caster',
  travelSpeed: DEFAULT_TRAVEL_SPEED_PX,
  spawnOffsetX: 0,
  spawnOffsetY: 0,
  targetOffsetX: 0,
  targetOffsetY: 0,
  vfxId: null,
  poseVfxId: null,
  poseScale: 1,
  poseOffsetX: 0,
  poseOffsetY: 0,
  castDelayMs: 0,
  castAnimationId: null,
  poseSheet: null,
  execution: cloneExecutionDef({ type: 'single-hit' }),
  statusEffects: [],
  skillElement: DEFAULT_SKILL_ELEMENT,
  skillAi: defaultSkillAi(1),
  aiDecision: null,
  skillRotationDebug: null,
  enemyAffinityOverride: null,
  damageDebug: null,
  draftHotbar: null,
  editingVfxId: null,
  vfxEditorMode: null,
  dataEpoch: 0,
  skillOriginals: DEFAULT_SKILL_ORIGINALS,
  travelDebug: null,
  command: null,
  events: [],
  frameDebug: null,
  hitDebug: null,
  executionDebug: null,
  activeVfxKey: null,
  sessionStartedAt: 0,
  alignmentDebug: null,
});

interface LabPrefs {
  isOpen: boolean;
  playerId: string | null;
  enemyId: string | null;
  lastSkillId: string | null;
  selectedSkillSlot: LabSkillSlot;
  tab: LabTab;
  showFrameDebug: boolean;
  showHitTiming: boolean;
  showHitbox: boolean;
  showHurtbox: boolean;
  showSpriteOrigin: boolean;
  showVfxOrigin: boolean;
  showVfxPath: boolean;
  showAreaRadius: boolean;
  showLog: boolean;
  showAiDecisions: boolean;
  loopIntervalMs: number;
}

function loadPrefs(): Partial<LabPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CHARACTER_LAB_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LabPrefs;
  } catch {
    return {};
  }
}

function savePrefs(state: CharacterLabState): void {
  if (typeof window === 'undefined') return;
  const prefs: LabPrefs = {
    isOpen: false, // never persist open lab across reloads
    playerId: state.playerId,
    enemyId: state.enemyId,
    lastSkillId: state.lastSkillId,
    selectedSkillSlot: state.selectedSkillSlot,
    tab: state.tab,
    showFrameDebug: state.showFrameDebug,
    showHitTiming: state.showHitTiming,
    showHitbox: state.showHitbox,
    showHurtbox: state.showHurtbox,
    showSpriteOrigin: state.showSpriteOrigin,
    showVfxOrigin: state.showVfxOrigin,
    showVfxPath: state.showVfxPath,
    showAreaRadius: state.showAreaRadius,
    showLog: state.showLog,
    showAiDecisions: state.showAiDecisions,
    loopIntervalMs: state.loopIntervalMs,
  };
  try {
    window.localStorage.setItem(CHARACTER_LAB_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/**
 * Salvar no Código escreve `src/data/**` e o Fast Refresh reexecuta este
 * módulo. Sem singleton, React assina uma store nova e o Phaser fica na
 * antiga — F8, skills e cliques do lab param de responder.
 */
const LAB_STORE_GLOBAL = '__idleMmorpgCharacterLabStore';
const LAB_STORE_HYDRATED = '__idleMmorpgCharacterLabHydrated';

type LabStoreGlobal = {
  [LAB_STORE_GLOBAL]?: WritableStore<CharacterLabState>;
  [LAB_STORE_HYDRATED]?: boolean;
};

function createLabStore(): WritableStore<CharacterLabState> {
  const prefs = loadPrefs();
  return createStore<CharacterLabState>({
    ...emptyState(),
    isOpen: false, // Item 35: nunca reabrir Lab automaticamente após reload
    playerId: prefs.playerId ?? null,
    enemyId: prefs.enemyId ?? null,
    lastSkillId: prefs.lastSkillId ?? null,
    selectedSkillSlot: asLabSkillSlot(prefs.selectedSkillSlot) ?? 1,
    tab: asLabTab(prefs.tab) ?? 'geral',
    showFrameDebug: prefs.showFrameDebug ?? false,
    showHitTiming: prefs.showHitTiming ?? false,
    showHitbox: prefs.showHitbox ?? false,
    showHurtbox: prefs.showHurtbox ?? false,
    showSpriteOrigin: prefs.showSpriteOrigin ?? false,
    showVfxOrigin: prefs.showVfxOrigin ?? false,
    showVfxPath: prefs.showVfxPath ?? false,
    showAreaRadius: prefs.showAreaRadius ?? false,
    showLog: prefs.showLog ?? true,
    showAiDecisions: prefs.showAiDecisions ?? false,
    loopIntervalMs: prefs.loopIntervalMs ?? 1000,
  });
}

function getLabStore(): WritableStore<CharacterLabState> {
  const g = globalThis as LabStoreGlobal;
  const existing = g[LAB_STORE_GLOBAL];
  if (existing) return existing;
  const created = createLabStore();
  g[LAB_STORE_GLOBAL] = created;
  return created;
}

const store = getLabStore();

function patch(partial: Partial<CharacterLabState>): void {
  store.setState({ ...store.getSnapshot(), ...partial });
}

function persist(): void {
  savePrefs(store.getSnapshot());
}

export const LAB_DISTANCE_PX: Record<LabDistancePreset, number> = {
  'very-close': 42,
  close: 72,
  normal: 120,
  far: 200,
  'very-far': 320,
};

export const LAB_HP_MULT: Record<LabEnemyHpMode, number> = {
  normal: 1,
  x2: 2,
  x5: 5,
  x10: 10,
  infinite: 0,
};

export function characterLabLabel(id: string): string {
  const starter = STARTERS.find((entry) => entry.id === id);
  if (starter) {
    if (id === 'naruto-classic') return 'Naruto Clássico';
    if (id === 'sasuke-classic') return 'Sasuke Clássico';
    return starter.name;
  }
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function isCharacterLabSession(): boolean {
  return isDevMode() && store.getSnapshot().isOpen;
}

/**
 * O Lab não pausa a caça: o jogo é oficial. Dummy do Lab não dá recompensa.
 */
export function isLabBlockingHuntGameplay(): boolean {
  return false;
}

export function isLabEnemyInvincible(): boolean {
  if (!isCharacterLabSession()) return false;
  const state = store.getSnapshot();
  return state.enemyInvincible || state.enemyHpMode === 'infinite';
}

export function labOriginalVisuals() {
  return DEFAULT_VISUALS;
}

function asLabSkillSlot(value: unknown): LabSkillSlot | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
}

function asLabTab(value: unknown): LabTab | undefined {
  return value === 'geral' || value === 'skills' || value === 'sprite' || value === 'vfx' || value === 'mapas' || value === 'debug'
    ? value
    : undefined;
}

function skillFieldsFrom(originals: LabSkillOriginals) {
  return {
    targetMode: originals.targetMode,
    travelSpeed: originals.travelSpeed,
    vfxScale: originals.vfxScale,
    vfxOffsetX: originals.vfxOffsetX,
    vfxOffsetY: originals.vfxOffsetY,
    vfxLoopMode: originals.vfxLoopMode,
    vfxLoopStartFrame: originals.vfxLoopStartFrame,
    vfxLoopEndFrame: originals.vfxLoopEndFrame,
    vfxLoopDurationMs: originals.vfxLoopDurationMs ?? 3000,
    vfxLoopUntilSkillEnd: Boolean(originals.vfxLoopUntilSkillEnd),
    vfxFlipX: originals.vfxFlipX ?? false,
    vfxFlipY: originals.vfxFlipY ?? false,
    spawnOffsetX: originals.spawnOffsetX,
    spawnOffsetY: originals.spawnOffsetY,
    targetOffsetX: originals.targetOffsetX,
    targetOffsetY: originals.targetOffsetY,
    vfxId: originals.vfxId ?? null,
    poseVfxId: originals.poseVfxId ?? null,
    poseScale: originals.poseScale,
    poseOffsetX: originals.poseOffsetX,
    poseOffsetY: originals.poseOffsetY,
    castDelayMs: originals.castDelayMs,
    castAnimationId: originals.castAnimationId ?? null,
    poseSheet: cloneLabPoseSheet(originals.poseSheet),
    execution: cloneExecutionDef(originals.execution),
    statusEffects: cloneSkillStatusEffects(originals.statusEffects),
    skillElement: originals.skillElement,
    skillAi: cloneSkillAi(originals.skillAi) ?? defaultSkillAi(1),
  };
}

function cloneSkillOriginals(originals: LabSkillOriginals): LabSkillOriginals {
  return {
    targetMode: originals.targetMode,
    hasOfficialTargetMode: originals.hasOfficialTargetMode,
    travelSpeed: originals.travelSpeed,
    vfxId: originals.vfxId ?? null,
    vfxScale: originals.vfxScale,
    vfxOffsetX: originals.vfxOffsetX,
    vfxOffsetY: originals.vfxOffsetY,
    vfxLoopMode: originals.vfxLoopMode,
    vfxLoopStartFrame: originals.vfxLoopStartFrame,
    vfxLoopEndFrame: originals.vfxLoopEndFrame,
    vfxLoopDurationMs: originals.vfxLoopDurationMs ?? 3000,
    vfxLoopUntilSkillEnd: Boolean(originals.vfxLoopUntilSkillEnd),
    vfxFlipX: originals.vfxFlipX ?? false,
    vfxFlipY: originals.vfxFlipY ?? false,
    spawnOffsetX: originals.spawnOffsetX,
    spawnOffsetY: originals.spawnOffsetY,
    targetOffsetX: originals.targetOffsetX,
    targetOffsetY: originals.targetOffsetY,
    poseVfxId: originals.poseVfxId ?? null,
    poseScale: originals.poseScale,
    poseOffsetX: originals.poseOffsetX,
    poseOffsetY: originals.poseOffsetY,
    castDelayMs: originals.castDelayMs,
    castAnimationId: originals.castAnimationId ?? null,
    poseSheet: cloneLabPoseSheet(originals.poseSheet),
    execution: cloneExecutionDef(originals.execution),
    statusEffects: cloneSkillStatusEffects(originals.statusEffects),
    skillElement: originals.skillElement,
    skillAi: cloneSkillAi(originals.skillAi) ?? defaultSkillAi(1),
  };
}

function packFor(playerId: string | null) {
  return playerId ? CharacterRegistry.get(playerId)?.pack : undefined;
}

function alignmentFromPack(playerId: string | null): Required<SpriteAlignmentConfig> {
  return normalizeSpriteAlignment(packFor(playerId)?.spriteAlignment);
}

function alignmentDraftFrom(config: Required<SpriteAlignmentConfig>) {
  return {
    alignHubX: config.hub.x,
    alignHubY: config.hub.y,
    alignHuntX: config.hunt.x,
    alignHuntY: config.hunt.y,
    alignSaved: config,
  };
}

function officialHotbarFor(playerId: string | null): OfficialHotbar {
  return padOfficialHotbar(packFor(playerId)?.hotbarSkillIds);
}

function loadSkillFromPack(playerId: string | null, skillId: string | null): LabSkillOriginals {
  if (!playerId || !skillId) return DEFAULT_SKILL_ORIGINALS;
  const def = CharacterRegistry.get(playerId);
  const skill = getSkill(skillId);
  const slot = resolveOfficialSlot(playerId, skillId, undefined).slot;
  return cloneSkillOriginals(
    readLabSkillOriginals(
      def?.pack.skillAnims[skillId],
      skill?.statusEffects,
      skill?.element,
      skill?.ai,
      slot,
    ),
  );
}

function resolveOfficialSlot(
  playerId: string | null,
  preferredSkillId: string | null | undefined,
  preferredSlot: LabSkillSlot | undefined,
  hotbar?: OfficialHotbar | null,
): { slot: LabSkillSlot; skillId: string | null } {
  const pack = packFor(playerId);
  const slots = hotbar ?? (pack ? padOfficialHotbar(pack.hotbarSkillIds) : null);
  if (slots) {
    const fromSkill = preferredSkillId
      ? (([1, 2, 3, 4] as const).find((slot) => slots[slot - 1] === preferredSkillId) ?? null)
      : null;
    const slot: LabSkillSlot = fromSkill ?? preferredSlot ?? 1;
    return { slot, skillId: slots[slot - 1] ?? null };
  }
  const fromSkill = slotForSkillId(pack, preferredSkillId);
  const slot: LabSkillSlot = fromSkill ?? preferredSlot ?? 1;
  return { slot, skillId: skillIdForSlot(pack, slot) };
}

{
  const g = globalThis as LabStoreGlobal;
  if (!g[LAB_STORE_HYDRATED]) {
    g[LAB_STORE_HYDRATED] = true;
    const snap = store.getSnapshot();
    if (snap.isOpen && snap.playerId) {
      const resolved = resolveOfficialSlot(snap.playerId, snap.lastSkillId, snap.selectedSkillSlot);
      const originals = loadSkillFromPack(snap.playerId, resolved.skillId);
      store.setState({
        ...snap,
        selectedSkillSlot: resolved.slot,
        lastSkillId: resolved.skillId,
        skillOriginals: originals,
        ...skillFieldsFrom(originals),
      });
    }
  }
}

export function friendlyLabAnimName(anim: string | null | undefined): string {
  if (!anim) return 'idle';
  const lower = anim.toLowerCase();
  const slots = [
    'special3',
    'special2',
    'special1',
    'combo3',
    'combo2',
    'combo1',
    'attack',
    'walk',
    'idle',
    'hurt',
    'death',
  ] as const;
  for (const slot of slots) {
    if (lower === slot || lower.endsWith(`-${slot}`) || lower.includes(`-${slot}-`)) return slot;
  }
  if (lower.startsWith('skill-')) return 'special';
  const last = anim.split(/[-_]/).pop();
  return last && last.length <= 12 ? last : 'idle';
}

export const characterLabStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  toggle(): void {
    if (!isDevMode()) return;
    if (store.getSnapshot().isOpen) this.close();
    else this.open();
  },

  open(): void {
    if (!isDevMode()) return;
    if (store.getSnapshot().isOpen) return;
    const state = store.getSnapshot();
    setDevLabSessionActive(true);
    patch({
      isOpen: true,
      sessionStartedAt: Date.now(),
      events: [],
      command: null,
      tab: 'geral',
      playerId: state.playerId,
    });
    persist();
    const playerId = state.playerId;
    if (playerId) {
      queueMicrotask(() => {
        if (!store.getSnapshot().isOpen) return;
        if (CharacterRegistry.get(playerId)) this.applyPlayer(playerId, false);
      });
    }
  },

  close(): void {
    resetDangerousDevOverrides();
    setDevTestCatalogLookType(null);
    setDevLabSessionActive(false);
    patch({
      ...emptyState(),
      isOpen: false,
      loopSkill: false,
      playerId: store.getSnapshot().playerId,
      enemyId: store.getSnapshot().enemyId,
      showFrameDebug: store.getSnapshot().showFrameDebug,
      showHitTiming: store.getSnapshot().showHitTiming,
      showHitbox: store.getSnapshot().showHitbox,
      showHurtbox: store.getSnapshot().showHurtbox,
      showSpriteOrigin: store.getSnapshot().showSpriteOrigin,
      showVfxOrigin: store.getSnapshot().showVfxOrigin,
      showVfxPath: store.getSnapshot().showVfxPath,
      showAreaRadius: store.getSnapshot().showAreaRadius,
      showLog: store.getSnapshot().showLog,
      loopIntervalMs: store.getSnapshot().loopIntervalMs,
      lastSkillId: store.getSnapshot().lastSkillId,
      selectedSkillSlot: store.getSnapshot().selectedSkillSlot,
      tab: store.getSnapshot().tab,
    });
    persist();
    void import('@/lib/session-persist').then((m) => m.savePersistedSession());
    locationStore.reloadScene();
  },

  /** RESET DEV STATE — overrides + lab session; não toca save oficial além do restore. */
  resetDevState(): void {
    if (!isDevMode()) return;
    if (store.getSnapshot().isOpen) {
      this.close();
      return;
    }
    resetDangerousDevOverrides();
    setDevLabSessionActive(false);
    setDevTestCatalogLookType(null);
    combatEnergyStore.resetRegenSettings();
  },

  applyPlayer(playerId: string, reload = true): void {
    const def = CharacterRegistry.get(playerId);
    if (!def) return;
    // Sempre o id permanente do pack (slug `itachi` → `uchiha-itachi`).
    const canonicalId = def.id;
    const lookType = def.lookTypes[0] ?? def.pack.outfit?.lookType ?? null;
    setDevTestCatalogLookType(lookType);
    const prev = store.getSnapshot();
    const resolved = resolveOfficialSlot(canonicalId, prev.lastSkillId, prev.selectedSkillSlot);
    const originals = loadSkillFromPack(canonicalId, resolved.skillId);
    const alignment = alignmentFromPack(canonicalId);
    patch({
      playerId: canonicalId,
      selectedSkillSlot: resolved.slot,
      lastSkillId: resolved.skillId,
      draftHotbar: null,
      loopSkill: false,
      command: reload ? { kind: 'reset' } : store.getSnapshot().command,
      activeVfxKey: null,
      travelDebug: null,
      skillOriginals: originals,
      ...DEFAULT_SPRITE,
      ...alignmentDraftFrom(alignment),
      gameSpeed: store.getSnapshot().gameSpeed,
      ...skillFieldsFrom(originals),
    });
    persist();
    if (reload) locationStore.reloadScene();
  },

  setEnemy(enemyId: string | null): void {
    patch({ enemyId, command: { kind: 'reset' }, travelDebug: null, activeVfxKey: null });
    persist();
  },

  setVisual<K extends keyof typeof DEFAULT_VISUALS>(key: K, value: number): void {
    patch({ [key]: value } as Partial<CharacterLabState>);
  },

  setFlag<K extends keyof CharacterLabState>(key: K, value: CharacterLabState[K]): void {
    patch({ [key]: value });
    persist();
  },

  setPreviewAwakening(level: 0 | 1 | 2 | 3): void {
    patch({ previewAwakening: level });
  },

  setPreviewLineage(lineageId: LineageId | null): void {
    patch({ previewLineageId: lineageId });
  },

  setPreviewLineageRank(rank: 0 | 1 | 2 | 3 | 4): void {
    patch({ previewLineageRank: rank });
  },

  setPreviewSpecialization(
    selectedSpecializationId: LineageSpecializationSlot | null,
    specializationLevel: 0 | 1 | 2 | 3 | 4,
  ): void {
    patch({ previewSpecializationId: selectedSpecializationId, previewSpecializationLevel: specializationLevel });
  },

  patchExecution(partial: Partial<SkillExecutionDef>): void {
    const current = cloneExecutionDef(store.getSnapshot().execution);
    patch({ execution: cloneExecutionDef({ ...current, ...partial }) });
  },

  setStatusEffects(statusEffects: SkillStatusApplication[]): void {
    patch({ statusEffects: cloneSkillStatusEffects(statusEffects) });
  },

  setSkillElement(skillElement: DamageElement): void {
    patch({ skillElement });
  },

  setSkillAi(skillAi: SkillAiConfig): void {
    patch({ skillAi: cloneSkillAi(skillAi) ?? defaultSkillAi(1) });
  },

  setAiDecision(aiDecision: import('@/systems/combat-decision').CombatAiDecision | null): void {
    patch({ aiDecision });
  },

  setSkillRotationDebug(
    skillRotationDebug: import('@/systems/combat-decision').CombatSkillRotationDebug | null,
  ): void {
    const prev = store.getSnapshot().skillRotationDebug;
    if (
      prev?.nextSlot === skillRotationDebug?.nextSlot &&
      prev?.lastUsedSlot === skillRotationDebug?.lastUsedSlot &&
      prev?.decision === skillRotationDebug?.decision &&
      JSON.stringify(prev?.slots) === JSON.stringify(skillRotationDebug?.slots)
    ) {
      return;
    }
    patch({ skillRotationDebug });
  },

  setEnemyAffinityOverride(override: LabEnemyAffinityOverride | null): void {
    patch({
      enemyAffinityOverride: override
        ? {
            resistances: cloneResistances(override.resistances),
            immunities: cloneImmunities(override.immunities),
          }
        : null,
    });
  },

  setDamageDebug(damageDebug: LabDamageDebug | null): void {
    patch({ damageDebug });
  },

  setEditingVfxId(id: string | null): void {
    if (store.getSnapshot().editingVfxId === id) return;
    patch({ editingVfxId: id });
  },

  setVfxEditorMode(mode: CharacterLabState['vfxEditorMode']): void {
    if (store.getSnapshot().vfxEditorMode === mode) return;
    patch({ vfxEditorMode: mode });
  },

  noteRuntimeUpdated(): void {
    patch({
      dataEpoch: store.getSnapshot().dataEpoch + 1,
      command: { kind: 'sync-runtime' },
    });
  },

  /** Associa o VFX Efeito de teste ao slot/Skill atuais. */
  useVfxOnSelectedSkill(id: string | null): void {
    patch({ vfxId: id });
  },

  setPoseSheet(sheet: LabPoseSheet | null): void {
    const next = cloneLabPoseSheet(sheet);
    patch({
      poseSheet: next,
      poseScale: next?.scaleY ?? 1,
      poseOffsetX: next?.offsetX ?? 0,
      poseOffsetY: next?.offsetY ?? 0,
    });
  },

  patchPoseSheet(partial: Partial<LabPoseSheet>): void {
    const state = store.getSnapshot();
    if (!state.poseSheet && !labPoseHasContent(partial as LabPoseSheet)) return;
    const base = state.poseSheet ?? {
      key: '',
      url: '',
      frameWidth: 0,
      frameHeight: 0,
      frameCount: 1,
      frameRate: 12,
      loop: false,
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };
    this.setPoseSheet({ ...base, ...partial, frames: partial.frames ?? base.frames });
  },

  hasDraftVisual(): boolean {
    const state = store.getSnapshot();
    return labDraftHasVisual(state.poseSheet, state.vfxId);
  },

  isDraftSlot(): boolean {
    return !store.getSnapshot().lastSkillId;
  },

  /** Associa o VFX Pose de teste ao slot/Skill atuais. */
  usePoseVfxOnSelectedSkill(id: string | null): void {
    if (!store.getSnapshot().lastSkillId) return;
    patch({ poseVfxId: id });
  },

  restoreVisuals(): void {
    const originals = store.getSnapshot().skillOriginals;
    patch({
      ...DEFAULT_SPRITE,
      gameSpeed: 1,
      ...skillFieldsFrom(originals),
      command: { kind: 'restore-visuals' },
    });
  },

  restoreSprite(): void {
    patch({ ...DEFAULT_SPRITE });
  },

  restoreVfx(): void {
    patch({ ...skillFieldsFrom(store.getSnapshot().skillOriginals) });
  },

  hasUnsavedSkillChanges(): boolean {
    return this.hasUnsavedSkillLogic() || this.hasUnsavedSkillVisual();
  },

  hasUnsavedSkillLogic(): boolean {
    const state = store.getSnapshot();
    return skillLogicDirty(
      {
        castDelayMs: state.castDelayMs,
        execution: state.execution,
        statusEffects: state.statusEffects,
        skillElement: state.skillElement,
        skillAi: state.skillAi,
      },
      state.skillOriginals,
    );
  },

  hasUnsavedSkillVisual(): boolean {
    const state = store.getSnapshot();
    return skillVisualDirty(
      {
        targetMode: state.targetMode,
        travelSpeed: state.travelSpeed,
        vfxScale: state.vfxScale,
        vfxOffsetX: state.vfxOffsetX,
        vfxOffsetY: state.vfxOffsetY,
        vfxLoopMode: state.vfxLoopMode,
        vfxLoopStartFrame: state.vfxLoopStartFrame,
        vfxLoopEndFrame: state.vfxLoopEndFrame,
        vfxLoopDurationMs: state.vfxLoopDurationMs,
        vfxLoopUntilSkillEnd: state.vfxLoopUntilSkillEnd,
        vfxFlipX: state.vfxFlipX,
        vfxFlipY: state.vfxFlipY,
        spawnOffsetX: state.spawnOffsetX,
        spawnOffsetY: state.spawnOffsetY,
        targetOffsetX: state.targetOffsetX,
        targetOffsetY: state.targetOffsetY,
        vfxId: state.vfxId,
        poseVfxId: state.poseVfxId,
        poseScale: state.poseScale,
        poseOffsetX: state.poseOffsetX,
        poseOffsetY: state.poseOffsetY,
        castDelayMs: state.castDelayMs,
        castAnimationId: state.castAnimationId,
        poseSheet: state.poseSheet,
        execution: state.execution,
        statusEffects: state.statusEffects,
        skillElement: state.skillElement,
        skillAi: state.skillAi,
      },
      state.skillOriginals,
    );
  },

  hasUnsavedSpriteChanges(): boolean {
    const state = store.getSnapshot();
    return (
      state.scaleX !== DEFAULT_SPRITE.scaleX ||
      state.scaleY !== DEFAULT_SPRITE.scaleY ||
      state.offsetX !== DEFAULT_SPRITE.offsetX ||
      state.offsetY !== DEFAULT_SPRITE.offsetY ||
      state.animationSpeed !== DEFAULT_SPRITE.animationSpeed
    );
  },

  getDraftAlignment(): Required<SpriteAlignmentConfig> {
    const state = store.getSnapshot();
    return {
      hub: { x: state.alignHubX, y: state.alignHubY },
      hunt: { x: state.alignHuntX, y: state.alignHuntY },
    };
  },

  hasUnsavedAlignmentChanges(): boolean {
    const state = store.getSnapshot();
    return !alignmentsEqual(this.getDraftAlignment(), state.alignSaved);
  },

  setAlignContext(context: SpriteAlignmentContext): void {
    patch({ alignContext: context });
  },

  setAlignAxis(axis: 'x' | 'y', value: number): void {
    const state = store.getSnapshot();
    const rounded = Math.round(value);
    if (state.alignContext === 'hub') {
      patch(axis === 'x' ? { alignHubX: rounded } : { alignHubY: rounded });
    } else {
      patch(axis === 'x' ? { alignHuntX: rounded } : { alignHuntY: rounded });
    }
  },

  nudgeAlign(axis: 'x' | 'y', delta: number): void {
    const state = store.getSnapshot();
    const current =
      state.alignContext === 'hub'
        ? axis === 'x'
          ? state.alignHubX
          : state.alignHubY
        : axis === 'x'
          ? state.alignHuntX
          : state.alignHuntY;
    this.setAlignAxis(axis, current + delta);
  },

  resetAlignContext(): void {
    const state = store.getSnapshot();
    if (state.alignContext === 'hub') patch({ alignHubX: 0, alignHubY: 0 });
    else patch({ alignHuntX: 0, alignHuntY: 0 });
  },

  reloadAlignSaved(): void {
    // Preferência: fonte oficial do Character Pack (via API). Fallback: último confirmado.
    void (async () => {
      const playerId = store.getSnapshot().playerId;
      if (!playerId) {
        const saved = normalizeSpriteAlignment(store.getSnapshot().alignSaved);
        patch(alignmentDraftFrom(saved));
        return;
      }
      try {
        const res = await fetch(`/api/dev/character-config?characterId=${encodeURIComponent(playerId)}`);
        const json = (await res.json()) as {
          success?: boolean;
          spriteAlignment?: SpriteAlignmentConfig | null;
        };
        if (res.ok && json.success) {
          const fromDisk = normalizeSpriteAlignment(json.spriteAlignment);
          patch(alignmentDraftFrom(fromDisk));
          return;
        }
      } catch {
        // fallback abaixo
      }
      const saved = normalizeSpriteAlignment(store.getSnapshot().alignSaved);
      patch(alignmentDraftFrom(saved));
    })();
  },

  copyAlign(from: SpriteAlignmentContext, to: SpriteAlignmentContext): void {
    const draft = this.getDraftAlignment();
    const point = draft[from];
    if (to === 'hub') patch({ alignHubX: point.x, alignHubY: point.y });
    else patch({ alignHuntX: point.x, alignHuntY: point.y });
  },

  applyAlignBothContexts(): void {
    const state = store.getSnapshot();
    const point =
      state.alignContext === 'hub'
        ? { x: state.alignHubX, y: state.alignHubY }
        : { x: state.alignHuntX, y: state.alignHuntY };
    patch({
      alignHubX: point.x,
      alignHubY: point.y,
      alignHuntX: point.x,
      alignHuntY: point.y,
    });
  },

  markAlignmentSaved(config: SpriteAlignmentConfig): void {
    const normalized = normalizeSpriteAlignment(config);
    patch({
      ...alignmentDraftFrom(normalized),
      dataEpoch: store.getSnapshot().dataEpoch + 1,
      command: { kind: 'sync-runtime' },
    });
    persist();
  },

  skillOverrideDirty(): boolean {
    return this.hasUnsavedSkillChanges();
  },

  getEffectiveHotbar(): OfficialHotbar {
    const state = store.getSnapshot();
    return state.draftHotbar ?? officialHotbarFor(state.playerId);
  },

  hasUnsavedHotbarChanges(): boolean {
    const state = store.getSnapshot();
    if (!state.draftHotbar) return false;
    return !hotbarsEqual(state.draftHotbar, officialHotbarFor(state.playerId));
  },

  hasUnsavedLabChanges(): boolean {
    return (
      this.hasUnsavedSkillChanges() ||
      this.hasUnsavedHotbarChanges() ||
      this.hasUnsavedSpriteChanges() ||
      this.hasUnsavedAlignmentChanges()
    );
  },

  moveSkillSlot(slot: LabSkillSlot, dir: -1 | 1): void {
    const current = this.getEffectiveHotbar();
    const next = moveOfficialSlot(current, slot, dir);
    if (hotbarsEqual(current, next)) return;
    const selected = store.getSnapshot().selectedSkillSlot;
    const swapped = selected === slot ? ((slot + dir) as LabSkillSlot) : selected === slot + dir ? slot : selected;
    const official = officialHotbarFor(store.getSnapshot().playerId);
    patch({
      draftHotbar: hotbarsEqual(next, official) ? null : next,
      selectedSkillSlot: swapped,
      lastSkillId: next[swapped - 1] ?? null,
    });
  },

  setDraftHotbar(slots: OfficialHotbar | null): void {
    patch({ draftHotbar: slots });
  },

  applySavedHotbar(slots: OfficialHotbar, options?: { selectSlot?: LabSkillSlot }): void {
    const state = store.getSnapshot();
    const slot = options?.selectSlot ?? state.selectedSkillSlot;
    const skillId = slots[slot - 1] ?? null;
    const originals = loadSkillFromPack(state.playerId, skillId);
    patch({
      draftHotbar: null,
      selectedSkillSlot: slot,
      lastSkillId: skillId,
      skillOriginals: originals,
      ...skillFieldsFrom(originals),
      dataEpoch: state.dataEpoch + 1,
      command: { kind: 'sync-runtime' },
    });
    persist();
  },

  reloadSelectedSkill(): void {
    const state = store.getSnapshot();
    const skillId = this.getEffectiveHotbar()[state.selectedSkillSlot - 1] ?? null;
    const originals = loadSkillFromPack(state.playerId, skillId);
    patch({
      lastSkillId: skillId,
      skillOriginals: originals,
      ...skillFieldsFrom(originals),
    });
  },

  selectSlot(slot: LabSkillSlot, options?: { force?: boolean }): boolean {
    const state = store.getSnapshot();
    if (state.selectedSkillSlot === slot) return true;
    if (!options?.force && this.hasUnsavedSkillChanges()) return false;
    const skillId = this.getEffectiveHotbar()[slot - 1] ?? null;
    const originals = loadSkillFromPack(state.playerId, skillId);
    // editingVfxId permanece: editar VFX global não depende do slot selecionado.
    patch({
      selectedSkillSlot: slot,
      lastSkillId: skillId,
      skillOriginals: originals,
      ...skillFieldsFrom(originals),
      loopSkill: false,
      command: { kind: 'clear-fx' },
      activeVfxKey: null,
      travelDebug: null,
    });
    persist();
    return true;
  },

  selectSkill(skillId: string, options?: { force?: boolean }): boolean {
    const state = store.getSnapshot();
    const hotbar = this.getEffectiveHotbar();
    const slot = ([1, 2, 3, 4] as const).find((entry) => hotbar[entry - 1] === skillId);
    if (slot) return this.selectSlot(slot, options);
    const pack = state.playerId ? CharacterRegistry.get(state.playerId)?.pack : undefined;
    const fromPack = slotForSkillId(pack, skillId);
    if (fromPack) return this.selectSlot(fromPack, options);
    return false;
  },

  playSlot(slot: CharacterAnimSlot): void {
    patch({ command: { kind: 'play-slot', slot } });
  },

  castSkill(skillId: string): void {
    patch({ lastSkillId: skillId, command: { kind: 'cast-skill', skillId } });
  },

  playPose(): void {
    patch({ command: { kind: 'play-pose' } });
  },

  playEffect(): void {
    patch({ command: { kind: 'play-effect' } });
  },

  playCompleteSkill(): void {
    patch({ command: { kind: 'play-complete' } });
  },

  basicAttack(): void {
    patch({ command: { kind: 'basic-attack' } });
  },

    resetTest(): void {
    combatEnergyStore.resetRegenSettings();
    patch({
      command: { kind: 'reset' },
      loopSkill: false,
      activeVfxKey: null,
      travelDebug: null,
      executionDebug: null,
    });
  },

  markVisualsSaved(options?: { skillOnly?: boolean; scope?: 'logic' | 'visual' | 'all' }): void {
    const state = store.getSnapshot();
    const scope = options?.scope ?? 'all';
    const prev = state.skillOriginals;
    const originals: LabSkillOriginals = cloneSkillOriginals({
      targetMode: scope === 'logic' ? prev.targetMode : state.targetMode,
      hasOfficialTargetMode: true,
      travelSpeed: scope === 'logic' ? prev.travelSpeed : state.travelSpeed,
      vfxScale: scope === 'logic' ? prev.vfxScale : state.vfxScale,
      vfxOffsetX: scope === 'logic' ? prev.vfxOffsetX : state.vfxOffsetX,
      vfxOffsetY: scope === 'logic' ? prev.vfxOffsetY : state.vfxOffsetY,
      vfxLoopMode: scope === 'logic' ? prev.vfxLoopMode : state.vfxLoopMode,
      vfxLoopStartFrame: scope === 'logic' ? prev.vfxLoopStartFrame : state.vfxLoopStartFrame,
      vfxLoopEndFrame: scope === 'logic' ? prev.vfxLoopEndFrame : state.vfxLoopEndFrame,
      vfxLoopDurationMs: scope === 'logic' ? prev.vfxLoopDurationMs : state.vfxLoopDurationMs,
      vfxLoopUntilSkillEnd: scope === 'logic' ? prev.vfxLoopUntilSkillEnd : state.vfxLoopUntilSkillEnd,
      vfxFlipX: scope === 'logic' ? prev.vfxFlipX : state.vfxFlipX,
      vfxFlipY: scope === 'logic' ? prev.vfxFlipY : state.vfxFlipY,
      spawnOffsetX: scope === 'logic' ? prev.spawnOffsetX : state.spawnOffsetX,
      spawnOffsetY: scope === 'logic' ? prev.spawnOffsetY : state.spawnOffsetY,
      targetOffsetX: scope === 'logic' ? prev.targetOffsetX : state.targetOffsetX,
      targetOffsetY: scope === 'logic' ? prev.targetOffsetY : state.targetOffsetY,
      vfxId: scope === 'logic' ? prev.vfxId : state.vfxId,
      poseVfxId: scope === 'logic' ? prev.poseVfxId : state.poseVfxId,
      poseScale: scope === 'logic' ? prev.poseScale : state.poseScale,
      poseOffsetX: scope === 'logic' ? prev.poseOffsetX : state.poseOffsetX,
      poseOffsetY: scope === 'logic' ? prev.poseOffsetY : state.poseOffsetY,
      castDelayMs: scope === 'visual' ? prev.castDelayMs : state.castDelayMs,
      castAnimationId: scope === 'logic' ? prev.castAnimationId : state.castAnimationId,
      poseSheet: cloneLabPoseSheet(scope === 'logic' ? prev.poseSheet : state.poseSheet),
      execution: cloneExecutionDef(scope === 'visual' ? prev.execution : state.execution),
      statusEffects: cloneSkillStatusEffects(scope === 'visual' ? prev.statusEffects : state.statusEffects),
      skillElement: scope === 'visual' ? prev.skillElement : state.skillElement,
      skillAi: cloneSkillAi(scope === 'visual' ? prev.skillAi : state.skillAi) ?? defaultSkillAi(state.selectedSkillSlot),
    });
    patch({
      ...(options?.skillOnly ? {} : DEFAULT_SPRITE),
      skillOriginals: originals,
      dataEpoch: state.dataEpoch + 1,
      command: { kind: 'sync-runtime' },
    });
    persist();
  },

  setTravelDebug(travelDebug: LabTravelDebug | null): void {
    const prev = store.getSnapshot().travelDebug;
    if (
      prev?.forceOn === travelDebug?.forceOn &&
      prev?.mode === travelDebug?.mode &&
      prev?.startX === travelDebug?.startX &&
      prev?.startY === travelDebug?.startY &&
      prev?.targetX === travelDebug?.targetX &&
      prev?.targetY === travelDebug?.targetY &&
      prev?.distance === travelDebug?.distance &&
      prev?.speedPx === travelDebug?.speedPx &&
      prev?.estimatedImpactMs === travelDebug?.estimatedImpactMs &&
      prev?.note === travelDebug?.note
    ) {
      return;
    }
    patch({ travelDebug });
  },

  consumeCommand(): LabCommand | null {
    const command = store.getSnapshot().command;
    if (command) patch({ command: null });
    return command;
  },

  pushEvent(text: string): void {
    const state = store.getSnapshot();
    if (!state.isOpen) return;
    const elapsed = Date.now() - (state.sessionStartedAt || Date.now());
    const next = [...state.events, { t: elapsed, text }].slice(-MAX_EVENTS);
    patch({ events: next });
  },

  setFrameDebug(frameDebug: LabFrameDebug | null): void {
    const prev = store.getSnapshot().frameDebug;
    if (
      prev?.anim === frameDebug?.anim &&
      prev?.frame === frameDebug?.frame &&
      prev?.total === frameDebug?.total &&
      prev?.actionLocked === frameDebug?.actionLocked
    ) {
      return;
    }
    patch({ frameDebug });
  },

  setAlignmentDebug(alignmentDebug: CharacterLabState['alignmentDebug']): void {
    const prev = store.getSnapshot().alignmentDebug;
    if (
      prev?.base.x === alignmentDebug?.base.x &&
      prev?.base.y === alignmentDebug?.base.y &&
      prev?.alignment.x === alignmentDebug?.alignment.x &&
      prev?.alignment.y === alignmentDebug?.alignment.y &&
      prev?.poseOffset.x === alignmentDebug?.poseOffset.x &&
      prev?.poseOffset.y === alignmentDebug?.poseOffset.y &&
      prev?.final.x === alignmentDebug?.final.x &&
      prev?.final.y === alignmentDebug?.final.y
    ) {
      return;
    }
    patch({ alignmentDebug });
  },

  setHitDebug(hitDebug: LabHitDebug | null): void {
    patch({ hitDebug });
  },

  setExecutionDebug(executionDebug: LabExecutionDebug | null): void {
    const prev = store.getSnapshot().executionDebug;
    if (
      prev?.status === executionDebug?.status &&
      prev?.currentHit === executionDebug?.currentHit &&
      prev?.hitMax === executionDebug?.hitMax &&
      prev?.tick === executionDebug?.tick &&
      prev?.tickMax === executionDebug?.tickMax &&
      Math.floor((prev?.elapsedMs ?? 0) / 50) === Math.floor((executionDebug?.elapsedMs ?? 0) / 50) &&
      prev?.durationMs === executionDebug?.durationMs &&
      prev?.type === executionDebug?.type
    ) {
      return;
    }
    patch({ executionDebug });
  },

  setActiveVfx(activeVfxKey: string | null): void {
    if (store.getSnapshot().activeVfxKey === activeVfxKey) return;
    patch({ activeVfxKey });
  },

  copyVisualSettings(): string {
    const state = store.getSnapshot();
    const def = state.playerId ? CharacterRegistry.get(state.playerId) : null;
    const text = [
      `Character: ${state.playerId ? characterLabLabel(state.playerId) : '—'}`,
      '',
      'Sprite',
      `scaleX: ${state.scaleX}`,
      `scaleY: ${state.scaleY}`,
      `offsetX: ${state.offsetX}`,
      `offsetY: ${state.offsetY}`,
      '',
      'VFX',
      `scale: ${state.vfxScale}`,
      `offsetX: ${state.vfxOffsetX}`,
      `offsetY: ${state.vfxOffsetY}`,
      '',
      `animationSpeed: ${state.animationSpeed}`,
    ].join('\n');
    void copyText(text);
    return text;
  },
};

function copyText(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => copyTextFallback(text));
    return;
  }
  copyTextFallback(text);
}

function copyTextFallback(text: string): void {
  if (typeof document === 'undefined') return;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    // ignore
  }
  area.remove();
}
