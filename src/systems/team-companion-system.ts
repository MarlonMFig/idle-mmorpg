import * as Phaser from 'phaser';
import {
  IDLE_AGGRO_RANGE,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_JUTSU_GAP_MS,
} from '@/constants/combat';
import {
  COMPANION_BASIC_ATTACK_FLAT,
  SKILL_ATTACK_ATK_FACTOR,
} from '@/constants/combat-damage';
import { isSkillCooldownIgnored, scaleOutgoingDamage } from '@/config/devConfig';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { BASIC_ATTACK_ELEMENT, resolveSkillElement, type DamageElement } from '@/data/damage-elements';
import { resolveEffectiveSkill, resolveSkillWithAnim } from '@/lib/resolve-effective-skill';
import { Decimal, d, hpRatio } from '@/lib/decimal';
import type { Enemy } from '@/entities/enemy';
import type { Player } from '@/entities/player';
import { scheduleHandleEnemyKill } from '@/systems/combat-rewards';
import {
  getEffectiveCombatStats,
  scaledAttackCooldown,
} from '@/systems/combat-stats';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findUnclaimedEnemy } from '@/systems/find-nearest-enemy';
import { IdleAiSystem } from '@/systems/idle-ai-system';
import { locationStore } from '@/stores/location-store';
import {
  createCombatEnergyPool,
} from '@/stores/combat-energy-store';
import { resolveSkillEnergyCost } from '@/data/skill-ai-def';
import {
  createSkillRotationCursor,
  decideNextAction,
  noteSkillRotationUsed,
  type CombatAiSlotInput,
  type SkillRotationCursor,
} from '@/systems/combat-decision';
import type { LootManager } from '@/systems/loot-manager';
import {
  computeSkillFxAim,
  poseAttackAnimAsFx,
  shouldSpawnAreaImpactFxPerTarget,
  spawnAreaImpactFxForTargets,
} from '@/systems/pack-fx';
import { SkillVfx } from '@/systems/skill-vfx';
import { scheduleOfficialSkillFx, SkillExecutionRuntime, type SkillExecution, type SkillImpact } from '@/systems/skill-execution';
import { resolveBuffDurationMs, tryApplySkillStatuses } from '@/systems/skill-status-apply';
import { applyDirectDamage, getStatusRuntime } from '@/systems/status-runtime';
import type { TargetClaims } from '@/systems/target-claims';
import type { SkillDefinition } from '@/types/skill';

/** Formação atrás do líder (px de mundo, escala nativa do mapa). */
const FORMATION_BACK_PX = 64;
const FORMATION_SIDE_PX = 40;
const FORMATION_REACHED_PX = 12;
/** Longe demais (ex.: preso numa parede): teleporta para não sumir do grupo. */
const FORMATION_TELEPORT_PX = 640;
/** Aliado ajuda de verdade, sem triplicar o dano do personagem ativo. */
const COMPANION_DAMAGE_FACTOR = 0.45;

type CompanionEnergyPool = ReturnType<typeof createCombatEnergyPool>;

export interface TeamCompanion {
  id: string;
  player: Player;
  /** Nível do membro; filtra os jutsus liberados na hotbar do pack. */
  level?: number;
}

export interface TeamCompanionOptions {
  collisionLayer?: Phaser.Tilemaps.TilemapLayer | null;
  enemyManager?: EnemyManager | null;
  lootManager?: LootManager | null;
  /** Reserva de alvos compartilhada com o líder: um monstro por caçador. */
  claims?: TargetClaims | null;
}

/**
 * Os outros dois membros da equipe no mapa: seguem o líder em formação e,
 * com inimigo por perto, caçam junto com a mesma IA idle do jogador —
 * combo básico e os jutsus da própria hotbar, com FX do pack.
 */
export class TeamCompanionSystem {
  private headingX = 0;
  private headingY = 1;
  private readonly combatAi: Array<IdleAiSystem | null>;
  private readonly vfx: SkillVfx;
  private readonly lastAttackAt = new Map<string, number>();
  /**
   * Cooldowns próprios: `skillsStore` pertence ao personagem ativo, então cada
   * aliado guarda o seu `readyAt` por `companionId:skillId`.
   */
  private readonly skillReadyAt = new Map<string, number>();
  private readonly lastJutsuAt = new Map<string, number>();
  private readonly skillRotation = new Map<string, SkillRotationCursor>();
  private readonly energyPools = new Map<string, CompanionEnergyPool>();
  /** Último tick de regen por companion (scene time). */
  private readonly lastEnergyTickAt = new Map<string, number>();
  private rotationHuntId: string | null | undefined = undefined;
  private readonly executions = new SkillExecutionRuntime();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly leader: Player,
    private readonly companions: TeamCompanion[],
    private readonly options: TeamCompanionOptions = {},
  ) {
    this.vfx = new SkillVfx(scene);
    this.combatAi = companions.map(({ id, player }) =>
      options.enemyManager
        ? new IdleAiSystem(player, options.enemyManager, options.collisionLayer ?? null, {
            claims: options.claims ?? null,
            claimantId: id,
          })
        : null,
    );
  }

  update(time: number): void {
    this.updateHeading();

    for (let index = 0; index < this.companions.length; index += 1) {
      const companion = this.companions[index];
      // Regen passiva individual (mesmo tempo lógico do update) — sem setInterval.
      this.tickCompanionEnergyRegen(companion.id, time);

      const enemyManager = this.options.enemyManager;
      const target = enemyManager
        ? findUnclaimedEnemy(
            enemyManager,
            companion.player.x,
            companion.player.y,
            IDLE_AGGRO_RANGE,
            this.options.claims ?? null,
            companion.id,
          )
        : null;

      if (target) {
        this.combatAi[index]?.update();
        const unitId = `companion:${companion.id}`;
        if (getStatusRuntime(this.scene).isStunned(unitId)) {
          companion.player.syncPresentation();
          continue;
        }
        this.decideCompanionAction(companion, time, target);
      } else {
        this.options.claims?.release(companion.id);
        this.followFormation(companion.player, index);
      }
      companion.player.syncPresentation();
    }
    this.executions.updateFollow();
    getStatusRuntime(this.scene).updateFollow();
  }

  private tickCompanionEnergyRegen(companionId: string, time: number): void {
    const last = this.lastEnergyTickAt.get(companionId) ?? 0;
    if (last <= 0) {
      this.lastEnergyTickAt.set(companionId, time);
      return;
    }
    const deltaSeconds = Math.max(0, (time - last) / 1000);
    this.lastEnergyTickAt.set(companionId, time);
    if (deltaSeconds <= 0) return;
    this.energyFor(companionId).tickPassiveRegen(deltaSeconds);
  }

  destroy(): void {
    this.executions.cancelAll();
    for (const companion of this.companions) {
      getStatusRuntime(this.scene).clearTarget(`companion:${companion.id}`);
      this.options.claims?.release(companion.id);
      companion.player.destroy();
    }
    this.companions.length = 0;
    this.lastAttackAt.clear();
    this.skillReadyAt.clear();
    this.lastJutsuAt.clear();
    this.skillRotation.clear();
  }

  private updateHeading(): void {
    const body = this.leader.sprite.body as Phaser.Physics.Arcade.Body | null;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    const length = Math.hypot(vx, vy);
    if (length < 4) return;
    this.headingX = vx / length;
    this.headingY = vy / length;
  }

  /** Um de cada lado, atrás do líder — como no vídeo de referência. */
  private followFormation(player: Player, index: number): void {
    const side = index === 0 ? -FORMATION_SIDE_PX : FORMATION_SIDE_PX;
    const back = FORMATION_BACK_PX * player.worldScale;
    const perpendicularX = -this.headingY;
    const perpendicularY = this.headingX;
    const targetX =
      this.leader.x - this.headingX * back + perpendicularX * side * player.worldScale;
    const targetY =
      this.leader.y - this.headingY * back + perpendicularY * side * player.worldScale;

    const distance = Phaser.Math.Distance.Between(player.x, player.y, targetX, targetY);
    if (distance > FORMATION_TELEPORT_PX * player.worldScale) {
      player.sprite.setPosition(targetX, targetY);
      player.stop();
      return;
    }
    player.moveToward(targetX, targetY, FORMATION_REACHED_PX * player.worldScale);
  }

  /**
   * Decision Engine do aliado. Heal continua fora (aliado não tem HP próprio).
   */
  private decideCompanionAction(companion: TeamCompanion, time: number, focus: Enemy): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager) return;
    if (companion.player.isBusy()) return;
    if (this.executions.blocksNewAction(companion.player.pack.id)) return;
    const unitId = `companion:${companion.id}`;
    if (getStatusRuntime(this.scene).isStunned(unitId)) return;
    const lastAction = this.lastAttackAt.get(companion.id) ?? 0;
    if (time - lastAction < 140) return;

    const level = Math.max(1, companion.level ?? 1);
    const ids = companion.player.pack.hotbarSkillIds ?? [];
    const slots: CombatAiSlotInput[] = ([1, 2, 3, 4] as const).map((slot) => {
      const skillId = ids[slot - 1] ?? null;
      const baseSkill = skillId
        ? resolveEffectiveSkill(skillId, companion.player.pack.id)
        : null;
      const skill = baseSkill ? resolveSkillWithAnim(baseSkill, companion.player.getSkillAnim(skillId!)) : null;
      if (!skill || skill.effect === 'heal' || level < (skill.requiredLevel ?? 1)) {
        return { slot, skillId, skill: skill && skill.effect === 'heal' ? skill : null, animAi: undefined };
      }
      return {
        slot,
        skillId,
        skill,
        animAi: companion.player.getSkillAnim(skill.id)?.ai,
      };
    });
    // Heal: marcar como inválido para a IA do aliado (não tem HP).
    for (const row of slots) {
      if (row.skill?.effect === 'heal') row.skill = null;
    }

    const jutsuGap = scaledAttackCooldown(PLAYER_JUTSU_GAP_MS, unitId);
    const rotation = this.rotationFor(companion.id);
    const energy = this.energyFor(companion.id);
    const decision = decideNextAction({
      now: time,
      stunned: false,
      actionBlocked: false,
      skillGapBlocked: !isSkillCooldownIgnored() && time - (this.lastJutsuAt.get(companion.id) ?? -Infinity) < jutsuGap,
      selfHpRatio: 1,
      targetHpRatio: hpRatio(focus.stats.hp, focus.stats.hpMax),
      energy: energy.current,
      isSkillReady: (skillId) =>
        isSkillCooldownIgnored() || time >= (this.skillReadyAt.get(`${companion.id}:${skillId}`) ?? 0),
      getCooldownRemainingMs: (skillId) =>
        Math.max(0, (this.skillReadyAt.get(`${companion.id}:${skillId}`) ?? 0) - time),
      hasStatus: (who, statusId) =>
        getStatusRuntime(this.scene).hasStatus(who === 'self' ? unitId : focus.id, statusId),
      slots,
      nextSkillSlot: rotation.nextSlot,
    });

    if (decision.action.kind === 'skill') {
      if (this.tryCastCompanionSkill(companion, time, decision.action.skillId)) {
        noteSkillRotationUsed(rotation, decision.action.slot, time);
      }
      return;
    }
    this.tryBasicAttack(companion, time);
  }

  private energyFor(companionId: string): CompanionEnergyPool {
    let pool = this.energyPools.get(companionId);
    if (!pool) {
      pool = createCombatEnergyPool();
      this.energyPools.set(companionId, pool);
    }
    return pool;
  }

  private rotationFor(companionId: string): SkillRotationCursor {
    const huntId = locationStore.getSnapshot().huntId;
    if (this.rotationHuntId !== huntId) {
      this.skillRotation.clear();
      this.energyPools.clear();
      this.lastEnergyTickAt.clear();
      this.rotationHuntId = huntId;
    }
    let cursor = this.skillRotation.get(companionId);
    if (!cursor) {
      cursor = createSkillRotationCursor();
      this.skillRotation.set(companionId, cursor);
    }
    return cursor;
  }

  private tryCastCompanionSkill(companion: TeamCompanion, time: number, skillId: string): boolean {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager || companion.player.isBusy()) return false;
    const baseSkill = resolveEffectiveSkill(skillId, companion.player.pack.id);
    const skill = baseSkill ? resolveSkillWithAnim(baseSkill, companion.player.getSkillAnim(skillId)) : null;
    if (!skill || skill.effect === 'heal') return false;
    if (
      !isSkillCooldownIgnored() &&
      time < (this.skillReadyAt.get(`${companion.id}:${skill.id}`) ?? 0)
    ) {
      return false;
    }
    const range = (skill.range ?? SKILL_DEFAULT_RANGE) * companion.player.worldScale;
    const target =
      skill.effect === 'buff'
        ? null
        : findUnclaimedEnemy(
            enemyManager,
            companion.player.x,
            companion.player.y,
            range,
            this.options.claims ?? null,
            companion.id,
          );
    if (!target && skill.effect !== 'buff') return false;

    const energy = this.energyFor(companion.id);
    const cost = resolveSkillEnergyCost({
      ...skill.ai,
      ...companion.player.getSkillAnim(skill.id)?.ai,
    });
    if (!energy.spend(cost)) return false;

    if (target) this.options.claims?.claim(companion.id, target.id);
    this.skillReadyAt.set(`${companion.id}:${skill.id}`, time + skill.cooldownMs);
    this.lastJutsuAt.set(companion.id, time);
    this.lastAttackAt.set(companion.id, time);
    this.cast(
      companion,
      skill,
      target,
      target ? (impact, execution) => this.applySkillDamage(companion, skill, target, impact, execution) : () => undefined,
    );
    return true;
  }

  /** Anima o cast do aliado (folha do pack ou VFX genérico) e agenda o dano. */
  private cast(
    companion: TeamCompanion,
    skill: SkillDefinition,
    target: Enemy | null,
    onHit: (impact: SkillImpact, execution: SkillExecution) => void,
  ): void {
    const player = companion.player;
    const fromX = player.x;
    const fromY = player.y;
    const toX = target?.sprite.x ?? player.x;
    const toY = target?.sprite.y ?? player.y;
    const targetId = target?.id ?? null;
    const unitId = `companion:${companion.id}`;
    player.faceToward(toX, toY);

    const rawAnim = player.getSkillAnim(skill.id);
    const anim = poseAttackAnimAsFx(rawAnim);
    const duration = skill.animation.durationMs ?? 280;
    const hitDelay = (anim ? player.playSkillAnim(skill.id) : null) ?? anim?.hitDelayMs ?? duration;

    if (anim) {
      scheduleOfficialSkillFx({
        scene: this.scene,
        runtime: this.executions,
        player,
        skill,
        anim,
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        aim: computeSkillFxAim(player, target),
        targetId,
        hitDelayMs: hitDelay,
        isCasterDead: () => player.isDead(),
        isOriginalTargetDead: () => {
          if (!targetId) return false;
          const enemy = this.options.enemyManager?.get(targetId);
          return !enemy || !enemy.isAlive;
        },
        getTargetPos: () => {
          if (!targetId) return { x: player.x, y: player.y };
          const enemy = targetId ? this.options.enemyManager?.get(targetId) : null;
          if (!enemy) return null;
          return { x: enemy.sprite.x, y: enemy.sprite.y };
        },
        onHit,
        onStatusMoment: (moment, execution) => {
          if (moment === 'on-start' && skill.effect === 'buff' && rawAnim?.buffAuraEnabled) {
            player.activateBuffAura(rawAnim, resolveBuffDurationMs(rawAnim, skill));
          }
          tryApplySkillStatuses({
            scene: this.scene,
            skill,
            anim,
            moment,
            executionId: execution.executionId,
            rolledKeys: execution.statusRolled,
            casterId: unitId,
            primaryTargetId: targetId,
            hitTargets: target ? [target] : [],
            hitIndex: 0,
          });
        },
      });
      return;
    }

    this.vfx.play(skill, { fromX, fromY, toX, toY });
    const synthetic: SkillExecution = {
      executionId: `legacy-${companion.id}-${skill.id}`,
      characterId: player.pack.id,
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
    this.scene.time.delayedCall(duration, () => onHit({ multiplier: 1, kind: 'single', index: 0 }, synthetic));
  }

  private applySkillDamage(
    companion: TeamCompanion,
    skill: SkillDefinition,
    target: Enemy,
    impact: SkillImpact,
    execution: SkillExecution,
  ): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager || impact.multiplier <= 0) return;
    const unitId = `companion:${companion.id}`;
    const anim = companion.player.getSkillAnim(skill.id);

    const damage = scaleOutgoingDamage(
      Decimal.max(
        d(1),
        d(skill.damage)
          .add(getEffectiveCombatStats(unitId).attack.mul(SKILL_ATTACK_ATK_FACTOR))
          .mul(COMPANION_DAMAGE_FACTOR)
          .mul(impact.multiplier)
          .floor(),
      ),
    );

    const radius = impact.kind === 'area' ? (impact.radius ?? skill.areaRadius) : skill.areaRadius;
    const hit: Enemy[] = [];
    if (radius != null && radius > 0) {
      const centerX = target.sprite.x;
      const centerY = target.sprite.y;
      for (const enemy of enemyManager.values()) {
        if (!enemy.isAlive) continue;
        const distance = Phaser.Math.Distance.Between(
          centerX,
          centerY,
          enemy.sprite.x,
          enemy.sprite.y,
        );
        if (distance > radius) continue;
        hit.push(enemy);
        this.damageEnemy(enemy, damage, unitId, resolveSkillElement(skill, anim));
      }
    } else if (target.isAlive) {
      hit.push(target);
      this.damageEnemy(target, damage, unitId, resolveSkillElement(skill, anim));
    }
    if (anim && shouldSpawnAreaImpactFxPerTarget(anim, impact.kind, hit.length, radius)) {
      spawnAreaImpactFxForTargets(this.scene, companion.player, anim, hit, target.id);
    }
    tryApplySkillStatuses({
      scene: this.scene,
      skill,
      anim,
      moment: 'on-hit',
      executionId: execution.executionId,
      rolledKeys: execution.statusRolled,
      casterId: unitId,
      primaryTargetId: target.id,
      hitTargets: hit,
      hitIndex: impact.index,
    });
  }

  private damageEnemy(enemy: Enemy, damage: number | import('@/lib/decimal').Decimal, sourceId: string, element?: DamageElement): boolean {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager) return false;

    return applyDirectDamage({
      runtime: getStatusRuntime(this.scene),
      targetId: enemy.id,
      rawAmount: damage,
      sourceId,
      enemy,
      element: element ?? BASIC_ATTACK_ELEMENT,
      onKill: (killed) => {
        scheduleHandleEnemyKill(this.scene, killed);
        enemyManager.onEnemyKilled(killed.id);
      },
    });
  }

  private tryBasicAttack(companion: TeamCompanion, time: number): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    const unitId = `companion:${companion.id}`;
    if (!enemyManager || !lootManager || companion.player.isBusy()) return;
    if (getStatusRuntime(this.scene).isStunned(unitId)) return;

    const lastAttack = this.lastAttackAt.get(companion.id) ?? 0;
    if (time - lastAttack < scaledAttackCooldown(PLAYER_ATTACK_COOLDOWN_MS, unitId)) return;

    const target = findUnclaimedEnemy(
      enemyManager,
      companion.player.x,
      companion.player.y,
      PLAYER_ATTACK_RANGE * companion.player.worldScale,
      this.options.claims ?? null,
      companion.id,
    );
    if (!target) return;

    companion.player.faceToward(target.sprite.x, target.sprite.y);
    const hitDelay = companion.player.playAttack();
    if (hitDelay <= 0) return;
    this.lastAttackAt.set(companion.id, time);

    this.scene.time.delayedCall(hitDelay, () => {
      if (!target.isAlive) return;
      const damage = scaleOutgoingDamage(
        d(COMPANION_BASIC_ATTACK_FLAT).add(
          getEffectiveCombatStats(unitId).attack.mul(COMPANION_DAMAGE_FACTOR).floor(),
        ),
      );
      if (this.damageEnemy(target, damage, unitId)) {
        this.energyFor(companion.id).gainFromBasicHit(1);
      }
    });
  }
}
