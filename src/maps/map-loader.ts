import * as Phaser from 'phaser';
import { MAP_FILES, type MapKey } from '@/maps/map-registry';
import { parseTmxXml } from '@/maps/parse-tmx';
import type { TiledMapJson } from '@/maps/tiled-types';

interface PendingMap {
  key: string;
  url: string;
}

export interface CreatedMap {
  map: Phaser.Tilemaps.Tilemap;
  layers: Phaser.Tilemaps.TilemapLayer[];
}

/**
 * Carrega mapas Tiled (.tmx) de forma reutilizável no Phaser.
 *
 * Uso típico:
 * ```ts
 * const maps = new MapLoader(this);
 * maps.queue('leafVillage').queue('forest');
 * maps.preload();          // em preload()
 * await maps.hydrate();    // em create() da PreloadScene
 * const { map, layers } = maps.createLayers('leafVillage'); // na GameScene
 * ```
 */
export class MapLoader {
  private readonly pending: PendingMap[] = [];
  private readonly parsed = new Map<string, TiledMapJson>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Enfileira um mapa do registry (`leafVillage`, `forest`, `academy`). */
  queue(mapKey: MapKey): this {
    return this.queueUrl(mapKey, MAP_FILES[mapKey]);
  }

  /** Enfileira um `.tmx` por URL. */
  queueUrl(key: string, url: string): this {
    this.pending.push({ key, url });
    return this;
  }

  /** Agenda download dos arquivos `.tmx` (chamar em `preload()`). */
  preload(): void {
    for (const entry of this.pending) {
      this.scene.load.text(this.textKey(entry.key), entry.url);
    }
  }

  /**
   * Parseia TMX → JSON Tiled, registra no cache e carrega imagens dos tilesets.
   * Chamar em `create()` da PreloadScene (após os textos estarem no cache).
   */
  hydrate(): Promise<void> {
    for (const entry of this.pending) {
      this.registerMap(entry.key, entry.url);
    }

    const imagesToLoad = this.collectMissingImages();
    if (imagesToLoad.length === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: { key?: string }) => {
        reject(new Error(`Falha ao carregar tileset: ${file?.key ?? 'desconhecido'}`));
      });

      for (const image of imagesToLoad) {
        this.scene.load.image(image.key, image.url);
      }

      this.scene.load.start();
    });
  }

  /** Indica se o mapa já está no cache de tilemaps do Phaser. */
  has(mapKey: string): boolean {
    return this.scene.cache.tilemap.exists(mapKey);
  }

  /** Cria o `Tilemap` Phaser a partir de um TMX já hidratado. */
  create(mapKey: MapKey | string): Phaser.Tilemaps.Tilemap {
    if (!this.scene.cache.tilemap.exists(mapKey)) {
      throw new Error(`Mapa não carregado: ${mapKey}`);
    }

    const map = this.scene.make.tilemap({ key: mapKey });
    for (const tileset of map.tilesets) {
      map.addTilesetImage(tileset.name, tileset.name);
    }
    return map;
  }

  /** Cria o tilemap e todas as tile layers. */
  createLayers(mapKey: MapKey | string): CreatedMap {
    const map = this.create(mapKey);
    const tilesetNames = map.tilesets.map((tileset) => tileset.name);
    const layers: Phaser.Tilemaps.TilemapLayer[] = [];

    for (const name of map.getTileLayerNames()) {
      const layer = map.createLayer(name, tilesetNames, 0, 0);
      if (layer) layers.push(layer);
    }

    return { map, layers };
  }

  private textKey(mapKey: string): string {
    return `tmx:${mapKey}`;
  }

  private registerMap(key: string, url: string): void {
    const cacheKey = this.textKey(key);
    if (!this.scene.cache.text.exists(cacheKey)) {
      throw new Error(`TMX não encontrado no cache: ${url}`);
    }

    const xml = this.scene.cache.text.get(cacheKey) as string;
    const json = parseTmxXml(xml, url);
    this.parsed.set(key, json);

    this.scene.cache.tilemap.add(key, {
      format: Phaser.Tilemaps.Formats.TILED_JSON,
      data: json,
    });
  }

  private collectMissingImages(): { key: string; url: string }[] {
    const images: { key: string; url: string }[] = [];
    const seen = new Set<string>();

    for (const json of this.parsed.values()) {
      for (const tileset of json.tilesets) {
        if (seen.has(tileset.name) || this.scene.textures.exists(tileset.name)) continue;
        seen.add(tileset.name);
        images.push({ key: tileset.name, url: tileset.image });
      }
    }

    return images;
  }
}
