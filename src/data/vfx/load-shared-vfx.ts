import * as Phaser from 'phaser';
import type { CharacterPack } from '@/data/character-packs';
import { loadSpriteSheets } from '@/data/character-packs';
import { getVfxDefinition, sharedVfxTextureKey, sharedVfxToSheet } from './registry';
import { isSequenceVfx, vfxFrameUrls, type SharedVfxDefinition } from './types';

const PHASER_TEXTURE_FILTER_NEAREST = Phaser.Textures.FilterMode.NEAREST;
const MAX_SHEET_DIM = 4096;

const loadedStamp = new WeakMap<SharedVfxDefinition, string>();
const inflight = new Map<string, Promise<void>>();

function sequenceStamp(def: SharedVfxDefinition): string {
  return `${def.frameWidth}x${def.frameHeight}x${vfxFrameUrls(def).join('|')}`;
}

function sequenceLayout(count: number, frameWidth: number, frameHeight: number): {
  cols: number;
  rows: number;
  width: number;
  height: number;
} {
  const maxCols = Math.max(1, Math.floor(MAX_SHEET_DIM / Math.max(1, frameWidth)));
  const cols = Math.min(count, maxCols);
  const rows = Math.ceil(count / cols);
  const width = cols * frameWidth;
  const height = rows * frameHeight;
  if (width > MAX_SHEET_DIM || height > MAX_SHEET_DIM) {
    throw new Error(
      `Sequência grande demais para uma textura (${count} frames de ${frameWidth}×${frameHeight})`,
    );
  }
  return { cols, rows, width, height };
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar frame ${url}`));
    img.src = url;
  });
}


function destroyGameObjectsUsingTexture(scene: Phaser.Scene, key: string): void {
  if (!scene?.sys || !scene.children) return;
  const doomed: Phaser.GameObjects.GameObject[] = [];
  scene.children.each((child) => {
    const sprite = child as Phaser.GameObjects.Sprite & {
      texture?: { key?: string } | null;
      frame?: { source?: { glTexture?: unknown } | null } | null;
    };
    if (sprite?.texture?.key === key) doomed.push(child);
  });
  for (const child of doomed) {
    try {
      child.destroy();
    } catch {
      // teardown / HMR
    }
  }
}

function removeTextureAndAnims(scene: Phaser.Scene, key: string): void {
  if (!scene?.sys || scene.sys.isActive?.() === false || !scene.textures || !scene.anims) return;

  // Sprites primeiro: se a textura some com Sprite ainda na display list,
  // MultiPipeline.batchSprite lê frame.glTexture null e explode no Lab.
  destroyGameObjectsUsingTexture(scene, key);

  // Anims depois: Phaser.anims.remove lê frame.sourceSize; se a textura
  // já sumiu, sourceSize/glTexture ficam null e explode no Character Lab.
  const animsMap = (
    scene.anims as unknown as {
      anims?: Map<string, Phaser.Animations.Animation>;
    }
  ).anims;
  const toRemove: string[] = [];
  if (animsMap) {
    for (const anim of animsMap.values()) {
      if (!anim?.frames?.length) continue;
      const usesKey = anim.frames.some((frame) => frame != null && frame.textureKey === key);
      if (usesKey) toRemove.push(anim.key);
    }
  }
  for (const animKey of toRemove) {
    try {
      if (scene.anims.exists(animKey)) scene.anims.remove(animKey);
    } catch {
      // teardown / HMR
    }
  }

  if (!scene.textures.exists(key)) return;
  try {
    scene.textures.remove(key);
  } catch {
    // GL texture já liberada
  }
}

function sequenceReady(scene: Phaser.Scene, def: SharedVfxDefinition, key: string): boolean {
  if (!scene.textures.exists(key) || loadedStamp.get(def) !== sequenceStamp(def)) return false;
  const existing = scene.textures.get(key).get(0);
  return Boolean(existing && existing.width === def.frameWidth && existing.height === def.frameHeight);
}

export function invalidateSharedVfxTexture(scene: Phaser.Scene, vfxId: string): void {
  const key = sharedVfxTextureKey(vfxId);
  inflight.delete(key);
  removeTextureAndAnims(scene, key);
}

/**
 * Garante uma textura Phaser `shared-vfx-<id>` pronta para o renderer.
 * Sequência é costurada numa spritesheet; o Combat continua usando um único key.
 */
export function ensureSharedVfxTexture(scene: Phaser.Scene, def: SharedVfxDefinition): Promise<void> {
  const key = sharedVfxTextureKey(def.id);
  if (isSequenceVfx(def) && sequenceReady(scene, def, key)) return Promise.resolve();
  if (!isSequenceVfx(def) && scene.textures.exists(key)) return Promise.resolve();

  const running = inflight.get(key);
  if (running) return running;

  const work = buildSharedVfxTexture(scene, def, key);
  inflight.set(key, work);
  void work.finally(() => {
    if (inflight.get(key) === work) inflight.delete(key);
  });
  return work;
}

async function buildSharedVfxTexture(
  scene: Phaser.Scene,
  def: SharedVfxDefinition,
  key: string,
): Promise<void> {
  if (!isSequenceVfx(def)) {
    await loadSpriteSheets(scene, [sharedVfxToSheet(def)]);
    return;
  }

  const urls = vfxFrameUrls(def);
  if (urls.length < 1) {
    throw new Error(`VFX ${def.id} sem frames`);
  }
  if (sequenceReady(scene, def, key)) return;

  const bust = Date.now();
  const images = await Promise.all(
    urls.map((url) => loadHtmlImage(`${url}${url.includes('?') ? '&' : '?'}v=${bust}`)),
  );
  const first = images[0];
  const actualW = first.naturalWidth || first.width;
  const actualH = first.naturalHeight || first.height;
  let fw = def.frameWidth;
  let fh = def.frameHeight;
  if (actualW !== fw || actualH !== fh) {
    console.warn(
      `[VFX] ${def.id}: catálogo ${fw}×${fh}, frames ${actualW}×${actualH} — usando dimensões reais`,
    );
    fw = actualW;
    fh = actualH;
  }
  for (let i = 1; i < images.length; i += 1) {
    const img = images[i];
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w !== actualW || h !== actualH) {
      throw new Error(`VFX ${def.id}: frame ${i + 1} com tamanho ${w}×${h} (esperado ${actualW}×${actualH})`);
    }
  }
  const layout = sequenceLayout(urls.length, fw, fh);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível para costurar VFX');
  ctx.imageSmoothingEnabled = false;
  for (let i = 0; i < images.length; i += 1) {
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    ctx.drawImage(images[i], col * fw, row * fh);
  }

  removeTextureAndAnims(scene, key);
  scene.textures.addSpriteSheet(key, canvas, { frameWidth: fw, frameHeight: fh });
  scene.textures.get(key).setFilter(PHASER_TEXTURE_FILTER_NEAREST);
  loadedStamp.set(def, sequenceStamp(def));
}

export async function ensurePackSharedVfx(scene: Phaser.Scene, pack: CharacterPack): Promise<void> {
  const seen = new Set<string>();
  for (const anim of Object.values(pack.skillAnims)) {
    if (!anim.vfxId || seen.has(anim.vfxId)) continue;
    seen.add(anim.vfxId);
    const def = getVfxDefinition(anim.vfxId);
    if (!def || !isSequenceVfx(def)) continue;
    await ensureSharedVfxTexture(scene, def);
  }
}
