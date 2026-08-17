import * as Phaser from 'phaser';
import { IDLE_AGGRO_RANGE, PLAYER_ATTACK_RANGE } from '@/constants/combat';
import type { Player } from '@/entities/player';
import { dialogueStore } from '@/stores/dialogue-store';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findUnclaimedEnemy } from '@/systems/find-nearest-enemy';
import { LEADER_CLAIM_ID, type TargetClaims } from '@/systems/target-claims';

const PATH_RECALCULATE_MS = 600;
const WAYPOINT_REACHED_PX = 6;

export interface IdleAiOptions {
  /** Reserva de alvos da equipe; sem isto a IA usa sempre o mais próximo. */
  claims?: TargetClaims | null;
  /** Identidade deste caçador na reserva de alvos. */
  claimantId?: string;
}

/**
 * IA idle: procura inimigos e navega pela grade de colisão até o alcance.
 * Sem controle manual do personagem.
 */
export class IdleAiSystem {
  private path: { x: number; y: number }[] = [];
  private pathIndex = 0;
  private targetId: string | null = null;
  private nextPathAt = 0;

  private readonly claims: TargetClaims | null;
  private readonly claimantId: string;

  constructor(
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
    private readonly collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null,
    options: IdleAiOptions = {},
  ) {
    this.claims = options.claims ?? null;
    this.claimantId = options.claimantId ?? LEADER_CLAIM_ID;
  }

  update(): void {
    if (dialogueStore.isOpen()) {
      this.player.stop();
      return;
    }

    if (this.player.isBusy() || this.player.isDead()) {
      // Morto não segura reserva: o alvo volta a valer para o resto da equipe.
      if (this.player.isDead()) this.claims?.release(this.claimantId);
      this.player.sprite.setVelocity(0, 0);
      return;
    }

    const target = findUnclaimedEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      IDLE_AGGRO_RANGE,
      this.claims,
      this.claimantId,
    );

    if (!target) {
      this.claims?.release(this.claimantId);
      this.clearPath();
      this.player.stop();
      return;
    }
    this.claims?.claim(this.claimantId, target.id);

    const scale = this.player.worldScale;
    const attackDistance = PLAYER_ATTACK_RANGE * 0.9 * scale;
    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      target.sprite.x,
      target.sprite.y,
    );
    if (distance <= attackDistance) {
      this.clearPath();
      this.player.moveToward(target.sprite.x, target.sprite.y, attackDistance);
      return;
    }

    // Mapas antigos sem layer dedicado mantêm o movimento em linha reta.
    if (!this.collisionLayer) {
      this.player.moveToward(target.sprite.x, target.sprite.y, attackDistance);
      return;
    }

    const now = this.player.sprite.scene.time.now;
    if (
      target.id !== this.targetId ||
      now >= this.nextPathAt ||
      this.pathIndex >= this.path.length
    ) {
      this.targetId = target.id;
      this.nextPathAt = now + PATH_RECALCULATE_MS;
      this.path = this.findPath(this.player.x, this.player.y, target.sprite.x, target.sprite.y);
      this.pathIndex = 0;
    }

    while (this.pathIndex < this.path.length) {
      const waypoint = this.path[this.pathIndex];
      if (
        Phaser.Math.Distance.Between(this.player.x, this.player.y, waypoint.x, waypoint.y) >
        WAYPOINT_REACHED_PX * this.player.worldScale
      ) {
        this.player.moveToward(
          waypoint.x,
          waypoint.y,
          WAYPOINT_REACHED_PX * this.player.worldScale,
        );
        return;
      }
      this.pathIndex++;
    }

    // Sem rota válida: não force o corpo continuamente contra uma parede.
    this.player.stop();
  }

  private clearPath(): void {
    this.path = [];
    this.pathIndex = 0;
    this.targetId = null;
  }

  /**
   * Busca em largura na grade 4-direções. Como cada passo custa o mesmo, ela
   * encontra a rota mais curta sem cortar quinas através de árvores/paredes.
   */
  private findPath(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): { x: number; y: number }[] {
    const layer = this.collisionLayer;
    if (!layer) return [];

    const width = layer.layer.width;
    const height = layer.layer.height;
    const startX = Phaser.Math.Clamp(layer.worldToTileX(fromX, true), 0, width - 1);
    const startY = Phaser.Math.Clamp(layer.worldToTileY(fromY, true), 0, height - 1);
    let goalX = Phaser.Math.Clamp(layer.worldToTileX(toX, true), 0, width - 1);
    let goalY = Phaser.Math.Clamp(layer.worldToTileY(toY, true), 0, height - 1);
    // Copas de árvore podem cobrir o tile do inimigo; mira o tile livre mais próximo.
    if (this.isBlocked(goalX, goalY)) {
      const nearest = this.findNearestWalkable(goalX, goalY);
      if (!nearest) return [];
      goalX = nearest.x;
      goalY = nearest.y;
    }
    const start = startY * width + startX;
    const goal = goalY * width + goalX;
    if (start === goal) return [];

    const parents = new Int32Array(width * height);
    parents.fill(-1);
    const queue = new Int32Array(width * height);
    let read = 0;
    let write = 0;
    queue[write++] = start;
    parents[start] = start;

    const offsets = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const;

    while (read < write && parents[goal] === -1) {
      const current = queue[read++];
      const x = current % width;
      const y = Math.floor(current / width);

      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        // Permite sair de um tile bloqueado (caso o corpo tenha entrado na vegetação).
        if (parents[next] !== -1) continue;
        if (this.isBlocked(nx, ny) && next !== goal) continue;
        parents[next] = current;
        queue[write++] = next;
      }
    }

    if (parents[goal] === -1) return [];

    const tiles: number[] = [];
    for (let cursor = goal; cursor !== start; cursor = parents[cursor]) {
      tiles.push(cursor);
    }
    tiles.reverse();

    // Não precisa visitar todos os centros em trechos retos; mantém apenas
    // mudanças de direção e o destino para um movimento mais natural.
    const waypoints: { x: number; y: number }[] = [];
    let previousDx = 0;
    let previousDy = 0;
    for (let index = 0; index < tiles.length; index++) {
      const tile = tiles[index];
      const x = tile % width;
      const y = Math.floor(tile / width);
      const previous = index === 0 ? start : tiles[index - 1];
      const dx = x - (previous % width);
      const dy = y - Math.floor(previous / width);
      const next = tiles[index + 1];
      const changesDirection =
        next == null ||
        (next % width) - x !== dx ||
        Math.floor(next / width) - y !== dy ||
        dx !== previousDx ||
        dy !== previousDy;

      if (changesDirection) {
        waypoints.push({
          x: layer.tileToWorldX(x) + layer.layer.tileWidth / 2,
          y: layer.tileToWorldY(y) + layer.layer.tileHeight / 2,
        });
      }
      previousDx = dx;
      previousDy = dy;
    }
    return waypoints;
  }

  private isBlocked(tileX: number, tileY: number): boolean {
    const tile = this.collisionLayer?.getTileAt(tileX, tileY);
    return tile != null && tile.index !== -1;
  }

  private findNearestWalkable(tileX: number, tileY: number): { x: number; y: number } | null {
    const layer = this.collisionLayer;
    if (!layer) return null;
    const width = layer.layer.width;
    const height = layer.layer.height;
    for (let radius = 0; radius <= 6; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const x = tileX + dx;
          const y = tileY + dy;
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          if (!this.isBlocked(x, y)) return { x, y };
        }
      }
    }
    return null;
  }
}
