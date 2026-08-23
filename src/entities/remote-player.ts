import * as Phaser from 'phaser';
import { NAMEPLATE_GAP_PX } from '@/constants/combat';
import { MULTIPLAYER_INTERPOLATION } from '@/constants/multiplayer';
import { addNameplate, REMOTE_NAMEPLATE_STYLE, worldDepthForY } from '@/constants/nameplate';
import { combatTextDepthForY } from '@/constants/render-layers';
import { directionFacesLeft, type PlayerDirection } from '@/constants/player';
import {
  characterDisplayScale,
  characterNameplateLift,
  getCharacterPack,
  getCuratedPackBySlug,
  loadCharacterPack,
  type CharacterPack,
} from '@/data/character-packs';
import { Player, playerIdleFrame, playerWalkAnimKey } from '@/entities/player';
import type { PlayerAnimState, PlayerNetState } from '@/types/net';
import type { StarterCharacterId } from '@/types/player-creation';

function resolveRemotePack(characterId: string): CharacterPack {
  const curated = getCuratedPackBySlug(characterId);
  if (curated) return curated;
  return getCharacterPack((characterId as StarterCharacterId) || 'naruto-classic');
}

function applyPackOrigin(sprite: Phaser.GameObjects.Sprite, pack: CharacterPack): void {
  if (pack.outfit) {
    const { content } = pack.outfit;
    sprite.setOrigin(
      (content.x + content.width / 2) / pack.walk.frameWidth,
      (content.y + content.height) / pack.walk.frameHeight,
    );
  } else {
    sprite.setOrigin(0.5, 1);
  }
}

/**
 * Jogador remoto — posicao/direcao/animacao sincronizados via rede.
 * Pack visual vem de `characterId` do snapshot.
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
  private characterId: string;
  private pack: CharacterPack;
  private ready = false;
  private readonly worldScale: number;

  constructor(scene: Phaser.Scene, state: PlayerNetState, worldScale = 1) {
    this.pack = resolveRemotePack(state.characterId || 'naruto-classic');
    this.characterId = state.characterId || 'naruto-classic';
    this.playerId = state.playerId;
    this.nickname = state.nickname;
    this.targetX = state.x;
    this.targetY = state.y;
    this.direction = state.direction;
    this.anim = state.anim;
    this.worldScale = worldScale;

    this.sprite = scene.add.sprite(state.x, state.y, this.pack.walk.key, 0);
    applyPackOrigin(this.sprite, this.pack);
    const scale = characterDisplayScale(this.pack);
    this.sprite.setScale(scale.x * this.worldScale, scale.y * this.worldScale);
    this.sprite.setTint(0xb8d4ff);
    this.sprite.setData('remotePlayerId', state.playerId);
    this.sprite.setVisible(false);

    this.nameLabel = addNameplate(
      scene,
      state.x,
      state.y - characterNameplateLift(this.pack) * this.worldScale - NAMEPLATE_GAP_PX,
      state.nickname,
      REMOTE_NAMEPLATE_STYLE,
    )
      .setScale(this.worldScale)
      .setVisible(false);

    void loadCharacterPack(scene, this.pack).then(() => {
      if (!this.sprite.active) return;
      Player.ensureAnimations(scene, this.pack);
      this.sprite.setTexture(this.pack.walk.key, 0);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      this.ready = true;
      this.sprite.setVisible(true);
      this.nameLabel.setVisible(true);
      this.applyAnimation();
      this.syncPresentation();
    });
  }

  applyNetworkState(state: PlayerNetState): void {
    const nextId = state.characterId || this.characterId;
    if (nextId !== this.characterId) {
      this.characterId = nextId;
      this.pack = resolveRemotePack(nextId);
      void loadCharacterPack(this.sprite.scene, this.pack).then(() => {
        if (!this.sprite.active) return;
        Player.ensureAnimations(this.sprite.scene, this.pack);
        applyPackOrigin(this.sprite, this.pack);
        const scale = characterDisplayScale(this.pack);
        this.sprite.setScale(scale.x * this.worldScale, scale.y * this.worldScale);
        this.sprite.setTexture(this.pack.walk.key, 0);
        this.applyAnimation();
      });
    }

    this.targetX = state.x;
    this.targetY = state.y;
    this.direction = state.direction;
    this.anim = state.anim;
    if (state.nickname !== this.nickname) {
      this.nickname = state.nickname;
      this.nameLabel.setText(state.nickname);
    }
    if (this.ready) this.applyAnimation();
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
      Math.round(this.sprite.x),
      Math.round(
        this.sprite.y -
          characterNameplateLift(this.pack) * this.worldScale -
          NAMEPLATE_GAP_PX * this.worldScale,
      ),
    );
    this.nameLabel.setDepth(combatTextDepthForY(this.sprite.y, 3));
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
    } else if (this.pack.outfit) {
      this.sprite.anims.stop();
      this.sprite.setTexture(this.pack.walk.key, playerIdleFrame(this.pack, this.direction));
    } else {
      const idleKey = `${this.pack.id}-idle`;
      if (this.sprite.anims.currentAnim?.key !== idleKey) {
        this.sprite.anims.play(idleKey, true);
      }
    }
  }
}
