import * as Phaser from 'phaser';
import {
  NPC_FRAME_HEIGHT,
  NPC_FRAME_WIDTH,
  NPC_INTERACTION_ICON_KEY,
  NPC_INTERACTION_ICON_URL,
  NPC_SPRITE_URL,
  NPC_TEXTURE_KEY,
} from '@/constants/npc';
import { getNpcsForMap } from '@/data/npcs';
import { Npc } from '@/entities/npc';
import type { MapKey } from '@/maps/map-registry';
import type { NpcDefinition } from '@/types/npc';

/**
 * Carrega e gerencia todos os NPCs de um mapa.
 */
export class NPCManager {
  private readonly npcs = new Map<string, Npc>();
  private mapKey: MapKey | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Preload de sprites compartilhados (chamar na PreloadScene). */
  static preload(scene: Phaser.Scene): void {
    scene.load.spritesheet(NPC_TEXTURE_KEY, NPC_SPRITE_URL, {
      frameWidth: NPC_FRAME_WIDTH,
      frameHeight: NPC_FRAME_HEIGHT,
    });
    scene.load.image(NPC_INTERACTION_ICON_KEY, NPC_INTERACTION_ICON_URL);
  }

  /** Remove NPCs atuais e instancia os do mapa informado. */
  loadForMap(mapKey: MapKey): Npc[] {
    this.clear();
    this.mapKey = mapKey;

    const definitions = getNpcsForMap(mapKey);
    for (const definition of definitions) {
      this.spawn(definition);
    }

    return this.list();
  }

  get(id: string): Npc | undefined {
    return this.npcs.get(id);
  }

  list(): Npc[] {
    return Array.from(this.npcs.values());
  }

  values(): IterableIterator<Npc> {
    return this.npcs.values();
  }

  get currentMapKey(): MapKey | null {
    return this.mapKey;
  }

  clear(): void {
    for (const npc of this.npcs.values()) {
      npc.destroy();
    }
    this.npcs.clear();
    this.mapKey = null;
  }

  private spawn(definition: NpcDefinition): Npc {
    if (this.npcs.has(definition.id)) {
      throw new Error(`NPC duplicado no mapa: ${definition.id}`);
    }
    const npc = new Npc(this.scene, definition);
    this.npcs.set(definition.id, npc);
    return npc;
  }
}
