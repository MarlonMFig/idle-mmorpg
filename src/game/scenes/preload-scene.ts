import * as Phaser from 'phaser';
import { preloadCharacterPack } from '@/data/character-packs';
import { getKonohaHub } from '@/data/hub-backgrounds';
import { listWonsrRenderedMaps } from '@/data/wonsr-rendered-maps';
import { WONSR_SPRITE_INDEX_URL } from '@/data/wonsr-sprites';
import { getPlayerSession } from '@/game/registry';
import { GameScene } from '@/game/scenes/game-scene';
import { getActiveCharacterPack } from '@/lib/active-character';
import { MapLoader, MAP_KEYS } from '@/maps';
import { EnemyManager, LootManager, NPCManager } from '@/systems';

/**
 * Carrega mapas, pack do avatar, NPCs, monstros e loot; avança para a GameScene.
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
    const pack = getActiveCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
    preloadCharacterPack(this, pack);
    this.registry.set('characterPackId', pack.id);

    const hub = getKonohaHub();
    this.load.image(hub.key, hub.url);
    if (hub.tilemapImageKey && hub.tilemapImageUrl) {
      this.load.image(hub.tilemapImageKey, hub.tilemapImageUrl);
    }

    // PNGs pré-renderizados dos mapas de caça WONSR (visual do combate).
    for (const rendered of listWonsrRenderedMaps()) {
      this.load.image(rendered.imageKey, rendered.imageUrl);
    }

    // Índice das sheets de outfit; as folhas em si são carregadas sob demanda.
    this.load.json('wonsr-sprite-index', WONSR_SPRITE_INDEX_URL);

    NPCManager.preload(this);
    EnemyManager.preload(this);
    LootManager.preload(this);
    this.mapLoader = new MapLoader(this);
    this.mapLoader
      .queue(MAP_KEYS.leafVillage)
      .queue(MAP_KEYS.leafVillageHub)
      .queue(MAP_KEYS.forest)
      .queue(MAP_KEYS.huntForestClearing)
      .queue(MAP_KEYS.huntArenaExameChunnin)
      .queue(MAP_KEYS.huntCampoTreinamento)
      .queue(MAP_KEYS.huntEsconderijoAkatsuki)
      .queue(MAP_KEYS.huntKonohaDestruida)
      .queue(MAP_KEYS.huntLabOrochimaru)
      .queue(MAP_KEYS.huntPaisDoVento)
      .queue(MAP_KEYS.huntPontePaisOnda)
      .queue(MAP_KEYS.huntValeDoFim)
      .queue(MAP_KEYS.academy)
      .preload();
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#000000');

    try {
      await this.mapLoader.hydrate();
      this.registry.set('mapLoaderReady', true);
      this.scene.start(GameScene.KEY, { mapKey: MAP_KEYS.leafVillage, mode: 'hub' });
    } catch (error) {
      console.error('[PreloadScene] falha ao hidratar mapas', error);
      this.scene.start(GameScene.KEY, { mapKey: MAP_KEYS.leafVillage, mode: 'hub' });
    }
  }
}
