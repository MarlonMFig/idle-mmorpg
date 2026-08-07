import * as Phaser from 'phaser';
import {
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
} from '@/constants/combat';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import type { Player } from '@/entities/player';
import { attributesStore } from '@/stores/attributes-store';
import { dialogueStore } from '@/stores/dialogue-store';
import { skillsStore } from '@/stores/skills-store';
import { vitalsStore } from '@/stores/vitals-store';
import { handleEnemyKill } from '@/systems/combat-rewards';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findNearestAliveEnemy } from '@/systems/find-nearest-enemy';
import type { LootManager } from '@/systems/loot-manager';
import { playPlayerPulse } from '@/systems/player-feedback';
import { SkillVfx } from '@/systems/skill-vfx';
import type { SkillDefinition } from '@/types/skill';

/**
 * Combate idle: ataque básico; jutsus da hotbar quando existirem.
 * VFX de effects/missiles WONSR ficam desligados — só animação do personagem
 * e o SkillVfx genérico quando não há sheet de jutsu.
 */
export class CombatSystem {
  private readonly vfx: SkillVfx;
  /** Próximo índice da rotação na hotbar. */
  private step = 0;
  private lastActionAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
    private readonly lootManager: LootManager,
  ) {
    this.vfx = new SkillVfx(scene);
  }

  update(time: number): void {
    this.enemyManager.update(time);
    skillsStore.consumePendingCast();

    if (dialogueStore.isOpen()) return;
    if (this.player.isBusy()) return;
    if (time - this.lastActionAt < 140) return;

    const level = vitalsStore.getLevel();
    const hotbar = skillsStore.getSnapshot().hotbar;
    const filled = hotbar.filter((id): id is string => {
      if (!id) return false;
      const skill = getSkill(id);
      return Boolean(skill && level >= (skill.requiredLevel ?? 1));
    });

    if (filled.length === 0) {
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

  private tryBasicAttack(time: number): void {
    if (time - this.lastActionAt < PLAYER_ATTACK_COOLDOWN_MS) return;

    const target = findNearestAliveEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      PLAYER_ATTACK_RANGE,
    );
    if (!target) return;

    this.lastActionAt = time;
    this.player.faceToward(target.sprite.x, target.sprite.y);
    const hitDelay = this.player.playAttack();
    if (hitDelay <= 0) return;

    this.scene.time.delayedCall(hitDelay, () => {
      if (!target.isAlive) return;
      const damage = 8 + Math.floor(attributesStore.getStrength() * 0.85);
      const dropX = target.sprite.x;
      const dropY = target.sprite.y;
      const killed = target.takeDamage(damage);
      if (killed) {
        handleEnemyKill(target, this.lootManager, dropX, dropY);
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

    const range = skill.range ?? SKILL_DEFAULT_RANGE;
    const target = findNearestAliveEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      range,
    );
    if (!target) return;

    this.lastActionAt = time;
    this.cast(skill, target.sprite.x, target.sprite.y, () => {
      const damage = skill.damage + Math.floor(attributesStore.getStrength() * 0.35);
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
            handleEnemyKill(enemy, this.lootManager, dropX, dropY);
          }
        }
      } else if (target.isAlive) {
        const dropX = target.sprite.x;
        const dropY = target.sprite.y;
        if (target.takeDamage(damage)) {
          handleEnemyKill(target, this.lootManager, dropX, dropY);
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
        if (skillAnim?.fx) {
          this.scene.time.delayedCall(Math.max(0, hitDelay - 80), () => {
            this.playPackFx(skillAnim.fx!.key, toX, toY);
          });
        }
        this.scene.time.delayedCall(hitDelay, onHit);
        return;
      }
      // Pack/character: só a sheet do personagem — sem orb/impacto genérico no alvo.
      this.scene.time.delayedCall(skillAnim?.durationMs ?? duration, onHit);
      return;
    }

    this.vfx.play(skill, { fromX, fromY, toX, toY });
    playPlayerPulse(this.scene, this.player.sprite, 1.06, 0.96, 60);
    this.scene.time.delayedCall(duration, onHit);
  }

  private playPackFx(textureKey: string, x: number, y: number): void {
    const animKey = `fx-${textureKey}`;
    if (!this.scene.textures.exists(textureKey)) return;

    const fx = this.scene.add.sprite(x, y - 20, textureKey, 0);
    fx.setOrigin(0.5, 0.5);
    fx.setDepth(22);
    fx.setScale(this.player.sprite.scaleX * 1.15);

    if (this.scene.anims.exists(animKey)) {
      fx.play(animKey);
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    } else {
      this.scene.tweens.add({
        targets: fx,
        alpha: 0,
        scale: 1.2,
        duration: 280,
        onComplete: () => fx.destroy(),
      });
    }
  }
}
