import * as Phaser from 'phaser';
import {
  IDLE_AGGRO_RANGE,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_JUTSU_GAP_MS,
} from '@/constants/combat';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import type { Enemy } from '@/entities/enemy';
import type { Player } from '@/entities/player';
import { attributesStore } from '@/stores/attributes-store';
import { handleEnemyKill } from '@/systems/combat-rewards';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findUnclaimedEnemy } from '@/systems/find-nearest-enemy';
import { IdleAiSystem } from '@/systems/idle-ai-system';
import type { LootManager } from '@/systems/loot-manager';
import { scheduleSkillFx } from '@/systems/pack-fx';
import { SkillVfx } from '@/systems/skill-vfx';
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
  private readonly jutsuStep = new Map<string, number>();

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
        if (!this.tryJutsu(companion, time)) {
          this.tryBasicAttack(companion, time);
        }
      } else {
        this.options.claims?.release(companion.id);
        this.followFormation(companion.player, index);
      }
      companion.player.syncPresentation();
    }
  }

  destroy(): void {
    for (const companion of this.companions) {
      this.options.claims?.release(companion.id);
      companion.player.destroy();
    }
    this.companions.length = 0;
    this.lastAttackAt.clear();
    this.skillReadyAt.clear();
    this.lastJutsuAt.clear();
    this.jutsuStep.clear();
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

  /** Jutsus liberados na hotbar do pack do aliado (cura fica de fora: ele não tem HP). */
  private companionSkills(companion: TeamCompanion): SkillDefinition[] {
    const level = Math.max(1, companion.level ?? 1);
    const ids = companion.player.pack.hotbarSkillIds ?? [];
    const skills: SkillDefinition[] = [];
    for (const id of ids) {
      const skill = getSkill(id);
      if (!skill || skill.effect === 'heal') continue;
      if (level < (skill.requiredLevel ?? 1)) continue;
      skills.push(skill);
    }
    return skills;
  }

  /**
   * Rotação de jutsus do aliado, no mesmo ritmo do líder.
   * @returns true quando lançou (o chamador então não usa o combo básico).
   */
  private tryJutsu(companion: TeamCompanion, time: number): boolean {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager || companion.player.isBusy()) return false;
    if (time - (this.lastJutsuAt.get(companion.id) ?? -Infinity) < PLAYER_JUTSU_GAP_MS) {
      return false;
    }

    const skills = this.companionSkills(companion);
    if (skills.length === 0) return false;

    const step = this.jutsuStep.get(companion.id) ?? 0;
    const readyOffset = Array.from({ length: skills.length }, (_, offset) => offset).find(
      (offset) => {
        const skill = skills[(step + offset) % skills.length];
        return time >= (this.skillReadyAt.get(`${companion.id}:${skill.id}`) ?? 0);
      },
    );
    if (readyOffset == null) return false;

    const index = (step + readyOffset) % skills.length;
    const skill = skills[index];
    const range = (skill.range ?? SKILL_DEFAULT_RANGE) * companion.player.worldScale;
    const target = findUnclaimedEnemy(
      enemyManager,
      companion.player.x,
      companion.player.y,
      range,
      this.options.claims ?? null,
      companion.id,
    );
    if (!target) return false;

    this.options.claims?.claim(companion.id, target.id);
    this.jutsuStep.set(companion.id, (index + 1) % skills.length);
    this.skillReadyAt.set(`${companion.id}:${skill.id}`, time + skill.cooldownMs);
    this.lastJutsuAt.set(companion.id, time);
    this.lastAttackAt.set(companion.id, time);

    this.cast(companion, skill, target, () => this.applySkillDamage(skill, target));
    return true;
  }

  /** Anima o cast do aliado (folha do pack ou VFX genérico) e agenda o dano. */
  private cast(
    companion: TeamCompanion,
    skill: SkillDefinition,
    target: Enemy,
    onHit: () => void,
  ): void {
    const player = companion.player;
    const fromX = player.x;
    const fromY = player.y;
    const toX = target.sprite.x;
    const toY = target.sprite.y;
    player.faceToward(toX, toY);

    const anim = player.getSkillAnim(skill.id);
    const hitDelay = anim ? player.playSkillAnim(skill.id) : null;

    if (anim && hitDelay != null) {
      scheduleSkillFx(
        this.scene,
        player,
        anim,
        hitDelay,
        { x: fromX, y: fromY },
        { x: toX, y: toY },
      );
      this.scene.time.delayedCall(hitDelay, onHit);
      return;
    }

    // Sem folha de jutsu no pack: cai no VFX genérico do elemento.
    const duration = skill.animation.durationMs ?? 280;
    this.vfx.play(skill, { fromX, fromY, toX, toY });
    this.scene.time.delayedCall(duration, onHit);
  }

  private applySkillDamage(skill: SkillDefinition, target: Enemy): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager) return;

    const damage = Math.max(
      1,
      Math.floor((skill.damage + attributesStore.getStrength() * 0.35) * COMPANION_DAMAGE_FACTOR),
    );

    if (skill.areaRadius != null) {
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
        if (distance > skill.areaRadius) continue;
        this.damageEnemy(enemy, damage);
      }
      return;
    }

    if (target.isAlive) this.damageEnemy(target, damage);
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager) return;

    const dropX = enemy.sprite.x;
    const dropY = enemy.sprite.y;
    if (!enemy.takeDamage(damage)) return;
    handleEnemyKill(enemy, lootManager, dropX, dropY);
    enemyManager.onEnemyKilled(enemy.id);
  }

  private tryBasicAttack(companion: TeamCompanion, time: number): void {
    const enemyManager = this.options.enemyManager;
    const lootManager = this.options.lootManager;
    if (!enemyManager || !lootManager || companion.player.isBusy()) return;

    const lastAttack = this.lastAttackAt.get(companion.id) ?? 0;
    if (time - lastAttack < PLAYER_ATTACK_COOLDOWN_MS) return;

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
      const dropX = target.sprite.x;
      const dropY = target.sprite.y;
      const damage = 5 + Math.floor(attributesStore.getStrength() * COMPANION_DAMAGE_FACTOR);
      if (!target.takeDamage(damage)) return;
      handleEnemyKill(target, lootManager, dropX, dropY);
      enemyManager.onEnemyKilled(target.id);
    });
  }
}
