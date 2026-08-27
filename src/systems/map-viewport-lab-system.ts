import * as Phaser from 'phaser';
import { diagnosePixelDensity } from '@/lib/dev/map-viewport-catalog';
import type { Player } from '@/entities/player';
import { locationStore } from '@/stores/location-store';
import {
  mapViewportLabStore,
  type MapViewportDiagnostics,
} from '@/stores/map-viewport-lab-store';

export interface MapViewportLabHost {
  scene: Phaser.Scene;
  getPlayer: () => Player | null;
  getWorldSize: () => { w: number; h: number };
  getMapKey: () => string;
  getCameraLayout: () => string;
  getMapBackground: () => Phaser.GameObjects.Image | null;
  applyCameraLayout: () => void;
}

/**
 * Overlays + hot-apply de zoom/layoutScale do Map Viewport Lab sobre a GameScene real.
 */
export class MapViewportLabSystem {
  private gfx: Phaser.GameObjects.Graphics | null = null;
  private groundLine: Phaser.GameObjects.Graphics | null = null;
  private dragging = false;
  private dragLast: { x: number; y: number } | null = null;
  private lastLayoutScale = -1;
  private lastFilter: string | null = null;
  private unsub: (() => void) | null = null;
  private wheelHandler: ((pointer: Phaser.Input.Pointer, _g: unknown, _x: number, _y: number, deltaY: number) => void) | null =
    null;

  constructor(private readonly host: MapViewportLabHost) {
    this.unsub = mapViewportLabStore.subscribe(() => this.onStoreChange());
    this.bindPointer();
  }

  destroy(): void {
    this.unsub?.();
    this.unsub = null;
    this.unbindPointer();
    this.gfx?.destroy();
    this.gfx = null;
    this.groundLine?.destroy();
    this.groundLine = null;
  }

  /** Chamado a cada frame pela GameScene quando o lab está ativo. */
  update(): void {
    const ov = mapViewportLabStore.getLiveOverrides();
    if (!ov) {
      this.clearOverlays();
      return;
    }
    const loc = locationStore.getSnapshot();
    const matchesHub = ov.catalogId === 'hub' && loc.mode === 'hub';
    const matchesMap = String(this.host.getMapKey()) === String(ov.mapKey);
    if (!matchesHub && !matchesMap) {
      // Ainda viajando para o mapa selecionado.
      this.publishDiagnostics(ov.cameraZoom);
      return;
    }

    this.applyLayoutScale(ov.layoutScale, ov.showCharacter);
    this.applyFilter(ov.filterMode);
    this.applyCamera(ov);
    this.drawOverlays(ov);
    this.publishDiagnostics(ov.cameraZoom);
  }

  private onStoreChange(): void {
    // Aplica no próximo update; força refresh de câmera se sim resolution mudou.
    if (mapViewportLabStore.getLiveOverrides()) {
      this.host.applyCameraLayout();
    }
  }

  private applyLayoutScale(scale: number, showCharacter: boolean): void {
    const player = this.host.getPlayer();
    if (!player) return;
    if (Math.abs(scale - this.lastLayoutScale) > 0.0001) {
      player.setWorldScale(scale);
      this.lastLayoutScale = scale;
    }
    player.sprite.setVisible(showCharacter);
  }

  private applyFilter(mode: string): void {
    const bg = this.host.getMapBackground();
    if (!bg) return;
    if (mode === this.lastFilter) return;
    this.lastFilter = mode;
    if (mode === 'nearest') {
      bg.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else if (mode === 'linear') {
      bg.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    // official: não reverte automaticamente (precisaria do default); resetTest viaja de novo.
  }

  private applyCamera(ov: NonNullable<ReturnType<typeof mapViewportLabStore.getLiveOverrides>>): void {
    const cam = this.host.scene.cameras.main;
    const { w: worldW, h: worldH } = this.host.getWorldSize();
    const fullW = this.host.scene.scale.width;
    const fullH = this.host.scene.scale.height;

    let viewW = fullW;
    let viewH = fullH;
    let viewX = 0;
    let viewY = 0;
    if (ov.simWidth && ov.simHeight) {
      viewW = Math.min(ov.simWidth, fullW);
      viewH = Math.min(ov.simHeight, fullH);
      viewX = Math.floor((fullW - viewW) / 2);
      viewY = Math.floor((fullH - viewH) / 2);
    }
    cam.setViewport(viewX, viewY, viewW, viewH);

    if (ov.roundPixelsOverride != null) {
      cam.setRoundPixels(ov.roundPixelsOverride);
    }

    if (ov.pendingFit) {
      mapViewportLabStore.fitEntireMap(viewW, viewH, worldW, worldH);
    }
    const live = mapViewportLabStore.getLiveOverrides() ?? ov;

    cam.setZoom(live.cameraZoom);

    // Lab de mapas: sempre solta o follow do avatar para poder enquadrar o mundo.
    cam.stopFollow();
    if (live.panMode) {
      cam.centerOn(live.camX, live.camY);
    }

    cam.setBounds(0, 0, worldW, worldH);
  }

  private ensureGfx(): Phaser.GameObjects.Graphics {
    if (!this.gfx) {
      this.gfx = this.host.scene.add.graphics().setDepth(10_000);
    }
    return this.gfx;
  }

  private drawOverlays(
    ov: NonNullable<ReturnType<typeof mapViewportLabStore.getLiveOverrides>>,
  ): void {
    const g = this.ensureGfx();
    g.clear();
    const { w: worldW, h: worldH } = this.host.getWorldSize();
    const cam = this.host.scene.cameras.main;

    if (ov.showGrid) {
      g.lineStyle(1, 0x44ff88, 0.25);
      const step = 128;
      for (let x = 0; x <= worldW; x += step) {
        g.lineBetween(x, 0, x, worldH);
      }
      for (let y = 0; y <= worldH; y += step) {
        g.lineBetween(0, y, worldW, y);
      }
    }

    if (ov.showWorldBounds) {
      g.lineStyle(2, 0xff6644, 0.9);
      g.strokeRect(1, 1, worldW - 2, worldH - 2);
    }

    if (ov.showCameraBounds) {
      g.lineStyle(2, 0x66aaff, 0.9);
      const b = cam.getBounds();
      g.strokeRect(b.x, b.y, b.width, b.height);
    }

    if (ov.showViewportBounds) {
      g.lineStyle(2, 0xffee55, 0.95);
      const wl = cam.worldView;
      g.strokeRect(wl.x + 2, wl.y + 2, wl.width - 4, wl.height - 4);
    }

    if (ov.showGroundGuide) {
      const floorY = ov.lateralFloorY;
      const player = this.host.getPlayer();
      if (floorY != null) {
        const { w } = this.host.getWorldSize();
        g.lineStyle(2, 0x7cffb2, 0.9);
        g.lineBetween(0, floorY, w, floorY);
      }
      if (player) {
        g.lineStyle(1, 0xff2222, 0.85);
        g.lineBetween(player.sprite.x - 40, player.sprite.y, player.sprite.x + 40, player.sprite.y);
        g.lineBetween(player.sprite.x, player.sprite.y - 8, player.sprite.x, player.sprite.y + 8);
      }
    }
  }

  private clearOverlays(): void {
    this.gfx?.clear();
  }

  private publishDiagnostics(draftZoom: number): void {
    const cam = this.host.scene.cameras.main;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    // Asset 1:1 world: source px per screen px ≈ 1 / zoom (sem DPR no canvas Phaser).
    const sourcePxPerScreenPx = draftZoom > 0 ? 1 / draftZoom : 1;
    const dens = diagnosePixelDensity(sourcePxPerScreenPx);
    const bg = this.host.getMapBackground();
    let mapFilter: MapViewportDiagnostics['mapFilter'] = 'unknown';
    if (bg) {
      // Phaser não expõe getter estável; reportamos pelo override do lab.
      const ov = mapViewportLabStore.getLiveOverrides();
      if (ov?.filterMode === 'nearest') mapFilter = 'nearest';
      else if (ov?.filterMode === 'linear') mapFilter = 'linear';
      else mapFilter = 'linear';
    }

    const pointer = this.host.scene.input.activePointer;
    const diagnostics: MapViewportDiagnostics = {
      canvasW: this.host.scene.scale.width,
      canvasH: this.host.scene.scale.height,
      viewportW: cam.width,
      viewportH: cam.height,
      cameraX: cam.scrollX + cam.width / 2 / cam.zoom,
      cameraY: cam.scrollY + cam.height / 2 / cam.zoom,
      cameraZoom: cam.zoom,
      roundPixels: cam.roundPixels,
      dpr,
      sourcePxPerScreenPx,
      quality: dens.band,
      upscale: dens.upscale,
      downscale: dens.downscale,
      fitMode: this.host.getCameraLayout(),
      mapFilter,
      characterWorldScale: this.host.getPlayer()?.worldScale ?? 1,
      screenX: pointer ? Math.round(pointer.x) : null,
      screenY: pointer ? Math.round(pointer.y) : null,
      worldX: pointer ? Math.round(pointer.worldX) : null,
      worldY: pointer ? Math.round(pointer.worldY) : null,
    };
    mapViewportLabStore.setDiagnostics(diagnostics);

    const ov = mapViewportLabStore.getLiveOverrides();
    if (ov && mapViewportLabStore.getSnapshot().officialCameraZoom == null) {
      mapViewportLabStore.syncComputedZoomBaseline(cam.zoom);
    }
  }

  private bindPointer(): void {
    const input = this.host.scene.input;
    input.on('pointerdown', this.onPointerDown, this);
    input.on('pointermove', this.onPointerMove, this);
    input.on('pointerup', this.onPointerUp, this);
    this.wheelHandler = (_p, _g, _x, _y, deltaY) => {
      const ov = mapViewportLabStore.getLiveOverrides();
      if (!ov) return;
      const step = deltaY > 0 ? -0.05 : 0.05;
      mapViewportLabStore.nudgeCameraZoom(step);
    };
    input.on('wheel', this.wheelHandler);
  }

  private unbindPointer(): void {
    const input = this.host.scene.input;
    input.off('pointerdown', this.onPointerDown, this);
    input.off('pointermove', this.onPointerMove, this);
    input.off('pointerup', this.onPointerUp, this);
    if (this.wheelHandler) input.off('wheel', this.wheelHandler);
    this.wheelHandler = null;
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    const ov = mapViewportLabStore.getLiveOverrides();
    if (!ov || !pointer.rightButtonDown() && !pointer.middleButtonDown() && !pointer.leftButtonDown()) {
      return;
    }
    // Pan com botão do meio ou shift+esquerdo para não conflitar com hub click.
    if (!(pointer.middleButtonDown() || (pointer.leftButtonDown() && pointer.event.shiftKey))) {
      return;
    }
    this.dragging = true;
    this.dragLast = { x: pointer.x, y: pointer.y };
    mapViewportLabStore.setPanMode(true);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || !this.dragLast) return;
    const cam = this.host.scene.cameras.main;
    const dx = (pointer.x - this.dragLast.x) / cam.zoom;
    const dy = (pointer.y - this.dragLast.y) / cam.zoom;
    this.dragLast = { x: pointer.x, y: pointer.y };
    const s = mapViewportLabStore.getSnapshot();
    mapViewportLabStore.setCameraPos(s.camX - dx, s.camY - dy);
  }

  private onPointerUp(): void {
    this.dragging = false;
    this.dragLast = null;
  }
}
