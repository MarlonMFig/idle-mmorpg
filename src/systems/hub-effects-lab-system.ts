import * as Phaser from 'phaser';
import { isHubSmokeEffect } from '@/data/hub-effects';
import { locationStore } from '@/stores/location-store';
import { hubEffectsLabStore } from '@/stores/hub-effects-lab-store';

export interface HubEffectsLabHost {
  scene: Phaser.Scene;
  getWorldSize: () => { w: number; h: number };
}

/**
 * Marcadores + clique para posicionar emissores de fumaça no hub (Dev Lab).
 */
export class HubEffectsLabSystem {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private unsub: (() => void) | null = null;
  private pointerHandler: ((pointer: Phaser.Input.Pointer) => void) | null = null;

  constructor(private readonly host: HubEffectsLabHost) {
    this.unsub = hubEffectsLabStore.subscribe(() => this.onStoreChange());
    this.bindPointer();
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.unbindPointer();
    this.gfx?.destroy();
    this.gfx = null;
  }

  update(): void {
    const lab = hubEffectsLabStore.getSnapshot();
    if (!lab.active || locationStore.getSnapshot().mode !== 'hub') {
      this.gfx?.clear();
      return;
    }

    const pointer = this.host.scene.input.activePointer;
    hubEffectsLabStore.setPointerWorld(
      pointer ? Math.round(pointer.worldX) : null,
      pointer ? Math.round(pointer.worldY) : null,
    );

    this.drawMarkers(lab);
  }

  private onStoreChange(): void {
    // redraw on next update
  }

  private ensureGfx(): Phaser.GameObjects.Graphics {
    if (!this.gfx) {
      this.gfx = this.host.scene.add.graphics().setDepth(10_001);
    }
    return this.gfx;
  }

  private drawMarkers(lab: ReturnType<typeof hubEffectsLabStore.getSnapshot>): void {
    const g = this.ensureGfx();
    g.clear();
    const { w, h } = this.host.getWorldSize();

    if (lab.pickMode) {
      g.lineStyle(1, 0xffee55, 0.35);
      const step = 128;
      for (let x = 0; x <= w; x += step) g.lineBetween(x, 0, x, h);
      for (let y = 0; y <= h; y += step) g.lineBetween(0, y, w, y);
    }

    for (const entry of lab.effects) {
      if (!isHubSmokeEffect(entry)) continue;
      const selected = entry.id === lab.selectedId;
      const color = entry.enabled ? (selected ? 0x66ffaa : 0x44ccff) : 0x888888;
      const alpha = entry.enabled ? 0.95 : 0.45;
      g.lineStyle(selected ? 3 : 2, color, alpha);
      g.strokeCircle(entry.x, entry.y, selected ? 14 : 10);
      g.fillStyle(color, 0.25);
      g.fillCircle(entry.x, entry.y, selected ? 8 : 5);
      if (selected) {
        g.lineStyle(1, color, 0.7);
        g.lineBetween(entry.x - 20, entry.y, entry.x + 20, entry.y);
        g.lineBetween(entry.x, entry.y - 20, entry.x, entry.y + 20);
      }
    }

    if (lab.pickMode && lab.pointerWorldX != null && lab.pointerWorldY != null) {
      g.lineStyle(2, 0xff6644, 0.85);
      g.strokeCircle(lab.pointerWorldX, lab.pointerWorldY, 12);
    }
  }

  private bindPointer(): void {
    this.pointerHandler = (pointer: Phaser.Input.Pointer) => {
      const lab = hubEffectsLabStore.getSnapshot();
      if (!lab.active || !lab.pickMode || locationStore.getSnapshot().mode !== 'hub') return;
      if (!pointer.leftButtonDown()) return;
      if (pointer.event.shiftKey || pointer.event.altKey) return;
      const entry = lab.effects.find((e) => e.id === lab.selectedId);
      if (!entry || entry.kind !== 'smoke') return;
      hubEffectsLabStore.setSmokePosition(entry.id, pointer.worldX, pointer.worldY);
    };
    this.host.scene.input.on('pointerdown', this.pointerHandler);
  }

  private unbindPointer(): void {
    if (this.pointerHandler) {
      this.host.scene.input.off('pointerdown', this.pointerHandler);
      this.pointerHandler = null;
    }
  }
}
