import * as Phaser from 'phaser';
import { RENDER_LAYER } from '@/constants/render-layers';
import { loadCharacterPack, type CharacterSkillAnimDef } from '@/data/character-packs';
import { getVfxDefinition } from '@/data/vfx/registry';
import { ensureWonsrVfxCatalog, isWonsrVfxId } from '@/data/vfx/wonsr-catalog';
import { ensureSharedVfxTexture, invalidateSharedVfxTexture } from '@/data/vfx/load-shared-vfx';
import { CharacterRegistry } from '@/data/characters';
import { applySharedVfxToAnim } from '@/data/vfx/apply-skill-vfx';
import { Player } from '@/entities/player';
import { DEFAULT_TRAVEL_SPEED_PX } from '@/lib/dev/lab-save-fields';
import { labPoseHasContent, poseSheetToSpriteDef } from '@/lib/dev/lab-pose-sheet';
import { getWonsrRenderedMap } from '@/data/wonsr-rendered-maps';
import type { MapKey } from '@/maps/map-registry';
import {
  characterLabStore,
  friendlyLabAnimName,
  isCharacterLabSession,
  LAB_DISTANCE_PX,
  LAB_DUMMY_ID,
  LAB_HP_MULT,
  type LabCommand,
  type LabEnemyHpMode,
} from '@/stores/character-lab-store';
import { skillsStore } from '@/stores/skills-store';
import { vitalsStore } from '@/stores/vitals-store';
import { resolveEffectiveSkill } from '@/lib/resolve-effective-skill';
import { resolveSkillElement } from '@/data/damage-elements';
import { resolveExecutionType } from '@/data/skill-execution-def';
import type { CombatSystem } from '@/systems/combat-system';
import type { EnemyManager } from '@/systems/enemy-manager';
import { clearLabForcedFx, scheduleSkillFx } from '@/systems/pack-fx';
import { scheduleOfficialSkillFx, SkillExecutionRuntime } from '@/systems/skill-execution';
import { tryApplySkillStatuses } from '@/systems/skill-status-apply';
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
    }
    this.player.previewLabAlignment();

    if (this.lastLoadedVfxId !== lab.vfxId) {
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
    this.enemyManager.removeById(LAB_DUMMY_ID);
    this.enemyManager.setHuntPaused(false);
    this.dummyKey = null;
    this.dummyHpMode = null;
    this.dummyLoadInFlight = false;
    this.lastVisKey = '';
    this.lastLoadedVfxId = null;
    this.overlay.setVisible(false);
    this.gfx.clear();
    this.scene.time.timeScale = 1;
    if (this.player.sprite?.active) this.player.resetLabVisualOverrides();
    this.releaseCombat();
    this.combat = null;
    this.lastOpen = false;
  }

  private dummy() {
    return this.enemyManager.get(LAB_DUMMY_ID) ?? null;
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
    const ok = this.combat?.castLabSkill(skillId, this.dummy()) ?? false;
    if (!ok) this.player.playSkillAnim(skillId);
  }

  private async playPose(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    this.player.resetLabPose();
    if (!labPoseHasContent(lab.poseSheet) || !lab.poseSheet) {
      characterLabStore.pushEvent('nenhuma animação pose');
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
    const { start, target } = this.forceTargetPoints(lab);
    const from = lab.targetMode === 'caster' ? { x: this.player.x, y: this.player.y } : start;
    const to = lab.targetMode === 'caster' ? from : target;
    void this.ensureCatalogTexture(lab.vfxId);
    scheduleSkillFx(this.scene, this.player, anim, 0, from, to, null);
    characterLabStore.pushEvent('effect started');
  }

  private async playComplete(): Promise<void> {
    const lab = characterLabStore.getSnapshot();
    await this.playPose();
    const anim = this.effectAnimFromLab() ?? (lab.lastSkillId ? this.player.getSkillAnim(lab.lastSkillId) : undefined);
    const skill = lab.lastSkillId ? resolveEffectiveSkill(lab.lastSkillId) : undefined;
    if (!anim && !skill) {
      characterLabStore.pushEvent(`skill complete · delay ${Math.max(0, Math.round(lab.castDelayMs))}ms`);
      return;
    }
    const dummy = this.dummy();
    const { start, target } = this.forceTargetPoints(lab);
    const from = lab.targetMode === 'caster' ? { x: this.player.x, y: this.player.y } : start;
    const to = lab.targetMode === 'caster' ? from : target;
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
      aim: null,
      targetId: dummy?.id ?? null,
      hitDelayMs: anim && 'hitDelayMs' in anim ? (anim.hitDelayMs ?? 280) : 280,
      isCasterDead: () => this.player.isDead(),
      isOriginalTargetDead: () => Boolean(dummy) && !dummy!.isAlive,
      getTargetPos: () => (dummy ? { x: dummy.sprite.x, y: dummy.sprite.y } : { x: to.x, y: to.y }),
      onHit: (impact, execution) => {
        if (!dummy?.isAlive || impact.multiplier <= 0) return;
        applyDirectDamage({
          runtime: getStatusRuntime(this.scene),
          targetId: dummy.id,
          rawAmount: Math.max(1, Math.floor((stub.damage || 40) * impact.multiplier)),
          sourceId: PLAYER_STATUS_UNIT_ID,
          enemy: dummy,
          element: resolveSkillElement(stub, anim),
          onKill: () => undefined,
        });
        tryApplySkillStatuses({
          scene: this.scene,
          skill: stub,
          anim,
          moment: 'on-hit',
          executionId: execution.executionId,
          rolledKeys: execution.statusRolled,
          casterId: PLAYER_STATUS_UNIT_ID,
          primaryTargetId: dummy.id,
          hitTargets: [dummy],
          hitIndex: impact.index,
        });
      },
      onStatusMoment: (moment, execution) => {
        tryApplySkillStatuses({
          scene: this.scene,
          skill: stub,
          anim,
          moment,
          executionId: execution.executionId,
          rolledKeys: execution.statusRolled,
          casterId: PLAYER_STATUS_UNIT_ID,
          primaryTargetId: dummy?.id ?? null,
          hitTargets: dummy ? [dummy] : [],
          hitIndex: 0,
        });
      },
    });
    characterLabStore.pushEvent(`skill complete · ${resolveExecutionType(lab.execution)}`);
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
      this.enemyManager.removeById(LAB_DUMMY_ID);
      characterLabStore.setActiveVfx(null);
      void this.syncDummy();
      characterLabStore.pushEvent('reset test');
    }
  }

  private syncRuntimePack(): void {
    const lab = characterLabStore.getSnapshot();
    if (lab.playerId) {
      const def = CharacterRegistry.get(lab.playerId);
      if (def) this.player.replacePack(def.pack);
    }
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
    if (!lab.enemyId) {
      this.enemyManager.removeById(LAB_DUMMY_ID);
      this.dummyKey = null;
      this.dummyHpMode = null;
      return;
    }
    const layout = this.player.worldScale;
    const dummyKey = `${lab.enemyId}@${layout}`;
    if (
      this.dummyKey === dummyKey &&
      this.dummyHpMode === lab.enemyHpMode &&
      this.dummy()?.isAlive
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
      const pos = this.dummyPos();
      const hpMult = LAB_HP_MULT[lab.enemyHpMode];
      const hp = hpMult === 0 ? 1_000_000 : Math.max(1, Math.round(BASE_DUMMY_HP * hpMult));
      const spriteFit = {
        ...resolved.fit,
        scale: resolved.fit.scale * layout,
        scaleX: (resolved.fit.scaleX ?? resolved.fit.scale) * layout,
      };
      this.enemyManager.spawnLabDummy({
        id: LAB_DUMMY_ID,
        name: `[LAB] ${characterLabLabelSafe(def.id)}`,
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
      this.dummyKey = dummyKey;
      this.dummyHpMode = lab.enemyHpMode;
    } catch (error) {
      console.warn('[CharacterLab] falha ao spawnar dummy', error);
    } finally {
      this.dummyLoadInFlight = false;
    }
  }

  private dummyPos(): { x: number; y: number } {
    const lab = characterLabStore.getSnapshot();
    const dist = LAB_DISTANCE_PX[lab.distance] * this.player.worldScale;
    return { x: this.player.x + dist, y: this.player.y };
  }

  private placeDummy(): void {
    const enemy = this.dummy();
    if (!enemy?.isAlive) return;
    const pos = this.dummyPos();
    enemy.sprite.setPosition(pos.x, pos.y);
    enemy.sprite.setVelocity(0, 0);
  }

  private spriteCenter(sprite: Phaser.GameObjects.Sprite): { x: number; y: number } {
    const bounds = sprite.getBounds();
    return { x: bounds.centerX, y: bounds.centerY };
  }

  private forceTargetPoints(lab: ReturnType<typeof characterLabStore.getSnapshot>) {
    const start = this.spriteCenter(this.player.sprite);
    const dummy = this.dummy();
    const facingLeft = dummy ? dummy.sprite.x < this.player.x : false;
    const spawn = {
      x: start.x + lab.spawnOffsetX * (facingLeft ? -1 : 1),
      y: start.y + lab.spawnOffsetY,
    };
    if (!dummy) {
      return {
        start: spawn,
        target: {
          x: start.x + 80 * this.player.worldScale + lab.targetOffsetX,
          y: start.y + lab.targetOffsetY,
        },
      };
    }
    const mid = this.spriteCenter(dummy.sprite);
    return {
      start: spawn,
      target: { x: mid.x + lab.targetOffsetX, y: mid.y + lab.targetOffsetY },
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
      const dummyBody = this.dummy()?.sprite.body;
      if (dummyBody) drawBody(dummyBody, 0xff4d4d);
    }
    if (lab.showHurtbox) {
      const body = this.player.sprite.body;
      if (body) drawBody(body, 0x4dff88);
      const dummyBody = this.dummy()?.sprite.body;
      if (dummyBody) drawBody(dummyBody, 0x4dff88);
    }
    if (lab.showSpriteOrigin) {
      this.gfx.fillStyle(0xffe066, 1);
      this.gfx.fillCircle(this.player.x, this.player.y, 3);
      const dummy = this.dummy();
      if (dummy) {
        this.gfx.fillStyle(0x66d4ff, 1);
        this.gfx.fillCircle(dummy.sprite.x, dummy.sprite.y, 3);
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

    if (lab.showAreaRadius && resolveExecutionType(lab.execution) === 'area') {
      const radius = Math.max(0, lab.execution.radius ?? 80);
      const dummy = this.dummy();
      const cx = dummy?.sprite.x ?? this.player.x + 80;
      const cy = dummy?.sprite.y ?? this.player.y;
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
