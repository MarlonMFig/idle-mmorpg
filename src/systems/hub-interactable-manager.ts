import * as Phaser from 'phaser';
import { sharpenWorldText } from '@/constants/nameplate';
import { getActiveHub, HUB_UI_SCALE } from '@/data/hub-backgrounds';
import { combatLayoutScale } from '@/data/wonsr-rendered-maps';
import {
  getHubInteractablesFor,
  type HubBuildingArea,
  type HubInteractableDef,
} from '@/data/hub-interactables';
import type { MapKey } from '@/maps/map-registry';
import { forgeStore } from '@/stores/forge-store';
import { guildStore } from '@/stores/guild-store';
import { huntStore } from '@/stores/hunt-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { medicStore } from '@/stores/medic-store';
import { shopStore } from '@/stores/shop-store';
import { teamStore } from '@/stores/team-store';

interface HubMarker {
  def: HubInteractableDef;
  objects: Phaser.GameObjects.GameObject[];
}

/** Gradiente radial reaproveitado pelos brilhos de fachada e de porta. */
const GLOW_TEXTURE = 'hub-building-glow';
/** Gradiente invertido: apaga as bordas do recorte do prédio. */
const FEATHER_TEXTURE = 'hub-building-feather';
/** Atrás do jogador (o passeio já rende depth ≈ 86 em `worldDepthForY`). */
const GLOW_DEPTH = 2;
/** Nome do prédio sempre por cima de personagens e efeitos. */
const LABEL_DEPTH = 240;
/** Quanto o nome sobe ao entrar (px de mundo). */
const LABEL_RISE = 56;
/** Folga entre o telhado e a base do nome (px de mundo). */
const LABEL_GAP = 42;
/** Luz baixa e pulsante na porta: mostra que o prédio é clicável. */
const IDLE_DOOR_ALPHA = 0;

/**
 * Prédios do hub como botões: a fachada acende e o nome sobe no hover.
 * Nos mapas de combate o marcador continua sendo o disco flutuante.
 */
export class HubInteractableManager {
  private readonly markers: HubMarker[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  load(mode: GameMode, mapKey: MapKey): void {
    this.clear();
    for (const def of getHubInteractablesFor(mode, mapKey)) {
      this.markers.push(
        def.building ? this.spawnBuilding(def, def.building) : this.spawnDisc(def),
      );
    }
  }

  clear(): void {
    for (const marker of this.markers) {
      for (const obj of marker.objects) {
        this.scene.tweens.killTweensOf(obj);
        obj.destroy();
      }
    }
    this.markers.length = 0;
  }

  private spawnBuilding(def: HubInteractableDef, area: HubBuildingArea): HubMarker {
    const texture = this.ensureGlowTexture();
    const height = area.bottom - area.top;
    const centerX = def.position.x;
    const centerY = area.top + height / 2;

    // Realce: recorte da própria arte com borda esfumada, somado por cima em
    // blend aditivo. Cada pixel clareia na proporção do original, então janelas
    // e lanternas brilham e o telhado não vira mancha leitosa.
    const lit = this.createLitCopy(centerX, centerY, area.width, height);
    const facade =
      lit ??
      this.scene.add
        .image(centerX, centerY, texture)
        .setDisplaySize(area.width * 1.16, height * 1.2)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(towardsWhite(def.color, 0.5))
        .setDepth(GLOW_DEPTH)
        .setAlpha(0);
    const facadeAlpha = lit ? 0.48 : 0.34;
    const baseScaleX = facade.scaleX;
    const baseScaleY = facade.scaleY;
    facade.setScale(baseScaleX * 0.97, baseScaleY * 0.97);

    const doorSize = Math.min(area.width * 0.85, 560);
    const doorway = this.scene.add
      .image(def.position.x, def.position.y, texture)
      .setDisplaySize(doorSize, doorSize * 0.8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffd9a0)
      .setDepth(GLOW_DEPTH + 1)
      .setAlpha(IDLE_DOOR_ALPHA);

    const labelY = area.top - LABEL_GAP;
    const text = sharpenWorldText(
      this.scene.add.text(centerX, labelY + LABEL_RISE, def.label, {
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
        fontSize: `${Math.round(23 * HUB_UI_SCALE)}px`,
        color: '#f7f1e4',
        stroke: '#080b12',
        strokeThickness: Math.round(2 * HUB_UI_SCALE),
      }),
    )
      .setOrigin(0.5, 1)
      .setDepth(LABEL_DEPTH + 1)
      .setAlpha(0);

    const pillW = text.width + 22 * HUB_UI_SCALE * 2;
    const pillH = text.height + 8 * HUB_UI_SCALE * 2;
    const pill = this.scene.add
      .graphics()
      .setPosition(centerX, labelY + LABEL_RISE + pillH * 0.22)
      .setDepth(LABEL_DEPTH)
      .setAlpha(0);
    pill.fillStyle(0x0a111c, 0.74);
    pill.fillRoundedRect(-pillW / 2, -pillH, pillW, pillH, pillH / 2);
    pill.lineStyle(Math.max(2, 1.4 * HUB_UI_SCALE), def.color, 0.85);
    pill.strokeRoundedRect(-pillW / 2, -pillH, pillW, pillH, pillH / 2);
    const pillRestY = pill.y;
    const pillHoverY = pillRestY - LABEL_RISE;

    const zone = this.scene.add
      .zone(centerX, centerY, area.width, height)
      .setInteractive({ useHandCursor: true });

    let doorPulse: Phaser.Tweens.Tween | null = null;
    const startDoorPulse = (): void => {
      if (IDLE_DOOR_ALPHA <= 0) return;
      doorPulse = this.scene.tweens.add({
        targets: doorway,
        alpha: { from: IDLE_DOOR_ALPHA, to: IDLE_DOOR_ALPHA * 2.2 },
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };
    startDoorPulse();

    const setHover = (on: boolean): void => {
      doorPulse?.remove();
      doorPulse = null;
      this.scene.tweens.killTweensOf([facade, doorway, text, pill]);

      this.scene.tweens.add({
        targets: text,
        alpha: on ? 1 : 0,
        y: on ? labelY : labelY + LABEL_RISE,
        duration: on ? 240 : 170,
        ease: on ? 'Back.easeOut' : 'Sine.easeIn',
      });
      this.scene.tweens.add({
        targets: pill,
        alpha: on ? 1 : 0,
        y: on ? pillHoverY : pillRestY,
        duration: on ? 240 : 170,
        ease: on ? 'Back.easeOut' : 'Sine.easeIn',
      });
      this.scene.tweens.add({
        targets: facade,
        alpha: on ? facadeAlpha : 0,
        scaleX: baseScaleX * (on ? 1 : 0.97),
        scaleY: baseScaleY * (on ? 1 : 0.97),
        duration: on ? 260 : 200,
        ease: 'Sine.easeOut',
      });
      this.scene.tweens.add({
        targets: doorway,
        alpha: on ? 0.55 : IDLE_DOOR_ALPHA,
        duration: on ? 260 : 200,
        ease: 'Sine.easeOut',
        onComplete: on ? undefined : startDoorPulse,
      });
    };

    zone.on('pointerover', () => setHover(true));
    zone.on('pointerout', () => setHover(false));
    zone.on('pointerdown', () => {
      setHover(true);
      facade.setAlpha(Math.min(0.85, facadeAlpha * 1.8));
      this.handleAction(def);
    });

    return { def, objects: [facade, doorway, pill, text, zone] };
  }

  /**
   * Recorta o prédio da arte do hub numa render texture e apaga as bordas com um
   * gradiente — o realce aditivo entra sem contorno reto em volta da fachada.
   */
  private createLitCopy(
    centerX: number,
    centerY: number,
    width: number,
    height: number,
  ): Phaser.GameObjects.RenderTexture | null {
    const artKey = getActiveHub().tilemapImageKey;
    if (!artKey || !this.scene.textures.exists(artKey)) return null;

    const w = Math.round((width * 1.14) / 2) * 2;
    const h = Math.round((height * 1.14) / 2) * 2;
    const left = Math.round(centerX - w / 2);
    const top = Math.round(centerY - h / 2);

    const lit = this.scene.add.renderTexture(centerX, centerY, w, h);
    lit.draw(artKey, -left, -top);

    const feather = this.scene.make
      .image({ key: this.ensureFeatherTexture() }, false)
      .setOrigin(0, 0)
      .setDisplaySize(w, h);
    lit.erase(feather);
    feather.destroy();

    lit.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return lit
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(GLOW_DEPTH)
      .setAlpha(0) as Phaser.GameObjects.RenderTexture;
  }

  private spawnDisc(def: HubInteractableDef): HubMarker {
    const { x, y } = def.position;
    const s = combatLayoutScale(def.mapKey);
    const root = this.scene.add.container(x, y);
    root.setDepth(8);

    const disc = this.scene.add.circle(0, 0, 18 * s, def.color, 0.92);
    disc.setStrokeStyle(Math.max(2, 2 * s), 0xffffff, 0.85);
    disc.setInteractive({ useHandCursor: true });

    const label = this.scene.add
      .text(0, -28 * s, def.label, {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(12 * s)}px`,
        color: '#f2efe6',
        stroke: '#000000',
        strokeThickness: Math.max(4, Math.round(4 * s)),
      })
      .setOrigin(0.5, 1);

    const glyph = this.scene.add
      .text(0, 0, glyphFor(def.action), {
        fontFamily: 'sans-serif',
        fontSize: `${Math.round(14 * s)}px`,
        color: '#0a1220',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    root.add([disc, label, glyph]);

    disc.on('pointerdown', () => this.handleAction(def));
    label.setInteractive({ useHandCursor: true });
    label.on('pointerdown', () => this.handleAction(def));

    this.scene.tweens.add({
      targets: root,
      y: y - 4 * s,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return { def, objects: [root] };
  }

  /** Halo suave (branco → transparente) tingido por prédio no uso. */
  private ensureGlowTexture(): string {
    return this.ensureGradient(GLOW_TEXTURE, [
      [0, 1],
      [0.4, 0.62],
      [0.72, 0.2],
      [1, 0],
    ]);
  }

  /** Inverso do halo: alpha só nas bordas, para `erase` esfumar o recorte. */
  private ensureFeatherTexture(): string {
    return this.ensureGradient(FEATHER_TEXTURE, [
      [0, 0],
      [0.58, 0],
      [0.82, 0.5],
      [1, 1],
    ]);
  }

  private ensureGradient(key: string, stops: readonly [number, number][]): string {
    if (this.scene.textures.exists(key)) return key;

    const size = 256;
    const canvas = this.scene.textures.createCanvas(key, size, size);
    const ctx = canvas?.getContext();
    if (!canvas || !ctx) return key;

    const r = size / 2;
    const gradient = ctx.createRadialGradient(r, r, 0, r, r, r);
    for (const [offset, alpha] of stops) {
      gradient.addColorStop(offset, `rgba(255,255,255,${alpha})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
    // pixelArt do jogo é nearest: no gradiente esticado isso viraria degrau.
    canvas.setFilter(Phaser.Textures.FilterMode.LINEAR);

    return key;
  }

  private handleAction(def: HubInteractableDef): void {
    switch (def.action) {
      case 'map':
        huntStore.open();
        break;
      case 'guild':
        guildStore.setOpen(true);
        break;
      case 'heal':
        medicStore.open();
        break;
      case 'shop':
        shopStore.setOpen(true);
        break;
      case 'forge':
        teamStore.setOpen(false);
        forgeStore.open();
        break;
      case 'return':
        locationStore.enterHub();
        break;
      default:
        break;
    }
  }
}

/** Clareia a cor do prédio para o halo não sair saturado no blend aditivo. */
function towardsWhite(color: number, amount: number): number {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const mix = (channel: number): number => Math.round(channel + (0xff - channel) * amount);
  return (mix(r) << 16) | (mix(g) << 8) | mix(b);
}

function glyphFor(action: HubInteractableDef['action']): string {
  switch (action) {
    case 'map':
      return 'M';
    case 'bag':
      return 'B';
    case 'heal':
      return '+';
    case 'shop':
      return '$';
    case 'forge':
      return 'F';
    case 'guild':
      return 'G';
    case 'return':
      return 'V';
    default:
      return '?';
  }
}
