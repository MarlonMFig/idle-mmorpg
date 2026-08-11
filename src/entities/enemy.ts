import * as Phaser from 'phaser';
import {
  ENEMY_CORPSE_MS,
  ENEMY_HP_BAR_HEIGHT,
  ENEMY_HP_BAR_WIDTH,
  ENEMY_RESPAWN_MS,
  NAMEPLATE_BAR_GAP_PX,
  NAMEPLATE_GAP_PX,
} from '@/constants/combat';
import { NAMEPLATE_STYLE, worldDepthForY } from '@/constants/nameplate';
import {
  CHARACTER_BODY_HEIGHT,
  CHARACTER_BODY_WIDTH,
  CHARACTER_DISPLAY_HEIGHT,
} from '@/constants/sprites';
import type { WonsrDirection } from '@/data/wonsr-sprites';
import type { EnemyDefinition, EnemyRuntimeStats } from '@/types/enemy';

/**
 * Monstro com HP, barra, morte e respawn (combate).
 */
export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  readonly definition: EnemyDefinition;
  readonly stats: EnemyRuntimeStats;

  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly hpBarFill: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private alive = true;
  private respawnAt = 0;
  private patrolTarget: { x: number; y: number } | null = null;
  private nextPatrolAt = 0;
  private facing: WonsrDirection = 'south';
  private readonly mapCollider: Phaser.Physics.Arcade.Collider | null;
  /** Hit reaction lock (hurt anim play-once). */
  private reactingUntil = 0;
  private deathHold = false;
  private reactionEpoch = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    definition: EnemyDefinition,
    private readonly collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null,
  ) {
    this.definition = definition;
    this.stats = {
      hp: definition.hp,
      hpMax: definition.hp,
      level: definition.level,
      xp: definition.xp,
    };

    this.sprite = scene.physics.add.sprite(
      definition.spawn.x,
      definition.spawn.y,
      definition.sprite,
      definition.spriteFrame ?? 0,
    );
    // Sem `spriteFit` (atlas de fallback) cai na moldura, que ali é justa.
    const fit =
      definition.spriteFit ??
      {
        scale: this.sprite.height > 0 ? CHARACTER_DISPLAY_HEIGHT / this.sprite.height : 1,
        originX: 0.5,
        originY: 1,
      };
    this.sprite.setOrigin(fit.originX, fit.originY);
    this.sprite.setScale(fit.scaleX ?? fit.scale, fit.scale);
    this.sprite.setCollideWorldBounds(true);
    if (this.sprite.texture) {
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // O Phaser multiplica tamanho e offset do corpo pela escala, então a
    // pegada é convertida para px de textura para sair igual no mundo.
    const scaleX = fit.scaleX ?? fit.scale;
    const scaleY = fit.scale;
    const bodyWidth = CHARACTER_BODY_WIDTH / scaleX;
    const bodyHeight = CHARACTER_BODY_HEIGHT / scaleY;
    this.sprite.body!.setSize(bodyWidth, bodyHeight, false);
    this.sprite.body!.setOffset(
      this.sprite.displayOriginX - bodyWidth / 2,
      this.sprite.displayOriginY - bodyHeight,
    );
    this.sprite.setData('enemyId', definition.id);
    this.sprite.setData('enemyLevel', definition.level);
    this.mapCollider = collisionLayer
      ? scene.physics.add.collider(this.sprite, collisionLayer)
      : null;
    this.nextPatrolAt = scene.time.now + Phaser.Math.Between(250, 1200);

    // Nameplate: [barra fina] acima do [nome branco] — sem “Nv. X” no mapa.
    this.nameLabel = scene.add
      .text(definition.spawn.x, definition.spawn.y, definition.name, NAMEPLATE_STYLE)
      .setOrigin(0.5, 1);
    this.hpBarBg = scene.add
      .rectangle(0, 0, ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_HEIGHT, 0x101010, 0.9)
      .setOrigin(0.5);
    this.hpBarFill = scene.add
      .rectangle(0, 0, ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_HEIGHT, 0xe05050)
      .setOrigin(0, 0.5);

    this.refreshHpBar();
    this.syncOverlays();
    this.playIdleAnim();
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get hp(): number {
    return this.stats.hp;
  }

  get level(): number {
    return this.stats.level;
  }

  get xp(): number {
    return this.stats.xp;
  }

  get loot() {
    return this.definition.loot;
  }

  get spawn() {
    return { ...this.definition.spawn };
  }

  get speed(): number {
    return this.definition.speed;
  }

  get chaseRadius(): number {
    return this.definition.chaseRadius;
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** Aplica dano. Retorna true se o golpe matou o monstro. */
  takeDamage(amount: number): boolean {
    if (!this.alive || amount <= 0) return false;

    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.refreshHpBar();
    this.showDamage(amount);

    if (this.stats.hp <= 0) {
      this.die();
      return true;
    }

    this.playHurtReaction();
    return false;
  }

  /** Atualiza barra / respawn. */
  update(time: number): void {
    if (!this.alive) {
      if (time >= this.respawnAt) {
        this.respawn();
      }
      return;
    }
    this.updatePatrol(time);
    this.syncOverlays();
  }

  destroy(): void {
    this.mapCollider?.destroy();
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }

  private die(): void {
    this.alive = false;
    this.patrolTarget = null;
    this.reactingUntil = 0;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.clearTint();
    this.sprite.setVelocity(0, 0);
    this.sprite.body!.enable = false;
    this.nameLabel.setVisible(false);
    this.hpBarBg.setVisible(false);
    this.hpBarFill.setVisible(false);
    this.respawnAt = this.scene.time.now + ENEMY_RESPAWN_MS;

    const playedDeath = this.playDeathAnim();
    if (!playedDeath) {
      // Fallback: tint + dim without death sheet.
      this.sprite.anims.stop();
      this.sprite.setTint(0x555555);
      this.sprite.setAlpha(0.85);
    }

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      delay: Math.max(0, ENEMY_CORPSE_MS - 350),
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.alive) this.sprite.setVisible(false);
      },
    });
  }

  private respawn(): void {
    this.alive = true;
    this.deathHold = false;
    this.reactingUntil = 0;
    this.stats.hp = this.stats.hpMax;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.clearTint();
    this.sprite.setVisible(true);
    this.sprite.setAlpha(1);
    this.sprite.enableBody(
      true,
      this.definition.spawn.x,
      this.definition.spawn.y,
      true,
      true,
    );
    this.sprite.setVelocity(0, 0);
    this.nameLabel.setVisible(true);
    this.hpBarBg.setVisible(true);
    this.hpBarFill.setVisible(true);
    this.nextPatrolAt = this.scene.time.now + Phaser.Math.Between(250, 900);
    this.playIdleAnim();
    this.refreshHpBar();
    this.syncOverlays();
  }

  private updatePatrol(time: number): void {
    if (time < this.reactingUntil) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    if (this.patrolTarget) {
      const dx = this.patrolTarget.x - this.sprite.x;
      const dy = this.patrolTarget.y - this.sprite.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 3) {
        this.sprite.setPosition(this.patrolTarget.x, this.patrolTarget.y);
        this.sprite.setVelocity(0, 0);
        this.patrolTarget = null;
        this.nextPatrolAt = time + Phaser.Math.Between(250, 1000);
        this.playIdleAnim();
        return;
      }
      const speed = Phaser.Math.Clamp(this.definition.speed * 0.24, 28, 68);
      this.sprite.setVelocity((dx / distance) * speed, (dy / distance) * speed);
      this.playWalkAnim(dx, dy);
      return;
    }

    this.sprite.setVelocity(0, 0);
    this.playIdleAnim();
    if (time < this.nextPatrolAt) return;
    this.choosePatrolStep(time);
  }

  /** Toca a caminhada direcional (sheet) ou apenas espelha (atlas de 1 frame). */
  private playWalkAnim(dx: number, dy: number): void {
    if (this.scene.time.now < this.reactingUntil || this.deathHold) return;
    const direction = velocityToDirection(dx, dy);
    const walk = this.definition.walk;
    if (!walk) {
      this.sprite.setFlipX(dx < 0);
      return;
    }

    this.facing = walk.directions.includes(direction) ? direction : walk.directions[0];

    if (walk.lateral && walk.walkAnimKey) {
      if (walk.walkTextureKey && this.sprite.texture.key !== walk.walkTextureKey) {
        this.sprite.setTexture(walk.walkTextureKey);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      // Folhas laterais (Sakura, etc.): flip por componente horizontal.
      if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
      this.sprite.anims.play(walk.walkAnimKey, true);
      return;
    }

    const animKey = walk.anims[this.facing];
    if (animKey) this.sprite.anims.play(animKey, true);
  }

  private playIdleAnim(): void {
    if (this.scene.time.now < this.reactingUntil || this.deathHold) return;
    const walk = this.definition.walk;
    if (!walk) return;

    if (walk.lateral && walk.idleAnimKey) {
      if (walk.idleTextureKey && this.sprite.texture.key !== walk.idleTextureKey) {
        this.sprite.setTexture(walk.idleTextureKey);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      this.sprite.setFlipX(this.facing === 'west');
      this.sprite.anims.play(walk.idleAnimKey, true);
      return;
    }

    this.sprite.anims.stop();
    const frame = walk.idleFrames[this.facing] ?? walk.idleFrames[walk.directions[0]];
    if (frame != null) this.sprite.setFrame(frame);
  }

  /**
   * Hurt sheet se existir (Gaara etc.); senão flash tint clássico.
   */
  private playHurtReaction(): void {
    const walk = this.definition.walk;
    const animKey = walk?.hurtAnimKey;
    const textureKey = walk?.hurtTextureKey;
    if (animKey && textureKey && this.scene.anims.exists(animKey)) {
      this.sprite.setVelocity(0, 0);
      this.patrolTarget = null;
      if (this.sprite.texture.key !== textureKey) {
        this.sprite.setTexture(textureKey, 0);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      // Mantém o flip lateral atual.
      const epoch = ++this.reactionEpoch;
      this.sprite.anims.play(animKey, false);
      const anim = this.scene.anims.get(animKey);
      const durationMs = anim
        ? Math.max(160, Math.ceil((anim.frames.length / (anim.frameRate || 10)) * 1000))
        : 220;
      this.reactingUntil = this.scene.time.now + durationMs;
      this.scene.time.delayedCall(durationMs, () => {
        if (this.reactionEpoch !== epoch || !this.alive) return;
        this.reactingUntil = 0;
        this.playIdleAnim();
      });
      return;
    }
    this.flashHit();
  }

  /** @returns true se tocou animação de morte pack. */
  private playDeathAnim(): boolean {
    const walk = this.definition.walk;
    const animKey = walk?.deathAnimKey;
    const textureKey = walk?.deathTextureKey;
    if (!animKey || !textureKey || !this.scene.anims.exists(animKey)) return false;

    this.deathHold = true;
    this.reactionEpoch += 1;
    if (this.sprite.texture.key !== textureKey) {
      this.sprite.setTexture(textureKey, 0);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.sprite.anims.play(animKey, false);
    // Phaser holds last frame after repeat:0 completes by default.
    return true;
  }

  /** Escolhe um tile vizinho livre; passos sucessivos fazem o inimigo percorrer o mapa. */
  private choosePatrolStep(time: number): void {
    const layer = this.collisionLayer;
    if (!layer) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.patrolTarget = {
        x: Phaser.Math.Clamp(this.sprite.x + Math.cos(angle) * 32, 16, this.scene.physics.world.bounds.width - 16),
        y: Phaser.Math.Clamp(this.sprite.y + Math.sin(angle) * 32, 16, this.scene.physics.world.bounds.height - 16),
      };
      return;
    }

    const tileX = layer.worldToTileX(this.sprite.x, true);
    const tileY = layer.worldToTileY(this.sprite.y, true);
    const directions = Phaser.Utils.Array.Shuffle([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]);

    for (const direction of directions) {
      const x = tileX + direction.x;
      const y = tileY + direction.y;
      if (x < 0 || y < 0 || x >= layer.layer.width || y >= layer.layer.height) continue;
      const tile = layer.getTileAt(x, y);
      if (tile && tile.index !== -1) continue;
      this.patrolTarget = {
        x: layer.tileToWorldX(x) + layer.layer.tileWidth / 2,
        y: layer.tileToWorldY(y) + layer.layer.tileHeight / 2,
      };
      return;
    }

    this.nextPatrolAt = time + 600;
  }

  private refreshHpBar(): void {
    const ratio = this.stats.hpMax > 0 ? this.stats.hp / this.stats.hpMax : 0;
    this.hpBarFill.width = Math.max(0, ENEMY_HP_BAR_WIDTH * ratio);
    // Verde cheio → vermelho baixo (ler legível como no ref.).
    this.hpBarFill.setFillStyle(ratio > 0.35 ? 0x4cdd6e : 0xe05050);
  }

  /**
   * Pilha do nameplate no topo do sprite:
   *   [barra HP]
   *   [nome]
   *   personagem
   */
  private syncOverlays(): void {
    const depth = worldDepthForY(this.sprite.y, 8);
    this.sprite.setDepth(depth);

    const headY = this.sprite.y - CHARACTER_DISPLAY_HEIGHT;
    const nameBottom = headY - NAMEPLATE_GAP_PX;
    this.nameLabel.setPosition(this.sprite.x, nameBottom);
    this.nameLabel.setDepth(depth + 3);

    const barY = nameBottom - this.nameLabel.height - NAMEPLATE_BAR_GAP_PX - ENEMY_HP_BAR_HEIGHT / 2;
    this.hpBarBg.setPosition(this.sprite.x, barY);
    this.hpBarBg.setDepth(depth + 1);
    this.hpBarFill.setPosition(this.sprite.x - ENEMY_HP_BAR_WIDTH / 2, barY);
    this.hpBarFill.setDepth(depth + 2);
  }

  private flashHit(): void {
    // Tint flash — alpha blink seems like afterimage while the enemy moves.
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAlpha(1);
    this.sprite.setTintFill(0xffefc2);
    this.scene.time.delayedCall(80, () => {
      if (!this.sprite.active || !this.alive) return;
      this.sprite.clearTint();
    });
  }

  private showDamage(amount: number): void {
    const floater = this.scene.add
      .text(this.sprite.x, this.sprite.y - CHARACTER_DISPLAY_HEIGHT * 0.55, `-${Math.round(amount)}`, {
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#1a0808',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(worldDepthForY(this.sprite.y, 8) + 20);

    this.scene.tweens.add({
      targets: floater,
      y: floater.y - 26,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => floater.destroy(),
    });
  }
}

/** Vetor de movimento → direção cardinal (sheets têm 4 direções reais). */
function velocityToDirection(dx: number, dy: number): WonsrDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'west' : 'east';
  return dy < 0 ? 'north' : 'south';
}
