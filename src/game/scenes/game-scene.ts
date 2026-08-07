import * as Phaser from 'phaser';
import { loadCharacterPack } from '@/data/character-packs';
import {
  filterOutfitLookTypes,
  getCuratedMapPack,
} from '@/data/curated-map-sprites';
import { getKonohaHub } from '@/data/hub-backgrounds';
import { getNpcsForMap } from '@/data/npcs';
import { getWonsrRenderedMap } from '@/data/wonsr-rendered-maps';
import {
  loadOutfitSheets,
  type WonsrSpriteIndex,
} from '@/data/wonsr-sprites';
import { getHubNpcs } from '@/data/wonsr-hub-npcs';
import { Player } from '@/entities';
import { getPlayerSession } from '@/game/registry';
import { getActiveCharacterPack } from '@/lib/active-character';
import type { HuntCatalog } from '@/types/hunt';
import { MapLoader, MAP_KEYS, type MapKey } from '@/maps';
import { createMultiplayerClient } from '@/services/multiplayer-client';
import {
  CombatSystem,
  DialogueInteractor,
  EnemyManager,
  HubInteractableManager,
  IdleAiSystem,
  LootManager,
  LootPickupSystem,
  NPCManager,
  PlayerInputSystem,
  PlayerSyncSystem,
  RemotePlayerManager,
} from '@/systems';
import { dialogueStore } from '@/stores/dialogue-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { multiplayerStore } from '@/stores/multiplayer-store';
import { questStore } from '@/stores/quest-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';

interface GameSceneData {
  mapKey?: MapKey;
  mode?: GameMode;
  huntId?: string | null;
}

/** GIDs de colisão do tileset `nature` (cliff = local 4 → gid 5). */
const COLLISION_TILES = [5];

/**
 * Cena principal — hub fullscreen (arte da Folha) ou combate idle no mapa de caça.
 */
export class GameScene extends Phaser.Scene {
  static readonly KEY = 'GameScene';

  private player!: Player;
  private npcManager!: NPCManager;
  private enemyManager!: EnemyManager;
  private lootManager!: LootManager;
  private lootPickup!: LootPickupSystem;
  private dialogueInteractor!: DialogueInteractor;
  private combatSystem: CombatSystem | null = null;
  private idleAi: IdleAiSystem | null = null;
  private playerInput: PlayerInputSystem | null = null;
  private hubInteractables!: HubInteractableManager;
  private hubCollisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;
  private remotePlayers!: RemotePlayerManager;
  private playerSync!: PlayerSyncSystem;
  private mode: GameMode = 'hub';
  private mapKey: MapKey = MAP_KEYS.leafVillage;
  private huntId: string | null = null;
  private travelSeq = 0;
  private buildSeq = 0;
  /** Enquanto false, os sistemas ainda apontam para objetos da cena anterior. */
  private worldReady = false;
  private worldW = 0;
  private worldH = 0;
  /** Layout da câmera: cover = fundo hub estático; follow = tilemap/combate. */
  private cameraLayout: 'cover' | 'follow' | 'follow-combat' = 'follow';
  private combatUsesRenderedMap = false;
  private unsubLocation: (() => void) | null = null;
  private readonly multiplayer = createMultiplayerClient();

  constructor() {
    super({ key: GameScene.KEY });
  }

  create(data?: GameSceneData): void {
    this.worldReady = false;
    this.cameras.main.setBackgroundColor('#000000');

    const session = getPlayerSession(this.registry);
    const starterId = session?.starterCharacterId ?? 'naruto-classic';
    const index = this.cache.json.get('wonsr-sprite-index') as
      | WonsrSpriteIndex
      | undefined;
    const pack = getActiveCharacterPack(starterId, index);

    // Pack lateral (Shikamaru, …) + outfits WONSR sob demanda; sem isso o
    // player spawna com textura ausente e trava ao gerar frames.
    const buildSeq = ++this.buildSeq;
    void (async () => {
      await loadCharacterPack(this, pack);

      const lookTypes = this.collectLookTypes(data);
      for (const lookType of lookTypes) {
        const curated = getCuratedMapPack(lookType);
        if (curated) await loadCharacterPack(this, curated);
      }

      if (index) {
        await loadOutfitSheets(this, index, filterOutfitLookTypes(lookTypes));
      }
      if (buildSeq !== this.buildSeq || !this.sys.isActive()) return;
      this.buildWorld(data);
    })();
  }

  /** lookTypes visíveis nesta cena: NPCs do mapa/hub + alvos da caça. */
  private collectLookTypes(data?: GameSceneData): number[] {
    const loc = locationStore.getSnapshot();
    const mode = data?.mode ?? loc.mode ?? 'hub';
    const mapKey = data?.mapKey ?? loc.mapKey ?? MAP_KEYS.leafVillage;
    const huntId = data?.huntId ?? loc.huntId ?? null;
    const lookTypes = new Set<number>();

    const npcs = mode === 'hub' ? getHubNpcs() : getNpcsForMap(mapKey);
    for (const npc of npcs) {
      if (npc.lookType) lookTypes.add(npc.lookType);
    }

    if (huntId) {
      const catalog = this.cache.json.get('wonsr-hunts') as HuntCatalog | undefined;
      const hunt = catalog?.hunts.find((entry) => entry.id === huntId);
      for (const target of hunt?.targets ?? []) {
        // hasSprite cobre atlas WONSR; packs curados (ex.: sennin 9001, itachi 9002, neji 9003) não dependem do atlas.
        if (target.hasSprite || getCuratedMapPack(target.lookType)) {
          lookTypes.add(target.lookType);
        }
      }
    }

    const activeLookType = teamStore.getActive()?.lookType;
    if (activeLookType) lookTypes.add(activeLookType);

    return [...lookTypes];
  }

  private buildWorld(data?: GameSceneData): void {
    this.cameras.main.setBackgroundColor('#000000');

    const session = getPlayerSession(this.registry);
    const starterId = session?.starterCharacterId ?? 'naruto-classic';
    const spriteIndex = this.cache.json.get('wonsr-sprite-index') as
      | WonsrSpriteIndex
      | undefined;
    const pack = getActiveCharacterPack(starterId, spriteIndex);

    const loc = locationStore.getSnapshot();
    this.mode = data?.mode ?? loc.mode ?? 'hub';
    this.mapKey = data?.mapKey ?? loc.mapKey ?? MAP_KEYS.leafVillage;
    this.huntId = data?.huntId ?? loc.huntId ?? null;
    this.travelSeq = loc.travelSeq;

    if (!loc.sessionStarted) {
      vitalsStore.reset();
      inventoryStore.reset();
      skillsStore.reset(starterId);
      questStore.reset();
      multiplayerStore.reset();
      locationStore.markSessionStarted();
    } else {
      // Mantém hotbar alinhada ao ativo após reload de troca/viagem.
      skillsStore.applyCharacterHotbar(pack.hotbarSkillIds);
    }

    locationStore.sync(this.mode, this.mapKey, this.huntId);

    this.npcManager = new NPCManager(this);
    this.enemyManager = new EnemyManager(this);
    this.lootManager = new LootManager(this);

    let spawnX: number;
    let spawnY: number;
    let worldW: number;
    let worldH: number;
    let combatCollisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    const hub = getKonohaHub();
    const hubUsesTilemap = this.mode === 'hub' && hub.tilemapKey != null;

    if (this.mode === 'hub' && !hubUsesTilemap) {
      if (!this.textures.exists(hub.key)) {
        console.warn(`[GameScene] hub ausente: ${hub.key}`);
        return;
      }

      const bg = this.add.image(0, 0, hub.key).setOrigin(0, 0).setDepth(0);
      bg.setDisplaySize(hub.width, hub.height);

      worldW = hub.width;
      worldH = hub.height;
      spawnX = hub.spawn.x;
      spawnY = hub.spawn.y;

      this.physics.world.setBounds(0, 0, worldW, worldH);
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      this.worldW = worldW;
      this.worldH = worldH;
      this.cameraLayout = 'cover';
      this.applyCameraLayout();
    } else if (hubUsesTilemap) {
      const maps = new MapLoader(this);
      const hubMapKey = hub.tilemapKey as MapKey;
      if (!maps.has(hubMapKey)) {
        console.warn(`[GameScene] mapa do hub ausente no cache: ${hubMapKey}`);
        return;
      }

      // Visual: PNG inteira (Phaser quebra tilesets com milhares de GIDs únicos).
      // Colisão: camada invisível do TMX.
      const imageKey = hub.tilemapImageKey;
      if (!imageKey || !this.textures.exists(imageKey)) {
        console.warn(`[GameScene] imagem do hub ausente: ${imageKey}`);
        return;
      }

      worldW = hub.tilemapWidth ?? 3072;
      worldH = hub.tilemapHeight ?? 3072;
      this.add.image(0, 0, imageKey).setOrigin(0, 0).setDepth(0);

      const { layers } = maps.createLayers(hubMapKey);
      const ground = layers.find((layer) => layer.layer.name === 'ground');
      const collision = layers.find((layer) => layer.layer.name === 'collision');
      ground?.setVisible(false);
      collision?.setVisible(false);
      if (collision) {
        collision.setCollisionByExclusion([-1]);
        this.hubCollisionLayer = collision;
      }

      spawnX = hub.tilemapSpawn?.x ?? worldW / 2;
      spawnY = hub.tilemapSpawn?.y ?? worldH / 2;

      this.physics.world.setBounds(0, 0, worldW, worldH);
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      this.worldW = worldW;
      this.worldH = worldH;
      this.cameraLayout = 'follow';
      this.applyCameraLayout();
    } else {
      const maps = new MapLoader(this);
      if (!maps.has(this.mapKey)) {
        console.warn(`[GameScene] mapa ausente no cache: ${this.mapKey}`);
        return;
      }

      // Mapas WONSR recortados: PNG única como visual + colisão invisível do TMX.
      const rendered = getWonsrRenderedMap(this.mapKey);
      let collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

      if (rendered) {
        if (!this.textures.exists(rendered.imageKey)) {
          console.warn(`[GameScene] imagem do mapa ausente: ${rendered.imageKey}`);
          return;
        }

        worldW = rendered.width;
        worldH = rendered.height;
        spawnX = rendered.spawn.x;
        spawnY = rendered.spawn.y;
        this.add.image(0, 0, rendered.imageKey).setOrigin(0, 0).setDepth(0);

        const { layers } = maps.createLayers(this.mapKey);
        const collision = layers.find((layer) => layer.layer.name === 'collision');
        for (const layer of layers) layer.setVisible(false);
        if (collision) {
          collision.setCollisionByExclusion([-1]);
          collisionLayer = collision;
        }
      } else {
        const { map, layers } = maps.createLayers(this.mapKey);
        const ground = layers.find((layer) => layer.layer.name === 'ground') ?? layers[0];
        const decor = layers.find((layer) => layer.layer.name === 'decor');
        const collision = layers.find((layer) => layer.layer.name === 'collision');

        ground?.setDepth(0);
        decor?.setDepth(1);
        collision?.setVisible(false);

        worldW = map.widthInPixels;
        worldH = map.heightInPixels;
        spawnX = worldW / 2;
        spawnY = worldH / 2;

        if (collision) {
          collision.setCollisionByExclusion([-1]);
          collisionLayer = collision;
        } else if (ground) {
          ground.setCollision(COLLISION_TILES);
          collisionLayer = ground;
        }
      }

      this.physics.world.setBounds(0, 0, worldW, worldH);
      this.cameras.main.setBounds(0, 0, worldW, worldH);

      this.npcManager.loadForMap(this.mapKey);
      this.enemyManager.setCollisionLayer(collisionLayer);
      this.enemyManager.loadForMap(this.mapKey, this.huntId);

      this.player = new Player(this, {
        x: spawnX,
        y: spawnY,
        pack,
        displayName: session?.nickname,
      });
      if (collisionLayer) {
        this.physics.add.collider(this.player.sprite, collisionLayer);
        combatCollisionLayer = collisionLayer;
      }

      this.combatUsesRenderedMap = Boolean(rendered);
      this.worldW = worldW;
      this.worldH = worldH;
      this.cameraLayout = 'follow-combat';
      this.applyCameraLayout();
      this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
    }

    if (this.mode === 'hub') {
      this.player = new Player(this, {
        x: spawnX,
        y: spawnY,
        pack,
        displayName: session?.nickname,
      });
      this.npcManager.loadHub();

      if (this.hubCollisionLayer) {
        this.physics.add.collider(this.player.sprite, this.hubCollisionLayer);
        this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
      }
    }

    this.scale.off('resize', this.onScaleResize, this);
    this.scale.on('resize', this.onScaleResize, this);

    this.dialogueInteractor = new DialogueInteractor(this, this.npcManager, () => ({
      x: this.player.x,
      y: this.player.y,
    }));

    this.hubInteractables = new HubInteractableManager(this);
    this.hubInteractables.load(this.mode, this.mapKey);

    this.lootPickup = new LootPickupSystem(this.lootManager);

    if (this.mode === 'hub') {
      this.playerInput = new PlayerInputSystem(this, this.player);
      this.playerInput.setEnabled(true);
      this.combatSystem = null;
      this.idleAi = null;
    } else {
      this.playerInput = null;
      this.combatSystem = new CombatSystem(
        this,
        this.player,
        this.enemyManager,
        this.lootManager,
      );
      this.idleAi = new IdleAiSystem(
        this.player,
        this.enemyManager,
        combatCollisionLayer,
      );
    }

    this.remotePlayers = new RemotePlayerManager(this);
    this.playerSync = new PlayerSyncSystem(this.multiplayer, this.player, this.remotePlayers);

    void this.connectMultiplayer(this.mapKey);

    this.unsubLocation = locationStore.subscribe(() => {
      const next = locationStore.getSnapshot();
      if (next.travelSeq === this.travelSeq) return;
      this.travelSeq = next.travelSeq;
      this.scene.restart({ mapKey: next.mapKey, mode: next.mode, huntId: next.huntId });
    });

    this.worldReady = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.worldReady = false;
      this.scale.off('resize', this.onScaleResize, this);
      this.unsubLocation?.();
      this.unsubLocation = null;
      this.hubInteractables?.clear();
      this.multiplayer.disconnect();
      this.remotePlayers.clear();
      multiplayerStore.setDisconnected();
    });
  }

  /** Canvas RESIZE: viewport e zoom acompanham o tamanho do parent (100vw × 100dvh). */
  private onScaleResize(): void {
    if (!this.worldReady) return;
    this.applyCameraLayout();
  }

  private applyCameraLayout(): void {
    const cam = this.cameras.main;
    const w = this.scale.width;
    const h = this.scale.height;
    cam.setViewport(0, 0, w, h);
    cam.setRoundPixels(true);

    if (this.cameraLayout === 'cover') {
      // Preenche o viewport (cover); corta bordas se aspect do hub ≠ da janela.
      const zoom = Math.max(w / this.worldW, h / this.worldH);
      cam.setZoom(zoom);
      cam.centerOn(this.worldW / 2, this.worldH / 2);
      return;
    }

    if (this.cameraLayout === 'follow-combat') {
      // Cover preenche o viewport (sem pilares pretos laterais). Mapas
      // renderizados ainda exigem zoom ≥ 2.25 para legibilidade em combat.
      const coverZoom = Math.max(w / this.worldW, h / this.worldH);
      const zoom = this.combatUsesRenderedMap
        ? Math.max(2.25, coverZoom)
        : coverZoom;
      cam.setZoom(zoom);
      return;
    }

    // Hub tilemap: zoom fixo, follow do player.
    cam.setZoom(2);
  }

  update(time: number): void {
    if (!this.worldReady) return;

    this.dialogueInteractor?.update();
    this.playerInput?.update();
    this.idleAi?.update();
    this.combatSystem?.update(time);
    this.lootManager?.update(time);
    this.lootPickup?.update();
    this.playerSync?.update(time);
    this.player?.syncPresentation();

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
