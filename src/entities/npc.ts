import * as Phaser from 'phaser';
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

    this.sprite = scene.add.sprite(definition.position.x, definition.position.y, definition.sprite, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setDepth(5);
    this.sprite.setData('npcId', definition.id);

    this.nameLabel = scene.add
      .text(definition.position.x, definition.position.y - this.sprite.displayHeight - 28, definition.name, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#f2efe6',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(7)
      .setInteractive({ useHandCursor: true });

    this.nameLabel.on('pointerdown', () => {
      dialogueStore.openFromNpc(definition);
    });

    this.interactionIcon = scene.add.image(
      definition.position.x,
      definition.position.y - this.sprite.displayHeight - 8,
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
