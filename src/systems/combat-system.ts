import * as Phaser from 'phaser';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import type { Player } from '@/entities/player';
import { attributesStore } from '@/stores/attributes-store';
import { dialogueStore } from '@/stores/dialogue-store';
import { skillsStore } from '@/stores/skills-store';
import { handleEnemyKill } from '@/systems/combat-rewards';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findNearestAliveEnemy } from '@/systems/find-nearest-enemy';
import type { LootManager } from '@/systems/loot-manager';
import { playPlayerPulse } from '@/systems/player-feedback';
import { SkillVfx } from '@/systems/skill-vfx';
import type { SkillDefinition } from '@/types/skill';

/**
 * Combate idle: só jutsus em ordem — jutsu 1 → jutsu 2 → (repete).
 * Sem ataque normal.
 */
export class CombatSystem {
  private readonly vfx: SkillVfx;
  /** Índice na hotbar (0 ou 1). */
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

    this.tryJutsu(time, this.step);
  }

  private tryJutsu(time: number, hotbarIndex: number): void {
    const hotbar = skillsStore.getSnapshot().hotbar;
    const filled = hotbar.filter((id): id is string => id != null);
    if (filled.length === 0) return;

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
      const dropX = target.sprite.x;
      const dropY = target.sprite.y;
      const killed = target.takeDamage(damage);
      if (killed) {
        handleEnemyKill(target, this.lootManager, dropX, dropY);
      }
    });

    this.advanceStep(filled.length);
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
    }

    this.vfx.play(skill, { fromX, fromY, toX, toY });
    playPlayerPulse(this.scene, this.player.sprite, 1.06, 0.96, 60);
    onHit();
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
