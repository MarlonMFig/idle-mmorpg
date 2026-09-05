import * as Phaser from 'phaser';
import { preloadCharacterPack } from '@/data/character-packs';
import { getActiveHub } from '@/data/hub-backgrounds';
import { listWonsrRenderedMaps } from '@/data/wonsr-rendered-maps';
import { WONSR_SPRITE_INDEX_URL } from '@/data/wonsr-sprites';
import { getPlayerSession } from '@/game/registry';
import { GameScene } from '@/game/scenes/game-scene';
import { getSpawnCharacterPack } from '@/lib/active-character';
import { isDevMode } from '@/config/devConfig';
import { runDevCharacterValidation } from '@/data/characters';
import { MapLoader, MAP_KEYS } from '@/maps';
import { bootLoadingStore } from '@/stores/boot-loading-store';
import { EnemyManager, LootManager, NPCManager, SkillVfx } from '@/systems';

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
    bootLoadingStore.setPhase('preload');
    this.cameras.main.setBackgroundColor('#000000');
    this.load.on('progress', (value: number) => {
      // Reserva ~0.05–0.82 para o loader; o resto é montagem do hub.
      bootLoadingStore.setProgress(0.05 + Math.max(0, Math.min(1, value)) * 0.77);
    });

    const session = getPlayerSession(this.registry);
    const pack = getSpawnCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
    preloadCharacterPack(this, pack);
    this.registry.set('characterPackId', pack.id);

    const hub = getActiveHub();
    this.load.image(hub.key, hub.url);
    if (hub.tilemapImageKey && hub.tilemapImageUrl) {
      this.load.image(hub.tilemapImageKey, hub.tilemapImageUrl);
    }

    // PNGs pré-renderizados dos mapas de caça WONSR (visual do combate).
    // Mapas podem compartilhar arte; carregar a mesma key duas vezes gera aviso.
    const loadedImages = new Set<string>();
    for (const rendered of listWonsrRenderedMaps()) {
      // Top-down 5k: carrega só ao entrar na caça (VRAM + WebGL).
      if (rendered.cameraFollow && rendered.width >= 4096) continue;
      if (!loadedImages.has(rendered.imageKey)) {
        loadedImages.add(rendered.imageKey);
        this.load.image(rendered.imageKey, rendered.imageUrl);
      }
      if (
        rendered.foregroundKey &&
        rendered.foregroundUrl &&
        !loadedImages.has(rendered.foregroundKey)
      ) {
        loadedImages.add(rendered.foregroundKey);
        this.load.image(rendered.foregroundKey, rendered.foregroundUrl);
      }
      if (rendered.videoKey && rendered.videoUrl) {
        this.load.video(rendered.videoKey, rendered.videoUrl, true);
      }
    }

    // Índice das sheets de outfit; as folhas em si são carregadas sob demanda.
    this.load.json('wonsr-sprite-index', WONSR_SPRITE_INDEX_URL);

    NPCManager.preload(this);
    EnemyManager.preload(this);
    LootManager.preload(this);
    SkillVfx.preload(this);
    this.mapLoader = new MapLoader(this);
    this.mapLoader
      .queue(MAP_KEYS.leafVillage)
      .queue(MAP_KEYS.hubInterdimensional)
      .queue(MAP_KEYS.forest)
      .queue(MAP_KEYS.huntForestClearing)
      .queue(MAP_KEYS.huntArenaExameChunnin)
      .queue(MAP_KEYS.huntArenaExameChunin)
      .queue(MAP_KEYS.huntCampoTreinamento)
      .queue(MAP_KEYS.huntEsconderijoAkatsuki)
      .queue(MAP_KEYS.huntKonohaDestruida)
      .queue(MAP_KEYS.huntLabOrochimaru)
      .queue(MAP_KEYS.huntPaisDoVento)
      .queue(MAP_KEYS.huntPontePaisOnda)
      .queue(MAP_KEYS.huntValeDoFim)
      .queue(MAP_KEYS.huntValeDoFimLateral)
      .queue(MAP_KEYS.huntValeLoop)
      .queue(MAP_KEYS.huntMonteMyoboku)
      .queue(MAP_KEYS.huntDistritoUchiha)
      .queue(MAP_KEYS.huntCampoGuerraNinja)
      .queue(MAP_KEYS.huntArredoresReinoClover)
      .queue(MAP_KEYS.huntNamekusei)
      .queue(MAP_KEYS.huntJogosCell)
      .queue(MAP_KEYS.huntTorneioArtesMarciais)
      .queue(MAP_KEYS.huntSalaDoTempo)
      .queue(MAP_KEYS.huntDesertoSaiyajin)
      .queue(MAP_KEYS.huntTesteEquipe)
      .queue(MAP_KEYS.wonsrFarmAnbu)
      .queue(MAP_KEYS.academy)
      .preload();
  }

  async create(): Promise<void> {
    this.cameras.main.setBackgroundColor('#000000');

    if (isDevMode()) {
      const session = getPlayerSession(this.registry);
      const pack = getSpawnCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
      runDevCharacterValidation(this, pack);
    }

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
