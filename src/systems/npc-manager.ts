import * as Phaser from 'phaser';
import {
  NPC_FRAME_HEIGHT,
  NPC_FRAME_WIDTH,
  NPC_INTERACTION_ICON_KEY,
  NPC_INTERACTION_ICON_URL,
  NPC_SPRITE_URL,
  NPC_TEXTURE_KEY,
} from '@/constants/npc';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { getNpcsForMap } from '@/data/npcs';
import {
  outfitIdleFrame,
  wonsrSpriteFit,
  wonsrTextureKey,
  type WonsrSpriteIndex,
} from '@/data/wonsr-sprites';
import { getHubNpcs } from '@/data/wonsr-hub-npcs';
import { Npc } from '@/entities/npc';
import type { MapKey } from '@/maps/map-registry';
import type { NpcDefinition } from '@/types/npc';

const WONSR_SPRITE_INDEX_KEY = 'wonsr-sprite-index';

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

    // Texturas próprias dos NPCs do hub (sheets montadas do DAT WONSR).
    for (const npc of getHubNpcs()) {
      if (npc.spriteUrl && !scene.textures.exists(npc.sprite)) {
        scene.load.image(npc.sprite, npc.spriteUrl);
      }
    }
  }

  /** Remove NPCs atuais e instancia os do mapa informado. */
  loadForMap(mapKey: MapKey): Npc[] {
    return this.loadDefinitions(getNpcsForMap(mapKey), mapKey);
  }

  /** NPCs do hub Konoha (posições na arte 1024×576). */
  loadHub(): Npc[] {
    return this.loadDefinitions(getHubNpcs(), null);
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

  private loadDefinitions(definitions: readonly NpcDefinition[], mapKey: MapKey | null): Npc[] {
    this.clear();
    this.mapKey = mapKey;
    for (const definition of definitions) {
      this.spawn(definition);
    }
    return this.list();
  }

  private spawn(definition: NpcDefinition): Npc {
    if (this.npcs.has(definition.id)) {
      throw new Error(`NPC duplicado no mapa: ${definition.id}`);
    }
    const npc = new Npc(this.scene, this.withOutfitSheet(definition));
    this.npcs.set(definition.id, npc);
    return npc;
  }

  /**
   * Troca o sprite estático pela sheet direcional do WONSR (parado, virado ao
   * sul) quando o outfit foi exportado e já está carregado. Caso contrário,
   * mantém o sprite original como fallback.
   */
  private withOutfitSheet(definition: NpcDefinition): NpcDefinition {
    if (!definition.lookType) return definition;

    const index = this.scene.cache.json.get(WONSR_SPRITE_INDEX_KEY) as
      | WonsrSpriteIndex
      | undefined;
    const sheet = index?.groups.outfits[String(definition.lookType)];
    if (!sheet) return definition;

    const textureKey = wonsrTextureKey('outfits', definition.lookType);
    if (!this.scene.textures.exists(textureKey)) return definition;

    const direction = sheet.directions.includes('south') ? 'south' : sheet.directions[0];
    return {
      ...definition,
      sprite: textureKey,
      spriteFrame: outfitIdleFrame(sheet, direction),
      spriteFit: wonsrSpriteFit(sheet, CHARACTER_DISPLAY_HEIGHT),
    };
  }
}
