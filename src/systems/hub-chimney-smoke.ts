import * as Phaser from 'phaser';
import { RENDER_LAYER } from '@/constants/render-layers';
import { HUB_FORGE_CHIMNEY } from '@/data/hub-interactables';

const TEX_KEY = 'hub-chimney-puff';

/**
 * Fumaça contínua da chaminé da forja. Textura suave + LINEAR —
 * combina com o hub pintado (sem nearest).
 */
export class HubChimneySmokeSystem {
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    ensurePuffTexture(scene);
    const { x, y } = HUB_FORGE_CHIMNEY;
    this.particles = scene.add.particles(x, y, TEX_KEY, {
      lifespan: { min: 2800, max: 5200 },
      frequency: 140,
      quantity: 1,
      speedX: { min: 14, max: 42 },
      speedY: { min: -52, max: -22 },
      gravityY: -6,
      scale: { start: 0.55, end: 2.4, ease: 'Quad.easeOut' },
      alpha: { start: 0.42, end: 0, ease: 'Sine.easeIn' },
      rotate: { min: -18, max: 22 },
      x: { min: -8, max: 8 },
      y: { min: -4, max: 6 },
      blendMode: Phaser.BlendModes.NORMAL,
    });
    this.particles.setDepth(RENDER_LAYER.world + 60);
    this.particles.setParticleTint(0xd8d4e4);
  }

  destroy(): void {
    this.particles?.destroy();
    this.particles = null;
  }
}

function ensurePuffTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX_KEY)) return;
  const size = 64;
  const canvas = scene.textures.createCanvas(TEX_KEY, size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();
  const cx = size / 2;
  const cy = size / 2;
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, size / 2 - 1);
  g.addColorStop(0, 'rgba(236, 232, 244, 0.85)');
  g.addColorStop(0.35, 'rgba(210, 206, 220, 0.45)');
  g.addColorStop(0.7, 'rgba(188, 184, 198, 0.14)');
  g.addColorStop(1, 'rgba(180, 176, 190, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
  canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);
}
