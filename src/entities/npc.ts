import * as Phaser from 'phaser';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { addNameplate, NAMEPLATE_STYLE } from '@/constants/nameplate';
import { dialogueStore } from '@/stores/dialogue-store';
import type { NpcDefinition } from '@/types/npc';

/**
 * Instância visual de um NPC no mundo (sprite, ícone e nome clicável).
 */
export class Npc {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly interactionIcon: Phaser.GameObjects.Image;
  readonly nameLabel: Phaser.GameObjects.Text;
  readonly definition: NpcDefinition;

  constructor(scene: Phaser.Scene, definition: NpcDefinition) {
    this.definition = definition;

    this.sprite = scene.add.sprite(
      definition.position.x,
      definition.position.y,
      definition.sprite,
      definition.spriteFrame ?? 0,
    );
    this.sprite.setDepth(5);
    const fit =
      definition.spriteFit ??
      {
        scale: this.sprite.height > 0 ? CHARACTER_DISPLAY_HEIGHT / this.sprite.height : 1,
        originX: 0.5,
        originY: 1,
      };
    this.sprite.setOrigin(fit.originX, fit.originY);
    this.sprite.setScale(fit.scale);
    this.sprite.setData('npcId', definition.id);

    this.nameLabel = addNameplate(
      scene,
      definition.position.x,
      definition.position.y - CHARACTER_DISPLAY_HEIGHT - 28,
      definition.name,
      NAMEPLATE_STYLE,
    )
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    this.nameLabel.on('pointerdown', () => {
      dialogueStore.openFromNpc(definition);
    });

    this.interactionIcon = scene.add.image(
      definition.position.x,
      definition.position.y - CHARACTER_DISPLAY_HEIGHT - 8,
      definition.interactionIcon,
    );
    this.interactionIcon.setOrigin(0.5, 1);
    this.interactionIcon.setDepth(6);
    this.interactionIcon.setData('npcId', definition.id);

    scene.tweens.add({
      targets: this.interactionIcon,
      y: this.interactionIcon.y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get dialogue(): string[] {
    return this.definition.dialogue;
  }

  get position(): { x: number; y: number } {
    return { ...this.definition.position };
  }

  setInteractionHighlight(active: boolean): void {
    this.interactionIcon.setAlpha(active ? 1 : 0.35);
    this.nameLabel.setColor(active ? '#ffe08a' : '#f2efe6');
  }

  destroy(): void {
    this.sprite.destroy();
    this.interactionIcon.destroy();
    this.nameLabel.destroy();
  }
}
