/** Subconjunto do JSON Tiled usado pelo Phaser. */
export interface TiledMapJson {
  compressionlevel: number;
  height: number;
  width: number;
  tilewidth: number;
  tileheight: number;
  infinite: boolean;
  orientation: string;
  renderorder: string;
  type: 'map';
  version: string;
  tiledversion: string;
  nextlayerid: number;
  nextobjectid: number;
  layers: TiledLayerJson[];
  tilesets: TiledTilesetJson[];
}

export interface TiledLayerJson {
  id: number;
  name: string;
  type: 'tilelayer';
  width: number;
  height: number;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  data: number[];
}

export interface TiledTilesetJson {
  firstgid: number;
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;
  image: string;
  imagewidth: number;
  imageheight: number;
  margin: number;
  spacing: number;
}
