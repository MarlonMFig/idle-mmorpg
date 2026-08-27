'use client';

import { useEffect, useMemo, useState, type RefObject } from 'react';
import { DEV_FLAGS, isDevMode } from '@/config/devConfig';
import { COMBAT_ENERGY } from '@/constants/combat-energy';
import { locationStore } from '@/stores/location-store';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import { getVfxDefinition, listVfxDefinitions, vfxMatchesQuery } from '@/data/vfx';
import {
  ensureWonsrVfxCatalog,
  WONSR_AURA_PREFIX,
  WONSR_FX_PREFIX,
} from '@/data/vfx/wonsr-catalog';
import { CharacterRegistry, listAvailableAnimSlots } from '@/data/characters';
import { getSkill } from '@/data/skills';
import type { SkillDefinition } from '@/types/skill';
import { resolveEffectiveSkill, resolveEffectiveSkillAnim } from '@/lib/resolve-effective-skill';
import type { SkillVfxTargetMode } from '@/data/character-packs';
import { formatExecutionTypesLabel } from '@/data/skill-execution-def';
import {
  collectLabSaveChanges,
  hasLabSpriteChanges,
  spriteOnlyLabChanges,
  TARGET_MODE_LABELS,
  type LabSaveChanges,
} from '@/lib/dev/lab-save-fields';
import { isBodyAnimSlot, readSheetScale } from '@/lib/dev/lab-sheet-scale';
import {
  extraLegacySkillIds,
  LAB_SKILL_SLOTS,
  type LabSkillSlot,
} from '@/lib/dev/lab-skill-slots';
import { CharacterLabStatusLibrary } from '@/ui/dev/character-lab-status-library';
import { CharacterLabSkillLogic } from '@/ui/dev/character-lab-skill-logic';
import { labPoseHasContent } from '@/lib/dev/lab-pose-sheet';
import { ValueRow } from '@/ui/dev/character-lab-value-row';
import { CharacterLabDamageDebug, CharacterLabResistPanel } from '@/ui/dev/character-lab-resist';
import { formatCombatAiDecision } from '@/systems/combat-decision';
import { DAMAGE_ELEMENT_LABELS, resolveSkillElement } from '@/data/damage-elements';
import { combatStatusHudStore } from '@/stores/combat-status-hud-store';
import { skillVisualTimeline } from '@/lib/combat-visual-timing';
import { suggestLabSkillId } from '@/lib/dev/lab-pose-sheet';
import { fetchDevSave, fetchDevSaveJson } from '@/lib/dev/dev-save-fetch';
import { saveLog } from '@/lib/dev/save-log';
import { removeDevVfx, upsertDevHotbar, upsertDevSkillAnim, upsertDevSkillDef } from '@/lib/dev/dev-runtime-registry';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import {
  characterLabLabel,
  characterLabStore,
  clampLabEnemyCount,
  friendlyLabAnimName,
  labOriginalVisuals,
  type LabDistancePreset,
  type LabEnemyHpMode,
  type LabTab,
} from '@/stores/character-lab-store';
import type { CharacterAnimSlot } from '@/types/character-definition';
import { CharacterLabLootInspector } from '@/ui/dev/character-lab-loot-inspector';
import { CharacterLabLootEconomyAnalyzer } from '@/ui/dev/character-lab-loot-economy';
import { CharacterLabCaptureInspector } from '@/ui/dev/character-lab-capture-inspector';
import { CharacterLabQualityTester } from '@/ui/dev/character-lab-quality-tester';
import { CharacterLabXpAnalyzer } from '@/ui/dev/character-lab-xp-analyzer';
import { CharacterLabSkillsTab } from '@/ui/dev/character-lab-skills-tab';
import { CharacterLabPoseEffect } from '@/ui/dev/character-lab-pose-effect';
import { CharacterLabSpriteAlignment } from '@/ui/dev/character-lab-sprite-alignment';
import { CharacterLabMapViewport } from '@/ui/dev/character-lab-map-viewport';
import { CharacterLabHubEffects } from '@/ui/dev/character-lab-hub-effects';
import { CharacterLabMasteryDebug } from '@/ui/dev/character-lab-mastery';
import { CharacterLabAwakeningDebug } from '@/ui/dev/character-lab-awakening';
import { CharacterLabLineageDebug } from '@/ui/dev/character-lab-lineage';
import { CharacterLabAchievementsDebug } from '@/ui/dev/character-lab-achievements';
import { CharacterLabMissionsDebug } from '@/ui/dev/character-lab-missions';
import { CharacterLabDailyLoginDebug } from '@/ui/dev/character-lab-daily-login';
import { CharacterLabBossDebug } from '@/ui/dev/character-lab-bosses';
import { CharacterLabRankingDebug } from '@/ui/dev/character-lab-ranking';
import { CharacterLabGuildDebug } from '@/ui/dev/character-lab-guild';
import { CharacterLabGuildBossDebug } from '@/ui/dev/character-lab-guild-boss';
import { CharacterLabGuildShopDebug } from '@/ui/dev/character-lab-guild-shop';
import { CharacterLabWorldBossDebug } from '@/ui/dev/character-lab-world-boss';
import { CharacterLabEconomyDebug } from '@/ui/dev/character-lab-economy';
import { CharacterLabGameCycleDebug } from '@/ui/dev/character-lab-game-cycle';
import { LabPreviewAwakening } from '@/ui/dev/lab-preview-awakening';
import { VfxEditorModal } from '@/ui/dev/vfx-editor-modal';

const SLOT_LABELS: Record<CharacterAnimSlot, string> = {
  idle: 'Idle',
  walk: 'Walk',
  attack: 'Attack',
  combo1: 'Combo 1',
  combo2: 'Combo 2',
  combo3: 'Combo 3',
  hurt: 'Hurt',
  death: 'Death',
  special1: 'Special 1',
  special2: 'Special 2',
  special3: 'Special 3',
};

const SCALE_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const OFFSET_PRESETS = [-50, -25, -10, 0, 10, 25, 50];
const ANIM_SPEEDS = [0.25, 0.5, 1, 1.5, 2];
const GAME_SPEEDS = [0.25, 0.5, 1, 2];
const LOOP_INTERVALS = [500, 1000, 2000];

function labDirtyAreaLabels(input: {
  skillLogic: boolean;
  skillVisual: boolean;
  sprite: boolean;
  order: boolean;
  vfxDef: boolean;
}): string[] {
  const areas: string[] = [];
  if (input.skillLogic) areas.push('Skill Logic');
  if (input.skillVisual) areas.push('VFX Override');
  if (input.sprite) areas.push('Sprite');
  if (input.order) areas.push('Ordem dos slots');
  if (input.vfxDef) areas.push('VFX Global');
  return areas;
}

const TABS = [
  { id: 'geral', label: 'GERAL' },
  { id: 'skills', label: 'SKILLS' },
  { id: 'sprite', label: 'SPRITE' },
  { id: 'vfx', label: 'VFX' },
  { id: 'mapas', label: 'MAPAS' },
  { id: 'debug', label: 'DEBUG' },
] as const;

const DISTANCE_OPTIONS: { id: LabDistancePreset; label: string }[] = [
  { id: 'very-close', label: 'Muito perto' },
  { id: 'close', label: 'Perto' },
  { id: 'normal', label: 'Normal' },
  { id: 'far', label: 'Longe' },
  { id: 'very-far', label: 'Muito longe' },
];

const HP_OPTIONS: { id: LabEnemyHpMode; label: string }[] = [
  { id: 'normal', label: 'HP normal' },
  { id: 'x2', label: 'HP ×2' },
  { id: 'x5', label: 'HP ×5' },
  { id: 'x10', label: 'HP ×10' },
  { id: 'infinite', label: 'HP infinito' },
];

const LAB_ENEMY_COUNT_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function labSkillVfxLabel(
  vfxId: string | null,
  anim: { fx?: unknown } | undefined,
): string {
  if (vfxId) return getVfxDefinition(vfxId)?.name ?? vfxId;
  if (anim?.fx) return 'legado';
  return 'Nenhum';
}

function formatLabTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Painel interno DEV: Character Test Lab.
 * Só monta com DEV_FLAGS.enabled. Não faz parte do gameplay.
 */
function CharacterTestLabBody() {
  const isOpen = useStore(characterLabStore, (s) => s.isOpen);
  const playerId = useStore(characterLabStore, (s) => s.playerId);
  const enemyId = useStore(characterLabStore, (s) => s.enemyId);
  const loopSkill = useStore(characterLabStore, (s) => s.loopSkill);
  const loopIntervalMs = useStore(characterLabStore, (s) => s.loopIntervalMs);
  const ignoreCooldown = useStore(characterLabStore, (s) => s.ignoreCooldown);
  const infiniteChakra = useStore(characterLabStore, (s) => s.infiniteChakra);
  const energyCurrent = useStore(combatEnergyStore, (s) => s.currentEnergy);
  const energyMax = useStore(combatEnergyStore, (s) => s.maxEnergy);
  const energyRegenOverride = useStore(combatEnergyStore, (s) => s.regenPerSecondOverride);
  const energyRegenFrozen = useStore(combatEnergyStore, (s) => s.freezePassiveRegen);
  const energyRegenPerSecond =
    energyRegenOverride != null ? energyRegenOverride : COMBAT_ENERGY.energyRegenPerSecond;
  const playerInvincible = useStore(characterLabStore, (s) => s.playerInvincible);
  const enemyInvincible = useStore(characterLabStore, (s) => s.enemyInvincible);
  const enemyHpMode = useStore(characterLabStore, (s) => s.enemyHpMode);
  const labEnemyCount = useStore(characterLabStore, (s) => s.labEnemyCount);
  const distance = useStore(characterLabStore, (s) => s.distance);
  const scaleX = useStore(characterLabStore, (s) => s.scaleX);
  const scaleY = useStore(characterLabStore, (s) => s.scaleY);
  const offsetX = useStore(characterLabStore, (s) => s.offsetX);
  const offsetY = useStore(characterLabStore, (s) => s.offsetY);
  const animPreviewSlot = useStore(characterLabStore, (s) => s.animPreviewSlot);
  const sheetScaleDrafts = useStore(characterLabStore, (s) => s.sheetScaleDrafts);
  const sheetScaleOriginals = useStore(characterLabStore, (s) => s.sheetScaleOriginals);
  const vfxScale = useStore(characterLabStore, (s) => s.vfxScale);
  const vfxOffsetX = useStore(characterLabStore, (s) => s.vfxOffsetX);
  const vfxOffsetY = useStore(characterLabStore, (s) => s.vfxOffsetY);
  const animationSpeed = useStore(characterLabStore, (s) => s.animationSpeed);
  const gameSpeed = useStore(characterLabStore, (s) => s.gameSpeed);
  const showFrameDebug = useStore(characterLabStore, (s) => s.showFrameDebug);
  const showHitTiming = useStore(characterLabStore, (s) => s.showHitTiming);
  const showHitbox = useStore(characterLabStore, (s) => s.showHitbox);
  const showHurtbox = useStore(characterLabStore, (s) => s.showHurtbox);
  const showSpriteOrigin = useStore(characterLabStore, (s) => s.showSpriteOrigin);
  const showVfxOrigin = useStore(characterLabStore, (s) => s.showVfxOrigin);
  const showLog = useStore(characterLabStore, (s) => s.showLog);
  const tab = useStore(characterLabStore, (s) => s.tab);
  const targetMode = useStore(characterLabStore, (s) => s.targetMode);
  const travelSpeed = useStore(characterLabStore, (s) => s.travelSpeed);
  const spawnOffsetX = useStore(characterLabStore, (s) => s.spawnOffsetX);
  const spawnOffsetY = useStore(characterLabStore, (s) => s.spawnOffsetY);
  const targetOffsetX = useStore(characterLabStore, (s) => s.targetOffsetX);
  const targetOffsetY = useStore(characterLabStore, (s) => s.targetOffsetY);
  const vfxId = useStore(characterLabStore, (s) => s.vfxId);
  const poseSheet = useStore(characterLabStore, (s) => s.poseSheet);
  const poseVfxId = useStore(characterLabStore, (s) => s.poseVfxId);
  const poseScale = useStore(characterLabStore, (s) => s.poseScale);
  const poseOffsetX = useStore(characterLabStore, (s) => s.poseOffsetX);
  const poseOffsetY = useStore(characterLabStore, (s) => s.poseOffsetY);
  const castDelayMs = useStore(characterLabStore, (s) => s.castDelayMs);
  const castAnimationId = useStore(characterLabStore, (s) => s.castAnimationId);
  const execution = useStore(characterLabStore, (s) => s.execution);
  const statusEffects = useStore(characterLabStore, (s) => s.statusEffects);
  const skillElement = useStore(characterLabStore, (s) => s.skillElement);
  const skillAi = useStore(characterLabStore, (s) => s.skillAi);
  const areaImpactFxPerTarget = useStore(characterLabStore, (s) => s.areaImpactFxPerTarget);
  const executionDebug = useStore(characterLabStore, (s) => s.executionDebug);
  const statusDebug = useStore(combatStatusHudStore, (s) => s.debug);
  const showAreaRadius = useStore(characterLabStore, (s) => s.showAreaRadius);
  const draftHotbar = useStore(characterLabStore, (s) => s.draftHotbar);
  const editingVfxId = useStore(characterLabStore, (s) => s.editingVfxId);
  const vfxEditor = useStore(characterLabStore, (s) => s.vfxEditorMode);
  const dataEpoch = useStore(characterLabStore, (s) => s.dataEpoch);
  const skillOriginals = useStore(characterLabStore, (s) => s.skillOriginals);
  const events = useStore(characterLabStore, (s) => s.events);
  const lastSkillId = useStore(characterLabStore, (s) => s.lastSkillId);
  const previewAwakening = useStore(characterLabStore, (s) => s.previewAwakening);
  const selectedSkillSlot = useStore(characterLabStore, (s) => s.selectedSkillSlot);
  const frameDebug = useStore(characterLabStore, (s) => s.frameDebug);
  const alignmentDebug = useStore(characterLabStore, (s) => s.alignmentDebug);
  const activeVfxKey = useStore(characterLabStore, (s) => s.activeVfxKey);

  const [copied, setCopied] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [isSavingSkill, setIsSavingSkill] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [sourcePath, setSourcePath] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<LabSkillSlot | null>(null);
  const [pendingPlayer, setPendingPlayer] = useState<string | null>(null);
  const [draftNameOpen, setDraftNameOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftId, setDraftId] = useState('');
  const [statusLibraryOpen, setStatusLibraryOpen] = useState(false);
  const [lastCreatedVfxId, setLastCreatedVfxId] = useState<string | null>(null);
  const [vfxQuery, setVfxQuery] = useState('');
  const [vfxSource, setVfxSource] = useState<'catalog' | 'wonsr-fx' | 'wonsr-aura'>('catalog');
  const [wonsrVfxGen, setWonsrVfxGen] = useState(0);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [vfxDefinitionDirty, setVfxDefinitionDirty] = useState(false);
  const [vfxDraftKey, setVfxDraftKey] = useState(0);
  const [pendingVfxLeave, setPendingVfxLeave] = useState<{
    nextId: string | null;
    intent: 'switch' | 'create' | 'close';
  } | null>(null);
  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('dev-character-lab', {
    zIndex: 92,
    dragZIndex: 99,
  });

  const characters = useMemo(() => {
    return CharacterRegistry.list({ includeInactive: true })
      .slice()
      .sort((a, b) => characterLabLabel(a.id).localeCompare(characterLabLabel(b.id), 'pt-BR'));
  }, [dataEpoch]);

  const playerDef = playerId ? CharacterRegistry.get(playerId) : null;
  const slots = playerDef ? listAvailableAnimSlots(playerDef.pack) : [];
  const effectiveHotbar = characterLabStore.getEffectiveHotbar();
  const officialSlots = {
    1: effectiveHotbar[0],
    2: effectiveHotbar[1],
    3: effectiveHotbar[2],
    4: effectiveHotbar[3],
  } as const;
  const orderDirty = Boolean(draftHotbar);
  const legacyExtraSkills = playerDef ? extraLegacySkillIds(playerDef.pack) : [];
  const original = labOriginalVisuals();
  const skillName = lastSkillId
    ? (getSkill(lastSkillId)?.name ?? lastSkillId)
    : playerId
      ? 'Vazio'
      : '—';
  const characterName = playerId ? characterLabLabel(playerId) : '—';
  const pendingSave = collectLabSaveChanges({
    characterName,
    skillName: lastSkillId ? skillName : undefined,
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    animationSpeed,
    vfxScale,
    vfxOffsetX,
    vfxOffsetY,
    targetMode,
    travelSpeed,
    vfxId,
    spawnOffsetX,
    spawnOffsetY,
    targetOffsetX,
    targetOffsetY,
    poseVfxId,
    poseScale,
    poseOffsetX,
    poseOffsetY,
    castDelayMs,
    castAnimationId,
    execution,
    statusEffects,
    skillElement,
    skillAi,
    areaImpactFxPerTarget,
    original: skillOriginals,
    sheetScaleDrafts,
    sheetScaleOriginals,
  });
  const activeSheetScale = useMemo(() => {
    if (!animPreviewSlot || !isBodyAnimSlot(animPreviewSlot) || !playerDef) return null;
    return (
      sheetScaleDrafts[animPreviewSlot] ??
      sheetScaleOriginals[animPreviewSlot] ??
      readSheetScale(playerDef.pack, animPreviewSlot)
    );
  }, [animPreviewSlot, sheetScaleDrafts, sheetScaleOriginals, playerDef]);
  const activeSheetScaleOriginal = useMemo(() => {
    if (!animPreviewSlot || !isBodyAnimSlot(animPreviewSlot)) return { scaleX: 1, scaleY: 1 };
    return sheetScaleOriginals[animPreviewSlot] ?? { scaleX: 1, scaleY: 1 };
  }, [animPreviewSlot, sheetScaleOriginals]);
  const [saveScope, setSaveScope] = useState<'all' | 'skill' | 'logic' | 'visual'>('all');
  const scopedSave = useMemo(() => {
    if (saveScope === 'all') return pendingSave;
    const lines = pendingSave.lines.filter((line) => {
      if (saveScope === 'logic') return line.group === 'Skill' || line.group === 'Status';
      if (saveScope === 'visual') {
        return (
          line.group === 'VFX' ||
          line.field === 'castDelayMs' ||
          line.field === 'execution'
        );
      }
      return true;
    });
    const changes: LabSaveChanges = {};
    for (const line of lines) {
      if (line.field === 'targetMode') changes.targetMode = line.value as SkillVfxTargetMode;
      else if (line.field === 'vfxId') changes.vfxId = (line.value as string | null) ?? null;
      else if (line.field === 'poseVfxId') changes.poseVfxId = (line.value as string | null) ?? null;
      else if (line.field === 'castAnimationId') changes.castAnimationId = (line.value as string | null) ?? null;
      else if (line.field === 'execution') changes.execution = line.value as LabSaveChanges['execution'];
      else if (line.field === 'statusEffects') changes.statusEffects = line.value as LabSaveChanges['statusEffects'];
      else if (line.field === 'element') changes.element = line.value as LabSaveChanges['element'];
      else if (line.field === 'ai') changes.ai = line.value as LabSaveChanges['ai'];
      else if (line.field === 'sheetScales') {
        changes.sheetScales = {
          ...changes.sheetScales,
          ...(line.value as NonNullable<LabSaveChanges['sheetScales']>),
        };
      }
      else changes[line.field as keyof LabSaveChanges] = line.value as never;
    }
    return { header: pendingSave.header, lines, changes };
  }, [pendingSave, saveScope]);
  const animName = friendlyLabAnimName(frameDebug?.anim);
  const vfxName = activeVfxKey ?? 'none';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (vfxEditor) {
          requestCloseVfxEditor();
          return;
        }
        characterLabStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, vfxEditor, vfxDefinitionDirty]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void ensureWonsrVfxCatalog().then(() => {
      if (!cancelled) setWonsrVfxGen((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const requestSelectSlot = (slot: LabSkillSlot) => {
    if (characterLabStore.selectSlot(slot)) {
      setPendingSlot(null);
      return;
    }
    setPendingSlot(slot);
  };

  const selectedSkillAnim = lastSkillId ? playerDef?.pack.skillAnims[lastSkillId] : undefined;
  const awakeningCtx = {
    characterId: playerId,
    awakeningLevel: previewAwakening,
    preview: true as const,
  };
  const effectiveSkill = lastSkillId ? resolveEffectiveSkill(lastSkillId, awakeningCtx) : undefined;
  const effectiveAnim = lastSkillId
    ? resolveEffectiveSkillAnim(selectedSkillAnim, lastSkillId, awakeningCtx)
    : undefined;
  const baseVfxId = selectedSkillAnim?.vfxId ?? null;
  const effectiveVfxId = effectiveAnim?.vfxId ?? baseVfxId;
  const visualTimeline = useMemo(() => {
    if (!selectedSkillAnim) return null;
    const catalog = vfxId ? getVfxDefinition(vfxId) : null;
    return skillVisualTimeline({
      ...selectedSkillAnim,
      frameCount: poseSheet?.frameCount ?? selectedSkillAnim.frameCount,
      frameRate: poseSheet?.frameRate ?? selectedSkillAnim.frameRate,
      frames: poseSheet?.frames ?? selectedSkillAnim.frames,
      url: poseSheet?.url || selectedSkillAnim.url,
      key: poseSheet?.key || selectedSkillAnim.key,
      castDelayMs,
      targeting: {
        mode: targetMode,
        travelSpeed,
        spawnOffsetX,
        spawnOffsetY,
        targetOffsetX,
        targetOffsetY,
      },
      fx:
        selectedSkillAnim.fx && catalog
          ? {
              ...selectedSkillAnim.fx,
              frameCount: catalog.frameCount ?? selectedSkillAnim.fx.frameCount,
              frameRate: catalog.frameRate ?? selectedSkillAnim.fx.frameRate,
            }
          : selectedSkillAnim.fx,
    });
  }, [
    selectedSkillAnim,
    poseSheet,
    vfxId,
    castDelayMs,
    targetMode,
    travelSpeed,
    spawnOffsetX,
    spawnOffsetY,
    targetOffsetX,
    targetOffsetY,
  ]);
  const editingVfx = editingVfxId ? getVfxDefinition(editingVfxId) : null;
  const skillOverrideDirty = characterLabStore.skillOverrideDirty();
  const skillLogicDirty = characterLabStore.hasUnsavedSkillLogic();
  const jutsuFpsDirty = characterLabStore.hasUnsavedJutsuFps();
  const skillVisualDirty = characterLabStore.hasUnsavedSkillVisual();
  const spriteDefinitionDirty = characterLabStore.hasUnsavedSpriteChanges();
  const skillOrderDirty = orderDirty;
  const catalogVfx = useMemo(() => {
    if (tab !== 'vfx') return [];
    const items = listVfxDefinitions().filter((def) => {
      if (vfxSource === 'catalog' && def.universe === 'wonsr') return false;
      if (vfxSource === 'wonsr-fx' && !def.id.startsWith(WONSR_FX_PREFIX)) return false;
      if (vfxSource === 'wonsr-aura' && !def.id.startsWith(WONSR_AURA_PREFIX)) return false;
      return def.id === lastCreatedVfxId || vfxMatchesQuery(def, vfxQuery);
    });
    const sorted = !lastCreatedVfxId
      ? items
      : [...items].sort((a, b) => Number(b.id === lastCreatedVfxId) - Number(a.id === lastCreatedVfxId));
    if (vfxSource === 'catalog') return sorted;
    return sorted.slice(0, vfxQuery.trim() ? 120 : 48);
  }, [tab, dataEpoch, wonsrVfxGen, vfxQuery, vfxSource, lastCreatedVfxId]);
  const dirtyAreas = labDirtyAreaLabels({
    skillLogic: skillLogicDirty,
    skillVisual: skillVisualDirty,
    sprite: spriteDefinitionDirty,
    order: skillOrderDirty,
    vfxDef: vfxDefinitionDirty,
  });

  const applyPendingVfxLeave = (leave: { nextId: string | null; intent: 'switch' | 'create' | 'close' }) => {
    setPendingVfxLeave(null);
    setVfxDefinitionDirty(false);
    if (leave.intent === 'close') {
      characterLabStore.setVfxEditorMode(null);
      return;
    }
    if (leave.intent === 'create') {
      characterLabStore.setEditingVfxId(null);
      setVfxDraftKey((n) => n + 1);
      characterLabStore.setVfxEditorMode('create');
      return;
    }
    characterLabStore.setEditingVfxId(leave.nextId);
    characterLabStore.setVfxEditorMode(leave.nextId ? 'edit' : null);
  };

  const requestCloseVfxEditor = () => {
    if (vfxEditor && vfxDefinitionDirty) {
      setPendingVfxLeave({ nextId: editingVfxId, intent: 'close' });
      return;
    }
    characterLabStore.setVfxEditorMode(null);
  };

  const selectEditingVfx = (id: string) => {
    if (vfxEditor && vfxDefinitionDirty && id !== editingVfxId) {
      setPendingVfxLeave({ nextId: id, intent: 'switch' });
      return;
    }
    characterLabStore.setEditingVfxId(id);
    if (vfxEditor === 'edit' || vfxEditor === 'duplicate') characterLabStore.setVfxEditorMode('edit');
  };

  const requestEditVfx = (id: string | null) => {
    if (vfxEditor && vfxDefinitionDirty && id !== editingVfxId) {
      setPendingVfxLeave({ nextId: id, intent: 'switch' });
      return;
    }
    characterLabStore.setEditingVfxId(id);
    if (id) characterLabStore.setVfxEditorMode('edit');
  };

  const requestCreateVfx = () => {
    if (vfxEditor && vfxDefinitionDirty) {
      setPendingVfxLeave({ nextId: null, intent: 'create' });
      return;
    }
    setVfxDraftKey((n) => n + 1);
    characterLabStore.setVfxEditorMode('create');
  };

  const applyEditingVfxToSkill = () => {
    if (!editingVfxId) return;
    characterLabStore.useVfxOnSelectedSkill(editingVfxId);
  };

  const openDraftNameModal = () => {
    const defaultName = 'Nova Skill';
    setSaveOpen(false);
    setDraftName(defaultName);
    setDraftId(playerId ? suggestLabSkillId(playerId, defaultName) : '');
    setDraftNameOpen(true);
  };

  const persistVisualSkill = async (
    draft?: { name: string; id: string },
    options?: { scope?: 'logic' | 'visual' | 'all' },
  ): Promise<boolean> => {
    if (!playerId) return false;
    if (!lastSkillId && !draft) {
      openDraftNameModal();
      return false;
    }
    const scope = options?.scope ?? 'all';
    saveLog('started', 'skill');
    setIsSavingSkill(true);
    setSaveError(null);
    try {
      const snap = characterLabStore.getSnapshot();
      const orig = snap.skillOriginals;
      const visual = scope === 'logic' ? orig : snap;
      const logic = scope === 'visual' ? orig : snap;
      const pose =
        scope === 'logic' &&
        snap.poseSheet &&
        orig.poseSheet &&
        snap.poseSheet.frameRate !== orig.poseSheet.frameRate
          ? { ...orig.poseSheet, frameRate: snap.poseSheet.frameRate }
          : visual.poseSheet;
      const payload = JSON.stringify({
          action: 'save-visual',
          characterId: playerId,
          slot: snap.selectedSkillSlot,
          slots: characterLabStore.getEffectiveHotbar(),
          skillId: snap.lastSkillId,
          existingAnim: selectedSkillAnim,
          name: draft?.name,
          id: draft?.id,
          pose: pose,
          vfxId: visual.vfxId,
          targetMode: visual.targetMode,
          travelSpeed: visual.travelSpeed,
          vfxScale: visual.vfxScale,
          vfxOffsetX: visual.vfxOffsetX,
          vfxOffsetY: visual.vfxOffsetY,
          vfxLoopMode: visual.vfxLoopMode,
          vfxLoopStartFrame: visual.vfxLoopStartFrame,
          vfxLoopEndFrame: visual.vfxLoopEndFrame,
          vfxLoopDurationMs: visual.vfxLoopDurationMs,
          vfxLoopUntilSkillEnd: visual.vfxLoopUntilSkillEnd,
          vfxFlipX: visual.vfxFlipX,
          vfxFlipY: visual.vfxFlipY,
          spawnOffsetX: visual.spawnOffsetX,
          spawnOffsetY: visual.spawnOffsetY,
          targetOffsetX: visual.targetOffsetX,
          targetOffsetY: visual.targetOffsetY,
          castDelayMs: logic.castDelayMs,
          execution: logic.execution,
          statusEffects: logic.statusEffects,
          element: logic.skillElement,
          ai: logic.skillAi,
          areaImpactFxPerTarget: logic.areaImpactFxPerTarget,
      });
      saveLog(`payload bytes ${payload.length}`, 'lab-skill');
      const started = performance.now();
      saveLog('request sent', 'lab-skill');
      const { res, json } = await fetchDevSaveJson<{
        success?: boolean;
        ok?: boolean;
        error?: string;
        skill?: SkillDefinition;
        skillAnim?: import('@/data/character-packs').CharacterSkillAnimDef;
        slots?: typeof effectiveHotbar;
        skillId?: string;
      }>('/api/dev/lab-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      saveLog(`frontend response received ${Math.round(performance.now() - started)}ms`, 'lab-skill');
      if (!res.ok || !json.ok || !json.slots || !json.skillId) {
        setSaveError(json.error ?? 'Erro ao salvar a Skill.');
        return false;
      }
      if (json.skill) upsertDevSkillDef(json.skill);
      upsertDevHotbar(playerId, json.slots);
      if (json.skillAnim) upsertDevSkillAnim(playerId, json.skillId, json.skillAnim);
      characterLabStore.markVisualsSaved({ skillOnly: true, scope });
      if (draft || scope === 'all') {
        characterLabStore.applySavedHotbar(json.slots, { selectSlot: snap.selectedSkillSlot });
      }
      setSaveOk('Salvo ✓');
      window.setTimeout(() => setSaveOk(null), 1800);
      setDraftNameOpen(false);
      saveLog('local state rebased', 'skill');
      saveLog(`completed in ${Math.round(performance.now() - started)}ms`, 'skill');
      return true;
    } catch (error: unknown) {
      console.error('[DEV lab-skill save-visual]', error);
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar a Skill.');
      return false;
    } finally {
      setIsSavingSkill(false);
    }
  };

  const persistLabChanges = async (
    scope: 'all' | 'skill' | 'logic' | 'visual' = saveScope,
  ): Promise<boolean> => {
    if (scope === 'logic') {
      const ok = await persistVisualSkill(undefined, { scope: 'logic' });
      if (ok) setSaveOpen(false);
      return ok;
    }
    if (scope === 'visual') {
      const ok = await persistVisualSkill(undefined, { scope: 'visual' });
      if (ok) setSaveOpen(false);
      return ok;
    }
    if (scope === 'skill') {
      const ok = await persistVisualSkill(undefined, { scope: 'all' });
      if (ok) setSaveOpen(false);
      return ok;
    }
    if (!playerId) return false;

    const skillDirty = characterLabStore.hasUnsavedSkillChanges();
    const spriteChanges = spriteOnlyLabChanges(pendingSave.changes);
    const hasSprite = hasLabSpriteChanges(spriteChanges);

    if (skillDirty) {
      const skillOk = await persistVisualSkill();
      if (!skillOk) return false;
    }

    if (!hasSprite) {
      setSaveOpen(false);
      return true;
    }

    setIsSavingSkill(true);
    setSaveError(null);
    try {
      const { res, json } = await fetchDevSaveJson<{
        ok?: boolean;
        file?: string;
        error?: string;
        detail?: string;
      }>('/api/dev/character-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: playerId,
          changes: spriteChanges,
        }),
      });
      if (!res.ok || !json.ok) {
        console.error('[DEV character-config]', json.detail ?? json.error);
        setSaveError('Erro ao salvar.\nNenhuma alteração foi aplicada.');
        return false;
      }
      characterLabStore.markVisualsSaved({ skillOnly: false });
      setSaveOk('Salvo ✓');
      window.setTimeout(() => setSaveOk(null), 1800);
      setSaveOpen(false);
      return true;
    } catch (error: unknown) {
      console.error('[DEV character-config]', error);
      setSaveError(
        error instanceof Error ? error.message : 'Erro ao salvar.\nNenhuma alteração foi aplicada.',
      );
      return false;
    } finally {
      setIsSavingSkill(false);
    }
  };

  const persistHotbar = async (): Promise<boolean> => {
    if (!playerId || !orderDirty) return true;
    setIsSavingSkill(true);
    setSaveError(null);
    try {
      const { res, json } = await fetchDevSaveJson<{
        ok?: boolean;
        error?: string;
        slots?: typeof effectiveHotbar;
      }>('/api/dev/lab-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', characterId: playerId, slots: effectiveHotbar }),
      });
      if (!res.ok || !json.ok || !json.slots) {
        setSaveError(json.error ?? 'Erro ao salvar a ordem.');
        return false;
      }
      upsertDevHotbar(playerId, json.slots);
      characterLabStore.applySavedHotbar(json.slots);
      return true;
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Erro ao salvar a ordem.');
      return false;
    } finally {
      setIsSavingSkill(false);
    }
  };

  const requestSelectPlayer = (id: string) => {
    if (!id || id === playerId) return;
    if (characterLabStore.hasUnsavedLabChanges()) {
      setPendingPlayer(id);
      return;
    }
    characterLabStore.applyPlayer(id);
  };

  const flushUnsavedThen = async (next: () => void) => {
    if (characterLabStore.hasUnsavedSkillChanges()) {
      const ok = await persistLabChanges('skill');
      if (!ok) return;
    }
    if (characterLabStore.hasUnsavedHotbarChanges()) {
      const ok = await persistHotbar();
      if (!ok) return;
    }
    next();
  };

  if (!isDevMode() || !isOpen) return null;

  return (
    <>
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`character-lab${isDragging ? ' is-dragging' : ''}${loopSkill ? ' is-looping' : ''}`}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="Character Test Lab"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="character-lab__head" title="Arrastar para mover" {...handleProps}>
        <h2 className="character-lab__title">Character Test Lab</h2>
        <button
          type="button"
          className="character-lab__icon-btn"
          data-no-drag
          aria-label="Fechar"
          onClick={() => characterLabStore.close()}
        >
          ×
        </button>
      </header>

      <div className="character-lab__sticky">
        <div className="character-lab__summary">
          <strong>{characterName}</strong>
          <span>
            Slot {selectedSkillSlot} · {skillName}
          </span>
        </div>
        <div className="character-lab__status">
            <span>
            Animation: {animName}
            {frameDebug && frameDebug.total > 0
              ? ` · Frame: ${frameDebug.frame} / ${frameDebug.total}`
              : null}
            {frameDebug?.actionLocked ? ' · Action Locked: YES' : ' · Action Locked: NO'}
          </span>
            <span>
            Execution: {executionDebug?.status ?? 'Idle'}
          </span>
          <span>VFX: {vfxName}</span>
        </div>
        {loopSkill ? (
          <div className="character-lab__loop is-on">
            Loop Skill: ON · Interval: {loopIntervalMs}ms
          </div>
        ) : null}
        <div className="character-lab__run">
          <button
            type="button"
            className="character-lab__run-btn"
            onClick={() => characterLabStore.playCompleteSkill()}
          >
            Executar Skill Completa
          </button>
        </div>
        <nav className="character-lab__tabs" aria-label="Seções">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={tab === entry.id ? 'is-active' : undefined}
              onClick={() => characterLabStore.setFlag('tab', entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="character-lab__body">
        {tab === 'geral' ? (
          <>
            <LabPreviewAwakening preview={previewAwakening} />
            <section className="character-lab__section">
              <label>
                Personagem
                <select
                  value={playerId ?? ''}
                  onChange={(event) => {
                    const id = event.target.value;
                    if (id) requestSelectPlayer(id);
                  }}
                >
                  <option value="">Selecionar…</option>
                  {characters.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {characterLabLabel(entry.id)}
                      {entry.active ? '' : ' (inativo)'}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Inimigo
                <select
                  value={enemyId ?? ''}
                  onChange={(event) => characterLabStore.setEnemy(event.target.value || null)}
                >
                  <option value="">Nenhum</option>
                  {characters.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {characterLabLabel(entry.id)}
                      {entry.active ? '' : ' (inativo)'}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="character-lab__section">
              <h3>Sessão de teste</h3>
              <button type="button" onClick={() => characterLabStore.basicAttack()}>
                Ataque básico
              </button>
              <button
                type="button"
                className="character-lab__run-btn"
                onClick={() => characterLabStore.playCompleteSkill()}
              >
                Executar Skill Completa
              </button>
              <label className={`character-lab__toggle${loopSkill ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={loopSkill}
                  onChange={(event) => characterLabStore.setFlag('loopSkill', event.target.checked)}
                />
                Loop Skill: {loopSkill ? 'ON' : 'OFF'}
              </label>
              <div className="character-lab__chips">
                {LOOP_INTERVALS.map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    className={loopIntervalMs === ms ? 'is-active' : undefined}
                    onClick={() => characterLabStore.setFlag('loopIntervalMs', ms)}
                  >
                    {ms} ms
                  </button>
                ))}
              </div>
              {loopSkill ? <p className="character-lab__hint">Interval: {loopIntervalMs}ms</p> : null}
            </section>

            <section className="character-lab__section">
              <h3>Sessão</h3>
              <p className="character-lab__hint">
                DEV SAVE isolado — fechar Lab restaura progresso oficial e reseta overrides.
              </p>
              <div className="character-lab__row">
                <button
                  type="button"
                  onClick={() => {
                    DEV_FLAGS.xpMultiplier = 110;
                    locationStore.reloadScene();
                  }}
                >
                  XP ×110
                </button>
                <button
                  type="button"
                  onClick={() => {
                    DEV_FLAGS.enemyHpMultiplier = 2;
                    locationStore.reloadScene();
                  }}
                >
                  Enemy HP ×2
                </button>
                <button
                  type="button"
                  onClick={() => {
                    DEV_FLAGS.forceHuntLevel = 1;
                    locationStore.reloadScene();
                  }}
                >
                  Force Hunt Lv1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    DEV_FLAGS.forceAllSkillsLevel1 = true;
                  }}
                >
                  Force Skills Lv1
                </button>
                <button
                  type="button"
                  onClick={() => {
                    characterLabStore.resetDevState();
                    locationStore.reloadScene();
                  }}
                >
                  RESET DEV STATE
                </button>
              </div>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={ignoreCooldown}
                  onChange={(event) => characterLabStore.setFlag('ignoreCooldown', event.target.checked)}
                />
                Ignorar Cooldown
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={infiniteChakra}
                  onChange={(event) => characterLabStore.setFlag('infiniteChakra', event.target.checked)}
                />
                Energia Infinita
              </label>
              <section className="character-lab__section">
                <h4>ENERGIA</h4>
                <p className="character-lab__hint">
                  Current {Math.floor(energyCurrent)} / Max {energyMax} · Cost default{' '}
                  {COMBAT_ENERGY.defaultSkillEnergyCost} · Gain/hit {COMBAT_ENERGY.energyGainPerBasicHit}{' '}
                  · Regen {energyRegenPerSecond}/s
                  {energyRegenFrozen ? ' (frozen)' : ''}
                </p>
                <div className="character-lab__actions">
                  <label>
                    Set Energy
                    <input
                      type="number"
                      min={0}
                      max={energyMax}
                      value={Math.floor(energyCurrent)}
                      onChange={(event) => combatEnergyStore.setEnergy(Number(event.target.value))}
                    />
                  </label>
                  <button type="button" onClick={() => combatEnergyStore.empty()}>
                    Empty Energy
                  </button>
                  <button type="button" onClick={() => combatEnergyStore.fill()}>
                    Full Energy
                  </button>
                </div>
                <div className="character-lab__actions">
                  <label>
                    Energy Regen / Second
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={energyRegenPerSecond}
                      onChange={(event) => {
                        const n = Number(event.target.value);
                        combatEnergyStore.setRegenPerSecond(Number.isFinite(n) ? n : null);
                      }}
                    />
                  </label>
                  <label className="character-lab__toggle">
                    <input
                      type="checkbox"
                      checked={energyRegenFrozen}
                      onChange={(event) => combatEnergyStore.setFreezePassiveRegen(event.target.checked)}
                    />
                    Freeze Passive Regen
                  </label>
                  <button type="button" onClick={() => combatEnergyStore.resetRegenSettings()}>
                    Reset Regen
                  </button>
                </div>
              </section>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={playerInvincible}
                  onChange={(event) => characterLabStore.setFlag('playerInvincible', event.target.checked)}
                />
                Player Invincible
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={enemyInvincible}
                  onChange={(event) => characterLabStore.setFlag('enemyInvincible', event.target.checked)}
                />
                Enemy Invincible
              </label>
              <label>
                HP do inimigo
                <select
                  value={enemyHpMode}
                  onChange={(event) =>
                    characterLabStore.setFlag('enemyHpMode', event.target.value as LabEnemyHpMode)
                  }
                >
                  {HP_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Inimigos (área)
                <select
                  value={labEnemyCount}
                  disabled={!enemyId}
                  onChange={(event) =>
                    characterLabStore.setFlag(
                      'labEnemyCount',
                      clampLabEnemyCount(Number(event.target.value)),
                    )
                  }
                >
                  {LAB_ENEMY_COUNT_OPTIONS.map((count) => (
                    <option key={count} value={count}>
                      {count} {count === 1 ? 'inimigo' : 'inimigos'}
                    </option>
                  ))}
                </select>
              </label>
              <p className="character-lab__hint">
                O inimigo central é o alvo primário; os extras ficam ao lado para testar jutsus de área.
              </p>
              <label>
                Distância
                <select
                  value={distance}
                  onChange={(event) =>
                    characterLabStore.setFlag('distance', event.target.value as LabDistancePreset)
                  }
                >
                  {DISTANCE_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <h3>Game Speed</h3>
              <div className="character-lab__chips">
                {GAME_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    className={gameSpeed === speed ? 'is-active' : undefined}
                    onClick={() => characterLabStore.setVisual('gameSpeed', speed)}
                  >
                    {speed}×
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => characterLabStore.resetTest()}>
                Reset Test
              </button>
            </section>
          </>
        ) : null}

        {tab === 'skills' ? (
          <>
            <LabPreviewAwakening preview={previewAwakening} />
            {lastSkillId ? (
              <section className="character-lab__section">
                <h4>Awakening Override</h4>
                <p>
                  BASE {getSkill(lastSkillId)?.name ?? lastSkillId}
                  {baseVfxId ? ` · VFX: ${baseVfxId}` : ''}
                  {` · dmg ${getSkill(lastSkillId)?.damage ?? '—'}`}
                </p>
                <p>
                  AWAKENING {previewAwakening === 0 ? 'Base' : ['I', 'II', 'III'][previewAwakening - 1]}
                  {' · '}
                  {effectiveSkill?.name ?? lastSkillId}
                  {effectiveVfxId ? ` · VFX: ${effectiveVfxId}` : ''}
                  {effectiveSkill?.execution
                    ? ` · Execution: ${formatExecutionTypesLabel(effectiveSkill.execution)}`
                    : ''}
                  {effectiveSkill ? ` · dmg ${effectiveSkill.damage}` : ''}
                </p>
              </section>
            ) : null}
            <CharacterLabSkillsTab
            playerId={playerId}
            pack={playerDef?.pack ?? null}
            slots={effectiveHotbar}
            selectedSlot={selectedSkillSlot}
            orderDirty={skillOrderDirty}
            saveBusy={isSavingSkill}
            onSelectSlot={requestSelectSlot}
            onEditSlot={(slot) => {
              if (!characterLabStore.selectSlot(slot, { force: false })) {
                setPendingSlot(slot);
                return;
              }
            }}
            onSaved={(message) => {
              setSaveOk(message);
              window.setTimeout(() => setSaveOk(null), 1800);
            }}
            onError={(message) => setSaveError(message)}
          />
            <CharacterLabSkillLogic
              characterName={characterName}
              selectedSlot={selectedSkillSlot}
              lastSkillId={lastSkillId}
              skillName={skillName}
              saveBusy={isSavingSkill}
              logicDirty={skillLogicDirty || jutsuFpsDirty}
              onManageStatus={() => setStatusLibraryOpen(true)}
              onSave={() => {
                if (!lastSkillId) {
                  openDraftNameModal();
                  return;
                }
                setSaveError(null);
                setSaveOk(null);
                setSaveScope('logic');
                setSaveOpen(true);
              }}
            />
          </>
        ) : null}

        {tab === 'sprite' ? (
          <>
          <section className="character-lab__section">
            <h3>Animações</h3>
            <p className="character-lab__hint">Como o personagem aparece. VFX da Skill fica na aba VFX.</p>
            <div className="character-lab__chips">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  className={animPreviewSlot === slot ? 'is-active' : undefined}
                  onClick={() => characterLabStore.playSlot(slot)}
                >
                  {SLOT_LABELS[slot] ?? slot}
                </button>
              ))}
            </div>
            {activeSheetScale && animPreviewSlot && isBodyAnimSlot(animPreviewSlot) ? (
              <>
                <h3>Escala desta animação ({SLOT_LABELS[animPreviewSlot]})</h3>
                <p className="character-lab__hint">
                  Só esta folha — não muda Scale X/Y do corpo inteiro abaixo.
                </p>
                <ValueRow
                  label="Sheet Scale X"
                  original={activeSheetScaleOriginal.scaleX}
                  value={activeSheetScale.scaleX}
                  presets={SCALE_PRESETS}
                  step={0.05}
                  onChange={(value) => characterLabStore.setSheetScale('scaleX', value)}
                />
                <ValueRow
                  label="Sheet Scale Y"
                  original={activeSheetScaleOriginal.scaleY}
                  value={activeSheetScale.scaleY}
                  presets={SCALE_PRESETS}
                  step={0.05}
                  onChange={(value) => characterLabStore.setSheetScale('scaleY', value)}
                />
              </>
            ) : (
              <p className="character-lab__hint">
                Clique Idle, Walk, Combo… para ajustar a escala só dessa sprite.
              </p>
            )}
            {labPoseHasContent(poseSheet) && poseSheet ? (
              <>
                <h3>Pose da Skill selecionada</h3>
                <p className="character-lab__hint">{poseSheet.key}</p>
                <ValueRow
                  label="Frame Width"
                  original={skillOriginals.poseSheet?.frameWidth ?? poseSheet.frameWidth}
                  value={poseSheet.frameWidth}
                  presets={[32, 48, 64, 96, 128]}
                  step={1}
                  onChange={(value) =>
                    characterLabStore.patchPoseSheet({ frameWidth: Math.max(1, Math.round(value)) })
                  }
                />
                <ValueRow
                  label="Frame Height"
                  original={skillOriginals.poseSheet?.frameHeight ?? poseSheet.frameHeight}
                  value={poseSheet.frameHeight}
                  presets={[32, 48, 64, 96, 128]}
                  step={1}
                  onChange={(value) =>
                    characterLabStore.patchPoseSheet({ frameHeight: Math.max(1, Math.round(value)) })
                  }
                />
                <ValueRow
                  label="Frame Count"
                  original={skillOriginals.poseSheet?.frameCount ?? poseSheet.frameCount}
                  value={poseSheet.frameCount}
                  presets={[1, 2, 4, 6, 8, 12]}
                  step={1}
                  onChange={(value) =>
                    characterLabStore.patchPoseSheet({ frameCount: Math.max(1, Math.round(value)) })
                  }
                />
                <ValueRow
                  label="FPS"
                  original={skillOriginals.poseSheet?.frameRate ?? poseSheet.frameRate}
                  value={poseSheet.frameRate}
                  presets={[8, 10, 12, 15, 24, 30]}
                  step={1}
                  onChange={(value) =>
                    characterLabStore.patchPoseSheet({ frameRate: Math.max(1, Math.round(value)) })
                  }
                />
                <label className="character-lab__toggle">
                  <input
                    type="checkbox"
                    checked={poseSheet.loop}
                    onChange={(event) => characterLabStore.patchPoseSheet({ loop: event.target.checked })}
                  />
                  Loop
                </label>
                <p className="character-lab__hint">
                  Scale/Offset da Pose específica da Skill ficam na aba VFX. Salvar esses frames usa
                  Salvar Alterações da Skill na aba VFX.
                </p>
              </>
            ) : (
              <p className="character-lab__hint">
                Nenhuma Pose da Skill selecionada. Escolha ou importe na aba VFX.
              </p>
            )}
            <h3>Corpo do personagem</h3>
            <ValueRow
              label="Scale X"
              original={original.scaleX}
              value={scaleX}
              presets={SCALE_PRESETS}
              step={0.05}
              onChange={(value) => characterLabStore.setVisual('scaleX', value)}
            />
            <ValueRow
              label="Scale Y"
              original={original.scaleY}
              value={scaleY}
              presets={SCALE_PRESETS}
              step={0.05}
              onChange={(value) => characterLabStore.setVisual('scaleY', value)}
            />
            <ValueRow
              label="Offset X"
              original={original.offsetX}
              value={offsetX}
              presets={OFFSET_PRESETS}
              step={1}
              onChange={(value) => characterLabStore.setVisual('offsetX', value)}
            />
            <ValueRow
              label="Offset Y"
              original={original.offsetY}
              value={offsetY}
              presets={OFFSET_PRESETS}
              step={1}
              onChange={(value) => characterLabStore.setVisual('offsetY', value)}
            />
            <h3>Animation Speed</h3>
            <div className="character-lab__chips">
              {ANIM_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={animationSpeed === speed ? 'is-active' : undefined}
                  onClick={() => characterLabStore.setVisual('animationSpeed', speed)}
                >
                  {speed}×
                </button>
              ))}
            </div>
            <div className="character-lab__actions">
              <button type="button" onClick={() => characterLabStore.restoreSprite()}>
                Reset Sprite
              </button>
              <button type="button" onClick={() => characterLabStore.restoreVisuals()}>
                Restore Original
              </button>
            </div>
          </section>
          <CharacterLabSpriteAlignment alignmentDebug={alignmentDebug} />
          </>
        ) : null}

        {tab === 'vfx' ? (
          <>
          <LabPreviewAwakening preview={previewAwakening} />
          <section className="character-lab__section">
            <div className="character-lab__vfx-status">
              <p>
                <strong>PERSONAGEM</strong>
                {characterName}
              </p>
              <p>
                <strong>SLOT</strong>
                {selectedSkillSlot}
              </p>
              <p>
                <strong>SKILL</strong>
                {skillName}
              </p>
              <p>
                <strong>ANIMAÇÃO POSE</strong>
                {poseSheet?.key || 'Nenhuma'}
              </p>
              <p>
                <strong>VFX Efeito</strong>
                {labSkillVfxLabel(vfxId, selectedSkillAnim)}
                {' · '}
                Original: {labSkillVfxLabel(skillOriginals.vfxId, selectedSkillAnim)}
                {skillOverrideDirty ? ' · alterações do Slot' : ''}
              </p>
              <p>
                <strong>Base VFX</strong>
                {labSkillVfxLabel(baseVfxId, selectedSkillAnim)}
              </p>
              <p>
                <strong>Effective VFX</strong>
                {labSkillVfxLabel(effectiveVfxId, effectiveAnim)}
                {previewAwakening > 0 ? ` · Preview ${['I', 'II', 'III'][previewAwakening - 1]}` : ' · Base'}
              </p>
              <p>
                <strong>Cast Delay</strong>
                {castDelayMs} ms
              </p>
              <p>
                <strong>Tipo de execução</strong>
                {formatExecutionTypesLabel(execution)}
              </p>
              <p>
                <strong>VFX EM EDIÇÃO</strong>
                {editingVfx?.name ?? editingVfxId ?? 'nenhum'}
                {vfxDefinitionDirty ? ' · alterações no VFX global' : ''}
              </p>
            </div>

            <h3>SLOT</h3>
            <LabSkillSlotChips
              packSlots={officialSlots}
              selectedSlot={selectedSkillSlot}
              onSelect={requestSelectSlot}
            />

            <CharacterLabPoseEffect
              playerId={playerId}
              pack={playerDef?.pack ?? null}
              selectedSlot={selectedSkillSlot}
              lastSkillId={lastSkillId}
              skillName={skillName}
              enemyId={enemyId}
              catalogVfx={catalogVfx}
              vfxQuery={vfxQuery}
              vfxSource={vfxSource}
              onVfxQuery={setVfxQuery}
              onVfxSource={setVfxSource}
              saveBusy={isSavingSkill}
              skillOverrideDirty={skillOverrideDirty}
              skillLogicDirty={skillLogicDirty}
              onRequestCreateVfx={requestCreateVfx}
              onSave={() => {
                if (!lastSkillId) {
                  openDraftNameModal();
                  return;
                }
                setSaveError(null);
                setSaveOk(null);
                setSaveScope('visual');
                setSaveOpen(true);
              }}
              onEditSprite={() => characterLabStore.setFlag('tab', 'sprite')}
              onError={(message) => setSaveError(message)}
            />

            <div className="character-lab__subpanel">
              <h3>VFX Global</h3>
              <p className="character-lab__hint">
                Asset, frames, FPS, Loop e Default Scale pertencem à VfxDefinition. Salvar VFX não
                associa ao slot.
              </p>
              <h4>VFX selecionado para edição</h4>
              <p className="character-lab__hint">{editingVfx?.name ?? editingVfxId ?? 'nenhum'}</p>
              <div className="character-lab__chips">
                {catalogVfx.map((def) => (
                  <button
                    key={`edit-${def.id}`}
                    type="button"
                    className={editingVfxId === def.id ? 'is-active' : undefined}
                    onClick={() => selectEditingVfx(def.id)}
                  >
                    {def.name}
                  </button>
                ))}
              </div>
              <div className="character-lab__actions">
                <button type="button" onClick={() => requestCreateVfx()}>
                  + Novo VFX
                </button>
                <button
                  type="button"
                  disabled={!editingVfxId}
                  onClick={() => editingVfxId && requestEditVfx(editingVfxId)}
                >
                  Editar VFX
                </button>
                <button
                  type="button"
                  disabled={!editingVfxId}
                  onClick={() => characterLabStore.setVfxEditorMode('duplicate')}
                >
                  Duplicar VFX
                </button>
                <button
                  type="button"
                  disabled={!editingVfxId}
                  onClick={() => applyEditingVfxToSkill()}
                >
                  Usar nesta Skill
                </button>
                <button
                  type="button"
                  disabled={!editingVfxId}
                  onClick={() => {
                    if (!editingVfxId) return;
                    setDeleteError(null);
                    void fetchDevSave('/api/dev/vfx/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'delete', id: editingVfxId }),
                    })
                      .then(async (res) => {
                        const json = (await res.json()) as {
                          ok?: boolean;
                          error?: string;
                          usedBy?: { characterId: string; skillId: string }[];
                        };
                        if (json.ok) {
                          const deleted = editingVfxId;
                          removeDevVfx(deleted);
                          characterLabStore.setEditingVfxId(null);
                          characterLabStore.noteRuntimeUpdated();
                          if (vfxId === deleted) characterLabStore.useVfxOnSelectedSkill(null);
                          return;
                        }
                        if (json.usedBy?.length) {
                          setDeleteError(
                            `Este VFX é utilizado por:\n${json.usedBy
                              .map(
                                (hit) =>
                                  `${characterLabLabel(hit.characterId)} — ${getSkill(hit.skillId)?.name ?? hit.skillId}`,
                              )
                              .join('\n')}`,
                          );
                          return;
                        }
                        setDeleteError(json.error ?? 'Não foi possível excluir.');
                      })
                      .catch(() => setDeleteError('Não foi possível excluir.'));
                  }}
                >
                  Excluir VFX
                </button>
              </div>
              {deleteError ? <p className="character-lab__hint is-error">{deleteError}</p> : null}
            </div>
          </section>
          </>
        ) : null}

        {tab === 'mapas' ? (
          <>
            <CharacterLabMapViewport />
            <CharacterLabHubEffects />
          </>
        ) : null}

        {tab === 'debug' ? (
          <>
            <CharacterLabXpAnalyzer />
            <CharacterLabQualityTester />
            <section className="character-lab__section">
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showFrameDebug}
                  onChange={(event) => characterLabStore.setFlag('showFrameDebug', event.target.checked)}
                />
                Show Frame Debug
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showHitTiming}
                  onChange={(event) => characterLabStore.setFlag('showHitTiming', event.target.checked)}
                />
                Show Hit Timing
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showHitbox}
                  onChange={(event) => characterLabStore.setFlag('showHitbox', event.target.checked)}
                />
                Show Hitbox
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showHurtbox}
                  onChange={(event) => characterLabStore.setFlag('showHurtbox', event.target.checked)}
                />
                Show Hurtbox
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showSpriteOrigin}
                  onChange={(event) => characterLabStore.setFlag('showSpriteOrigin', event.target.checked)}
                />
                Show Sprite Origin
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showVfxOrigin}
                  onChange={(event) => characterLabStore.setFlag('showVfxOrigin', event.target.checked)}
                />
                Show VFX Origin
              </label>
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showAreaRadius}
                  onChange={(event) => characterLabStore.setFlag('showAreaRadius', event.target.checked)}
                />
                Show Area Radius
              </label>
              {frameDebug ? (
                <div className="character-lab__exec-debug">
                  <h3>Animação</h3>
                  <p>
                    <strong>Animation ID</strong> {frameDebug.anim}
                  </p>
                  <p>
                    <strong>Friendly Name</strong> {friendlyLabAnimName(frameDebug.anim)}
                  </p>
                  <p>
                    <strong>Frame atual</strong> {frameDebug.frame} / {frameDebug.total}
                  </p>
                  <p>
                    <strong>Frame Count</strong> {frameDebug.total}
                  </p>
                  <p>
                    <strong>FPS</strong> {poseSheet?.frameRate ?? selectedSkillAnim?.frameRate ?? '—'}
                  </p>
                  <p>
                    <strong>Animation Duration</strong> {frameDebug.timeMs}ms
                  </p>
                </div>
              ) : null}
              {visualTimeline ? (
                <div className="character-lab__exec-debug">
                  <p>
                    <strong>POSE</strong> 0ms → {visualTimeline.poseDurationMs}ms · {visualTimeline.poseFps} FPS
                  </p>
                  <p>
                    <strong>EFFECT START</strong> {visualTimeline.effectStartMs}ms
                  </p>
                  <p>
                    <strong>EFFECT END</strong> {visualTimeline.effectEndMs}ms · {visualTimeline.effectFps} FPS ·{' '}
                    {visualTimeline.effectDurationMs}ms
                  </p>
                  <p>
                    <strong>EXECUTION END</strong> {visualTimeline.executionEndMs}ms
                  </p>
                  {visualTimeline.travelSpeed != null ? (
                    <p>
                      <strong>TRAVEL SPEED</strong> {visualTimeline.travelSpeed} px/s
                    </p>
                  ) : null}
                  <p>
                    Cast Delay: {visualTimeline.castDelayMs}ms
                  </p>
                </div>
              ) : null}
              {statusDebug.length > 0 ? (
                <div className="character-lab__exec-debug">
                  {statusDebug.map((row) => (
                    <p key={row.instanceId}>
                      {row.name} · Stacks: {row.stacks} · Remaining: {(row.remainingMs / 1000).toFixed(1)}s
                      {row.nextTickMs != null ? ` · Next Tick: ${(row.nextTickMs / 1000).toFixed(1)}s` : ''}
                    </p>
                  ))}
                </div>
              ) : null}
              {executionDebug ? (
                <div className="character-lab__exec-debug">
                  <h3>Skill Execution</h3>
                  <p>
                    <strong>SLOT</strong> {selectedSkillSlot}
                  </p>
                  <p>
                    <strong>SKILL ID</strong> {lastSkillId ?? '—'}
                  </p>
                  <p>
                    <strong>Execution Phase</strong> {executionDebug.status}
                  </p>
                  {executionDebug.hitMax > 0 ? (
                    <p>
                      Hit {executionDebug.currentHit} / {executionDebug.hitMax}
                    </p>
                  ) : null}
                  {executionDebug.tickMax > 0 ? (
                    <p>
                      Ticks: {executionDebug.tick} / {executionDebug.tickMax}
                    </p>
                  ) : null}
                  {executionDebug.durationMs > 0 ? (
                    <p>
                      Elapsed: {(executionDebug.elapsedMs / 1000).toFixed(1)} /{' '}
                      {(executionDebug.durationMs / 1000).toFixed(1)}s
                    </p>
                  ) : null}
                </div>
              ) : null}
              <CharacterLabResistPanel />
              <CharacterLabDamageDebug />
              <CharacterLabMasteryDebug />
              <CharacterLabLineageDebug />
              <CharacterLabAchievementsDebug />
              <CharacterLabMissionsDebug />
              <CharacterLabDailyLoginDebug />
              <CharacterLabGameCycleDebug />
              <CharacterLabBossDebug />
              <CharacterLabRankingDebug />
              <CharacterLabGuildDebug />
              <CharacterLabGuildBossDebug />
              <CharacterLabGuildShopDebug />
              <CharacterLabWorldBossDebug />
              <CharacterLabEconomyDebug />
              <CharacterLabAwakeningDebug />
              <CharacterLabAiDebug />
              <CharacterLabLootEconomyAnalyzer />
              <CharacterLabCaptureInspector />
              <ForceTargetDebug />
              <label className="character-lab__toggle">
                <input
                  type="checkbox"
                  checked={showLog}
                  onChange={(event) => characterLabStore.setFlag('showLog', event.target.checked)}
                />
                Event log
              </label>
            </section>
            {showLog ? (
              <section className="character-lab__section">
                <h3>Console</h3>
                <ol className="character-lab__log">
                  {events.map((entry, index) => (
                    <li key={`${entry.t}-${index}`}>
                      [{formatLabTime(entry.t)}] {entry.text}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </>
        ) : null}
      </div>

      <section className="character-lab__actions character-lab__footer">
        <button
          type="button"
          onClick={() => {
            characterLabStore.copyVisualSettings();
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
            {copied ? 'Copiado!' : 'Copy Current Visual Settings'}
        </button>
        <button type="button" onClick={() => characterLabStore.restoreVisuals()}>
          Restore Original
        </button>
        <button type="button" onClick={() => characterLabStore.resetTest()}>
          Reset Test
        </button>
      </section>

      <section className="character-lab__save">
        <button
          type="button"
          className="character-lab__save-btn"
          disabled={!playerId || (pendingSave.lines.length === 0 && !skillOverrideDirty) || isSavingSkill}
          onClick={() => {
            setSaveError(null);
            setSaveOk(null);
            setSaveScope('all');
            setSaveOpen(true);
            if (!playerId) return;
            void fetch(`/api/dev/character-config?characterId=${encodeURIComponent(playerId)}`)
              .then(async (res) => {
                if (!res.ok) return;
                const json = (await res.json()) as { source?: string };
                if (json.source) setSourcePath(json.source);
              })
              .catch(() => {
                // o POST ainda tenta localizar o arquivo
              });
          }}
        >
          Salvar no Código
        </button>
        {saveOk ? <p className="character-lab__hint is-ok">{saveOk}</p> : null}
        {saveError ? <p className="character-lab__hint is-error">{saveError}</p> : null}
        {saveOpen ? (
          <div className="character-lab__confirm" role="alertdialog" aria-label="Confirmar alterações">
            <strong>
              {saveScope === 'logic'
                ? 'Alterações lógicas da Skill'
                : saveScope === 'visual'
                  ? 'Overrides visuais da Skill'
                  : 'Alterações detectadas'}
            </strong>
            {scopedSave.header ? <p className="character-lab__hint">{scopedSave.header}</p> : null}
            {sourcePath ? <p className="character-lab__hint">Arquivo: {sourcePath}</p> : null}
            {!lastSkillId && skillOverrideDirty ? (
              <p className="character-lab__hint">
                Nova Skill: será pedido Nome e ID antes de gravar pose/efeito.
              </p>
            ) : null}
            <pre className="character-lab__diff">
              {formatSaveDiff(scopedSave.lines) ||
                (skillOverrideDirty ? 'Pose / efeito da skill selecionada.' : '')}
            </pre>
            <div className="character-lab__actions">
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={isSavingSkill || !playerId}
                onClick={() => {
                  void persistLabChanges();
                }}
              >
                {isSavingSkill ? 'Salvando...' : 'Confirmar alterações'}
              </button>
              <button
                type="button"
                disabled={isSavingSkill}
                onClick={() => {
                  setSaveOpen(false);
                  setSaveError(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {pendingSlot ? (
          <div className="character-lab__confirm" role="alertdialog" aria-label="Alterações não salvas">
            <strong>
              {lastSkillId
                ? `Existem alterações não salvas no Slot ${selectedSkillSlot}.`
                : `Existem alterações não salvas na nova Skill do Slot ${selectedSkillSlot}.`}
            </strong>
            {dirtyAreas.length > 0 ? (
              <>
                <p className="character-lab__hint">Existem alterações não salvas em:</p>
                <ul className="character-lab__hint">
                  {dirtyAreas.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              </>
            ) : null}
            <div className="character-lab__actions">
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={isSavingSkill}
                onClick={() => {
                  if (!lastSkillId) {
                    openDraftNameModal();
                    return;
                  }
                  void persistVisualSkill().then((ok) => {
                    if (!ok) return;
                    characterLabStore.selectSlot(pendingSlot, { force: true });
                    setPendingSlot(null);
                  });
                }}
              >
                Salvar
              </button>
              <button
                type="button"
                disabled={isSavingSkill}
                onClick={() => {
                  characterLabStore.selectSlot(pendingSlot, { force: true });
                  setPendingSlot(null);
                }}
              >
                Descartar
              </button>
              <button type="button" disabled={isSavingSkill} onClick={() => setPendingSlot(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {draftNameOpen ? (
          <div className="character-lab__confirm" role="dialog" aria-label="Nova Skill">
            <strong>Nova Skill</strong>
            <label className="character-lab__confirm-field">
              Nome
              <input
                type="text"
                autoFocus
                value={draftName}
                onChange={(event) => {
                  const name = event.target.value;
                  setDraftName(name);
                  if (!draftId || (playerId && draftId === suggestLabSkillId(playerId, draftName))) {
                    setDraftId(playerId ? suggestLabSkillId(playerId, name) : '');
                  }
                }}
                placeholder="Suiton: Suiryūdan"
              />
            </label>
            <label className="character-lab__confirm-field">
              ID
              <input
                type="text"
                value={draftId}
                onChange={(event) => setDraftId(event.target.value.toLowerCase())}
                placeholder="kisame-suiton-suiryudan"
              />
            </label>
            <p className="character-lab__hint">Slot: {selectedSkillSlot}</p>
            <div className="character-lab__actions">
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={isSavingSkill || !draftName.trim() || !draftId.trim()}
                onClick={() => {
                  void persistVisualSkill({ name: draftName, id: draftId }).then((ok) => {
                    if (!ok) return;
                    if (pendingSlot) {
                      characterLabStore.selectSlot(pendingSlot, { force: true });
                      setPendingSlot(null);
                    }
                  });
                }}
              >
                {isSavingSkill ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" disabled={isSavingSkill} onClick={() => setDraftNameOpen(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {pendingPlayer ? (
          <div className="character-lab__confirm" role="alertdialog" aria-label="Alterações não salvas">
            <strong>Existem alterações não salvas.</strong>
            {dirtyAreas.length > 0 ? (
              <>
                <p className="character-lab__hint">Existem alterações não salvas em:</p>
                <ul className="character-lab__hint">
                  {dirtyAreas.map((area) => (
                    <li key={area}>{area}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="character-lab__hint">Salve ou descarte antes de trocar de personagem.</p>
            )}
            <div className="character-lab__actions">
              <button
                type="button"
                className="character-lab__save-btn"
                disabled={isSavingSkill}
                onClick={() => {
                  const nextId = pendingPlayer;
                  void flushUnsavedThen(() => {
                    characterLabStore.applyPlayer(nextId);
                    setPendingPlayer(null);
                  });
                }}
              >
                Salvar
              </button>
              <button
                type="button"
                disabled={isSavingSkill}
                onClick={() => {
                  characterLabStore.restoreVfx();
                  characterLabStore.setDraftHotbar(null);
                  characterLabStore.applyPlayer(pendingPlayer);
                  setPendingPlayer(null);
                }}
              >
                Descartar
              </button>
              <button type="button" disabled={isSavingSkill} onClick={() => setPendingPlayer(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
    {statusLibraryOpen ? (
      <div className="character-lab__confirm" role="dialog" aria-label="Status Library">
        <strong>STATUS LIBRARY</strong>
        <button type="button" onClick={() => setStatusLibraryOpen(false)}>
          Fechar
        </button>
        <CharacterLabStatusLibrary />
      </div>
    ) : null}
    {vfxEditor ? (
      <VfxEditorModal
        key={`${vfxEditor}-${vfxEditor === 'create' || vfxEditor === 'duplicate' ? `draft-${vfxDraftKey}` : editingVfxId ?? 'none'}`}
        mode={vfxEditor}
        sourceId={vfxEditor === 'create' ? null : editingVfxId}
        canAssociate={Boolean(playerId)}
        associateLabel={`Usar no Slot ${selectedSkillSlot}`}
        pendingLeave={pendingVfxLeave}
        onDirtyChange={setVfxDefinitionDirty}
        onClose={requestCloseVfxEditor}
        onSaved={(id, options) => {
          characterLabStore.setEditingVfxId(id);
          characterLabStore.noteRuntimeUpdated();
          setLastCreatedVfxId(id);
          setVfxQuery('');
          if (options?.associate) characterLabStore.useVfxOnSelectedSkill(id);
          if (options?.keepOpen) return;
          characterLabStore.setVfxEditorMode(null);
          setVfxDefinitionDirty(false);
        }}
        onLeaveDecision={(action) => {
          if (action === 'cancel') {
            setPendingVfxLeave(null);
            return;
          }
          if (pendingVfxLeave) applyPendingVfxLeave(pendingVfxLeave);
        }}
      />
    ) : null}
    </>
  );
}

/** Gate: o body pesado só monta com o lab aberto (hooks/listas não correm no HUD). */
export function CharacterTestLabPanel() {
  const isOpen = useStore(characterLabStore, (s) => s.isOpen);
  if (!isDevMode() || !isOpen) return null;
  return <CharacterTestLabBody />;
}

function LabSkillSlotChips({
  packSlots,
  selectedSlot,
  onSelect,
}: {
  packSlots: Record<LabSkillSlot, string | null> | null;
  selectedSlot: LabSkillSlot;
  onSelect: (slot: LabSkillSlot) => void;
}) {
  return (
    <div className="character-lab__chips" role="tablist" aria-label="Slots de Skill">
      {LAB_SKILL_SLOTS.map((slot) => {
        const skillId = packSlots?.[slot] ?? null;
        const skill = skillId ? getSkill(skillId) : undefined;
        const name = skill?.name ?? (skillId || 'Vazio');
        const elementLabel = skill ? DAMAGE_ELEMENT_LABELS[resolveSkillElement(skill)] : null;
        return (
          <button
            key={slot}
            type="button"
            className={selectedSlot === slot ? 'is-active' : undefined}
            onClick={() => onSelect(slot)}
          >
            SLOT {slot}
            {skillId ? ` — ${name}` : ' — Vazio'}
            {elementLabel ? ` · ${elementLabel}` : ''}
          </button>
        );
      })}
    </div>
  );
}

function formatSaveDiff(lines: ReturnType<typeof collectLabSaveChanges>['lines']): string {
  const groups = ['Sprite', 'Animation', 'VFX', 'Status', 'Skill'] as const;
  const chunks: string[] = [];
  for (const group of groups) {
    const items = lines.filter((line) => line.group === group);
    if (items.length === 0) continue;
    chunks.push(group);
    for (const item of items) {
      chunks.push(`${item.label}: ${item.from} → ${item.to}`);
    }
    chunks.push('');
  }
  return chunks.join('\n').trim();
}

function CharacterLabAiDebug() {
  const showAiDecisions = useStore(characterLabStore, (s) => s.showAiDecisions);
  const decision = useStore(characterLabStore, (s) => s.aiDecision);
  const rotation = useStore(characterLabStore, (s) => s.skillRotationDebug);
  return (
    <section className="character-lab__section">
      <h4>SKILL ROTATION</h4>
      {rotation ? (
        <div className="character-lab__exec-debug">
          <p>
            <strong>Next Slot</strong> {rotation.nextSlot}
          </p>
          <p>
            <strong>Last Used</strong>{' '}
            {rotation.lastUsedSlot ? `Slot ${rotation.lastUsedSlot}` : '—'}
          </p>
          <p>
            <strong>Available</strong>
          </p>
          {rotation.slots.map((row) => (
            <p key={row.slot}>
              Slot {row.slot} {row.status}
            </p>
          ))}
          <p>
            <strong>Decision</strong> {rotation.decision}
          </p>
        </div>
      ) : (
        <p className="character-lab__hint">
          A rotação aparece durante a Hunt. Kill/respawn não resetam o cursor; Hunt nova ou
          troca de personagem voltam ao Slot 1.
        </p>
      )}
      <h4>Show AI Decisions</h4>
      <label className="character-lab__toggle">
        <input
          type="checkbox"
          checked={showAiDecisions}
          onChange={(event) => characterLabStore.setFlag('showAiDecisions', event.target.checked)}
        />
        Mostrar decisões da IA (Hunt)
      </label>
      <p className="character-lab__hint">
        O Test Lab não corre a IA automaticamente. A Hunt usa o Decision Engine.
      </p>
      {showAiDecisions && decision ? (
        <pre className="character-lab__hint">{formatCombatAiDecision(decision).join('\n')}</pre>
      ) : null}
    </section>
  );
}

function ForceTargetDebug() {
  const targetMode = useStore(characterLabStore, (s) => s.targetMode);
  const showVfxPath = useStore(characterLabStore, (s) => s.showVfxPath);
  const travelDebug = useStore(characterLabStore, (s) => s.travelDebug);
  const aimed = targetMode === 'travel-to-target' || targetMode === 'instant-target';

  return (
    <>
      <label className="character-lab__toggle">
        <input
          type="checkbox"
          checked={showVfxPath}
          onChange={(event) => characterLabStore.setFlag('showVfxPath', event.target.checked)}
        />
        Show VFX Path
      </label>
      {aimed && travelDebug ? (
        <pre className="character-lab__diff">
          {`Target Mode: ${TARGET_MODE_LABELS[targetMode]}
${travelDebug.note ? `${travelDebug.note}\n` : ''}
Start:
x: ${travelDebug.startX}
y: ${travelDebug.startY}

Target:
x: ${travelDebug.targetX}
y: ${travelDebug.targetY}

Distance: ${travelDebug.distance}px
Travel Speed: ${targetMode === 'instant-target' ? 'Instant' : `${travelDebug.speedPx}px/s`}
Estimated Impact: ${travelDebug.estimatedImpactMs}ms`}
        </pre>
      ) : (
        <p className="character-lab__hint">Target Mode: {TARGET_MODE_LABELS[targetMode]}</p>
      )}
    </>
  );
}
