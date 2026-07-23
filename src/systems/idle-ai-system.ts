import { IDLE_AGGRO_RANGE, PLAYER_ATTACK_RANGE } from '@/constants/combat';
import type { Player } from '@/entities/player';
import { dialogueStore } from '@/stores/dialogue-store';
import type { EnemyManager } from '@/systems/enemy-manager';
import { findNearestAliveEnemy } from '@/systems/find-nearest-enemy';

/**
 * IA idle: procura inimigos e caminha até o alcance de ataque.
 * Sem controle manual do personagem.
 */
export class IdleAiSystem {
  constructor(
    private readonly player: Player,
    private readonly enemyManager: EnemyManager,
  ) {}

  update(): void {
    if (dialogueStore.isOpen()) {
      this.player.stop();
      return;
    }

    if (this.player.isBusy()) {
      this.player.sprite.setVelocity(0, 0);
      return;
    }

    const target = findNearestAliveEnemy(
      this.enemyManager,
      this.player.x,
      this.player.y,
      IDLE_AGGRO_RANGE,
    );

    if (!target) {
      this.player.stop();
      return;
    }

    this.player.moveToward(target.sprite.x, target.sprite.y, PLAYER_ATTACK_RANGE * 0.9);
  }
}
