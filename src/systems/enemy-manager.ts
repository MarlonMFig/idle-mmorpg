import * as Phaser from 'phaser';
import { applyForcedHuntLevels } from '@/constants/combat';
import { ENEMY_SPRITE_URL, ENEMY_TEXTURE_KEY } from '@/constants/enemy';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { getCuratedMapPack } from '@/data/curated-map-sprites';
import { getEnemiesForMap } from '@/data/enemies';
import { getWonsrRenderedMap } from '@/data/wonsr-rendered-maps';
import {
  ensureOutfitWalkAnims,
  outfitIdleFrame,
  wonsrSpriteFit,
  wonsrTextureKey,
  type WonsrDirection,
  type WonsrSpriteFit,
  type WonsrSpriteIndex,
} from '@/data/wonsr-sprites';
import { Enemy } from '@/entities/enemy';
import { type MapKey } from '@/maps/map-registry';
import type { EnemyDefinition, EnemyWalkAnimation } from '@/types/enemy';
import type { HuntCatalog } from '@/types/hunt';

const WONSR_SPRITE_INDEX_KEY = 'wonsr-sprite-index';

const WONSR_HUNTS_KEY = 'wonsr-hunts';
const WONSR_HUNTS_URL = '/data/wonsr/hunts.json';
const WONSR_HUNT_ATLAS_KEY = 'wonsr-hunt-characters';
const WONSR_HUNT_ATLAS_IMAGE = '/sprites/wonsr-hunts/characters.png';
const WONSR_HUNT_ATLAS_JSON = '/sprites/wonsr-hunts/characters.json';
/**
 * Cópias por ponto de spawn. 3 × offset 32px amontoava labels/sprites
 * (efeito “shatter”); 2 com passo maior segue o espaçamento do vídeo.
 */
const ENEMIES_PER_SPAWN = 2;
/** Distância mínima entre clones no mesmo cluster (px mundo). */
const SPAWN_CLUSTER_STEP = 64;
const SPAWN_MIN_SEPARATION = 52;

const MAP_DIRECTIONS: readonly WonsrDirection[] = ['north', 'east', 'south', 'west'];

/**
 * Carrega e gerencia monstros do mapa (spawn, update, respawn).
 */
export class EnemyManager {
  private readonly enemies = new Map<string, Enemy>();
  private mapKey: MapKey | null = null;
  private collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  static preload(scene: Phaser.Scene): void {
    scene.load.image(ENEMY_TEXTURE_KEY, ENEMY_SPRITE_URL);
    scene.load.json(WONSR_HUNTS_KEY, WONSR_HUNTS_URL);
    scene.load.atlas(WONSR_HUNT_ATLAS_KEY, WONSR_HUNT_ATLAS_IMAGE, WONSR_HUNT_ATLAS_JSON);
  }

  setCollisionLayer(layer: Phaser.Tilemaps.TilemapLayer | null): void {
    this.collisionLayer = layer;
  }

  loadForMap(mapKey: MapKey, huntId: string | null = null): Enemy[] {
    this.clear();
    this.mapKey = mapKey;

    const huntDefinitions = this.getHuntEnemies(mapKey, huntId);
    const definitions = huntDefinitions.length ? huntDefinitions : getEnemiesForMap(mapKey);
    for (const definition of definitions) {
      this.spawn(definition);
    }

    return this.list();
  }

  update(time: number): void {
    for (const enemy of this.enemies.values()) {
      enemy.update(time);
    }
  }

  get(id: string): Enemy | undefined {
    return this.enemies.get(id);
  }

  list(): Enemy[] {
    return Array.from(this.enemies.values());
  }

  values(): IterableIterator<Enemy> {
    return this.enemies.values();
  }

  get currentMapKey(): MapKey | null {
    return this.mapKey;
  }

  clear(): void {
    for (const enemy of this.enemies.values()) {
      enemy.destroy();
    }
    this.enemies.clear();
    this.mapKey = null;
  }

  private spawn(definition: EnemyDefinition): Enemy {
    if (this.enemies.has(definition.id)) {
      throw new Error(`Monstro duplicado no mapa: ${definition.id}`);
    }
    const enemy = new Enemy(this.scene, definition, this.collisionLayer);
    this.enemies.set(definition.id, enemy);
    return enemy;
  }

  private static readonly FALLBACK_SPAWNS = [
    { x: 180, y: 180 },
    { x: 320, y: 420 },
    { x: 620, y: 300 },
    { x: 700, y: 500 },
    { x: 470, y: 150 },
  ] as const;

  private getHuntEnemies(mapKey: MapKey, huntId: string | null): EnemyDefinition[] {
    if (!huntId) return [];
    const raw = this.scene.cache.json.get(WONSR_HUNTS_KEY) as HuntCatalog | undefined;
    // TEST: FORCE_HUNT_LEVEL rewrites requiredLevel / level / HP / XP at catalog read.
    const catalog = raw ? applyForcedHuntLevels(raw) : undefined;
    const hunt = catalog?.hunts.find((entry) => entry.id === huntId);
    if (!hunt) return [];

    const rendered = getWonsrRenderedMap(mapKey);
    const basePositions =
      rendered && rendered.enemySpawns.length
        ? rendered.enemySpawns
        : EnemyManager.FALLBACK_SPAWNS;
    const positions = basePositions.flatMap((spawn) =>
      this.expandSpawn(spawn, rendered ? ENEMIES_PER_SPAWN : 1),
    );

    const spriteIndex = this.scene.cache.json.get(WONSR_SPRITE_INDEX_KEY) as
      | WonsrSpriteIndex
      | undefined;

    return positions.map((spawn, index) => {
      const target = hunt.targets[index % hunt.targets.length];
      const curated = this.resolveCurated(target.lookType);
      const outfit = curated ?? this.resolveOutfit(spriteIndex, target.lookType);
      const stats = { level: target.level, hp: target.hp, xp: target.xp };
      return {
        id: `${hunt.id}-${target.id}-${index}`,
        name: target.name,
        hp: stats.hp,
        level: stats.level,
        xp: stats.xp,
        loot: [
          {
            itemId: 'item-copper-coin',
            chance: 0.65,
            quantityMin: 1,
            quantityMax: Math.max(2, Math.min(25, Math.ceil(stats.level / 3))),
            rarity: 'common',
          },
          {
            itemId: 'item-chakra-shard',
            chance: Math.min(0.3, 0.04 + stats.level * 0.002),
            quantityMin: 1,
            quantityMax: 1,
            rarity: 'rare',
          },
        ],
        spawn,
        speed: target.speed,
        chaseRadius: Math.max(80, Math.min(180, target.targetDistance * 45)),
        sprite:
          outfit?.textureKey ??
          (target.hasSprite ? WONSR_HUNT_ATLAS_KEY : ENEMY_TEXTURE_KEY),
        spriteFrame:
          outfit?.idleFrame ?? (target.hasSprite ? `look-${target.lookType}` : undefined),
        walk: outfit?.walk,
        spriteFit: outfit?.fit,
        mapKey,
        sealable: {
          characterId: target.sourceId,
          sourceId: target.sourceId,
          name: target.name,
          lookType: target.lookType,
        },
      };
    });
  }

  private resolveCurated(lookType: number): {
    textureKey: string;
    idleFrame: number;
    walk: EnemyWalkAnimation;
    fit: WonsrSpriteFit;
  } | null {
    const pack = getCuratedMapPack(lookType);
    if (!pack) return null;
    // Packs parciais (ex.: sennin) usam walk como idle até existir folha própria.
    const idle = pack.idle ?? pack.walk;
    if (!this.scene.textures.exists(pack.walk.key) || !this.scene.textures.exists(idle.key)) {
      return null;
    }

    const idleAnimKey = `curated-map-${lookType}-idle`;
    const walkAnimKey = `curated-map-${lookType}-walk`;
    const hurtAnimKey = `curated-map-${lookType}-hurt`;
    const deathAnimKey = `curated-map-${lookType}-death`;

    // Recria se o pack mudou de contagem/tamanho de frames (hot reload de assets).
    if (this.scene.anims.exists(idleAnimKey)) this.scene.anims.remove(idleAnimKey);
    if (this.scene.anims.exists(walkAnimKey)) this.scene.anims.remove(walkAnimKey);
    if (this.scene.anims.exists(hurtAnimKey)) this.scene.anims.remove(hurtAnimKey);
    if (this.scene.anims.exists(deathAnimKey)) this.scene.anims.remove(deathAnimKey);

    // Idle com 1 frame quando reutiliza a sheet de walk (evita “caminhar no lugar”).
    const idleSharesWalk = idle.key === pack.walk.key;
    const idleEnd = idleSharesWalk || !pack.idle ? 0 : pack.idle.frameCount - 1;

    this.scene.anims.create({
      key: idleAnimKey,
      frames: this.scene.anims.generateFrameNumbers(idle.key, {
        start: 0,
        end: idleEnd,
      }),
      frameRate: 8,
      repeat: -1,
    });
    this.scene.anims.create({
      key: walkAnimKey,
      frames: this.scene.anims.generateFrameNumbers(pack.walk.key, {
        start: 0,
        end: pack.walk.frameCount - 1,
      }),
      frameRate: 12,
      repeat: -1,
    });

    let hurtTextureKey: string | undefined;
    let deathTextureKey: string | undefined;
    if (pack.hurt && this.scene.textures.exists(pack.hurt.key)) {
      this.scene.anims.create({
        key: hurtAnimKey,
        frames: this.scene.anims.generateFrameNumbers(pack.hurt.key, {
          start: 0,
          end: pack.hurt.frameCount - 1,
        }),
        frameRate: pack.hurt.frameRate ?? 10,
        repeat: 0,
      });
      hurtTextureKey = pack.hurt.key;
    }
    if (pack.death && this.scene.textures.exists(pack.death.key)) {
      this.scene.anims.create({
        key: deathAnimKey,
        frames: this.scene.anims.generateFrameNumbers(pack.death.key, {
          start: 0,
          end: pack.death.frameCount - 1,
        }),
        frameRate: pack.death.frameRate ?? 8,
        repeat: 0,
      });
      deathTextureKey = pack.death.key;
    }

    const contentH = idle.contentHeight ?? pack.walk.contentHeight ?? pack.walk.frameHeight;
    const scale = contentH > 0 ? CHARACTER_DISPLAY_HEIGHT / contentH : 1;
    const walkAnims: Partial<Record<WonsrDirection, string>> = {};
    const idleFrames: Partial<Record<WonsrDirection, number>> = {};
    for (const direction of MAP_DIRECTIONS) {
      walkAnims[direction] = walkAnimKey;
      idleFrames[direction] = 0;
    }

    return {
      textureKey: idle.key,
      idleFrame: 0,
      walk: {
        directions: [...MAP_DIRECTIONS],
        anims: walkAnims,
        idleFrames,
        lateral: true,
        idleTextureKey: idle.key,
        walkTextureKey: pack.walk.key,
        idleAnimKey,
        walkAnimKey,
        hurtTextureKey,
        hurtAnimKey: hurtTextureKey ? hurtAnimKey : undefined,
        deathTextureKey,
        deathAnimKey: deathTextureKey ? deathAnimKey : undefined,
      },
      fit: { scale, originX: 0.5, originY: 1 },
    };
  }

  private resolveOutfit(
    spriteIndex: WonsrSpriteIndex | undefined,
    lookType: number,
  ): {
    textureKey: string;
    idleFrame: number;
    walk: EnemyWalkAnimation;
    fit: WonsrSpriteFit;
  } | null {
    if (getCuratedMapPack(lookType)) return null;

    const sheet = spriteIndex?.groups.outfits[String(lookType)];
    if (!sheet) return null;

    const textureKey = wonsrTextureKey('outfits', lookType);
    if (!this.scene.textures.exists(textureKey)) return null;

    const anims = ensureOutfitWalkAnims(this.scene, lookType, sheet);
    const idleFrames: Partial<Record<WonsrDirection, number>> = {};
    for (const direction of sheet.directions) {
      idleFrames[direction] = outfitIdleFrame(sheet, direction);
    }

    const idleFrame = idleFrames.south ?? idleFrames[sheet.directions[0]] ?? 0;
    return {
      textureKey,
      idleFrame,
      walk: { directions: sheet.directions, anims, idleFrames },
      fit: wonsrSpriteFit(sheet, CHARACTER_DISPLAY_HEIGHT),
    };
  }

  private expandSpawn(
    origin: { x: number; y: number },
    amount: number,
  ): { x: number; y: number }[] {
    const step = SPAWN_CLUSTER_STEP;
    const offsets = [
      [0, 0],
      [step, 0],
      [-step, 0],
      [0, step],
      [0, -step],
      [step, step],
      [-step, step],
      [step, -step],
      [-step, -step],
      [step * 2, 0],
      [-step * 2, 0],
      [0, step * 2],
      [0, -step * 2],
      [step * 2, step],
      [-step * 2, -step],
    ] as const;
    const result: { x: number; y: number }[] = [];
    for (const [dx, dy] of offsets) {
      const candidate = { x: origin.x + dx, y: origin.y + dy };
      if (!this.isWalkable(candidate.x, candidate.y)) continue;
      const tooClose = result.some(
        (placed) =>
          Math.hypot(placed.x - candidate.x, placed.y - candidate.y) < SPAWN_MIN_SEPARATION,
      );
      if (tooClose) continue;
      result.push(candidate);
      if (result.length >= amount) break;
    }
    return result.length ? result : [origin];
  }

  private isWalkable(worldX: number, worldY: number): boolean {
    const layer = this.collisionLayer;
    if (!layer) return true;
    const tileX = layer.worldToTileX(worldX, true);
    const tileY = layer.worldToTileY(worldY, true);
    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX >= layer.layer.width ||
      tileY >= layer.layer.height
    ) {
      return false;
    }
    const tile = layer.getTileAt(tileX, tileY);
    return tile == null || tile.index === -1;
  }
}
