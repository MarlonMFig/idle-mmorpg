import * as Phaser from 'phaser';
import {
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
  PLAYER_DEATH_RESPAWN_MS,
  PLAYER_JUTSU_GAP_MS,
} from '@/constants/combat';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import type { Player } from '@/entities/player';
import type { Enemy } from '@/entities/enemy';
import { STAR_3_SPECIAL_DAMAGE_BONUS } from '@/constants/character-progression';
import { attributesStore } from '@/stores/attributes-store';
import { teamStore } from '@/stores/team-store';
import { dialogueStore } from '@/stores/dialogue-store';
import { helperStore } from '@/stores/helper-store';
import { skillsStore } from '@/stores/skills-store';
import { vitalsStore } from '@/stores/vitals-store';
import { autoHelperSystem } from '@/systems/auto-helper-system';
import { handleEnemyKill } from '@/systems/combat-rewards';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findNearestAliveEnemy, findUnclaimedEnemy } from '@/systems/find-nearest-enemy';
import type { LootManager } from '@/systems/loot-manager';
import { playPackFx, scheduleSkillFx } from '@/systems/pack-fx';
import { playPlayerPulse } from '@/systems/player-feedback';
import { SkillVfx } from '@/systems/skill-vfx';
import { LEADER_CLAIM_ID, type TargetClaims } from '@/systems/target-claims';
import type { SkillDefinition } from '@/types/skill';

/**
 * Combate idle: ataque básico; jutsus da hotbar quando existirem.
 * Inimigos perseguem e golpeiam o jogador dentro de `chaseRadius`.
 * VFX de effects/missiles WONSR ficam desligados — só animação do personagem
 * e o SkillVfx genérico quando não há sheet de jutsu.
 */
export class CombatSystem {
  private readonly vfx: SkillVfx;
  /** Próximo índice da rotação na hotbar. */
  private step = 0;
  private lastActionAt = 0;
  private lastJutsuAt = 0;
  /** Quando o jogador pode reviver após a morte (ms scene). */
  private playerRespawnAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
    private readonly lootManager: LootManager,
    /** Reserva de alvos da equipe: o líder não briga pelo alvo dos aliados. */
    private readonly claims: TargetClaims | null = null,
  ) {
    this.vfx = new SkillVfx(scene);
  }

  update(time: number): void {
    if (this.player.isDead() || vitalsStore.isDead()) {
      this.enemyManager.update(time);
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
      if (this.player.isDead() || vitalsStore.isDead()) return;
    }

    autoHelperSystem.tick(time);

    skillsStore.consumePendingCast();

    if (dialogueStore.isOpen()) return;
    if (this.player.isBusy()) return;
    if (time - this.lastActionAt < 140) return;

    const level = Math.max(1, teamStore.getActive()?.level || 1);
    const hotbar = skillsStore.getSnapshot().hotbar;
    const filled = hotbar.filter((id): id is string => {
      if (!id) return false;
      const skill = getSkill(id);
      return Boolean(skill && level >= (skill.requiredLevel ?? 1));
    });

    if (filled.length === 0 || time - this.lastJutsuAt < PLAYER_JUTSU_GAP_MS) {
      this.tryBasicAttack(time);
      return;
    }

    const readyOffset = Array.from({ length: filled.length }, (_, offset) => offset).find(
      (offset) => skillsStore.isReady(filled[(this.step + offset) % filled.length]),
    );
    if (readyOffset == null) {
      this.tryBasicAttack(time);
      return;
    }

    this.tryJutsu(time, this.step + readyOffset, filled);
  }

  private applyEnemyHit(rawDamage: number): void {
    if (rawDamage <= 0 || this.player.isDead()) return;

    const { damage, died } = vitalsStore.applyDamage(rawDamage, attributesStore.getDefense());
    if (damage <= 0) return;

    if (died) {
      this.player.playDeath();
      if (helperStore.getSnapshot().autoRevive) {
        this.playerRespawnAt = this.scene.time.now + PLAYER_DEATH_RESPAWN_MS;
      } else {
        this.playerRespawnAt = 0;
      }
      return;
    }

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
    if (time - this.lastActionAt < PLAYER_ATTACK_COOLDOWN_MS) return;

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
        });
      });
    }

    this.scene.time.delayedCall(hitDelay, () => {
      if (!target.isAlive) return;
      const dropX = target.sprite.x;
      const dropY = target.sprite.y;
      this.vfx.playComboHit(dropX, dropY, this.player.sprite.scaleX * 0.95);
      const damage = 8 + Math.floor(attributesStore.getStrength() * 0.85);
      const killed = target.takeDamage(damage);
      if (killed) {
        this.onKill(target, dropX, dropY);
      }
    });
  }

  private tryJutsu(time: number, hotbarIndex: number, filled: string[]): void {
    const index = hotbarIndex % filled.length;
    const skillId = filled[index];
    if (!skillsStore.isReady(skillId)) return;

    const skill = getSkill(skillId);
    if (!skill) {
      this.advanceStep(filled.length);
      return;
    }

    if (skill.effect === 'heal') {
      const vitals = vitalsStore.getSnapshot();
      if (vitals.hp >= vitals.hpMax) {
        this.step = (index + 1) % filled.length;
        this.tryBasicAttack(time);
        return;
      }

      this.lastActionAt = time;
      this.lastJutsuAt = time;
      this.cast(skill, this.player.x, this.player.y, () => {
        const current = vitalsStore.getSnapshot();
        const amount = Math.max(1, Math.floor(current.hpMax * (skill.healPercent ?? 0)));
        const healed = vitalsStore.heal(amount);
        if (healed > 0) this.vfx.healNumber(this.player.x, this.player.y, healed);
      });
      this.step = (index + 1) % filled.length;
      return;
    }

    const range = (skill.range ?? SKILL_DEFAULT_RANGE) * this.player.worldScale;
    const target = findNearestAliveEnemy(this.enemyManager, this.player.x, this.player.y, range);
    if (!target) return;

    this.lastActionAt = time;
    this.lastJutsuAt = time;
    this.cast(skill, target.sprite.x, target.sprite.y, () => {
      let damage = skill.damage + Math.floor(attributesStore.getStrength() * 0.35);
      const active = teamStore.getActive();
      if (active && active.stars >= 3 && STAR_3_SPECIAL_DAMAGE_BONUS != null) {
        damage = Math.floor(damage * (1 + STAR_3_SPECIAL_DAMAGE_BONUS));
      }
      if (skill.areaRadius != null) {
        for (const enemy of this.enemyManager.values()) {
          if (!enemy.isAlive) continue;
          const distance = Phaser.Math.Distance.Between(
            target.sprite.x,
            target.sprite.y,
            enemy.sprite.x,
            enemy.sprite.y,
          );
          if (distance > skill.areaRadius) continue;
          const dropX = enemy.sprite.x;
          const dropY = enemy.sprite.y;
          if (enemy.takeDamage(damage)) {
            this.onKill(enemy, dropX, dropY);
          }
        }
      } else if (target.isAlive) {
        const dropX = target.sprite.x;
        const dropY = target.sprite.y;
        if (target.takeDamage(damage)) {
          this.onKill(target, dropX, dropY);
        }
      }
    });

    this.step = (index + 1) % filled.length;
  }

  private advanceStep(count: number): void {
    if (count <= 0) return;
    this.step = (this.step + 1) % count;
  }

  private cast(skill: SkillDefinition, toX: number, toY: number, onHit: () => void): void {
    skillsStore.startCooldown(skill.id, skill.cooldownMs);
    this.player.faceToward(toX, toY);

    const fromX = this.player.x;
    const fromY = this.player.y;
    const skillAnim = this.player.getSkillAnim(skill.id);
    const duration = skill.animation.durationMs ?? 280;

    if (skill.animation.kind === 'character' || skillAnim) {
      const hitDelay = this.player.playSkillAnim(skill.id);
      if (hitDelay != null) {
        if (skill.dashToTarget) {
          this.dashPlayerToTarget(toX, toY, hitDelay, skill);
        }
        if (skillAnim) {
          scheduleSkillFx(
            this.scene,
            this.player,
            skillAnim,
            hitDelay,
            { x: fromX, y: fromY },
            { x: toX, y: toY },
          );
        }
        this.scene.time.delayedCall(hitDelay, onHit);
        return;
      }
      // Pack/character: só a sheet do personagem — sem orb/impacto genérico no alvo.
      const fallbackDelay = skillAnim?.durationMs ?? duration;
      if (skill.dashToTarget) {
        this.dashPlayerToTarget(toX, toY, fallbackDelay, skill);
      }
      this.scene.time.delayedCall(fallbackDelay, onHit);
      return;
    }

    this.vfx.play(skill, { fromX, fromY, toX, toY });
    playPlayerPulse(this.scene, this.player.sprite, 1.06, 0.96, 60);
    this.scene.time.delayedCall(duration, onHit);
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

  private onKill(enemy: Enemy, dropX: number, dropY: number): void {
    handleEnemyKill(enemy, this.lootManager, dropX, dropY);
    this.enemyManager.onEnemyKilled(enemy.id);
  }
}
