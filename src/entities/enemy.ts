import * as Phaser from 'phaser';
import { ENEMY_HP_BAR_HEIGHT, ENEMY_HP_BAR_WIDTH, ENEMY_RESPAWN_MS } from '@/constants/combat';
import type { EnemyDefinition, EnemyRuntimeStats } from '@/types/enemy';

/**
 * Monstro com HP, barra, morte e respawn (combate).
 */
export class Enemy {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly definition: EnemyDefinition;
  readonly stats: EnemyRuntimeStats;

  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  private readonly hpBarFill: Phaser.GameObjects.Rectangle;
  private alive = true;
  private respawnAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    definition: EnemyDefinition,
  ) {
    this.definition = definition;
    this.stats = {
      hp: definition.hp,
      hpMax: definition.hp,
      level: definition.level,
      xp: definition.xp,
    };

    this.sprite = scene.add.sprite(definition.spawn.x, definition.spawn.y, definition.sprite, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(4);
    this.sprite.setData('enemyId', definition.id);
    this.sprite.setData('enemyLevel', definition.level);

    const barY = definition.spawn.y - this.sprite.displayHeight - 6;
    this.hpBarBg = scene.add
      .rectangle(definition.spawn.x, barY, ENEMY_HP_BAR_WIDTH, ENEMY_HP_BAR_HEIGHT, 0x111111, 0.85)
      .setOrigin(0.5)
      .setDepth(8);
    this.hpBarFill = scene.add
      .rectangle(
        definition.spawn.x - ENEMY_HP_BAR_WIDTH / 2,
        barY,
        ENEMY_HP_BAR_WIDTH,
        ENEMY_HP_BAR_HEIGHT,
        0xd64545,
      )
      .setOrigin(0, 0.5)
      .setDepth(9);

    this.refreshHpBar();
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
    this.flashHit();

    if (this.stats.hp <= 0) {
      this.die();
      return true;
    }
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
    this.syncHpBarPosition();
  }

  destroy(): void {
    this.sprite.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
  }

  private die(): void {
    this.alive = false;
    this.sprite.setVisible(false);
    this.sprite.setActive(false);
    this.hpBarBg.setVisible(false);
    this.hpBarFill.setVisible(false);
    this.respawnAt = this.scene.time.now + ENEMY_RESPAWN_MS;
  }

  private respawn(): void {
    this.alive = true;
    this.stats.hp = this.stats.hpMax;
    this.sprite.setPosition(this.definition.spawn.x, this.definition.spawn.y);
    this.sprite.setVisible(true);
    this.sprite.setActive(true);
    this.sprite.setAlpha(1);
    this.hpBarBg.setVisible(true);
    this.hpBarFill.setVisible(true);
    this.refreshHpBar();
    this.syncHpBarPosition();
  }

  private refreshHpBar(): void {
    const ratio = this.stats.hpMax > 0 ? this.stats.hp / this.stats.hpMax : 0;
    this.hpBarFill.width = Math.max(0, ENEMY_HP_BAR_WIDTH * ratio);
  }

  private syncHpBarPosition(): void {
    const barY = this.sprite.y - this.sprite.displayHeight - 6;
    this.hpBarBg.setPosition(this.sprite.x, barY);
    this.hpBarFill.setPosition(this.sprite.x - ENEMY_HP_BAR_WIDTH / 2, barY);
  }

  private flashHit(): void {
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0.35,
      duration: 60,
      yoyo: true,
      repeat: 1,
    });
  }
}
