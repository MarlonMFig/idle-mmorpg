import type { HubEffect } from '@/data/hub-effects';
import { isHubBirdsEffect, isHubSmokeEffect } from '@/data/hub-effects';
import { HubBirdFlockSystem } from '@/systems/hub-bird-flock';
import { HubChimneySmokeSystem } from '@/systems/hub-chimney-smoke';
import type * as Phaser from 'phaser';

/**
 * Orquestra fumaça, pássaros e futuros efeitos ambientais do hub a partir de `HUB_EFFECTS`.
 */
export class HubAmbientEffectsSystem {
  private smokes = new Map<string, HubChimneySmokeSystem>();
  private birds: HubBirdFlockSystem | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldW: number,
    private readonly worldH: number,
    effects: readonly HubEffect[],
  ) {
    this.apply(effects);
  }

  apply(effects: readonly HubEffect[]): void {
    this.destroy();
    for (const entry of effects) {
      if (!entry.enabled) continue;
      if (isHubSmokeEffect(entry)) {
        this.smokes.set(
          entry.id,
          new HubChimneySmokeSystem(this.scene, { x: entry.x, y: entry.y }),
        );
      } else if (isHubBirdsEffect(entry) && !this.birds) {
        this.birds = new HubBirdFlockSystem(this.scene, this.worldW, this.worldH);
      }
    }
  }

  update(time: number, delta: number): void {
    this.birds?.update(time, delta);
  }

  destroy(): void {
    for (const smoke of this.smokes.values()) smoke.destroy();
    this.smokes.clear();
    this.birds?.destroy();
    this.birds = null;
  }
}
