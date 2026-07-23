import * as Phaser from 'phaser';
import { getCharacterPack } from '@/data/character-packs';
import { Player } from '@/entities';
import { getPlayerSession } from '@/game/registry';
import { MapLoader, MAP_KEYS, type MapKey } from '@/maps';
import { createMultiplayerClient } from '@/services/multiplayer-client';
import {
  CombatSystem,
  DialogueInteractor,
  EnemyManager,
  IdleAiSystem,
  LootManager,
  LootPickupSystem,
  NPCManager,
  PlayerSyncSystem,
  RemotePlayerManager,
} from '@/systems';
import { dialogueStore } from '@/stores/dialogue-store';
import { inventoryStore } from '@/stores/inventory-store';
import { multiplayerStore } from '@/stores/multiplayer-store';
import { questStore } from '@/stores/quest-store';
import { skillsStore } from '@/stores/skills-store';
import { vitalsStore } from '@/stores/vitals-store';

interface GameSceneData {
  mapKey?: MapKey;
}

const COLLISION_TILES = [4];

/**
 * Cena principal — mapa, player, NPCs, monstros, combate, loot e sync multiplayer.
 */
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  private player!: Player;
  private npcManager!: NPCManager;
  private enemyManager!: EnemyManager;
  private lootManager!: LootManager;
  private lootPickup!: LootPickupSystem;
  private dialogueInteractor!: DialogueInteractor;
  private combatSystem!: CombatSystem;
  private idleAi!: IdleAiSystem;
  private remotePlayers!: RemotePlayerManager;
  private playerSync!: PlayerSyncSystem;
  private readonly multiplayer = createMultiplayerClient();

  constructor() {
    super({ key: GameScene.KEY });
  }

  create(data?: GameSceneData): void {
    this.cameras.main.setBackgroundColor('#000000');

    const session = getPlayerSession(this.registry);
    const starterId = session?.starterCharacterId ?? 'naruto-classic';
    const pack = getCharacterPack(starterId);

    vitalsStore.reset();
    inventoryStore.reset();
    skillsStore.reset(starterId);
    questStore.reset();
    multiplayerStore.reset();

    const mapKey = data?.mapKey ?? MAP_KEYS.leafVillage;
    const maps = new MapLoader(this);

    if (!maps.has(mapKey)) {
      console.warn(`[GameScene] mapa ausente no cache: ${mapKey}`);
      return;
    }

    const { map, layers } = maps.createLayers(mapKey);
    const ground = layers[0];

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    if (ground) {
      ground.setCollision(COLLISION_TILES);
    }

    this.npcManager = new NPCManager(this);
    this.npcManager.loadForMap(mapKey);

    this.enemyManager = new EnemyManager(this);
    this.enemyManager.loadForMap(mapKey);

    this.lootManager = new LootManager(this);

    const spawnX = map.widthInPixels / 2;
    const spawnY = map.heightInPixels / 2;
    this.player = new Player(this, { x: spawnX, y: spawnY, pack });

    if (ground) {
      this.physics.add.collider(this.player.sprite, ground);
    }

    this.dialogueInteractor = new DialogueInteractor(this, this.npcManager, () => ({
      x: this.player.x,
      y: this.player.y,
    }));

    this.combatSystem = new CombatSystem(
      this,
      this.player,
      this.enemyManager,
      this.lootManager,
    );

    this.idleAi = new IdleAiSystem(this.player, this.enemyManager);

    this.lootPickup = new LootPickupSystem(this.player, this.lootManager);

    this.remotePlayers = new RemotePlayerManager(this);
    this.playerSync = new PlayerSyncSystem(this.multiplayer, this.player, this.remotePlayers);

    void this.connectMultiplayer(mapKey);

    const cam = this.cameras.main;
    // Mapa ocupa a tela inteira (cover) na resolução alvo.
    const zoom = Math.max(cam.width / map.widthInPixels, cam.height / map.heightInPixels);
    cam.setZoom(zoom);
    cam.startFollow(this.player.sprite, true, 1, 1);
    cam.setRoundPixels(true);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.multiplayer.disconnect();
      this.remotePlayers.clear();
      multiplayerStore.setDisconnected();
    });
  }

  update(time: number): void {
    this.dialogueInteractor?.update();
    this.idleAi?.update();
    this.combatSystem?.update(time);
    this.lootManager?.update(time);
    this.lootPickup?.update();
    this.playerSync?.update(time);

    if (dialogueStore.isOpen()) {
      this.player?.stop();
    }
  }

  private async connectMultiplayer(mapKey: string): Promise<void> {
    const session = getPlayerSession(this.registry);
    const playerId = session?.playerId ?? `local-${Date.now()}`;
    const nickname = session?.nickname ?? 'Shinobi';
    const villageId = session?.villageId ?? 'konoha';

    this.playerSync.setIdentity({ playerId, nickname, villageId, mapKey });
    multiplayerStore.setConnecting(this.multiplayer.getTransportName());

    try {
      await this.multiplayer.connect({ playerId, nickname, villageId, mapKey });
      multiplayerStore.setConnected(playerId, this.multiplayer.getTransportName());
      this.playerSync.publishJoin();
    } catch (error) {
      console.error('[GameScene] falha ao conectar multiplayer stub', error);
      multiplayerStore.setError();
    }
  }
}
