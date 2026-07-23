import * as Phaser from 'phaser';
import { LOOT_DESPAWN_MS } from '@/constants/loot';
import { RARITY_COLOR } from '@/data/items';
import type { GroundLootData, RolledLoot } from '@/types/loot';

/**
 * Item dropado no chão (visual + metadados).
 */
export class GroundLoot {
  readonly data: GroundLootData;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly label: Phaser.GameObjects.Text;
  private readonly glow: Phaser.GameObjects.Arc;
  private readonly expiresAt: number;
  private readonly baseY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    data: GroundLootData,
  ) {
    this.data = data;
    this.baseY = data.y;
    this.expiresAt = scene.time.now + LOOT_DESPAWN_MS;

    const color = RARITY_COLOR[data.rarity];

    this.glow = scene.add.circle(data.x, data.y - 4, 10, color, 0.25).setDepth(3);

    this.sprite = scene.add.sprite(data.x, data.y, 'loot', 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(4);
    this.sprite.setTint(color);
    this.sprite.setData('lootId', data.id);

    this.label = scene.add
      .text(data.x, data.y - 20, `${data.name} ×${data.quantity}`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#f2efe6',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(5);

    scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - 3,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get id(): string {
    return this.data.id;
  }

  isExpired(time: number): boolean {
    return time >= this.expiresAt;
  }

  setQuantity(quantity: number): void {
    this.data.quantity = quantity;
    this.label.setText(`${this.data.name} ×${quantity}`);
  }

  destroy(): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.destroy();
    this.label.destroy();
    this.glow.destroy();
  }
}

export function createGroundLootId(): string {
  return `loot-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function toGroundLootData(rolled: RolledLoot, x: number, y: number): GroundLootData {
  return {
    id: createGroundLootId(),
    itemId: rolled.itemId,
    name: rolled.name,
    quantity: rolled.quantity,
    rarity: rolled.rarity,
    x,
    y,
  };
}
