import * as Phaser from 'phaser';
import {
  PLAYER_ATTACK_COOLDOWN_MS,
  PLAYER_ATTACK_RANGE,
} from '@/constants/combat';
import { SKILL_DEFAULT_RANGE } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import type { Player } from '@/entities/player';
import { STAR_3_SPECIAL_DAMAGE_BONUS } from '@/constants/character-progression';
import { attributesStore } from '@/stores/attributes-store';
import { teamStore } from '@/stores/team-store';
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
      let damage = skill.damage + Math.floor(attributesStore.getStrength() * 0.35);
      const active = teamStore.getActive();
      if (
        active &&
        active.stars >= 3 &&
        STAR_3_SPECIAL_DAMAGE_BONUS != null
      ) {
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
        if (skill.dashToTarget) {
          this.dashPlayerToTarget(toX, toY, hitDelay, skill);
        }
        if (skillAnim?.fx) {
          const flightN = skillAnim.fxFlightFrameCount ?? 0;
          if (flightN > 0) {
            // Projétil só sai no frame de arremesso (nunca no wind-up / levantar).
            const releaseAt =
              skillAnim.fxReleaseMs ??
              Math.max(0, Math.floor(hitDelay * 0.72));
            // Chega no (ou logo antes do) hitDelay — sem estourar o impact cedo no alvo.
            const travelMs = Math.max(140, hitDelay - releaseAt);
            this.scene.time.delayedCall(releaseAt, () => {
              this.playPackThrowFx(
                skillAnim.fx!,
                flightN,
                fromX,
                fromY,
                toX,
                toY,
                travelMs,
              );
            });
          } else {
            const releaseAt =
              skillAnim.fxReleaseMs ?? Math.max(0, hitDelay - 80);
            const attach = skillAnim.fxAttach ?? 'target';
            const fxX = attach === 'caster' ? fromX : toX;
            const fxY = attach === 'caster' ? fromY : toY;
            this.scene.time.delayedCall(releaseAt, () => {
              this.playPackFx(skillAnim.fx!.key, fxX, fxY, {
                ground: skillAnim.fxGround ?? attach === 'caster',
              });
            });
          }
        }
        if (skillAnim?.fxSecondary) {
          const releaseAt =
            skillAnim.fxSecondaryReleaseMs ?? hitDelay;
          const attach = skillAnim.fxSecondaryAttach ?? 'caster';
          // Re-read live feet at impact (Lee may have dashed/moved during air time).
          this.scene.time.delayedCall(releaseAt, () => {
            const fxX = attach === 'caster' ? this.player.x : toX;
            const fxY = attach === 'caster' ? this.player.y : toY;
            this.playPackFx(skillAnim.fxSecondary!.key, fxX, fxY, {
              ground: attach === 'caster',
            });
          });
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
    const contact = skill.contactRange ?? PLAYER_ATTACK_RANGE * 0.85;
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

  private playPackFx(
    textureKey: string,
    x: number,
    y: number,
    opts?: { ground?: boolean },
  ): void {
    const animKey = `fx-${textureKey}`;
    if (!this.scene.textures.exists(textureKey)) return;

    const ground = opts?.ground === true;
    // Ground kick dust / rock slam sits at feet (origin bottom); flash is mid-body.
    const fx = this.scene.add.sprite(x, ground ? y : y - 20, textureKey, 0);
    fx.setOrigin(0.5, ground ? 1 : 0.5);
    fx.setDepth(22);
    fx.setScale(this.player.sprite.scaleX * (ground ? 1.05 : 1.15));

    if (this.scene.anims.exists(animKey)) {
      fx.play(animKey);
      const tex = this.scene.textures.get(textureKey);
      const sheetFrames = tex
        .getFrameNames()
        .filter((name) => name !== '__BASE').length;
      // Single-frame hold/fade; multi-frame plays through then destroys.
      if (sheetFrames <= 1) {
        this.scene.tweens.add({
          targets: fx,
          alpha: 0,
          scaleX: fx.scaleX * 1.12,
          scaleY: fx.scaleY * 1.12,
          duration: 320,
          delay: ground ? 40 : 90,
          onComplete: () => fx.destroy(),
        });
      } else {
        fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
      }
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

  /**
   * Projétil com frames de voo em loop, depois strip de impacto no alvo.
   * Usado no arremesso de pedra do Jirobo (fxFlightFrameCount).
   */
  private playPackThrowFx(
    fxDef: { key: string; frameCount: number },
    flightFrameCount: number,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    travelMs: number,
  ): void {
    const textureKey = fxDef.key;
    if (!this.scene.textures.exists(textureKey)) return;

    const flightEnd = Math.max(0, Math.min(flightFrameCount, fxDef.frameCount) - 1);
    const flightAnimKey = `fx-${textureKey}-flight`;
    const impactAnimKey = `fx-${textureKey}-impact`;

    if (!this.scene.anims.exists(flightAnimKey) && flightEnd >= 0) {
      this.scene.anims.create({
        key: flightAnimKey,
        frames: this.scene.anims.generateFrameNumbers(textureKey, {
          start: 0,
          end: flightEnd,
        }),
        frameRate: 10,
        repeat: -1,
      });
    }
    if (
      !this.scene.anims.exists(impactAnimKey) &&
      flightFrameCount < fxDef.frameCount
    ) {
      this.scene.anims.create({
        key: impactAnimKey,
        frames: this.scene.anims.generateFrameNumbers(textureKey, {
          start: flightFrameCount,
          end: fxDef.frameCount - 1,
        }),
        frameRate: 12,
        repeat: 0,
      });
    }

    const startX = fromX + (toX >= fromX ? 10 : -10);
    const startY = fromY - 18;
    const endX = toX;
    const endY = toY - 16;

    const rock = this.scene.add.sprite(startX, startY, textureKey, 0);
    rock.setOrigin(0.5, 0.5);
    rock.setDepth(22);
    rock.setScale(this.player.sprite.scaleX * 1.2);
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    rock.setRotation(angle);

    if (this.scene.anims.exists(flightAnimKey)) {
      rock.play(flightAnimKey);
    }

    this.scene.tweens.add({
      targets: rock,
      x: endX,
      y: endY,
      duration: travelMs,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        rock.setRotation(0);
        if (this.scene.anims.exists(impactAnimKey)) {
          rock.play(impactAnimKey);
          rock.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => rock.destroy());
        } else {
          this.scene.tweens.add({
            targets: rock,
            alpha: 0,
            duration: 200,
            onComplete: () => rock.destroy(),
          });
        }
      },
    });
  }
}
