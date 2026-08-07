import * as Phaser from 'phaser';
import { NAMEPLATE_GAP_PX } from '@/constants/combat';
import { MULTIPLAYER_INTERPOLATION } from '@/constants/multiplayer';
import { REMOTE_NAMEPLATE_STYLE, worldDepthForY } from '@/constants/nameplate';
import { directionFacesLeft, type PlayerDirection } from '@/constants/player';
import { CHARACTER_DISPLAY_HEIGHT } from '@/constants/sprites';
import {
  characterBaseScale,
  getCharacterPack,
  type CharacterPack,
} from '@/data/character-packs';
import { Player, playerIdleFrame, playerWalkAnimKey } from '@/entities/player';
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
  private readonly pack: CharacterPack;

  constructor(scene: Phaser.Scene, state: PlayerNetState) {
    const session = getPlayerSession(scene.registry);
    const pack = getCharacterPack(session?.starterCharacterId ?? 'naruto-classic');
    this.pack = pack;
    Player.ensureAnimations(scene, pack);

    this.playerId = state.playerId;
    this.nickname = state.nickname;
    this.targetX = state.x;
    this.targetY = state.y;
    this.direction = state.direction;
    this.anim = state.anim;

    this.sprite = scene.add.sprite(state.x, state.y, pack.walk.key, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setScale(characterBaseScale(pack));
    this.sprite.setTint(0xb8d4ff);
    this.sprite.setData('remotePlayerId', state.playerId);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    this.nameLabel = scene.add
      .text(state.x, state.y - CHARACTER_DISPLAY_HEIGHT - NAMEPLATE_GAP_PX, state.nickname, REMOTE_NAMEPLATE_STYLE)
      .setOrigin(0.5, 1);

    this.applyAnimation();
    this.syncPresentation();
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
    this.syncPresentation();
  }

  private syncPresentation(): void {
    const depth = worldDepthForY(this.sprite.y, 10);
    this.sprite.setDepth(depth);
    this.nameLabel.setPosition(
      this.sprite.x,
      this.sprite.y - CHARACTER_DISPLAY_HEIGHT - NAMEPLATE_GAP_PX,
    );
    this.nameLabel.setDepth(depth + 3);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameLabel.destroy();
  }

  private applyAnimation(): void {
    this.sprite.setFlipX(this.pack.outfit ? false : directionFacesLeft(this.direction));
    if (this.anim === 'walk') {
      const animKey = playerWalkAnimKey(this.pack, this.direction);
      if (this.sprite.anims.currentAnim?.key !== animKey) {
        this.sprite.anims.play(animKey, true);
      }
    } else {
      this.sprite.anims.stop();
      this.sprite.setTexture(this.pack.walk.key, playerIdleFrame(this.pack, this.direction));
    }
  }
}
