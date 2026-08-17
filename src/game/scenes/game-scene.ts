import * as Phaser from 'phaser';
import { refreshWorldTextResolution } from '@/constants/nameplate';
import { HUB_CHARACTER_SCALE } from '@/constants/sprites';
import { loadCharacterPack } from '@/data/character-packs';
import { filterOutfitLookTypes, getCuratedMapPack } from '@/data/curated-map-sprites';
import { getActiveHub } from '@/data/hub-backgrounds';
import { getNpcsForMap } from '@/data/npcs';
import { combatLayoutScale, getWonsrRenderedMap } from '@/data/wonsr-rendered-maps';
import { loadOutfitSheets, type WonsrSpriteIndex } from '@/data/wonsr-sprites';
import { getHubNpcs } from '@/data/wonsr-hub-npcs';
import { resolveCharacterPack } from '@/data/resolve-character-pack';
import { Player } from '@/entities';
import { getPlayerSession } from '@/game/registry';
import { getActiveCharacterPack } from '@/lib/active-character';
import { emitChatMessage, emitSystemMessage } from '@/lib/system-log';
import type { HuntCatalog } from '@/types/hunt';
import type { SealedCharacter } from '@/types/team';
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
  TargetClaims,
  LEADER_CLAIM_ID,
  TeamCompanionSystem,
} from '@/systems';
import { dialogueStore } from '@/stores/dialogue-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { multiplayerStore } from '@/stores/multiplayer-store';
import { attributesStore } from '@/stores/attributes-store';
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
  private teamCompanions: TeamCompanionSystem | null = null;
  private targetClaims: TargetClaims | null = null;
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
  private updateErrorReported = false;
  private worldW = 0;
  private worldH = 0;
  /** Layout da câmera: cover/contain-hub = arte da vila; contain-combat = arena inteira; follow = tilemap. */
  private cameraLayout:
    'cover' | 'contain-hub' | 'follow' | 'follow-combat' | 'contain-combat' | 'follow-explore' =
    'follow';
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
    const index = this.cache.json.get('wonsr-sprite-index') as WonsrSpriteIndex | undefined;
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

      // Mapa com a equipe inteira: aliados precisam do próprio pack em memória.
      const mapKey = data?.mapKey ?? locationStore.getSnapshot().mapKey;
      for (const member of this.companionMembers(mapKey)) {
        await loadCharacterPack(this, resolveCharacterPack(member, starterId, index));
      }

      if (index) {
        await loadOutfitSheets(this, index, filterOutfitLookTypes(lookTypes));
      }
      if (buildSeq !== this.buildSeq || !this.sys.isActive()) return;
      this.buildWorld(data);
    })().catch((error) => {
      // Sem isto a falha virava rejection silenciosa: mundo desenhado pela
      // metade, `worldReady` false e tudo parado sem nenhum aviso.
      console.error('[GameScene] falha ao montar o mundo', error);
      emitSystemMessage(
        `Falha ao montar o mapa (${this.mapKey}): ${error instanceof Error ? error.message : String(error)}`,
      );
    });
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

  /** Membros da equipe que entram como aliados (só em mapas `teamParty`). */
  private companionMembers(mapKey: MapKey): SealedCharacter[] {
    if (!getWonsrRenderedMap(mapKey)?.teamParty) return [];
    const team = teamStore.getSnapshot();
    return team.teamIds
      .filter((id) => id !== team.activeId)
      .map((id) => team.collection.find((entry) => entry.id === id))
      .filter((entry): entry is SealedCharacter => entry != null);
  }

  private buildWorld(data?: GameSceneData): void {
    this.cameras.main.setBackgroundColor('#000000');

    const session = getPlayerSession(this.registry);
    const starterId = session?.starterCharacterId ?? 'naruto-classic';
    const spriteIndex = this.cache.json.get('wonsr-sprite-index') as WonsrSpriteIndex | undefined;
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

    // Assinado antes de montar o mundo: se a montagem abortar, "Voltar" e as
    // demais viagens continuam reiniciando a cena em vez de travar o jogo.
    this.unsubLocation?.();
    this.unsubLocation = locationStore.subscribe(() => {
      const next = locationStore.getSnapshot();
      if (next.travelSeq === this.travelSeq) return;
      this.travelSeq = next.travelSeq;
      this.scene.restart({ mapKey: next.mapKey, mode: next.mode, huntId: next.huntId });
    });

    this.npcManager = new NPCManager(this);
    this.enemyManager = new EnemyManager(this);
    this.lootManager = new LootManager(this);

    let spawnX: number;
    let spawnY: number;
    let worldW: number;
    let worldH: number;
    let combatCollisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

    const hub = getActiveHub();
    const hubUsesTilemap = this.mode === 'hub' && hub.tilemapKey != null;

    if (this.mode === 'hub' && !hubUsesTilemap) {
      if (!this.textures.exists(hub.key)) {
        console.warn(`[GameScene] hub ausente: ${hub.key}`);
        return;
      }

      const bg = this.add.image(0, 0, hub.key).setOrigin(0, 0).setDepth(0);
      bg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
      bg.setDisplaySize(hub.width, hub.height);

      worldW = hub.width;
      worldH = hub.height;
      spawnX = hub.spawn.x;
      spawnY = hub.spawn.y;

      this.physics.world.setBounds(0, 0, worldW, worldH);
      this.cameras.main.setBounds(0, 0, worldW, worldH);
      this.worldW = worldW;
      this.worldH = worldH;
      this.cameraLayout = hub.cameraMode === 'contain' ? 'contain-hub' : 'cover';
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
      const hubBg = this.add.image(0, 0, imageKey).setOrigin(0, 0).setDepth(0);
      // Ilustração pintada: linear. pixelArt/nearest fica só nos sprites.
      hubBg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

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
      this.cameraLayout =
        hub.cameraMode === 'follow'
          ? 'follow'
          : hub.cameraMode === 'contain'
            ? 'contain-hub'
            : 'cover';
      this.applyCameraLayout();
    } else {
      const maps = new MapLoader(this);
      if (!maps.has(this.mapKey)) {
        this.recoverToHub(`mapa ausente no cache: ${this.mapKey}`);
        return;
      }

      // Mapas WONSR recortados: PNG única como visual + colisão invisível do TMX.
      const rendered = getWonsrRenderedMap(this.mapKey);
      let collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

      if (rendered) {
        if (!this.textures.exists(rendered.imageKey)) {
          this.recoverToHub(`imagem do mapa ausente: ${rendered.imageKey}`);
          return;
        }

        worldW = rendered.width;
        worldH = rendered.height;
        spawnX = rendered.spawn.x;
        spawnY = rendered.spawn.y;
        const mapBg = this.add.image(0, 0, rendered.imageKey).setOrigin(0, 0).setDepth(0);
        mapBg.texture.setFilter(
          rendered.foregroundKey
            ? Phaser.Textures.FilterMode.NEAREST
            : Phaser.Textures.FilterMode.LINEAR,
        );
        if (rendered.videoKey && this.cache.video.exists(rendered.videoKey)) {
          try {
            const mapVideo = this.add.video(0, 0, rendered.videoKey);
            mapVideo.setOrigin(0, 0);
            mapVideo.setDepth(0.5);
            mapVideo.setMute(true);
            // Phaser tipa incompleto: setPauseOnBlur existe em runtime no Video.
            (
              mapVideo as Phaser.GameObjects.Video & { setPauseOnBlur: (v: boolean) => void }
            ).setPauseOnBlur(false);
            mapVideo.setDisplaySize(rendered.width, rendered.height);
            mapVideo.play(true);
          } catch (error) {
            console.warn('[GameScene] falha ao tocar vídeo do mapa', error);
          }
        }

        let layers: Phaser.Tilemaps.TilemapLayer[] = [];
        try {
          layers = maps.createLayers(this.mapKey).layers;
        } catch (error) {
          console.warn(`[GameScene] colisão TMX falhou (${this.mapKey})`, error);
        }
        const collision = layers.find((layer) => layer.layer.name === 'collision');
        for (const layer of layers) layer.setVisible(false);
        if (collision) {
          collision.setCollisionByExclusion([-1]);
          collisionLayer = collision;
        }
        if (rendered.foregroundKey && this.textures.exists(rendered.foregroundKey)) {
          const mapFg = this.add
            .image(0, 0, rendered.foregroundKey)
            .setOrigin(0, 0)
            .setDepth(36)
            .setScrollFactor(1);
          mapFg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
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
        worldScale: combatLayoutScale(this.mapKey),
        moveSpeed: this.mapMoveSpeed(),
      });
      if (collisionLayer) {
        this.physics.add.collider(this.player.sprite, collisionLayer);
        combatCollisionLayer = collisionLayer;
      }

      this.worldW = worldW;
      this.worldH = worldH;
      this.cameraLayout = !rendered
        ? 'follow-combat'
        : rendered.cameraFollow
          ? 'follow-explore'
          : 'contain-combat';
      this.applyCameraLayout();
      if (!rendered) {
        this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
      } else if (rendered.cameraFollow) {
        // Contain: a ilustração inteira fica na tela, sem recorte/zoom.
        // Caso contrário o mundo é maior que a viewport e a câmera segue o líder.
        if (rendered.cameraFit !== 'contain') {
          this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);
        }
        this.teamCompanions = this.createTeamCompanions(
          spawnX,
          spawnY,
          collisionLayer,
          combatLayoutScale(this.mapKey),
          spriteIndex,
        );
      }
    }

    if (this.mode === 'hub') {
      this.player = new Player(this, {
        x: spawnX,
        y: spawnY,
        pack,
        displayName: session?.nickname,
        worldScale: HUB_CHARACTER_SCALE,
      });
      this.npcManager.loadHub();

      if (this.hubCollisionLayer) {
        this.physics.add.collider(this.player.sprite, this.hubCollisionLayer);
        // Cover stays centered on the illustration; only follow in follow mode.
        if (this.cameraLayout === 'follow') {
          this.cameras.main.startFollow(this.player.sprite, true, 1, 1);
        }
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
      this.playerInput = new PlayerInputSystem(this, this.player, {
        lateral: hub.lateralFloorY != null,
      });
      this.playerInput.setEnabled(true);
      this.combatSystem = null;
      this.idleAi = null;
    } else {
      // Mapa de exploração: WASD move o líder e a IA idle assume ao soltar as teclas.
      const explore = getWonsrRenderedMap(this.mapKey)?.cameraFollow === true;
      this.playerInput = explore ? new PlayerInputSystem(this, this.player) : null;
      this.playerInput?.setEnabled(true);
      this.combatSystem = new CombatSystem(
        this,
        this.player,
        this.enemyManager,
        this.lootManager,
        this.targetClaims,
      );
      this.idleAi = new IdleAiSystem(this.player, this.enemyManager, combatCollisionLayer, {
        claims: this.targetClaims,
      });
    }

    this.remotePlayers = new RemotePlayerManager(
      this,
      this.mode === 'hub' ? HUB_CHARACTER_SCALE : combatLayoutScale(this.mapKey),
    );
    this.playerSync = new PlayerSyncSystem(this.multiplayer, this.player, this.remotePlayers);

    void this.connectMultiplayer(this.mapKey);

    this.worldReady = true;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.worldReady = false;
      this.scale.off('resize', this.onScaleResize, this);
      this.unsubLocation?.();
      this.unsubLocation = null;
      this.hubInteractables?.clear();
      this.teamCompanions?.destroy();
      this.teamCompanions = null;
      this.targetClaims?.clear();
      this.targetClaims = null;
      this.multiplayer.disconnect();
      this.remotePlayers.clear();
      multiplayerStore.setDisconnected();
    });
  }

  /** Velocidade do mapa atual (mapa de teste farm usa multiplicador do vídeo). */
  private mapMoveSpeed(): number | undefined {
    const mult = getWonsrRenderedMap(this.mapKey)?.moveSpeedMult;
    if (mult == null || mult === 1) return undefined;
    return attributesStore.getSpeed() * mult;
  }

  /** Sobe os outros dois membros da equipe ao lado do jogador. */
  private createTeamCompanions(
    spawnX: number,
    spawnY: number,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
    worldScale: number,
    spriteIndex: WonsrSpriteIndex | undefined,
  ): TeamCompanionSystem | null {
    const session = getPlayerSession(this.registry);
    const starterId = session?.starterCharacterId ?? 'naruto-classic';
    const members = this.companionMembers(this.mapKey);
    if (members.length === 0) return null;

    // Reserva de alvos só existe quando a equipe entra em campo; nos demais
    // mapas o líder continua mirando pelo simples "mais próximo".
    this.targetClaims = new TargetClaims();

    const companions = members.map((member, index) => {
      const player = new Player(this, {
        x: spawnX + (index === 0 ? -40 : 40),
        y: spawnY + 48,
        pack: resolveCharacterPack(member, starterId, spriteIndex),
        displayName: member.name,
        worldScale,
        moveSpeed: this.mapMoveSpeed(),
      });
      if (collisionLayer) {
        this.physics.add.collider(player.sprite, collisionLayer);
      }
      return { id: member.id, player, level: member.level };
    });

    return new TeamCompanionSystem(this, this.player, companions, {
      collisionLayer,
      enemyManager: this.enemyManager,
      lootManager: this.lootManager,
      claims: this.targetClaims,
    });
  }

  /**
   * Asset de caça ausente: volta ao hub em vez de deixar a cena sem mundo.
   * Antes o jogo parecia travado — HUD viva, nenhum player e nenhuma saída.
   */
  private recoverToHub(reason: string): void {
    console.warn(`[GameScene] ${reason} — retornando ao hub`);
    if (this.mode === 'hub') return;
    this.time.delayedCall(0, () => locationStore.enterHub());
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
    } else if (this.cameraLayout === 'contain-hub') {
      const zoom = Math.min(w / this.worldW, h / this.worldH);
      cam.stopFollow();
      cam.setZoom(zoom);
      cam.centerOn(this.worldW / 2, this.worldH / 2);
    } else if (this.cameraLayout === 'contain-combat') {
      // Cover: preenche o viewport. Contain + setBounds(0,0,world)
      // travava o scroll em 0 e empurrava a tarja preta só para a direita.
      const zoom = Math.max(w / this.worldW, h / this.worldH);
      cam.stopFollow();
      cam.setZoom(zoom);
      cam.centerOn(this.worldW / 2, this.worldH / 2);
    } else if (this.cameraLayout === 'follow-explore') {
      const rendered = getWonsrRenderedMap(this.mapKey);
      if (rendered?.cameraFit === 'contain') {
        // Enquadra o PNG inteiro (como no visualizador). Sem padding nas
        // bounds, o Phaser trava o scroll em 0 e a arte cola na esquerda.
        const zoom = Math.min(w / this.worldW, h / this.worldH);
        const viewW = w / zoom;
        const viewH = h / zoom;
        const padX = Math.max(0, (viewW - this.worldW) / 2);
        const padY = Math.max(0, (viewH - this.worldH) / 2);
        cam.stopFollow();
        cam.setRoundPixels(false);
        cam.setZoom(zoom);
        cam.setBounds(-padX, -padY, this.worldW + padX * 2, this.worldH + padY * 2);
        cam.centerOn(this.worldW / 2, this.worldH / 2);
      } else {
        cam.setZoom(rendered?.cameraZoom ?? 1);
      }
    } else if (this.cameraLayout === 'follow-combat') {
      const coverZoom = Math.max(w / this.worldW, h / this.worldH);
      cam.setZoom(coverZoom);
    } else {
      // Hub 4K: cover preenche a tela. Em 1080p o zoom sai da altura (0.5), então
      // a arte cabe inteira na vertical e a câmera só desliza os 256px extras de
      // largura do mundo 4096. Floor 2 esticava o PNG 1024.
      const coverZoom = Math.max(w / this.worldW, h / this.worldH);
      cam.setZoom(coverZoom);
    }
    refreshWorldTextResolution(this);
  }

  update(time: number): void {
    if (!this.worldReady) return;

    // O Phaser agenda o próximo frame depois do update: uma exceção aqui
    // derrubava o loop inteiro e o mapa congelava com a HUD viva.
    try {
      this.stepWorld(time);
    } catch (error) {
      this.reportUpdateError(error);
    }
  }

  private stepWorld(time: number): void {
    this.dialogueInteractor?.update();
    const manualMove = this.playerInput?.update() ?? false;
    // Sob WASD o líder não persegue ninguém: solta a reserva para os aliados
    // não desviarem de um alvo que ele deixou para trás.
    if (manualMove) this.targetClaims?.release(LEADER_CLAIM_ID);
    else this.idleAi?.update();
    this.teamCompanions?.update(time);
    this.combatSystem?.update(time);
    this.lootManager?.update(time);
    this.lootPickup?.update();
    this.playerSync?.update(time);
    this.clampLateralFloor();
    this.player?.syncPresentation();

    if (dialogueStore.isOpen()) {
      this.player?.stop();
    }
  }

  /** Só a primeira falha vira log/chat; as seguintes seriam ruído a 60 fps. */
  private reportUpdateError(error: unknown): void {
    if (this.updateErrorReported) return;
    this.updateErrorReported = true;
    console.error('[GameScene] erro no update', error);
    const detail = error instanceof Error ? error.message : String(error);
    emitSystemMessage(`Falha no mapa (${this.mapKey}): ${detail}`);
  }

  /** Visão lateral: pés do jogador e inimigos na linha do chão. */
  private clampLateralFloor(): void {
    const floorY =
      this.mode === 'hub'
        ? getActiveHub().lateralFloorY
        : getWonsrRenderedMap(this.mapKey)?.lateralFloorY;
    if (floorY == null || !this.player) return;
    if (Math.abs(this.player.sprite.y - floorY) > 0.5) {
      this.player.sprite.setY(floorY);
      this.player.sprite.setVelocityY(0);
    }
    for (const enemy of this.enemyManager.values()) {
      if (!enemy.isAlive) continue;
      if (Math.abs(enemy.sprite.y - floorY) > 0.5) {
        enemy.sprite.setY(floorY);
        enemy.sprite.setVelocityY(0);
      }
    }
  }

  private async connectMultiplayer(mapKey: string): Promise<void> {
    const session = getPlayerSession(this.registry);
    const playerId = session?.playerId ?? `local-${Date.now()}`;
    const nickname = session?.nickname ?? 'Shinobi';
    const villageId = session?.villageId ?? 'konoha';
    const characterId =
      teamStore.getActive()?.id ?? session?.starterCharacterId ?? 'naruto-classic';

    this.playerSync.setIdentity({
      playerId,
      nickname,
      villageId,
      mapKey,
      characterId,
    });
    multiplayerStore.setConnecting(this.multiplayer.getTransportName());

    this.multiplayer.setHandlers({
      onChat: ({ nickname: nick, text }) => {
        emitChatMessage(nick, text);
      },
    });

    try {
      await this.multiplayer.connect({ playerId, nickname, villageId, mapKey });
      multiplayerStore.setConnected(playerId, this.multiplayer.getTransportName(), nickname);
      multiplayerStore.registerChatSender((text) => {
        this.multiplayer.sendChat(text, nickname);
      });
      this.playerSync.publishJoin();
    } catch (error) {
      console.error('[GameScene] falha ao conectar multiplayer', error);
      multiplayerStore.setError();
      multiplayerStore.registerChatSender(null);
    }
  }
}
