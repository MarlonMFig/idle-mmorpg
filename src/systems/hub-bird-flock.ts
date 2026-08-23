import * as Phaser from 'phaser';
import { RENDER_LAYER } from '@/constants/render-layers';

const TEX_KEY = 'hub-bird-sheet';
const FRAME_W = 20;
const FRAME_H = 12;

interface BirdState {
  sprite: Phaser.GameObjects.Sprite;
  /** Direção horizontal: −1 esquerda, +1 direita. */
  dir: 1 | -1;
  speed: number;
  baseY: number;
  bobAmp: number;
  bobSpeed: number;
  phase: number;
  flapMs: number;
  flapAcc: number;
  scale: number;
}

/**
 * Pássaros voando no céu do hub (silhuetas procedurais).
 * Ficam na faixa do céu — à frente do PNG de fundo, atrás dos personagens.
 */
export class HubBirdFlockSystem {
  private readonly birds: BirdState[] = [];
  private alive = true;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly worldW: number,
    private readonly worldH: number,
  ) {
    ensureBirdTextures(scene);
    this.spawnFlock();
  }

  update(_time: number, delta: number): void {
    if (!this.alive) return;
    const dt = Math.min(delta, 48);
    for (const bird of this.birds) {
      bird.flapAcc += dt;
      if (bird.flapAcc >= bird.flapMs) {
        bird.flapAcc = 0;
        const frame = bird.sprite.frame.name === '0' ? 1 : 0;
        bird.sprite.setFrame(frame);
      }

      bird.phase += bird.bobSpeed * (dt / 1000);
      const x = bird.sprite.x + bird.dir * bird.speed * (dt / 1000);
      const y = bird.baseY + Math.sin(bird.phase) * bird.bobAmp;
      bird.sprite.setPosition(x, y);

      const margin = 80;
      if (bird.dir > 0 && x > this.worldW + margin) {
        this.recycle(bird, 'left');
      } else if (bird.dir < 0 && x < -margin) {
        this.recycle(bird, 'right');
      }
    }
  }

  destroy(): void {
    this.alive = false;
    for (const bird of this.birds) {
      bird.sprite.destroy();
    }
    this.birds.length = 0;
  }

  private spawnFlock(): void {
    // 3 bandos pequenos + alguns solo — suficiente pra vida no céu sem poluir.
    const groups = [
      { count: 4, y: this.worldH * 0.18, dir: 1 as const, speed: 55 },
      { count: 3, y: this.worldH * 0.28, dir: -1 as const, speed: 42 },
      { count: 3, y: this.worldH * 0.12, dir: 1 as const, speed: 70 },
      { count: 2, y: this.worldH * 0.35, dir: -1 as const, speed: 38 },
    ];

    for (const group of groups) {
      const startX =
        group.dir > 0
          ? -40 - Math.random() * 200
          : this.worldW + 40 + Math.random() * 200;
      for (let i = 0; i < group.count; i += 1) {
        this.birds.push(
          this.createBird({
            x: startX + i * (18 + Math.random() * 22) * (group.dir > 0 ? 1 : -1),
            y: group.y + (Math.random() - 0.5) * 50,
            dir: group.dir,
            speed: group.speed * (0.85 + Math.random() * 0.3),
          }),
        );
      }
    }
  }

  private createBird(opts: {
    x: number;
    y: number;
    dir: 1 | -1;
    speed: number;
  }): BirdState {
    const scale = 1.6 + Math.random() * 1.1;
    const sprite = this.scene.add
      .sprite(opts.x, opts.y, TEX_KEY, '0')
      .setOrigin(0.5, 0.5)
      .setScale(scale)
      .setFlipX(opts.dir < 0)
      .setDepth(RENDER_LAYER.world + 40)
      .setAlpha(0.72 + Math.random() * 0.2);
    sprite.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    return {
      sprite,
      dir: opts.dir,
      speed: opts.speed,
      baseY: opts.y,
      bobAmp: 6 + Math.random() * 10,
      bobSpeed: 1.2 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      flapMs: 110 + Math.random() * 80,
      flapAcc: Math.random() * 100,
      scale,
    };
  }

  private recycle(bird: BirdState, from: 'left' | 'right'): void {
    bird.dir = from === 'left' ? 1 : -1;
    bird.sprite.setFlipX(bird.dir < 0);
    bird.baseY = this.worldH * (0.1 + Math.random() * 0.28);
    bird.speed = 36 + Math.random() * 40;
    bird.bobAmp = 6 + Math.random() * 10;
    bird.phase = Math.random() * Math.PI * 2;
    const x =
      from === 'left' ? -60 - Math.random() * 120 : this.worldW + 60 + Math.random() * 120;
    bird.sprite.setPosition(x, bird.baseY);
  }
}

function ensureBirdTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX_KEY)) return;

  const g = scene.add.graphics();
  g.setVisible(false);
  // Frame 0 — asas abertas
  drawBirdSilhouette(g, 0, 0, 'up');
  // Frame 1 — asas fechando
  drawBirdSilhouette(g, FRAME_W, 0, 'down');
  g.generateTexture(TEX_KEY, FRAME_W * 2, FRAME_H);
  g.destroy();

  const tex = scene.textures.get(TEX_KEY);
  tex.add('0', 0, 0, 0, FRAME_W, FRAME_H);
  tex.add('1', 0, FRAME_W, 0, FRAME_W, FRAME_H);
}

function drawBirdSilhouette(
  g: Phaser.GameObjects.Graphics,
  ox: number,
  oy: number,
  pose: 'up' | 'down',
): void {
  // Tom escuro quente — legível no céu dourado sem “sticker” preto puro.
  g.fillStyle(0x2c241c, 0.92);
  const cx = ox + FRAME_W / 2;
  const cy = oy + FRAME_H / 2 + 1;

  if (pose === 'up') {
    // Asa esquerda / direita em V invertido + corpo
    g.fillTriangle(cx - 9, cy + 1, cx - 1, cy - 1, cx - 2, cy + 2);
    g.fillTriangle(cx + 9, cy + 1, cx + 1, cy - 1, cx + 2, cy + 2);
    g.fillCircle(cx, cy, 1.6);
  } else {
    g.fillTriangle(cx - 8, cy - 1, cx - 1, cy + 1, cx - 2, cy + 2);
    g.fillTriangle(cx + 8, cy - 1, cx + 1, cy + 1, cx + 2, cy + 2);
    g.fillCircle(cx, cy + 0.5, 1.5);
  }
}
