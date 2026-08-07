import * as Phaser from 'phaser';
import { getHubInteractablesFor, type HubInteractableDef } from '@/data/hub-interactables';
import type { MapKey } from '@/maps/map-registry';
import { inventoryStore } from '@/stores/inventory-store';
import { huntStore } from '@/stores/hunt-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { vitalsStore } from '@/stores/vitals-store';

interface HubMarker {
  def: HubInteractableDef;
  root: Phaser.GameObjects.Container;
}

/**
 * Ícones clicáveis no mundo (Mapa, Bag, Curar, Voltar à vila).
 */
export class HubInteractableManager {
  private readonly markers: HubMarker[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  load(mode: GameMode, mapKey: MapKey): void {
    this.clear();
    for (const def of getHubInteractablesFor(mode, mapKey)) {
      this.markers.push(this.spawn(def));
    }
  }

  clear(): void {
    for (const marker of this.markers) {
      marker.root.destroy(true);
    }
    this.markers.length = 0;
  }

  private spawn(def: HubInteractableDef): HubMarker {
    const { x, y } = def.position;
    const root = this.scene.add.container(x, y);
    root.setDepth(8);

    const disc = this.scene.add.circle(0, 0, 18, def.color, 0.92);
    disc.setStrokeStyle(2, 0xffffff, 0.85);
    disc.setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(0, -28, def.label, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
        color: '#f2efe6',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1);

    const glyph = this.scene.add
      .text(0, 0, glyphFor(def.action), {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#0a1220',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    root.add([disc, label, glyph]);

    disc.on('pointerdown', () => this.handleAction(def));
    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', () => this.handleAction(def));

    this.scene.tweens.add({
      targets: root,
      y: y - 4,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return { def, root };
  }

  private handleAction(def: HubInteractableDef): void {
    switch (def.action) {
      case 'map':
        huntStore.open();
        break;
      case 'bag':
        inventoryStore.setOpen(true);
        break;
      case 'heal':
        vitalsStore.healFull();
        break;
      case 'return':
        locationStore.enterHub();
        break;
      default:
        break;
    }
  }
}

function glyphFor(action: HubInteractableDef['action']): string {
  switch (action) {
    case 'map':
      return 'M';
    case 'bag':
      return 'B';
    case 'heal':
      return '+';
    case 'return':
      return 'V';
    default:
      return '?';
  }
}
