import * as Phaser from 'phaser';
import {
  applyForcedHuntLevels,
  ENEMY_CORPSE_MS,
  huntEnemyStatsForLevel,
  LATERAL_SIDE_ENEMY_RESPAWN_MS,
  LATERAL_SIDE_MAX_ALIVE,
} from '@/constants/combat';
import { ENEMY_SPRITE_URL, ENEMY_TEXTURE_KEY } from '@/constants/enemy';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import { resolveAnimeId } from '@/data/anime';
import { buildAnimeHuntLoot } from '@/data/anime-loot';
import { characterLateralOrigin, type CharacterPack } from '@/data/character-packs';
import { getCuratedMapPack } from '@/data/curated-map-sprites';
import { getEnemiesForMap } from '@/data/enemies';
import { combatLayoutScale, enemyRespawnMsForMap, enemySpeedMultForMap, getWonsrRenderedMap, isLateralSideSpawnMap } from '@/data/wonsr-rendered-maps';
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
import { type Decimal as DecimalValue } from '@/lib/decimal';
import { LAB_DUMMY_ID } from '@/stores/character-lab-store';
import { type MapKey } from '@/maps/map-registry';
import type { EnemyDefinition, EnemySkill, EnemyWalkAnimation } from '@/types/enemy';
import type { HuntCatalog, HuntTargetAttack } from '@/types/hunt';
import { pickHuntTargetIndex } from '@/lib/hunt-spawn';
import { rollSpawnQualityFromWeights } from '@/lib/hunt-spawn';
import { isHuntCatalogSealable } from '@/lib/resolve-character-quality';

const WONSR_SPRITE_INDEX_KEY = 'wonsr-sprite-index';

const WONSR_HUNTS_KEY = 'wonsr-hunts';
const WONSR_HUNTS_URL = '/data/wonsr/hunts.json?v=naruto-td1';
const WONSR_HUNT_ATLAS_KEY = 'wonsr-hunt-characters';
const WONSR_HUNT_ATLAS_IMAGE = '/sprites/wonsr-hunts/characters.png';
const WONSR_HUNT_ATLAS_JSON = '/sprites/wonsr-hunts/characters.json';
/**
 * Cópias por ponto de spawn. 3 × offset 32px amontoava labels/sprites
 * (efeito “shatter”); 2 com passo maior segue o espaçamento do vídeo.
 */
const ENEMIES_PER_SPAWN = 1;
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
  /** Fila de duelo lateral (direita → esquerda, em ciclo). */
  private duelHuntId: string | null = null;
  private duelTargetIndex = 0;
  private duelSide = 0;
  private duelMaxAlive = 1;
  private duelEntryDelayMs = 0;
  private duelSpawnSeq = 0;
  private duelLeft: { x: number; y: number } | null = null;
  private duelRight: { x: number; y: number } | null = null;
  private duelTimers: Phaser.Time.TimerEvent[] = [];
  /** Timer de fila: próximo entra mesmo com os anteriores vivos. */
  private duelSpawnLoop = false;
  private huntPaused = false;

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

  loadBoss(mapKey: MapKey, definition: EnemyDefinition): Enemy {
    this.clear();
    this.mapKey = mapKey;
    return this.spawn(definition);
  }

  buildLookTypePresentation(
    lookType: number,
    mapKey: MapKey,
    spawn: { x: number; y: number },
    stats: { id: string; name: string; hp: number; level: number; xp: number; speed: number },
    affinity: Pick<EnemyDefinition, 'resistances' | 'immunities' | 'statusResistances' | 'statusImmunities'>,
  ): EnemyDefinition {
    const curated = this.resolveCurated(lookType);
    const spriteIndex = this.scene.cache.json.get(WONSR_SPRITE_INDEX_KEY) as WonsrSpriteIndex | undefined;
    const outfit = curated ?? this.resolveOutfit(spriteIndex, lookType);
    const layout = combatLayoutScale(mapKey);
    const renderedMap = getWonsrRenderedMap(mapKey);
    const fit = outfit?.fit
      ? {
          ...outfit.fit,
          scale: outfit.fit.scale * layout,
          scaleX: (outfit.fit.scaleX ?? outfit.fit.scale) * layout,
        }
      : undefined;
    const chaseRadius =
      renderedMap?.lateralFloorY != null && renderedMap.width > 0
        ? renderedMap.width
        : 240 * layout;
    const enemySpeedMult = enemySpeedMultForMap(renderedMap);
    return {
      id: stats.id,
      name: stats.name,
      hp: stats.hp,
      level: stats.level,
      xp: stats.xp,
      loot: [],
      spawn,
      speed: stats.speed * layout * enemySpeedMult,
      chaseRadius,
      sprite: outfit?.textureKey ?? ENEMY_TEXTURE_KEY,
      spriteFrame: outfit?.idleFrame,
      walk: outfit?.walk,
      spriteFit: fit,
      mapKey,
      noRespawn: true,
      aiMode: 'external',
      resistances: affinity.resistances,
      immunities: affinity.immunities,
      statusResistances: affinity.statusResistances,
      statusImmunities: affinity.statusImmunities,
    };
  }

  update(time: number, playerX?: number, playerY?: number): DecimalValue[] {
    const hits: DecimalValue[] = [];
    for (const enemy of this.enemies.values()) {
      if (this.huntPaused && enemy.id !== LAB_DUMMY_ID) continue;
      const damage = enemy.update(
        time,
        this.huntPaused ? undefined : playerX,
        this.huntPaused ? undefined : playerY,
      );
      if (damage != null && damage.gt(0)) hits.push(damage);
    }
    return hits;
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
    this.clearDuel();
  }

  /**
   * Após kill em caça sequencial: remove o cadáver.
   * Na fila lateral o próximo já entra pelo timer — não espera a morte.
   */
  onEnemyKilled(enemyId: string): void {
    if (!this.duelHuntId || !this.mapKey) return;
    const dead = this.enemies.get(enemyId);
    if (!dead) return;

    this.scheduleDuel(ENEMY_CORPSE_MS, () => {
      const still = this.enemies.get(enemyId);
      if (still) {
        still.destroy();
        this.enemies.delete(enemyId);
      }
    });

    if (!this.duelSpawnLoop) {
      this.scheduleDuel(this.duelEntryDelayMs, () => {
        this.spawnDuelNext();
      });
    }
  }

  private clearDuel(): void {
    for (const timer of this.duelTimers) {
      timer.remove(false);
    }
    this.duelTimers = [];
    this.duelHuntId = null;
    this.duelTargetIndex = 0;
    this.duelSide = 0;
    this.duelMaxAlive = 1;
    this.duelEntryDelayMs = 0;
    this.duelSpawnSeq = 0;
    this.duelLeft = null;
    this.duelRight = null;
    this.duelSpawnLoop = false;
  }

  private scheduleDuel(delayMs: number, fn: () => void): void {
    const timer = this.scene.time.delayedCall(Math.max(0, delayMs), () => {
      this.duelTimers = this.duelTimers.filter((entry) => entry !== timer);
      fn();
    });
    this.duelTimers.push(timer);
  }

  private aliveCount(): number {
    let count = 0;
    for (const enemy of this.enemies.values()) {
      if (enemy.isAlive) count += 1;
    }
    return count;
  }

  private spawnDuelNext(): void {
    if (!this.duelHuntId || !this.mapKey) return;
    if (this.huntPaused) return;
    if (this.aliveCount() >= this.duelMaxAlive) return;

    const raw = this.scene.cache.json.get(WONSR_HUNTS_KEY) as HuntCatalog | undefined;
    const catalog = raw ? applyForcedHuntLevels(raw) : undefined;
    const hunt = catalog?.hunts.find((entry) => entry.id === this.duelHuntId);
    const rawHunt = raw?.hunts.find((entry) => entry.id === this.duelHuntId);
    if (!hunt?.targets.length) return;

    this.spawn(this.buildDuelDefinition(hunt, rawHunt, this.mapKey));
  }

  private buildDuelDefinition(
    hunt: HuntCatalog['hunts'][number],
    rawHunt: HuntCatalog['hunts'][number] | undefined,
    mapKey: MapKey,
  ): EnemyDefinition {
    const spawn =
      this.duelSide === 0 ? (this.duelRight ?? this.duelLeft) : (this.duelLeft ?? this.duelRight);
    const targetIndex = this.duelTargetIndex % hunt.targets.length;
    const instanceIndex = this.duelSpawnSeq;
    this.duelTargetIndex = (this.duelTargetIndex + 1) % hunt.targets.length;
    this.duelSide = this.duelSide === 0 ? 1 : 0;
    this.duelSpawnSeq += 1;

    const def = this.buildHuntEnemyDefinition(
      hunt,
      rawHunt,
      mapKey,
      targetIndex,
      spawn ?? EnemyManager.FALLBACK_SPAWNS[0],
      true,
      instanceIndex,
    );
    return def;
  }

  private spawn(definition: EnemyDefinition): Enemy {
    if (this.enemies.has(definition.id)) {
      throw new Error(`Monstro duplicado no mapa: ${definition.id}`);
    }
    const enemy = new Enemy(this.scene, definition, this.collisionLayer);
    this.enemies.set(definition.id, enemy);
    return enemy;
  }

  spawnLabDummy(definition: EnemyDefinition): Enemy {
    const existing = this.enemies.get(definition.id);
    if (existing) {
      existing.destroy();
      this.enemies.delete(definition.id);
    }
    return this.spawn(definition);
  }

  removeById(id: string): void {
    const enemy = this.enemies.get(id);
    if (!enemy) return;
    enemy.destroy();
    this.enemies.delete(id);
  }

  setHuntPaused(paused: boolean): void {
    this.huntPaused = paused;
    for (const enemy of this.enemies.values()) {
      if (enemy.id === LAB_DUMMY_ID) continue;
      enemy.sprite.setVisible(!paused);
      const body = enemy.sprite.body;
      if (body) body.enable = !paused;
    }
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
    const catalog = raw ? applyForcedHuntLevels(raw) : undefined;
    const hunt = catalog?.hunts.find((entry) => entry.id === huntId);
    const rawHunt = raw?.hunts.find((entry) => entry.id === huntId);
    if (!hunt) return [];

    const rendered = getWonsrRenderedMap(mapKey);
    const basePositions =
      rendered && rendered.enemySpawns.length ? rendered.enemySpawns : EnemyManager.FALLBACK_SPAWNS;

    // Duelo / fila lateral: entra pela direita; depois pela esquerda; em ciclo.
    if (hunt.sequentialTargets || (rendered != null && isLateralSideSpawnMap(rendered))) {
      const lateralQueue = rendered != null && isLateralSideSpawnMap(rendered);
      const floorY =
        rendered?.lateralFloorY ??
        rendered?.spawn.y ??
        basePositions[0]?.y ??
        EnemyManager.FALLBACK_SPAWNS[0].y;
      const width = rendered?.width ?? 1024;
      const sorted = [...basePositions].sort((a, b) => a.x - b.x);
      this.duelHuntId = huntId;
      this.duelTargetIndex = 0;
      this.duelSide = 0;
      this.duelMaxAlive = Math.max(
        1,
        hunt.maxAlive ?? (lateralQueue ? LATERAL_SIDE_MAX_ALIVE : 1),
      );
      this.duelEntryDelayMs = Math.max(
        0,
        hunt.entryDelayMs ?? (lateralQueue ? LATERAL_SIDE_ENEMY_RESPAWN_MS : 0),
      );
      this.duelSpawnSeq = 0;
      this.duelSpawnLoop = lateralQueue;
      this.duelRight = hunt.alternatingSides
        ? { x: width - 56, y: floorY }
        : { ...(sorted[sorted.length - 1] ?? EnemyManager.FALLBACK_SPAWNS[0]) };
      this.duelLeft = hunt.alternatingSides
        ? { x: 56, y: floorY }
        : { ...(sorted[0] ?? this.duelRight) };
      const first = this.buildDuelDefinition(hunt, rawHunt, mapKey);
      if (lateralQueue && this.duelEntryDelayMs > 0) {
        const timer = this.scene.time.addEvent({
          delay: this.duelEntryDelayMs,
          loop: true,
          callback: () => this.spawnDuelNext(),
        });
        this.duelTimers.push(timer);
      } else if (this.duelMaxAlive > 1 && this.duelEntryDelayMs > 0) {
        this.scheduleDuel(this.duelEntryDelayMs, () => this.spawnDuelNext());
      }
      return [first];
    }

    this.clearDuel();

    const perSpawn = rendered ? Math.max(1, rendered.enemiesPerSpawn ?? ENEMIES_PER_SPAWN) : 1;
    const positions = basePositions.flatMap((spawn) => this.expandSpawn(spawn, perSpawn));

    return positions.map((spawn, index) =>
      this.buildHuntEnemyDefinition(
        hunt,
        rawHunt,
        mapKey,
        pickHuntTargetIndex(hunt.targets, index),
        spawn,
        false,
        index,
      ),
    );
  }

  private buildHuntEnemyDefinition(
    hunt: HuntCatalog['hunts'][number],
    rawHunt: HuntCatalog['hunts'][number] | undefined,
    mapKey: MapKey,
    targetIndex: number,
    spawn: { x: number; y: number },
    noRespawn: boolean,
    instanceIndex = targetIndex,
  ): EnemyDefinition {
    const target = hunt.targets[targetIndex];
    const curated = this.resolveCurated(target.lookType);
    const spriteIndex = this.scene.cache.json.get(WONSR_SPRITE_INDEX_KEY) as
      WonsrSpriteIndex | undefined;
    const outfit = curated ?? this.resolveOutfit(spriteIndex, target.lookType);
    const stats = {
      level: target.level,
      hp: target.hp,
      xp: huntEnemyStatsForLevel(target.level).xp,
    };
    const animeId = resolveAnimeId({
      lookType: target.lookType,
      source: target.source,
      sourceId: target.sourceId,
    });
    const layout = combatLayoutScale(mapKey);
    const renderedMap = getWonsrRenderedMap(mapKey);
    const fit = outfit?.fit
      ? {
          ...outfit.fit,
          scale: outfit.fit.scale * layout,
          scaleX: (outfit.fit.scaleX ?? outfit.fit.scale) * layout,
        }
      : undefined;
    const skillPx = Math.max(
      0,
      ...(target.attacks ?? []).map((attack) => Math.max(44, (attack.range || 1) * 32)),
    );
    const baseChase = Math.max(80, Math.min(180, target.targetDistance * 45), skillPx + 48) * layout;
    const chaseRadius =
      renderedMap?.lateralFloorY != null && renderedMap.width > 0
        ? Math.max(baseChase, renderedMap.width)
        : baseChase;
    const enemySpeedMult = enemySpeedMultForMap(renderedMap);
    return {
      id: noRespawn
        ? `${hunt.id}-${target.id}-${instanceIndex}-d${Date.now() % 1_000_000}`
        : `${hunt.id}-${target.id}-${instanceIndex}`,
      name: target.name,
      hp: stats.hp,
      level: stats.level,
      xp: stats.xp,
      combatHpFromLevel: true,
      loot: buildAnimeHuntLoot(animeId, stats.level, {
        lookType: target.lookType,
      }),
      spawn,
      speed: target.speed * layout * enemySpeedMult,
      chaseRadius,
      respawnMs: enemyRespawnMsForMap(renderedMap),
      sprite: outfit?.textureKey ?? (target.hasSprite ? WONSR_HUNT_ATLAS_KEY : ENEMY_TEXTURE_KEY),
      spriteFrame: outfit?.idleFrame ?? (target.hasSprite ? `look-${target.lookType}` : undefined),
      walk: outfit?.walk,
      spriteFit: fit,
      mapKey,
      noRespawn,
      sealable: isHuntCatalogSealable(hunt)
        ? {
            characterId: target.sourceId,
            sourceId: target.sourceId,
            name: target.name,
            lookType: target.lookType,
            level: rawHunt?.targets[targetIndex]?.level ?? target.level,
            quality: rollSpawnQualityFromWeights(),
          }
        : undefined,
      skills: this.mapHuntAttacks(target.attacks),
    };
  }

  private mapHuntAttacks(attacks: HuntTargetAttack[] | undefined): EnemySkill[] | undefined {
    if (!attacks?.length) return undefined;
    return attacks.map((attack) => ({
      name: attack.name,
      intervalMs: attack.intervalMs,
      min: attack.min,
      max: attack.max,
      range: attack.range,
      element: attack.element,
      effectId: attack.effectId,
      missileId: attack.missileId,
    }));
  }

  private resolveCurated(lookType: number): {
    textureKey: string;
    idleFrame: number;
    walk: EnemyWalkAnimation;
    fit: WonsrSpriteFit;
  } | null {
    const pack = getCuratedMapPack(lookType);
    if (!pack) return null;
    return this.resolveFromPack(pack, lookType);
  }

  resolveFromPack(pack: CharacterPack, lookType: number, animKeyPrefix?: string): {
    textureKey: string;
    idleFrame: number;
    walk: EnemyWalkAnimation;
    fit: WonsrSpriteFit;
  } | null {
    // Packs parciais (ex.: sennin) usam walk como idle até existir folha própria.
    const idle = pack.idle ?? pack.walk;
    if (!this.scene.textures.exists(pack.walk.key) || !this.scene.textures.exists(idle.key)) {
      return null;
    }

    const prefix = animKeyPrefix ?? `curated-map-${lookType}`;
    const idleAnimKey = `${prefix}-idle`;
    const walkAnimKey = `${prefix}-walk`;
    const hurtAnimKey = `${prefix}-hurt`;
    const deathAnimKey = `${prefix}-death`;

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
      frameRate: idle.frameRate ?? 8,
      repeat: -1,
    });
    this.scene.anims.create({
      key: walkAnimKey,
      frames: this.scene.anims.generateFrameNumbers(pack.walk.key, {
        start: 0,
        end: pack.walk.frameCount - 1,
      }),
      frameRate: pack.walk.frameRate ?? 12,
      repeat: -1,
    });

    const attackSheets =
      pack.attackChain && pack.attackChain.length > 0
        ? [...pack.attackChain]
        : pack.attack
          ? [pack.attack]
          : [];
    const attackAnimKeys: string[] = [];
    const attackTextureKeys: string[] = [];
    for (let i = 0; i < attackSheets.length; i += 1) {
      const sheet = attackSheets[i];
      if (!this.scene.textures.exists(sheet.key)) continue;
      const attackAnimKey = `${prefix}-attack-${i}`;
      if (this.scene.anims.exists(attackAnimKey)) this.scene.anims.remove(attackAnimKey);
      this.scene.anims.create({
        key: attackAnimKey,
        frames: this.scene.anims.generateFrameNumbers(sheet.key, {
          start: 0,
          end: sheet.frameCount - 1,
        }),
        frameRate: sheet.frameRate ?? 12,
        repeat: 0,
      });
      attackAnimKeys.push(attackAnimKey);
      attackTextureKeys.push(sheet.key);
    }

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
    const scaleY =
      (contentH > 0 ? CHARACTER_DISPLAY_HEIGHT / contentH : 1) * (pack.displayScale ?? 1);
    const scaleX = scaleY * (pack.displayScaleX ?? 1);
    const origin = characterLateralOrigin(pack, idle);
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
        attackAnimKeys: attackAnimKeys.length > 0 ? attackAnimKeys : undefined,
        attackTextureKeys: attackTextureKeys.length > 0 ? attackTextureKeys : undefined,
      },
      fit: {
        scale: scaleY,
        scaleX,
        originX: origin.x,
        originY: origin.y,
      },
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
    if (tileX < 0 || tileY < 0 || tileX >= layer.layer.width || tileY >= layer.layer.height) {
      return false;
    }
    const tile = layer.getTileAt(tileX, tileY);
    return tile == null || tile.index === -1;
  }
}
