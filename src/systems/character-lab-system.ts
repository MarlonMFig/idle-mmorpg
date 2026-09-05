import * as Phaser from 'phaser';
import { RENDER_LAYER } from '@/constants/render-layers';
import { loadCharacterPack, type CharacterSkillAnimDef } from '@/data/character-packs';
import { getVfxDefinition } from '@/data/vfx/registry';
import { ensureWonsrVfxCatalog, isWonsrVfxId } from '@/data/vfx/wonsr-catalog';
import { ensureSharedVfxTexture, invalidateSharedVfxTexture } from '@/data/vfx/load-shared-vfx';
import { CharacterRegistry } from '@/data/characters';
import { applySharedVfxToAnim } from '@/data/vfx/apply-skill-vfx';
import { Player } from '@/entities/player';
import type { Enemy } from '@/entities/enemy';
import {
  isPackBodyPoseOptionId,
  labPoseHasContent,
  poseSheetToSpriteDef,
} from '@/lib/dev/lab-pose-sheet';
import { scheduleLabPoseFx } from '@/lib/dev/lab-pose-fx';
import { DEFAULT_TRAVEL_SPEED_PX } from '@/lib/dev/lab-save-fields';
import { combatLayoutScale, getWonsrRenderedMap, pickEvenSpawns } from '@/data/wonsr-rendered-maps';
import type { MapKey } from '@/maps/map-registry';
import {
  characterLabStore,
  friendlyLabAnimName,
  isCharacterLabSession,
  LAB_DISTANCE_PX,
  LAB_DUMMY_ID,
  LAB_ENEMY_COUNT_MAX,
  LAB_HP_MULT,
  labDummyId,
  clampLabEnemyCount,
  type LabCommand,
  type LabEnemyHpMode,
} from '@/stores/character-lab-store';
import { skillsStore } from '@/stores/skills-store';
import { vitalsStore } from '@/stores/vitals-store';
import { resolveEffectiveSkill } from '@/lib/resolve-effective-skill';
import { resolveSkillElement } from '@/data/damage-elements';
import { formatExecutionTypesLabel, hasExecutionType } from '@/data/skill-execution-def';
import type { CombatSystem } from '@/systems/combat-system';
import type { EnemyManager } from '@/systems/enemy-manager';
import { clearLabForcedFx, computeSkillFxAim, scheduleSkillFx, shouldSpawnAreaImpactFxPerTarget, spawnAreaImpactFxForTargets } from '@/systems/pack-fx';
import { scheduleOfficialSkillFx, SkillExecutionRuntime } from '@/systems/skill-execution';
import { resolveBuffDurationMs, tryApplySkillStatuses } from '@/systems/skill-status-apply';
import { applyDirectDamage, clearStatusRuntime, getStatusRuntime } from '@/systems/status-runtime';
import { PLAYER_STATUS_UNIT_ID } from '@/systems/combat-stats';

const BASE_DUMMY_HP = 600;

/**
 * Sessão Phaser do Character Test Lab. Só age com o painel aberto em DEV MODE.
 */
export class CharacterLabSystem {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly overlay: Phaser.GameObjects.Text;
  private dummyKey: string | null = null;
  private dummyHpMode: LabEnemyHpMode | null = null;
  private dummyLoadGen = 0;
  private lastLoopAt = 0;
  private lastOpen = false;
  private lastRuntimePlayerId: string | null = null;
  private runtimePackLoadGen = 0;
  private lastLoadedVfxId: string | null = null;
  private dummyLoadInFlight = false;
  private lastVisKey = '';
  private lastAlignAt = 0;
  private completeTimer: Phaser.Time.TimerEvent | null = null;
  private readonly labExecutions = new SkillExecutionRuntime();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
    private combat: CombatSystem | null,
    private readonly ensureCombat: () => CombatSystem,
    private readonly releaseCombat: () => void,
    private readonly mapKey: MapKey,
  ) {
    this.gfx = scene.add.graphics().setDepth(RENDER_LAYER.ui);
    this.overlay = scene.add
      .text(12, 12, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e8d9a8',
        backgroundColor: '#00000099',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(RENDER_LAYER.ui + 1)
      .setVisible(false);
  }

  destroy(): void {
    this.teardownSession();
    this.gfx.destroy();
    this.overlay.destroy();
  }

  update(time: number): void {
    const lab = characterLabStore.getSnapshot();
    const active = isCharacterLabSession();

    if (!active) {
      if (this.lastOpen) this.teardownSession();
      return;
    }

    this.lastOpen = true;
    this.combat = this.combat ?? this.ensureCombat();
    this.scene.time.timeScale = lab.gameSpeed;
    this.enemyManager.setHuntPaused(true);
    if (lab.playerId !== this.lastRuntimePlayerId) {
      this.lastRuntimePlayerId = lab.playerId;
      if (lab.playerId) void this.syncRuntimePack();
    }
    const visKey = [
      lab.scaleX,
      lab.scaleY,
      lab.offsetX,
      lab.offsetY,
      lab.vfxScale,
      lab.vfxOffsetX,
      lab.vfxOffsetY,
      lab.animationSpeed,
      lab.alignContext,
      lab.alignHubX,
      lab.alignHubY,
      lab.alignHuntX,
      lab.alignHuntY,
      JSON.stringify(lab.sheetScaleDrafts),
    ].join('|');
    if (visKey !== this.lastVisKey) {
      this.lastVisKey = visKey;
      this.player.applyLabVisuals({
        scaleX: lab.scaleX,
        scaleY: lab.scaleY,
        offsetX: lab.offsetX,
        offsetY: lab.offsetY,
        vfxScale: lab.vfxScale,
        vfxOffsetX: lab.vfxOffsetX,
        vfxOffsetY: lab.vfxOffsetY,
        animationSpeed: lab.animationSpeed,
      });
      this.player.refreshSheetScale();
      // Inimigo da caça / dummy Lab usa as mesmas folhas — espelha scaleX/Y por anim.
      if (lab.playerId) {
        const playerPack = CharacterRegistry.get(lab.playerId)?.pack;
        if (playerPack) this.enemyManager.refreshLateralSheetScales(playerPack);
      }
      if (lab.enemyId && lab.enemyId !== lab.playerId) {
        const enemyPack = CharacterRegistry.get(lab.enemyId)?.pack;
        if (enemyPack) this.enemyManager.refreshLateralSheetScales(enemyPack);
      }
    }
    this.player.previewLabAlignment();

    if (this.lastLoadedVfxId !== lab.vfxId) {
      // Evita sprite antigo renderizar enquanto a textura antiga/nova muda.
      clearLabForcedFx();
      void this.ensureCatalogTexture(lab.vfxId);
    }
    if (lab.editingVfxId && lab.editingVfxId !== lab.vfxId) {
      void this.ensureCatalogTexture(lab.editingVfxId);
    }

    void this.syncDummy();
    this.holdHuntStation();
    this.placeDummy();

    const command = characterLabStore.consumeCommand();
    if (command) this.runCommand(command, time);

    if (lab.loopSkill && time - this.lastLoopAt >= lab.loopIntervalMs) {
      if (!this.player.isBusy()) {
        this.lastLoopAt = time;
        void this.playComplete();
      }
    } else if (!lab.loopSkill) {
      this.lastLoopAt = 0;
    }

    this.drawDebug(lab);
    if (time - this.lastAlignAt >= 100) {
      this.lastAlignAt = time;
      characterLabStore.setAlignmentDebug(this.player.getAlignmentDebug());
    }
    this.labExecutions.updateFollow();
    getStatusRuntime(this.scene).updateFollow();
    this.syncStatus(time);
    this.syncTravelDebug(lab);
  }

  private lastStatusAt = 0;

  private syncStatus(time: number): void {
    if (time - this.lastStatusAt < 80) return;
    this.lastStatusAt = time;
    const frame = this.player.getFrameDebug();
    characterLabStore.setFrameDebug(
      frame ?? { anim: 'idle', frame: 0, total: 0, timeMs: 0, actionLocked: this.player.isBusy() },
    );
  }

  private cancelComplete(): void {
    this.completeTimer?.remove(false);
    this.completeTimer = null;
    this.labExecutions.cancelAll();
  }

  private teardownSession(): void {
    this.cancelComplete();
    clearStatusRuntime(this.scene);
    clearLabForcedFx();
    this.removeAllLabDummies();
    this.enemyManager.setHuntPaused(false);
    this.dummyKey = null;
    this.dummyHpMode = null;
    this.dummyLoadInFlight = false;
    this.runtimePackLoadGen += 1;
    this.lastVisKey = '';
    this.lastRuntimePlayerId = null;
    this.lastLoadedVfxId = null;
    this.overlay.setVisible(false);
    this.gfx.clear();
    this.scene.time.timeScale = 1;
    if (this.player.sprite?.active) this.player.resetLabVisualOverrides();
    this.releaseCombat();
    this.combat = null;
    this.lastOpen = false;
  }

  private dummy(): Enemy | null {
    return this.enemyManager.get(LAB_DUMMY_ID) ?? null;
  }

  private labDummies(): Enemy[] {
    const count = clampLabEnemyCount(characterLabStore.getSnapshot().labEnemyCount);
    const out: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const enemy = this.enemyManager.get(labDummyId(i));
      if (enemy?.isAlive) out.push(enemy);
    }
    return out;
  }

  private removeAllLabDummies(): void {
    for (let i = 0; i < LAB_ENEMY_COUNT_MAX; i++) {
      this.enemyManager.removeById(labDummyId(i));
    }
  }

  private allLabDummiesReady(count: number): boolean {
    for (let i = 0; i < count; i++) {
      const enemy = this.enemyManager.get(labDummyId(i));
      if (!enemy?.isAlive) return false;
    }
    return count > 0;
  }

  /** Na caçada o idle AI vai para o canto; o lab testa no spawn central. */
  private holdHuntStation(): void {
    const rendered = getWonsrRenderedMap(this.mapKey);
    if (!rendered) return;
    this.player.sprite.setVelocity(0, 0);
    if (this.player.isBusy() || this.player.isDead()) return;
    const x = rendered.spawn.x;
    const y = rendered.lateralFloorY ?? rendered.spawn.y;
    if (Math.abs(this.player.x - x) > 4 || Math.abs(this.player.y - y) > 4) {
      this.player.sprite.setPosition(x, y);
      this.player.stop();
    }
  }

  private castSkill(skillId: string): void {
    const lab = characterLabStore.getSnapshot();
    if (lab.poseAttack && labPoseHasContent(lab.poseSheet)) {
      void this.playComplete();
      return;
    }
    const ok = this.combat?.castLabSkill(skillId, this.dummy()) ?? false;
    if (!ok) this.player.playSkillAnim(skillId);
  }

  private async playPose(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    this.player.resetLabPose();
    if (lab.poseOptionId && !lab.poseAttack && isPackBodyPoseOptionId(lab.poseOptionId)) {
      this.player.playLabSlot(lab.poseOptionId as import('@/types/character-definition').CharacterAnimSlot);
      characterLabStore.pushEvent(`${lab.poseOptionId} started (referência pack)`);
      return;
    }
    if (!labPoseHasContent(lab.poseSheet) || !lab.poseSheet) {
      characterLabStore.pushEvent('nenhuma animação pose');
      return;
    }
    if (lab.poseAttack) {
      const needsTarget = lab.targetMode === 'travel-to-target' || lab.targetMode === 'instant-target';
      if (needsTarget && !this.dummy()) {
        characterLabStore.pushEvent('Selecione um inimigo para testar este Target Mode.');
        return;
      }
      const { from, to, aim } = this.labFxPoints();
      const ok = await scheduleLabPoseFx({
        scene: this.scene,
        player: this.player,
        pose: lab.poseSheet,
        targetMode: lab.targetMode,
        travelSpeed: lab.travelSpeed,
        spawnOffsetX: lab.spawnOffsetX,
        spawnOffsetY: lab.spawnOffsetY,
        targetOffsetX: lab.targetOffsetX,
        targetOffsetY: lab.targetOffsetY,
        from,
        to,
        aim,
      });
      characterLabStore.pushEvent(
        ok ? `pose fx (${lab.targetMode})` : 'falha ao carregar pose fx',
      );
      return;
    }
    const ok = await this.player.playLabPoseSheet(lab.poseSheet);
    characterLabStore.pushEvent(ok ? 'pose started' : 'falha ao carregar pose');
  }

  private playEffect(options?: { keepPose?: boolean }): void {
    const lab = characterLabStore.getSnapshot();
    if (!options?.keepPose) this.player.resetLabPose();
    if (!lab.vfxId) {
      characterLabStore.pushEvent('nenhum vfx efeito');
      return;
    }
    const needsTarget = lab.targetMode === 'travel-to-target' || lab.targetMode === 'instant-target';
    if (needsTarget && !this.dummy()) {
      characterLabStore.pushEvent('Selecione um inimigo para testar este Target Mode.');
      return;
    }
    const anim = this.effectAnimFromLab();
    if (!anim?.fx) {
      characterLabStore.pushEvent('nenhum vfx efeito');
      return;
    }
    const { from, to, aim } = this.labFxPoints();
    void this.ensureCatalogTexture(lab.vfxId);
    scheduleSkillFx(this.scene, this.player, anim, 0, from, to, aim);
    characterLabStore.pushEvent('effect started');
  }

  private async playComplete(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    await this.playPose();
    const baseAnim =
      (lab.lastSkillId ? this.player.getSkillAnim(lab.lastSkillId) : undefined) ??
      this.effectAnimFromLab() ??
      undefined;
    // With Pose Attack enabled, the selected pose is the skill's only visual
    // effect. Do not let an older/regular VFX path replace or duplicate it.
    const anim =
      lab.poseAttack && baseAnim
        ? { ...baseAnim, fx: undefined, fxSecondary: undefined, vfxId: undefined }
        : baseAnim;
    const skill = lab.lastSkillId ? resolveEffectiveSkill(lab.lastSkillId) : undefined;
    if (!anim && !skill) {
      characterLabStore.pushEvent(`skill complete · delay ${Math.max(0, Math.round(lab.castDelayMs))}ms`);
      return;
    }
    const dummy = this.dummy();
    const { from, to, aim } = this.labFxPoints();
    const hitDelay = anim && 'hitDelayMs' in anim ? (anim.hitDelayMs ?? 280) : 280;
    const stub = {
      ...(skill ?? {
        id: lab.lastSkillId ?? 'lab-preview',
        name: 'Lab Preview',
        cooldownMs: 0,
        damage: 40,
        icon: '/sprites/skills/neutral.svg',
        animation: { kind: 'character' as const, durationMs: 600, scale: 1 },
      }),
      element: lab.skillElement,
      ...(anim?.effect ? { effect: anim.effect } : {}),
    };
    if (lab.vfxId) void this.ensureCatalogTexture(lab.vfxId);
    scheduleOfficialSkillFx({
      scene: this.scene,
      runtime: this.labExecutions,
      player: this.player,
      skill: stub,
      anim,
      from,
      to,
      aim,
      targetId: dummy?.id ?? null,
      hitDelayMs: hitDelay,
      isCasterDead: () => this.player.isDead(),
      isOriginalTargetDead: () => Boolean(dummy) && !dummy!.isAlive,
      getTargetPos: () => (dummy ? { x: dummy.sprite.x, y: dummy.sprite.y } : { x: to.x, y: to.y }),
      onHit: (impact, execution) => {
        const primary = this.dummy();
        const radius =
          impact.kind === 'area'
            ? (impact.radius ?? lab.execution.radius ?? stub.areaRadius ?? null)
            : null;
        const hit: Enemy[] = [];
        if (radius != null && radius > 0) {
          const ox = this.player.x;
          const oy = this.player.y;
          for (const enemy of this.labDummies()) {
            if (!enemy.isAlive) continue;
            const distance = Phaser.Math.Distance.Between(ox, oy, enemy.sprite.x, enemy.sprite.y);
            if (distance > radius) continue;
            hit.push(enemy);
          }
        } else if (primary?.isAlive) {
          hit.push(primary);
        }
        if (stub.effect !== 'buff') {
          const rawDamage = Math.max(1, Math.floor((stub.damage || 40) * impact.multiplier));
          for (const enemy of hit) {
            if (!enemy.isAlive || impact.multiplier <= 0) continue;
            applyDirectDamage({
              runtime: getStatusRuntime(this.scene),
              targetId: enemy.id,
              rawAmount: rawDamage,
              sourceId: PLAYER_STATUS_UNIT_ID,
              enemy,
              element: resolveSkillElement(stub, anim),
              onKill: () => undefined,
            });
          }
          if (
            anim &&
            shouldSpawnAreaImpactFxPerTarget(anim, impact.kind, hit.length, radius)
          ) {
            spawnAreaImpactFxForTargets(this.scene, this.player, anim, hit, primary?.id);
          }
        }
        tryApplySkillStatuses({
          scene: this.scene,
          skill: stub,
          anim,
          moment: 'on-hit',
          executionId: execution.executionId,
          rolledKeys: execution.statusRolled,
          casterId: PLAYER_STATUS_UNIT_ID,
          primaryTargetId: primary?.id ?? null,
          hitTargets: hit,
          hitIndex: impact.index,
        });
      },
      onStatusMoment: (moment, execution) => {
        const primary = this.dummy();
        const dummies = this.labDummies();
        if (moment === 'on-start' && stub.effect === 'buff' && anim?.buffAuraEnabled) {
          this.player.activateBuffAura(anim, resolveBuffDurationMs(anim, stub));
        }
        tryApplySkillStatuses({
          scene: this.scene,
          skill: stub,
          anim,
          moment,
          executionId: execution.executionId,
          rolledKeys: execution.statusRolled,
          casterId: PLAYER_STATUS_UNIT_ID,
          primaryTargetId: primary?.id ?? null,
          hitTargets: dummies,
          hitIndex: 0,
        });
      },
    });
    characterLabStore.pushEvent(`skill complete · ${formatExecutionTypesLabel(lab.execution)}`);
  }

  private effectAnimFromLab(): CharacterSkillAnimDef | null {
    const lab = characterLabStore.getSnapshot();
    if (!lab.vfxId) return null;
    const pack = lab.playerId ? CharacterRegistry.get(lab.playerId)?.pack : undefined;
    const raw =
      (lab.lastSkillId ? pack?.skillAnims[lab.lastSkillId] : undefined) ??
      pack?.attack ??
      (lab.poseSheet ? poseSheetToSpriteDef(lab.poseSheet) : undefined);
    if (!raw) return null;
    const base: CharacterSkillAnimDef = {
      ...raw,
      durationMs: 'durationMs' in raw && typeof raw.durationMs === 'number' ? raw.durationMs : 600,
      hitDelayMs: 0,
      targeting: {
        mode: lab.targetMode,
        travelSpeed: lab.travelSpeed,
        spawnOffsetX: lab.spawnOffsetX,
        spawnOffsetY: lab.spawnOffsetY,
        targetOffsetX: lab.targetOffsetX,
        targetOffsetY: lab.targetOffsetY,
      },
      // Lab VFX: Cast Delay agenda o Effect (officialVfxStartDelayMs).
      castDelayMs: Math.max(0, Math.round(lab.castDelayMs)),
      fxReleaseMs: 0,
      fxFlightFrameCount: undefined,
      fx: undefined,
      vfxId: undefined,
      execution: lab.execution,
      statusEffects: lab.statusEffects,
      element: lab.skillElement,
    };
    return applySharedVfxToAnim(base, lab.vfxId, {
      scale: lab.vfxScale,
      offsetX: lab.vfxOffsetX,
      offsetY: lab.vfxOffsetY,
    });
  }

  private runCommand(command: LabCommand, time: number): void {
    this.cancelComplete();
    if (command.kind === 'play-slot') {
      characterLabStore.pushEvent(`${command.slot} started`);
      this.player.playLabSlot(command.slot);
      return;
    }
    if (command.kind === 'basic-attack') {
      this.combat?.strikeLabBasic(this.dummy());
      return;
    }
    if (command.kind === 'cast-skill') {
      this.lastLoopAt = time;
      this.castSkill(command.skillId);
      return;
    }
    if (command.kind === 'play-pose') {
      this.lastLoopAt = time;
      void this.playPose();
      return;
    }
    if (command.kind === 'play-effect') {
      this.lastLoopAt = time;
      this.playEffect();
      return;
    }
    if (command.kind === 'play-complete') {
      this.lastLoopAt = time;
      void this.playComplete();
      return;
    }
    if (command.kind === 'restore-visuals') {
      this.player.applyLabVisuals({
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
        vfxScale: 1,
        vfxOffsetX: 0,
        vfxOffsetY: 0,
        animationSpeed: 1,
      });
      return;
    }
    if (command.kind === 'clear-fx') {
      clearLabForcedFx();
      return;
    }
    if (command.kind === 'preview-aura') {
      this.player.setAuraPreview(command.aura);
      return;
    }
    if (command.kind === 'sync-runtime') {
      this.syncRuntimePack();
      return;
    }
    if (command.kind === 'reset') {
      clearLabForcedFx();
      clearStatusRuntime(this.scene);
      vitalsStore.healFull();
      skillsStore.clearCooldowns();
      this.player.resetLabPose();
      this.dummyKey = null;
      this.dummyHpMode = null;
      this.removeAllLabDummies();
      characterLabStore.setActiveVfx(null);
      void this.syncDummy();
      characterLabStore.pushEvent('reset test');
    }
  }

  private async syncRuntimePack(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    const loadGen = ++this.runtimePackLoadGen;
    // Destrói sprites/tweens do lab antes de dropar a textura (evita glTexture null).
    clearLabForcedFx();
    if (lab.playerId) {
      const def = CharacterRegistry.get(lab.playerId);
      if (def) {
        try {
          await loadCharacterPack(this.scene, def.pack);
        } catch (error) {
          console.warn('[CharacterLab] falha ao carregar pack do jogador', error);
          return;
        }
        if (
          loadGen !== this.runtimePackLoadGen ||
          characterLabStore.getSnapshot().playerId !== lab.playerId
        ) {
          return;
        }
        Player.ensureAnimations(this.scene, def.pack);
        this.player.replacePack(def.pack);
        this.player.resetLabPose();
      }
    }
    // Loop/skill podem ter spawnado FX durante o await — limpa de novo.
    clearLabForcedFx();
    const ids = [lab.vfxId, lab.editingVfxId].filter((id): id is string => Boolean(id));
    for (const id of ids) {
      invalidateSharedVfxTexture(this.scene, id);
      void this.ensureCatalogTexture(id);
    }
  }

  private async ensureCatalogTexture(vfxId: string | null): Promise<void> {
    if (!vfxId) return;
    if (isWonsrVfxId(vfxId)) await ensureWonsrVfxCatalog();
    const def = getVfxDefinition(vfxId);
    if (!def) return;
    try {
      await ensureSharedVfxTexture(this.scene, def);
      this.lastLoadedVfxId = vfxId;
    } catch (error) {
      console.warn('[CharacterLab] falha ao carregar VFX de catálogo', error);
      this.lastLoadedVfxId = null;
    }
  }

  private async syncDummy(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    const count = clampLabEnemyCount(lab.labEnemyCount);
    if (!lab.enemyId) {
      this.removeAllLabDummies();
      this.dummyKey = null;
      this.dummyHpMode = null;
      return;
    }
    for (let i = count; i < LAB_ENEMY_COUNT_MAX; i++) {
      this.enemyManager.removeById(labDummyId(i));
    }
    const layout = this.player.worldScale;
    const dummyKey = `${lab.enemyId}@${layout}@${count}`;
    if (
      this.dummyKey === dummyKey &&
      this.dummyHpMode === lab.enemyHpMode &&
      this.allLabDummiesReady(count)
    ) {
      return;
    }
    if (this.dummyLoadInFlight) return;
    const def = CharacterRegistry.get(lab.enemyId);
    if (!def) return;
    const gen = ++this.dummyLoadGen;
    this.dummyLoadInFlight = true;
    try {
      await loadCharacterPack(this.scene, def.pack);
      if (gen !== this.dummyLoadGen) return;
      Player.ensureAnimations(this.scene, def.pack);
      const lookType = def.lookTypes[0] ?? def.pack.outfit?.lookType ?? 0;
      const resolved = this.enemyManager.resolveFromPack(def.pack, lookType, `lab-dummy-${def.id}`);
      if (!resolved) return;
      const hpMult = LAB_HP_MULT[lab.enemyHpMode];
      const hp = hpMult === 0 ? 1_000_000 : Math.max(1, Math.round(BASE_DUMMY_HP * hpMult));
      const spriteFit = {
        ...resolved.fit,
        scale: resolved.fit.scale * layout,
        scaleX: (resolved.fit.scaleX ?? resolved.fit.scale) * layout,
      };
      const label = characterLabLabelSafe(def.id);
      for (let i = 0; i < count; i++) {
        const pos = this.dummyPos(i);
        this.enemyManager.spawnLabDummy({
          id: labDummyId(i),
          name: count > 1 ? `[LAB] ${label} #${i + 1}` : `[LAB] ${label}`,
          hp,
          level: 1,
          xp: 0,
          loot: [],
          spawn: pos,
          speed: 0,
          chaseRadius: 0,
          sprite: resolved.textureKey,
          spriteFrame: resolved.idleFrame,
          walk: resolved.walk,
          spriteFit,
          mapKey: this.mapKey,
          noRespawn: true,
        });
      }
      this.dummyKey = dummyKey;
      this.dummyHpMode = lab.enemyHpMode;
    } catch (error) {
      console.warn('[CharacterLab] falha ao spawnar dummy', error);
    } finally {
      this.dummyLoadInFlight = false;
    }
  }

  private labDummyPositions(count: number): { x: number; y: number }[] {
    const lab = characterLabStore.getSnapshot();
    const rendered = getWonsrRenderedMap(this.mapKey);

    if (count <= 1) {
      const dist = LAB_DISTANCE_PX[lab.distance] * this.player.worldScale;
      return [{ x: this.player.x + dist, y: this.player.y }];
    }

    if (!rendered?.enemySpawns.length) {
      const dist = LAB_DISTANCE_PX[lab.distance] * this.player.worldScale;
      const layout = combatLayoutScale(this.mapKey);
      const spacing = 64 * layout;
      return Array.from({ length: count }, (_, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        return {
          x: this.player.x + dist + (col - 1) * spacing,
          y: this.player.y + row * spacing * 0.65,
        };
      });
    }

    const anchor = rendered.spawn;
    const px = this.player.x;
    const py = this.player.y;

    if (rendered.lateralFloorY != null) {
      const floorY = rendered.lateralFloorY;
      const pattern = rendered.enemySpawns.map((spawn) => ({
        x: px + (spawn.x - anchor.x),
        y: floorY,
      }));
      return this.orderLabSpawnsNearestFirst(pickEvenSpawns(pattern, count), px, py);
    }

    const pattern = rendered.enemySpawns.map((spawn) => ({
      x: px + (spawn.x - anchor.x),
      y: py + (spawn.y - anchor.y),
    }));
    return this.orderLabSpawnsNearestFirst(pickEvenSpawns(pattern, count), px, py);
  }

  /** Alvo primário (#1) = dummy mais perto do jogador; demais mantêm o espalhamento. */
  private orderLabSpawnsNearestFirst(
    positions: { x: number; y: number }[],
    px: number,
    py: number,
  ): { x: number; y: number }[] {
    if (positions.length <= 1) return positions;
    let nearestIdx = 0;
    let nearestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < positions.length; i += 1) {
      const pos = positions[i];
      const dist = (pos.x - px) ** 2 + (pos.y - py) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }
    if (nearestIdx === 0) return positions;
    return [...positions.slice(nearestIdx), ...positions.slice(0, nearestIdx)];
  }

  private dummyPos(index = 0): { x: number; y: number } {
    const count = clampLabEnemyCount(characterLabStore.getSnapshot().labEnemyCount);
    const positions = this.labDummyPositions(count);
    return positions[index] ?? positions[0] ?? { x: this.player.x, y: this.player.y };
  }

  private placeDummy(): void {
    const count = clampLabEnemyCount(characterLabStore.getSnapshot().labEnemyCount);
    for (let i = 0; i < count; i++) {
      const enemy = this.enemyManager.get(labDummyId(i));
      if (!enemy?.isAlive) continue;
      const pos = this.dummyPos(i);
      enemy.sprite.setPosition(pos.x, pos.y);
      enemy.sprite.setVelocity(0, 0);
    }
  }

  /**
   * Mesmo ancoramento do combate: `from`/`to` nos pés + `aim` nos centros visuais.
   * Offsets de Spawn/Target ficam só em `anim.targeting` (resolveAim aplica uma vez).
   */
  private labFxPoints() {
    const dummy = this.dummy();
    const aim = computeSkillFxAim(this.player, dummy);
    return {
      from: { x: this.player.x, y: this.player.y },
      to: dummy
        ? { x: dummy.sprite.x, y: dummy.sprite.y }
        : { x: aim.targetX, y: aim.targetY },
      aim,
    };
  }

  /** Caminho já com offsets (debug/overlay) — espelha `resolveAim` do pack-fx. */
  private forceTargetPoints(lab: ReturnType<typeof characterLabStore.getSnapshot>) {
    const { aim } = this.labFxPoints();
    const facingLeft = aim.targetX < aim.startX;
    return {
      start: {
        x: aim.startX + lab.spawnOffsetX * (facingLeft ? -1 : 1),
        y: aim.startY + lab.spawnOffsetY,
      },
      target: {
        x: aim.targetX + lab.targetOffsetX,
        y: aim.targetY + lab.targetOffsetY,
      },
    };
  }

  private syncTravelDebug(lab: ReturnType<typeof characterLabStore.getSnapshot>): void {
    const aimed = lab.targetMode === 'travel-to-target' || lab.targetMode === 'instant-target';
    if (!aimed) {
      if (lab.travelDebug?.forceOn) characterLabStore.setTravelDebug(null);
      return;
    }
    const { start, target } = this.forceTargetPoints(lab);
    const speedPx = lab.targetMode === 'instant-target' ? 0 : lab.travelSpeed;
    const distance = Math.round(Phaser.Math.Distance.Between(start.x, start.y, target.x, target.y));
    const anim = lab.lastSkillId ? this.player.getSkillAnim(lab.lastSkillId) : undefined;
    const mode = !anim?.fx ? 'no-vfx' : lab.targetMode;
    characterLabStore.setTravelDebug({
      forceOn: true,
      mode,
      startX: Math.round(start.x),
      startY: Math.round(start.y),
      targetX: Math.round(target.x),
      targetY: Math.round(target.y),
      distance,
      speedPx: speedPx || DEFAULT_TRAVEL_SPEED_PX,
      estimatedImpactMs: speedPx <= 0 ? 0 : Math.round((distance / speedPx) * 1000),
      note: anim?.fx ? `targetMode: ${lab.targetMode}` : 'skill sem VFX destacado',
    });
  }

  private drawDebug(lab: ReturnType<typeof characterLabStore.getSnapshot>): void {
    this.gfx.clear();
    this.overlay.setVisible(Boolean(lab.showFrameDebug || lab.showHitTiming));

    const drawBody = (body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody, color: number) => {
      this.gfx.lineStyle(1, color, 0.9);
      this.gfx.strokeRect(body.x, body.y, body.width, body.height);
    };

    if (lab.showHitbox) {
      const body = this.player.sprite.body;
      if (body) drawBody(body, 0xff4d4d);
      for (const enemy of this.labDummies()) {
        const dummyBody = enemy.sprite.body;
        if (dummyBody) drawBody(dummyBody, 0xff4d4d);
      }
    }
    if (lab.showHurtbox) {
      const body = this.player.sprite.body;
      if (body) drawBody(body, 0x4dff88);
      for (const enemy of this.labDummies()) {
        const dummyBody = enemy.sprite.body;
        if (dummyBody) drawBody(dummyBody, 0x4dff88);
      }
    }
    if (lab.showSpriteOrigin) {
      this.gfx.fillStyle(0xffe066, 1);
      this.gfx.fillCircle(this.player.x, this.player.y, 3);
      for (const enemy of this.labDummies()) {
        this.gfx.fillStyle(0x66d4ff, 1);
        this.gfx.fillCircle(enemy.sprite.x, enemy.sprite.y, 3);
      }
    }

    if (lab.showGroundGuide) {
      const y = this.player.y;
      const left = this.player.x - 120;
      const right = this.player.x + 120;
      this.gfx.lineStyle(1, 0x7CFFB2, 0.85);
      this.gfx.lineBetween(left, y, right, y);
      this.gfx.lineBetween(this.player.x - 8, y - 6, this.player.x, y);
      this.gfx.lineBetween(this.player.x + 8, y - 6, this.player.x, y);
    }

    if (lab.showAreaRadius && hasExecutionType(lab.execution, 'area')) {
      const radius = Math.max(0, lab.execution.radius ?? 80);
      const cx = this.player.x;
      const cy = this.player.y;
      this.gfx.lineStyle(1, 0xffcc66, 0.7);
      this.gfx.strokeCircle(cx, cy, radius);
    }

    if (lab.showVfxPath && (lab.targetMode === 'travel-to-target' || lab.targetMode === 'instant-target')) {
      const { start, target } = this.forceTargetPoints(lab);
      this.gfx.lineStyle(1, 0x88c8ff, 0.55);
      this.gfx.lineBetween(start.x, start.y, target.x, target.y);
      this.gfx.fillStyle(0x88c8ff, 0.8);
      this.gfx.fillCircle(start.x, start.y, 3);
      this.gfx.fillStyle(0xff8866, 0.85);
      this.gfx.fillCircle(target.x, target.y, 3);
    }

    if (lab.showFrameDebug || lab.showHitTiming) {
      const frame = this.player.getFrameDebug();
      const hit = lab.hitDebug;
      const lines = [
        frame ? `Anim: ${friendlyLabAnimName(frame.anim)}` : 'Anim: idle',
        frame ? `Frame: ${frame.frame} / ${frame.total}` : '',
        frame ? `Time: ${frame.timeMs} ms` : '',
        lab.showHitTiming && hit ? `hitDelay: ${hit.configuredMs} ms` : '',
        lab.showHitTiming && hit && hit.appliedAtMs < 0 ? `hit: waiting` : '',
        lab.showHitTiming && hit && hit.appliedAtMs >= 0 ? `hit applied @ ${hit.appliedAtMs} ms` : '',
      ].filter(Boolean);
      this.overlay.setText(lines.join('\n'));
    }
  }
}

function characterLabLabelSafe(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
