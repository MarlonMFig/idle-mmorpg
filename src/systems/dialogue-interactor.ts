import * as Phaser from 'phaser';
import { DIALOGUE_INTERACT_DISTANCE } from '@/constants/dialogue';
import type { Npc } from '@/entities/npc';
import { dialogueStore } from '@/stores/dialogue-store';
import type { NPCManager } from '@/systems/npc-manager';

/**
 * Detecta proximidade + tecla E para abrir diálogo.
 * A UI em si fica no React (dialogueStore).
 */
export class DialogueInteractor {
  private readonly keyE: Phaser.Input.Keyboard.Key;
  private nearest: Npc | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly npcManager: NPCManager,
    private readonly getPlayerPosition: () => { x: number; y: number },
  ) {
    if (!scene.input.keyboard) {
      throw new Error('Teclado indisponível para diálogo');
    }
    this.keyE = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  update(): void {
    if (dialogueStore.isOpen()) {
      this.clearHighlights();
      this.nearest = null;
      return;
    }

    const player = this.getPlayerPosition();
    let best: Npc | null = null;
    let bestDist = DIALOGUE_INTERACT_DISTANCE;

    for (const npc of this.npcManager.values()) {
      const dist = Phaser.Math.Distance.Between(player.x, player.y, npc.position.x, npc.position.y);
      npc.setInteractionHighlight(dist <= DIALOGUE_INTERACT_DISTANCE);
      if (dist <= bestDist) {
        bestDist = dist;
        best = npc;
      }
    }

    this.nearest = best;

    if (best && Phaser.Input.Keyboard.JustDown(this.keyE)) {
      dialogueStore.openFromNpc(best.definition);
    }
  }

  private clearHighlights(): void {
    for (const npc of this.npcManager.values()) {
      npc.setInteractionHighlight(false);
    }
  }
}
