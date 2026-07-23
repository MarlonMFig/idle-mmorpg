import * as Phaser from 'phaser';
import { MULTIPLAYER_INTERPOLATION } from '@/constants/multiplayer';
import { directionFacesLeft, type PlayerDirection } from '@/constants/player';
import { getCharacterPack } from '@/data/character-packs';
import { Player } from '@/entities/player';
import { getPlayerSession } from '@/game/registry';
import type { PlayerAnimState, PlayerNetState } from '@/types/net';

/**
 * Jogador remoto — posicao/direcao/animacao sincronizados via rede.
 * Usa o mesmo pack visual da sessão local (stub).
 */
export class RemotePlayer {
  readonly playerId: string;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly nameLabel: Phaser.GameObjects.Text;

  private targetX: number;
  private targetY: number;
  private direction: PlayerDirection;
  private anim: PlayerAnimState;
  private nickname: string;

  constructor(scene: Phaser.Scene, state: PlayerNetState) {
    const session = getPlayerSession(scene.registry);
    const pack = getCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
    Player.ensureAnimations(scene, pack);

    this.playerId = state.playerId;
    this.nickname = state.nickname;
    this.targetX = state.x;
    this.targetY = state.y;
    this.direction = state.direction;
    this.anim = state.anim;

    this.sprite = scene.add.sprite(state.x, state.y, pack.walk.key, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(pack.displayHeight / pack.walk.frameHeight);
    this.sprite.setDepth(9);
    this.sprite.setTint(0xb8d4ff);
    this.sprite.setData('remotePlayerId', state.playerId);

    this.nameLabel = scene.add
      .text(state.x, state.y - pack.displayHeight - 8, state.nickname, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#9ec8ff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(11);

    this.applyAnimation();
  }

  applyNetworkState(state: PlayerNetState): void {
    this.targetX = state.x;
    this.targetY = state.y;
    this.direction = state.direction;
    this.anim = state.anim;
    if (state.nickname !== this.nickname) {
      this.nickname = state.nickname;
      this.nameLabel.setText(state.nickname);
    }
    this.applyAnimation();
  }

  update(): void {
    const t = MULTIPLAYER_INTERPOLATION;
    this.sprite.x += (this.targetX - this.sprite.x) * t;
    this.sprite.y += (this.targetY - this.sprite.y) * t;
    this.nameLabel.setPosition(this.sprite.x, this.sprite.y - this.sprite.displayHeight - 8);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameLabel.destroy();
  }

  private applyAnimation(): void {
    this.sprite.setFlipX(directionFacesLeft(this.direction));
    const animKey = this.anim === 'walk' ? 'player-walk' : 'player-idle';
    if (this.sprite.anims.currentAnim?.key !== animKey) {
      this.sprite.anims.play(animKey, true);
    }
  }
}
