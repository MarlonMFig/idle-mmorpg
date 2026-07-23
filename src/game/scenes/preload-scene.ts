import * as Phaser from 'phaser';
import { getCharacterPack, preloadCharacterPack } from '@/data/character-packs';
import { getPlayerSession } from '@/game/registry';
import { GameScene } from '@/game/scenes/game-scene';
import { MapLoader, MAP_KEYS } from '@/maps';
import { EnemyManager, LootManager, NPCManager } from '@/systems';

/**
 * Carrega mapas, pack do starter, NPCs, monstros e loot; avança para a GameScene.
 */
export class PreloadScene extends Phaser.Scene {
  static readonly KEY = 'PreloadScene';

  private mapLoader!: MapLoader;

  constructor() {
    super({ key: PreloadScene.KEY });
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#000000');

    const session = getPlayerSession(this.registry);
    const pack = getCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
    preloadCharacterPack(this, pack);
    this.registry.set('characterPackId', pack.id);

    NPCManager.preload(this);
    EnemyManager.preload(this);
    LootManager.preload(this);
    this.mapLoader = new MapLoader(this);
    this.mapLoader
      .queue(MAP_KEYS.leafVillage)
      .queue(MAP_KEYS.forest)
      .queue(MAP_KEYS.academy)
      .preload();
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#000000');

    try {
      await this.mapLoader.hydrate();
      this.registry.set('mapLoaderReady', true);
      this.scene.start(GameScene.KEY, { mapKey: MAP_KEYS.leafVillage });
    } catch (error) {
      console.error('[PreloadScene] falha ao hidratar mapas', error);
      this.scene.start(GameScene.KEY, { mapKey: MAP_KEYS.leafVillage });
    }
  }
}
