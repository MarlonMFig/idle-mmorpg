import * as Phaser from 'phaser';
import {
  IDLE_AGGRO_RANGE,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_DEATH_RESPAWN_MS,
  PLAYER_JUTSU_GAP_MS,
} from '@/constants/combat';
import {
  BASIC_ATTACK_ATK_FACTOR,
  BASIC_ATTACK_FLAT,
  SKILL_ATTACK_ATK_FACTOR,
} from '@/constants/combat-damage';
import { isSkillCooldownIgnored, scaleOutgoingDamage } from '@/config/devConfig';
import { characterLabStore, isLabBlockingHuntGameplay } from '@/stores/character-lab-store';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { resolveSkillEnergyCost } from '@/data/skill-ai-def';
import { BASIC_ATTACK_ELEMENT, resolveSkillElement, type DamageElement } from '@/data/damage-elements';
import { resolveAwakeningRuntime } from '@/lib/awakening-runtime';
import { resolveEffectiveSkill } from '@/lib/resolve-effective-skill';
import type { Player } from '@/entities/player';
import type { Enemy } from '@/entities/enemy';
import { STAR_3_SPECIAL_DAMAGE_BONUS } from '@/constants/character-progression';
import { teamStore } from '@/stores/team-store';
import { dialogueStore } from '@/stores/dialogue-store';
import { helperStore } from '@/stores/helper-store';
import { skillsStore } from '@/stores/skills-store';
import { locationStore } from '@/stores/location-store';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import { vitalsStore } from '@/stores/vitals-store';
import { Decimal, d, hpRatio, type Decimal as DecimalValue } from '@/lib/decimal';
import { bossStore } from '@/stores/boss-store';
import { createBossAiState, decideBossAction } from '@/lib/boss-ai';
import { getSkill } from '@/data/skills';
import { autoHelperSystem } from '@/systems/auto-helper-system';
import { scheduleHandleEnemyKill } from '@/systems/combat-rewards';
import {
  getEffectiveCombatStats,
  PLAYER_STATUS_UNIT_ID,
  scaledAttackCooldown,
} from '@/systems/combat-stats';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findNearestAliveEnemy, findUnclaimedEnemy } from '@/systems/find-nearest-enemy';
import type { LootManager } from '@/systems/loot-manager';
import { computeSkillFxAim, playPackFx, shouldSpawnAreaImpactFxPerTarget, spawnAreaImpactFxForTargets, type SkillFxAim } from '@/systems/pack-fx';
import { playPlayerPulse } from '@/systems/player-feedback';
import { SkillVfx } from '@/systems/skill-vfx';
import {
  scheduleOfficialSkillFx,
  SkillExecutionRuntime,
  type SkillExecution,
  type SkillImpact,
} from '@/systems/skill-execution';
import { tryApplySkillStatuses } from '@/systems/skill-status-apply';
import {
  createSkillRotationCursor,
  decideNextAction,
  formatCombatAiDecision,
  noteSkillRotationUsed,
  type CombatAiSlotInput,
  type SkillRotationCursor,
} from '@/systems/combat-decision';
import {
  applyDirectDamage,
  getStatusRuntime,
  type StatusEffectRuntime,
} from '@/systems/status-runtime';
import { warnHotbarSlotIssues } from '@/lib/dev/skill-visual-validation';
import { LEADER_CLAIM_ID, type TargetClaims } from '@/systems/target-claims';
import type { SkillDefinition } from '@/types/skill';
import type { CharacterSkillAnimDef } from '@/data/character-packs';

/**
 * Combate idle: Decision Engine escolhe Slot vs ataque básico.
 * Inimigos perseguem e golpeiam o jogador dentro de `chaseRadius`.
 * Pose / Cast Delay / VFX / Damage Trigger vêm da SkillDefinition + pack.
 */
export class CombatSystem {
  private readonly vfx: SkillVfx;
  private lastActionAt = 0;
  private lastJutsuAt = 0;
  private lastAiDebugKey = '';
  private skillRotation: SkillRotationCursor = createSkillRotationCursor();
  private rotationHuntId: string | null | undefined = undefined;
  private rotationCharacterId: string | null = null;
  /** Último tick de regen passiva (scene time) — delta, não por frame. */
  private lastEnergyTickAt = 0;
  /** Quando o jogador pode reviver após a morte (ms scene). */
  private playerRespawnAt = 0;
  /** Mira visual do VFX (`targeting`). */
  private pendingFxAim: SkillFxAim | null = null;
  private readonly executions = new SkillExecutionRuntime();
  private readonly statuses: StatusEffectRuntime;
  private lastBossTick = 0;
  private readonly bossAi = createBossAiState();
  private lastBossActionAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
    private readonly lootManager: LootManager,
    /** Reserva de alvos da equipe: o líder não briga pelo alvo dos aliados. */
    private readonly claims: TargetClaims | null = null,
  ) {
    this.vfx = new SkillVfx(scene);
    this.statuses = getStatusRuntime(scene);
    this.bindStatusHooks();
    warnHotbarSlotIssues(player.pack);
  }

  destroy(): void {
    this.executions.cancelAll();
    this.statuses.clearAll();
  }

  private effectiveSkill(skillId: string) {
    return resolveEffectiveSkill(
      skillId,
      resolveAwakeningRuntime({
        characterId: this.player.pack.id,
        instanceId: this.player.instanceId,
      }),
    );
  }

  /** Test Lab: executa a skill real (animação + VFX + hitDelay) no alvo. */
  castLabSkill(skillId: string, target: Enemy | null): boolean {
    const skill = this.effectiveSkill(skillId);
    if (!skill) return false;
    if (!skillsStore.isReady(skillId)) return false;

    const toX = target?.sprite.x ?? this.player.x + 80 * this.player.worldScale;
    const toY = target?.sprite.y ?? this.player.y;
    characterLabStore.pushEvent(`${skill.name} started`);
    const anim = this.player.getSkillAnim(skillId);
    const configured = anim?.hitDelayMs ?? skill.animation.durationMs ?? 280;
    const startedAt = this.scene.time.now;
    characterLabStore.setHitDebug({ configuredMs: configured, appliedAtMs: -1 });

    if (skill.effect === 'heal') {
      this.lastActionAt = this.scene.time.now;
      this.lastJutsuAt = this.scene.time.now;
      this.cast(skill, this.player.x, this.player.y, () => {
        const current = vitalsStore.getSnapshot();
        const amount = Decimal.max(d(1), current.hpMax.mul(skill.healPercent ?? 0).floor());
        const healed = vitalsStore.heal(amount);
        if (healed.gt(0)) this.vfx.healNumber(this.player.x, this.player.y, healed);
        characterLabStore.pushEvent('heal applied');
        characterLabStore.setHitDebug({
          configuredMs: configured,
          appliedAtMs: Math.round(this.scene.time.now - startedAt),
        });
      }, null);
      return true;
    }

    this.lastActionAt = this.scene.time.now;
    this.lastJutsuAt = this.scene.time.now;
    this.pendingFxAim = computeSkillFxAim(this.player, target);
    this.cast(skill, toX, toY, (impact, execution) => {
      characterLabStore.pushEvent('hit applied');
      characterLabStore.setHitDebug({
        configuredMs: configured,
        appliedAtMs: Math.round(this.scene.time.now - startedAt),
      });
      this.applySkillImpact(skill, target, impact, execution, this.player.getSkillAnim(skillId));
    }, target?.id ?? null);
    if (anim?.fx) characterLabStore.pushEvent('VFX spawned');
    return true;
  }

  strikeLabBasic(target: Enemy | null): void {
    const toX = target?.sprite.x ?? this.player.x + 60;
    const toY = target?.sprite.y ?? this.player.y;
    this.player.faceToward(toX, toY);
    const hitDelay = this.player.playAttack();
    if (hitDelay <= 0) return;
    characterLabStore.pushEvent('attack started');
    const attackSheet = this.player.getCurrentAttackSheet();
    if (attackSheet?.fx) {
      const releaseAt = attackSheet.fxReleaseMs ?? Math.max(0, Math.floor(hitDelay * 0.55));
      this.scene.time.delayedCall(releaseAt, () => {
        playPackFx(this.scene, this.player, attackSheet.fx!.key, this.player.x, this.player.y, {
          ground: attackSheet.fxGround ?? true,
          bodyH: attackSheet.contentHeight,
          fxH: attackSheet.fx!.contentHeight ?? attackSheet.fx!.frameHeight,
          blend: attackSheet.fxBlend,
          scaleMult: attackSheet.fxScale,
          originX: attackSheet.fx!.originX,
          offsetX: attackSheet.fx!.offsetX,
          offsetY: attackSheet.fx!.offsetY,
        });
        characterLabStore.pushEvent('VFX spawned');
      });
    }
    this.scene.time.delayedCall(hitDelay, () => {
      characterLabStore.pushEvent('hit applied');
      if (!target?.isAlive) return;
      const damage = scaleOutgoingDamage(
        d(BASIC_ATTACK_FLAT).add(
          getEffectiveCombatStats(PLAYER_STATUS_UNIT_ID).attack.mul(BASIC_ATTACK_ATK_FACTOR).floor(),
        ),
      );
      if (this.hitEnemy(target, damage, PLAYER_STATUS_UNIT_ID)) {
        combatEnergyStore.gainFromBasicHit(1);
      }
    });
  }

  clearLabVfx(): void {
    // VFX do pack já se destroi sozinho ao terminar a animação.
  }

  update(time: number): void {
    this.bindStatusHooks();
    this.executions.updateFollow();
    this.statuses.updateFollow();

    // Item 41 correção: regen passiva no update de combate (delta time), inclusive
    // durante busy/skill/CD — mas NÃO após morte.
    if (this.player.isDead() || vitalsStore.isDead()) {
      this.lastEnergyTickAt = time;
    } else {
      this.tickPlayerEnergyRegen(time);
    }

    if (isLabBlockingHuntGameplay()) {
      this.enemyManager.update(time);
      return;
    }
    if (this.player.isDead() || vitalsStore.isDead()) {
      this.executions.cancelAll();
      this.statuses.clearTarget(PLAYER_STATUS_UNIT_ID);
      this.enemyManager.update(time);
      if (this.isBossFight()) {
        if (bossStore.getSnapshot().runtime) bossStore.finishDefeat('player-death');
        return;
      }
      // Ligou Auto Revive depois de morrer: agenda tentativa.
      if (this.playerRespawnAt <= 0 && helperStore.getSnapshot().autoRevive) {
        this.playerRespawnAt = time + PLAYER_DEATH_RESPAWN_MS;
      }
      this.tryPlayerRespawn(time);
      return;
    }

    const enemyHits = this.enemyManager.update(time, this.player.x, this.player.y);
    for (const raw of enemyHits) {
      this.applyEnemyHit(raw);
      if (this.player.isDead() || vitalsStore.isDead()) {
        if (this.isBossFight() && bossStore.getSnapshot().runtime) {
          bossStore.finishDefeat('player-death');
        }
        return;
      }
    }

    if (this.isBossFight()) {
      this.updateBossEncounter(time);
      if (bossStore.getSnapshot().result) return;
    }

    autoHelperSystem.tick(time);

    skillsStore.consumePendingCast();

    if (dialogueStore.isOpen()) return;
    if (this.statuses.isStunned(PLAYER_STATUS_UNIT_ID)) return;
    if (this.player.isBusy()) return;
    if (this.executions.blocksNewAction(this.player.pack.id)) return;
    if (time - this.lastActionAt < 140) return;

    const vitals = vitalsStore.getSnapshot();
    const nearest = findNearestAliveEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      IDLE_AGGRO_RANGE,
    );
    const level = Math.max(1, teamStore.getActive()?.level || 1);
    const hotbar = skillsStore.getSnapshot().hotbar;
    const slots: CombatAiSlotInput[] = ([1, 2, 3, 4] as const).map((slot) => {
      const skillId = hotbar[slot - 1] ?? null;
      const skill = skillId ? this.effectiveSkill(skillId) ?? null : null;
      if (skill && level < (skill.requiredLevel ?? 1)) {
        return { slot, skillId, skill: null, animAi: undefined };
      }
      return {
        slot,
        skillId,
        skill,
        animAi: skillId ? this.player.getSkillAnim(skillId)?.ai : undefined,
      };
    });

    const jutsuGap = scaledAttackCooldown(PLAYER_JUTSU_GAP_MS, PLAYER_STATUS_UNIT_ID);
    this.syncSkillRotationScope();
    const decision = decideNextAction({
      now: time,
      stunned: false,
      actionBlocked: false,
      skillGapBlocked: !isSkillCooldownIgnored() && time - this.lastJutsuAt < jutsuGap,
      selfHpRatio: hpRatio(vitals.hp, vitals.hpMax) || (vitals.hpMax.lte(0) ? 1 : 0),
      targetHpRatio: nearest ? hpRatio(nearest.stats.hp, nearest.stats.hpMax) : null,
      energy: combatEnergyStore.getDecisionEnergy(),
      isSkillReady: (skillId) => skillsStore.isReady(skillId),
      getCooldownRemainingMs: (skillId) => skillsStore.getCooldownRemainingMs(skillId),
      hasStatus: (who, statusId) =>
        this.statuses.hasStatus(who === 'self' ? PLAYER_STATUS_UNIT_ID : (nearest?.id ?? ''), statusId),
      slots,
      nextSkillSlot: this.skillRotation.nextSlot,
    });

    this.publishSkillRotationDebug(decision);

    if (characterLabStore.getSnapshot().showAiDecisions) {
      characterLabStore.setAiDecision(decision);
      const key = formatCombatAiDecision(decision).join('|');
      if (key !== this.lastAiDebugKey) {
        this.lastAiDebugKey = key;
        if (process.env.NODE_ENV !== 'production') {
          for (const line of formatCombatAiDecision(decision)) {
            console.info(line);
          }
        }
      }
    }

    if (decision.action.kind === 'wait') return;
    if (decision.action.kind === 'skill') {
      if (this.tryCastSkill(time, decision.action.skillId)) {
        noteSkillRotationUsed(this.skillRotation, decision.action.slot, time);
        this.publishSkillRotationDebug(decision);
      }
      return;
    }
    this.tryBasicAttack(time);
  }

  private syncSkillRotationScope(): void {
    const huntId = locationStore.getSnapshot().huntId;
    const characterId = this.player.pack.id;
    if (this.rotationHuntId === huntId && this.rotationCharacterId === characterId) return;
    this.skillRotation = createSkillRotationCursor();
    this.rotationHuntId = huntId;
    this.rotationCharacterId = characterId;
    // Nova Hunt / troca de personagem: Energia cheia. Entre inimigos da mesma Hunt: persiste.
    combatEnergyStore.reset();
    this.lastEnergyTickAt = 0;
  }

  /** Regen passiva: energyRegenPerSecond * deltaSeconds (mesmo `time` do Combat Engine). */
  private tickPlayerEnergyRegen(time: number): void {
    if (this.lastEnergyTickAt <= 0) {
      this.lastEnergyTickAt = time;
      return;
    }
    const deltaSeconds = Math.max(0, (time - this.lastEnergyTickAt) / 1000);
    this.lastEnergyTickAt = time;
    if (deltaSeconds <= 0) return;
    combatEnergyStore.tickPassiveRegen(deltaSeconds);
  }

  private publishSkillRotationDebug(decision: ReturnType<typeof decideNextAction>): void {
    const action =
      decision.action.kind === 'skill'
        ? `Slot ${decision.action.slot} selected`
        : decision.action.kind === 'basic-attack'
          ? 'Basic Attack selected'
          : 'wait';
    characterLabStore.setSkillRotationDebug({
      nextSlot: this.skillRotation.nextSlot,
      lastUsedSlot: this.skillRotation.lastUsedSlot,
      slots: decision.slotStatuses,
      decision: action,
    });
  }

  private applyEnemyHit(rawDamage: number | DecimalValue): void {
    const raw = d(rawDamage);
    if (raw.lte(0) || this.player.isDead()) return;
    const hpBefore = vitalsStore.getSnapshot().hp;
    applyDirectDamage({
      runtime: this.statuses,
      targetId: PLAYER_STATUS_UNIT_ID,
      rawAmount: raw,
      sourceId: 'enemy',
      enemy: null,
      element: BASIC_ATTACK_ELEMENT,
      onKill: () => undefined,
    });
    if (this.player.isDead() || vitalsStore.isDead()) {
      this.executions.cancelAll();
      this.statuses.clearTarget(PLAYER_STATUS_UNIT_ID);
      this.player.playDeath();
      if (helperStore.getSnapshot().autoRevive) {
        this.playerRespawnAt = this.scene.time.now + PLAYER_DEATH_RESPAWN_MS;
      } else {
        this.playerRespawnAt = 0;
      }
      return;
    }
    if (vitalsStore.getSnapshot().hp.gte(hpBefore)) return;

    this.player.playHurt();
    if (!this.player.isCastingSkill()) {
      playPlayerPulse(this.scene, this.player.sprite, 0.92, 1.04, 70);
      this.player.sprite.setTintFill(0xff6b6b);
      this.scene.time.delayedCall(70, () => {
        if (!this.player.isDead() && !this.player.isCastingSkill()) {
          this.player.sprite.clearTint();
        }
      });
    }
  }

  private tryPlayerRespawn(time: number): void {
    if (this.playerRespawnAt <= 0 || time < this.playerRespawnAt) return;

    if (!helperStore.getSnapshot().autoRevive) {
      this.playerRespawnAt = 0;
      return;
    }

    if (!autoHelperSystem.tryConsumeRevive(time)) {
      // Sem item: tenta de novo em breve (ex.: comprou no market enquanto morto).
      this.playerRespawnAt = time + 1000;
      return;
    }

    this.playerRespawnAt = 0;
    vitalsStore.healFull();
    this.player.clearDeath();
    this.player.sprite.clearTint();
  }

  private tryBasicAttack(time: number): void {
    if (time - this.lastActionAt < scaledAttackCooldown(PLAYER_ATTACK_COOLDOWN_MS, PLAYER_STATUS_UNIT_ID)) {
      return;
    }

    const target = findUnclaimedEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      PLAYER_ATTACK_RANGE * this.player.worldScale,
      this.claims,
      LEADER_CLAIM_ID,
    );
    if (!target) return;

    this.claims?.claim(LEADER_CLAIM_ID, target.id);
    this.lastActionAt = time;
    this.player.faceToward(target.sprite.x, target.sprite.y);
    const hitDelay = this.player.playAttack();
    if (hitDelay <= 0) return;

    const attackSheet = this.player.getCurrentAttackSheet();
    if (attackSheet?.fx) {
      const releaseAt = attackSheet.fxReleaseMs ?? Math.max(0, Math.floor(hitDelay * 0.55));
      const attach = attackSheet.fxAttach ?? 'caster';
      const fromX = this.player.x;
      const fromY = this.player.y;
      const fxX = attach === 'caster' ? fromX : target.sprite.x;
      const fxY = attach === 'caster' ? fromY : target.sprite.y;
      this.scene.time.delayedCall(releaseAt, () => {
        playPackFx(this.scene, this.player, attackSheet.fx!.key, fxX, fxY, {
          ground: attackSheet.fxGround ?? attach === 'caster',
          bodyH: attackSheet.contentHeight,
          fxH: attackSheet.fx!.contentHeight ?? attackSheet.fx!.frameHeight,
          blend: attackSheet.fxBlend,
          scaleMult: attackSheet.fxScale,
          originX: attackSheet.fx!.originX,
          offsetX: attackSheet.fx!.offsetX,
          offsetY: attackSheet.fx!.offsetY,
        });
      });
    }

    this.scene.time.delayedCall(hitDelay, () => {
      if (!target.isAlive) return;
      const dropX = target.sprite.x;
      const dropY = target.sprite.y;
      this.vfx.playComboHit(dropX, dropY, this.player.sprite.scaleX * 0.95);
      const damage = scaleOutgoingDamage(
        d(BASIC_ATTACK_FLAT).add(
          getEffectiveCombatStats(PLAYER_STATUS_UNIT_ID).attack.mul(BASIC_ATTACK_ATK_FACTOR).floor(),
        ),
      );
      // Item 41: Energia só no hit confirmado de Basic Attack (applyDirectDamage true).
      if (this.hitEnemy(target, damage, PLAYER_STATUS_UNIT_ID)) {
        combatEnergyStore.gainFromBasicHit(1);
      }
    });
  }

  private skillEnergyCost(skill: SkillDefinition): number {
    return resolveSkillEnergyCost({
      ...skill.ai,
      ...this.player.getSkillAnim(skill.id)?.ai,
    });
  }

  private tryCastSkill(time: number, skillId: string): boolean {
    if (!skillsStore.isReady(skillId)) return false;

    const skill = this.effectiveSkill(skillId);
    if (!skill) return false;

    if (skill.effect === 'heal') {
      // Consumo no commit real (antes de cast / cooldown) — uma vez.
      if (!combatEnergyStore.spend(this.skillEnergyCost(skill))) return false;
      this.lastActionAt = time;
      this.lastJutsuAt = time;
      this.cast(skill, this.player.x, this.player.y, () => {
        const current = vitalsStore.getSnapshot();
        const amount = Decimal.max(d(1), current.hpMax.mul(skill.healPercent ?? 0).floor());
        const healed = vitalsStore.heal(amount);
        if (healed.gt(0)) this.vfx.healNumber(this.player.x, this.player.y, healed);
      }, null);
      return true;
    }

    const range = (skill.range ?? SKILL_DEFAULT_RANGE) * this.player.worldScale;
    const target = findNearestAliveEnemy(this.enemyManager, this.player.x, this.player.y, range);
    if (!target) return false;

    if (!combatEnergyStore.spend(this.skillEnergyCost(skill))) return false;

    this.lastActionAt = time;
    this.lastJutsuAt = time;
    this.pendingFxAim = computeSkillFxAim(this.player, target);
    this.cast(skill, target.sprite.x, target.sprite.y, (impact, execution) => {
      this.applySkillImpact(skill, target, impact, execution, this.player.getSkillAnim(skill.id));
    }, target.id);
    return true;
  }

  private cast(
    skill: SkillDefinition,
    toX: number,
    toY: number,
    onHit: (impact: SkillImpact, execution: SkillExecution) => void,
    targetId: string | null,
  ): void {
    skillsStore.startCooldown(skill.id, skill.cooldownMs);
    this.player.faceToward(toX, toY);

    const fromX = this.player.x;
    const fromY = this.player.y;
    const skillAnim = this.player.getSkillAnim(skill.id);
    const duration = skill.animation.durationMs ?? 280;
    const aim = this.pendingFxAim;
    this.pendingFxAim = null;
    const impactOnce: SkillImpact = { multiplier: 1, kind: 'single', index: 0 };
    const primary = targetId ? this.enemyManager.get(targetId) ?? null : null;

    if (skill.animation.kind === 'character' || skillAnim) {
      const hitDelay = this.player.playSkillAnim(skill.id) ?? skillAnim?.hitDelayMs ?? duration;
      if (skill.dashToTarget) {
        this.dashPlayerToTarget(toX, toY, hitDelay, skill);
      }
      scheduleOfficialSkillFx({
        scene: this.scene,
        runtime: this.executions,
        player: this.player,
        skill,
        anim: skillAnim,
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        aim,
        targetId,
        hitDelayMs: hitDelay,
        isCasterDead: () => this.player.isDead(),
        isOriginalTargetDead: () => {
          if (!targetId) return false;
          const enemy = this.enemyManager.get(targetId);
          return !enemy || !enemy.isAlive;
        },
        getTargetPos: () => {
          if (!targetId) return { x: toX, y: toY };
          const enemy = this.enemyManager.get(targetId);
          if (!enemy) return null;
          return { x: enemy.sprite.x, y: enemy.sprite.y };
        },
        onHit,
        onStatusMoment: (moment, execution) => {
          this.applyStatuses(skill, skillAnim, moment, execution, primary, primary ? [primary] : [], 0);
        },
      });
      return;
    }

    this.vfx.play(skill, { fromX, fromY, toX, toY });
    playPlayerPulse(this.scene, this.player.sprite, 1.06, 0.96, 60);
    const synthetic: SkillExecution = {
      executionId: `legacy-${skill.id}`,
      characterId: this.player.pack.id,
      skillId: skill.id,
      slot: null,
      targetId,
      startedAt: this.scene.time.now,
      endsAt: null,
      phase: 'impact',
      executionType: 'single-hit',
      currentHit: 0,
      tickCount: 0,
      damageApplied: false,
      damageArmed: true,
      cancelled: false,
      appliedKeys: new Set(),
      statusRolled: new Set(),
      activeVfx: [],
      followMode: null,
    };
    this.applyStatuses(skill, skillAnim, 'on-start', synthetic, primary, primary ? [primary] : [], 0);
    this.scene.time.delayedCall(duration, () => {
      onHit(impactOnce, synthetic);
      this.applyStatuses(skill, skillAnim, 'on-end', synthetic, primary, primary ? [primary] : [], 0);
    });
  }

  private applySkillImpact(
    skill: SkillDefinition,
    target: Enemy | null,
    impact: SkillImpact,
    execution: SkillExecution,
    anim: CharacterSkillAnimDef | undefined,
  ): void {
    if (impact.multiplier <= 0) return;
    let damage = scaleOutgoingDamage(
      Decimal.max(
        d(0),
        d(skill.damage)
          .add(getEffectiveCombatStats(PLAYER_STATUS_UNIT_ID).attack.mul(SKILL_ATTACK_ATK_FACTOR).floor())
          .mul(impact.multiplier)
          .floor(),
      ),
    );
    const active = teamStore.getActive();
    if (active && active.stars >= 3 && STAR_3_SPECIAL_DAMAGE_BONUS != null) {
      damage = damage.mul(1 + STAR_3_SPECIAL_DAMAGE_BONUS).floor();
    }
    if (damage.lte(0)) return;

    const radius = impact.kind === 'area' ? (impact.radius ?? skill.areaRadius) : skill.areaRadius;
    const origin = target?.isAlive ? target : null;
    const hit: Enemy[] = [];
    if (radius != null && radius > 0) {
      const ox = origin?.sprite.x ?? this.player.x;
      const oy = origin?.sprite.y ?? this.player.y;
      for (const enemy of this.enemyManager.values()) {
        if (!enemy.isAlive) continue;
        const distance = Phaser.Math.Distance.Between(ox, oy, enemy.sprite.x, enemy.sprite.y);
        if (distance > radius) continue;
        hit.push(enemy);
        this.hitEnemy(enemy, damage, PLAYER_STATUS_UNIT_ID, resolveSkillElement(skill, anim));
      }
    } else if (origin?.isAlive) {
      hit.push(origin);
      this.hitEnemy(origin, damage, PLAYER_STATUS_UNIT_ID, resolveSkillElement(skill, anim));
    }
    if (
      anim &&
      shouldSpawnAreaImpactFxPerTarget(anim, impact.kind, hit.length, radius)
    ) {
      spawnAreaImpactFxForTargets(this.scene, this.player, anim, hit, target?.id);
    }
    this.applyStatuses(skill, anim, 'on-hit', execution, target, hit, impact.index);
  }

  private hitEnemy(
    enemy: Enemy,
    damage: number | DecimalValue,
    sourceId: string,
    element: DamageElement = BASIC_ATTACK_ELEMENT,
  ): boolean {
    return applyDirectDamage({
      runtime: this.statuses,
      targetId: enemy.id,
      rawAmount: damage,
      sourceId,
      enemy,
      element,
      onKill: (killed) => this.onKill(killed, killed.sprite.x, killed.sprite.y),
    });
  }

  private applyStatuses(
    skill: SkillDefinition,
    anim: CharacterSkillAnimDef | undefined,
    moment: 'on-start' | 'on-hit' | 'on-end',
    execution: SkillExecution,
    primary: Enemy | null,
    hitTargets: Enemy[],
    hitIndex: number,
  ): void {
    tryApplySkillStatuses({
      scene: this.scene,
      skill,
      anim,
      moment,
      executionId: execution.executionId,
      rolledKeys: execution.statusRolled,
      casterId: PLAYER_STATUS_UNIT_ID,
      primaryTargetId: primary?.id ?? execution.targetId,
      hitTargets,
      hitIndex,
    });
  }

  private bindStatusHooks(): void {
    this.statuses.setHooks({
      getEnemy: (id) => this.enemyManager.get(id) ?? null,
      getTargetPos: (id) => {
        if (id === PLAYER_STATUS_UNIT_ID) return { x: this.player.x, y: this.player.y };
        const enemy = this.enemyManager.get(id);
        if (!enemy) return null;
        return { x: enemy.sprite.x, y: enemy.sprite.y };
      },
      isPlayerDead: () => this.player.isDead() || vitalsStore.isDead(),
      onEnemyKilled: (enemy) => this.onKill(enemy, enemy.sprite.x, enemy.sprite.y),
    });
  }

  /**
   * Avança o jogador até `contactRange` do alvo.
   * - Lunge curto (Raikiri): sem `dashStartMs` → impulso nos últimos ~160–360ms.
   * - Investida (corrida / charge): `dashStartMs` → deslocamento contínuo até o hit.
   */
  private dashPlayerToTarget(
    toX: number,
    toY: number,
    hitDelayMs: number,
    skill: SkillDefinition,
  ): void {
    const contact = (skill.contactRange ?? PLAYER_ATTACK_RANGE * 0.85) * this.player.worldScale;
    const fromX = this.player.x;
    const fromY = this.player.y;
    const dist = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    if (dist <= contact) return;

    const ratio = 1 - contact / dist;
    const endX = fromX + (toX - fromX) * ratio;
    const endY = fromY + (toY - fromY) * ratio;

    let dashStart: number;
    let dashDuration: number;
    let ease: string;

    if (skill.dashStartMs != null) {
      // Investida prolongada: começa no run do sheet e chega no hitDelay.
      dashStart = Math.max(0, Math.min(skill.dashStartMs, Math.max(0, hitDelayMs - 80)));
      const remaining = Math.max(80, hitDelayMs - dashStart);
      dashDuration =
        skill.dashDurationMs != null
          ? Math.max(80, Math.min(skill.dashDurationMs, remaining))
          : remaining;
      ease = 'Linear';
    } else {
      // Impulso final (legado Raikiri).
      dashDuration =
        skill.dashDurationMs != null
          ? skill.dashDurationMs
          : Math.min(360, Math.max(160, Math.floor(hitDelayMs * 0.16)));
      dashStart = Math.max(0, hitDelayMs - dashDuration);
      ease = 'Cubic.easeIn';
    }

    this.scene.time.delayedCall(dashStart, () => {
      this.player.sprite.setVelocity(0, 0);
      this.scene.tweens.add({
        targets: this.player.sprite,
        x: endX,
        y: endY,
        duration: dashDuration,
        ease,
        onUpdate: () => this.player.syncPresentation(),
        onComplete: () => this.player.syncPresentation(),
      });
    });
  }

  private isBossFight(): boolean {
    return locationStore.getSnapshot().encounterKind === 'boss' || bossStore.isEncounterActive();
  }

  private updateBossEncounter(time: number): void {
    const runtime = bossStore.getSnapshot().runtime;
    if (!runtime) {
      this.enemyManager.setHuntPaused(true);
      return;
    }
    const dt = this.lastBossTick > 0 ? time - this.lastBossTick : 0;
    this.lastBossTick = time;
    const pendingHp = bossStore.consumePendingHp();
    const bossEnemy = this.enemyManager.get(runtime.bossId);
    if (bossEnemy && pendingHp != null) {
      bossEnemy.setHp(pendingHp);
      if (pendingHp <= 0) {
        this.onKill(bossEnemy, bossEnemy.sprite.x, bossEnemy.sprite.y);
        return;
      }
    }
    if (bossEnemy) bossStore.syncFromEnemy(bossEnemy.stats.hp, bossEnemy.stats.hpMax);
    if (bossStore.getSnapshot().runtime?.guildContext) {
      void import('@/stores/guild-boss-store').then(({ guildBossStore }) => {
        guildBossStore.pollSharedDefeat();
      });
    }
    if (bossStore.getSnapshot().runtime?.worldBossContext) {
      void import('@/stores/world-boss-store').then(({ worldBossStore }) => {
        worldBossStore.pollSharedDefeat();
      });
    }
    if (bossStore.tickTimer(dt)) {
      bossStore.finishDefeat('timeout');
      this.executions.cancelAll();
      this.statuses.clearAll();
      this.enemyManager.setHuntPaused(true);
      return;
    }
    if (!bossEnemy?.isAlive) return;
    if (time - this.lastBossActionAt < 220) return;
    if (this.statuses.isStunned(bossEnemy.id)) return;
    const skills = bossStore.currentSkills();
    const decision = decideBossAction({
      now: time,
      state: this.bossAi,
      skillIds: skills,
      stunned: false,
      skillGapMs: 700,
      selfHpRatio: hpRatio(bossEnemy.stats.hp, bossEnemy.stats.hpMax) || (bossEnemy.stats.hpMax.lte(0) ? 1 : 0),
      targetHpRatio: (() => {
        const v = vitalsStore.getSnapshot();
        return hpRatio(v.hp, v.hpMax) || (v.hpMax.lte(0) ? 1 : 0);
      })(),
    });
    if (decision.action.kind === 'wait') return;
    this.lastBossActionAt = time;
    if (decision.action.kind === 'basic-attack') {
      bossStore.noteSkill(null);
      const dmg = bossEnemy.triggerBasicAttack(time);
      if (dmg != null) this.applyEnemyHit(dmg.mul(bossStore.currentDamageMul()).floor());
      return;
    }
    const skill = getSkill(decision.action.skillId);
    bossStore.noteSkill(decision.action.skillId);
    if (!skill) return;
    const damage = Decimal.max(d(1), d((skill.damage ?? 8) * bossStore.currentDamageMul()).floor());
    this.applyEnemyHit(damage);
  }

  private onKill(enemy: Enemy, dropX: number, dropY: number): void {
    if (this.isBossFight()) {
      bossStore.syncFromEnemy(d(0), enemy.stats.hpMax);
      bossStore.finishVictory({ officialReward: true });
      this.executions.cancelAll();
      this.enemyManager.setHuntPaused(true);
      return;
    }
    scheduleHandleEnemyKill(this.scene, enemy, this.lootManager, dropX, dropY);
    this.enemyManager.onEnemyKilled(enemy.id);
  }
}
