import * as Phaser from 'phaser';
import {
  ENEMY_ATTACK_COOLDOWN_MS,
  ENEMY_ATTACK_RANGE,
  ENEMY_CHASE_SPEED_FACTOR,
  ENEMY_CORPSE_MS,
  ENEMY_HP_BAR_BORDER,
  ENEMY_HP_BAR_GLOSS_H,
  ENEMY_HP_BAR_HEIGHT,
  ENEMY_HP_BAR_WIDTH,
  ENEMY_RESPAWN_MS,
  NAMEPLATE_BAR_GAP_PX,
  NAMEPLATE_GAP_PX,
} from '@/constants/combat';
import { addNameplate, NAMEPLATE_STYLE, worldDepthForY } from '@/constants/nameplate';
import { combatTextDepthForY } from '@/constants/render-layers';
import {
  CHARACTER_BODY_HEIGHT,
  CHARACTER_BODY_WIDTH,
  CHARACTER_DISPLAY_HEIGHT,
} from '@/constants/sprites';
import { combatLayoutScale } from '@/data/wonsr-rendered-maps';
import { isLabEnemyInvincible } from '@/stores/character-lab-store';
import { getEffectiveCombatStats, scaledAttackCooldown } from '@/systems/combat-stats';
import { getStatusRuntime } from '@/systems/status-runtime';
import type { WonsrDirection } from '@/data/wonsr-sprites';
import type { EnemyDefinition, EnemyRuntimeStats, EnemySkill } from '@/types/enemy';
import { playWonsrEnemySkillFx } from '@/systems/wonsr-enemy-fx';
import { enemyMaxHpForDefinition, scaleEnemyLevelDamage } from '@/lib/enemy-quality-stats';
import { huntEnemyAtkForLevel } from '@/lib/hunt-enemy-xp';
import { Decimal, d, floorNonNeg, hpRatio, type Decimal as DecimalValue } from '@/lib/decimal';
import { formatStat } from '@/lib/format-stat';

/** Cor da vida: verde → âmbar → carmim conforme a vida cai. */
function enemyHpFillColor(ratio: number): number {
  const t = Phaser.Math.Clamp(ratio, 0, 1);
  if (t > 0.5) {
    // 50–100%: âmbar → verde-folha
    const u = (t - 0.5) * 2;
    return lerpColor(0xd4a84b, 0x4ecf70, u);
  }
  // 0–50%: carmim → âmbar
  const u = t * 2;
  return lerpColor(0xc93c3c, 0xd4a84b, u);
}

function lerpColor(from: number, to: number, t: number): number {
  const u = Phaser.Math.Clamp(t, 0, 1);
  const fr = (from >> 16) & 0xff;
  const fg = (from >> 8) & 0xff;
  const fb = from & 0xff;
  const tr = (to >> 16) & 0xff;
  const tg = (to >> 8) & 0xff;
  const tb = to & 0xff;
  const r = Math.round(fr + (tr - fr) * u);
  const g = Math.round(fg + (tg - fg) * u);
  const b = Math.round(fb + (tb - fb) * u);
  return (r << 16) | (g << 8) | b;
}

/**
 * Monstro com HP, barra, morte e respawn (combate).
 */
export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Sprite;
  /** Mutável para recycle na fila lateral (evita destroy/create a cada kill). */
  definition: EnemyDefinition;
  readonly stats: EnemyRuntimeStats;

  /** Contorno da barra (anel escuro). */
  private readonly hpBarBorder: Phaser.GameObjects.Rectangle;
  /** Trilha vazia. */
  private readonly hpBarBg: Phaser.GameObjects.Rectangle;
  /** Faixa de vida. */
  private readonly hpBarFill: Phaser.GameObjects.Rectangle;
  /** Brilho superior na vida (pixel highlight). */
  private readonly hpBarGloss: Phaser.GameObjects.Rectangle;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly statusIcons: Phaser.GameObjects.Text;
  private alive = true;
  /** Loot/XP desta instância já resolvidos (uma morte = uma recompensa). */
  rewardClaimed = false;
  /** Selamento desta instância já resolvido (manual ou auto). */
  captureResolved = false;
  private respawnAt = 0;
  private patrolTarget: { x: number; y: number } | null = null;
  private nextPatrolAt = 0;
  private facing: WonsrDirection = 'south';
  private readonly mapCollider: Phaser.Physics.Arcade.Collider | null;
  /** Hit reaction lock (hurt anim play-once). */
  private reactingUntil = 0;
  private deathHold = false;
  private reactionEpoch = 0;
  /** Scene time da morte — recycle da fila lateral espera o fade do cadáver. */
  private diedAt = 0;
  /** Último golpe no jogador (ms scene). */
  private lastAttackAt = 0;
  /** Próximo instante em que cada habilidade WONSR pode ser usada. */
  private readonly skillReadyAt = new Map<string, number>();
  /** Índice do próximo hit da cadeia de combos. */
  private comboStep = 0;
  /** Golpe agendado no meio da animação de combo. */
  private pendingHit: { damage: DecimalValue; at: number; range: number } | null = null;
  private lastPlayerPos: { x: number; y: number } | null = null;
  /** Cap de floaters — Boss com HP alto não acumula milhares de textos. */
  private readonly damageFloaters: Phaser.GameObjects.Text[] = [];
  /** Altura do topo do sprite relativo a `sprite.y` (inclui hover de voo). */
  private readonly spriteTopLift: number;
  private readonly layoutScale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    definition: EnemyDefinition,
    private readonly collisionLayer: Phaser.Tilemaps.TilemapLayer | null = null,
  ) {
    this.definition = definition;
    this.layoutScale = combatLayoutScale(definition.mapKey);
    const hpMax = enemyMaxHpForDefinition(definition);
    this.stats = {
      hp: hpMax,
      hpMax,
      level: definition.level,
      xp: definition.xp,
    };

    this.sprite = scene.physics.add.sprite(
      definition.spawn.x,
      definition.spawn.y,
      definition.sprite,
      definition.spriteFrame ?? 0,
    );
    // Sem `spriteFit` (atlas de fallback) cai na moldura, que ali é justa.
    const fit = definition.spriteFit ?? {
      scale: this.sprite.height > 0 ? CHARACTER_DISPLAY_HEIGHT / this.sprite.height : 1,
      originX: 0.5,
      originY: 1,
    };
    this.spriteTopLift =
      (CHARACTER_DISPLAY_HEIGHT + Math.max(0, (fit.originY - 1) * CHARACTER_DISPLAY_HEIGHT)) *
      this.layoutScale;
    this.sprite.setOrigin(fit.originX, fit.originY);
    const extra = definition.spriteFit ? 1 : this.layoutScale;
    const scaleX = (fit.scaleX ?? fit.scale) * extra;
    const scaleY = fit.scale * extra;
    this.sprite.setScale(scaleX, scaleY);
    this.sprite.setCollideWorldBounds(true);
    if (this.sprite.texture) {
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    // O Phaser multiplica tamanho e offset do corpo pela escala, então a
    // pegada é convertida para px de textura para sair igual no mundo.
    const bodyWidth = CHARACTER_BODY_WIDTH / scaleX;
    const bodyHeight = CHARACTER_BODY_HEIGHT / scaleY;
    this.sprite.body!.setSize(bodyWidth, bodyHeight, false);
    this.sprite.body!.setOffset(
      this.sprite.displayOriginX - bodyWidth / 2,
      this.sprite.displayOriginY - bodyHeight,
    );
    this.sprite.setData('enemyId', definition.id);
    this.sprite.setData('enemyLevel', definition.level);
    this.mapCollider = collisionLayer
      ? scene.physics.add.collider(this.sprite, collisionLayer)
      : null;
    this.nextPatrolAt = scene.time.now + Phaser.Math.Between(250, 1200);

    // Nameplate: [barra em camadas] acima do [nome]
    this.nameLabel = addNameplate(
      scene,
      definition.spawn.x,
      definition.spawn.y,
      definition.name,
      NAMEPLATE_STYLE,
    );

    const s = this.layoutScale;
    const barW = ENEMY_HP_BAR_WIDTH * s;
    const barH = ENEMY_HP_BAR_HEIGHT * s;
    const borderW = barW + ENEMY_HP_BAR_BORDER * 2 * s;
    const borderH = barH + ENEMY_HP_BAR_BORDER * 2 * s;
    this.hpBarBorder = scene.add
      .rectangle(0, 0, borderW, borderH, 0x1a1510, 0.95)
      .setOrigin(0.5)
      .setStrokeStyle(Math.max(1, s), 0x3a3228, 0.85);
    this.hpBarBg = scene.add.rectangle(0, 0, barW, barH, 0x0c0c0e, 0.92).setOrigin(0.5);
    this.hpBarFill = scene.add.rectangle(0, 0, barW, barH, 0x4ecf70, 1).setOrigin(0, 0.5);
    this.hpBarGloss = scene.add
      .rectangle(0, 0, barW, ENEMY_HP_BAR_GLOSS_H * s, 0xffffff, 0.28)
      .setOrigin(0, 0.5);
    this.nameLabel.setScale(s);
    this.statusIcons = scene.add
      .text(0, 0, '', {
        fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif',
        fontSize: `${Math.max(10, Math.round(12 * s))}px`,
        color: '#fff4c8',
      })
      .setOrigin(0.5, 1)
      .setDepth(combatTextDepthForY(definition.spawn.y, 6));

    this.refreshHpBar();
    this.syncOverlays();
    this.playIdleAnim();
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get hp(): DecimalValue {
    return this.stats.hp;
  }

  get level(): number {
    return this.stats.level;
  }

  get xp(): number {
    return this.stats.xp;
  }

  get loot() {
    return this.definition.loot;
  }

  get spawn() {
    return { ...this.definition.spawn };
  }

  get speed(): number {
    return this.definition.speed;
  }

  get chaseRadius(): number {
    return this.definition.chaseRadius;
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** true se morto e o fade do cadáver já terminou (pronto para recycle). */
  get canRecycle(): boolean {
    if (this.alive) return false;
    return this.scene.time.now - this.diedAt >= ENEMY_CORPSE_MS;
  }

  /** Aplica dano. Retorna true se o golpe matou o monstro. */
  takeDamage(amount: number | DecimalValue, floater?: { tag?: 'RESIST' | 'WEAK' | 'IMMUNE' }): boolean {
    if (!this.alive) return false;
    if (floater?.tag === 'IMMUNE') {
      this.showDamage(d(0), 'IMMUNE');
      return false;
    }
    const loss = d(amount);
    if (loss.lte(0)) return false;
    if (isLabEnemyInvincible()) {
      this.showDamage(loss, floater?.tag);
      this.playHurtReaction();
      return false;
    }

    this.stats.hp = Decimal.max(d(0), this.stats.hp.sub(loss));
    this.refreshHpBar({ pulse: true });
    this.showDamage(loss, floater?.tag);

    if (this.stats.hp.lte(0)) {
      this.die();
      return true;
    }

    this.playHurtReaction();
    return false;
  }

  /** Boss AI / testes: dispara o golpe básico existente. */
  triggerBasicAttack(time: number): DecimalValue | null {
    if (!this.alive) return null;
    if (time - this.lastAttackAt < scaledAttackCooldown(ENEMY_ATTACK_COOLDOWN_MS, this.id)) {
      return null;
    }
    if (getStatusRuntime(this.scene).isStunned(this.id)) return null;
    this.lastAttackAt = time;
    return this.beginAttack(time);
  }

  /** DEV: força HP sem loot. */
  setHp(hp: number | DecimalValue): void {
    this.stats.hp = Decimal.max(d(0), Decimal.min(this.stats.hpMax, floorNonNeg(hp)));
    this.refreshHpBar();
    if (this.stats.hp.lte(0) && this.alive) this.die();
  }

  heal(amount: number | DecimalValue): DecimalValue {
    const gain = floorNonNeg(amount);
    if (!this.alive || gain.lte(0)) return d(0);
    const next = Decimal.min(this.stats.hpMax, this.stats.hp.add(gain));
    const healed = next.sub(this.stats.hp);
    if (healed.lte(0)) return d(0);
    this.stats.hp = next;
    this.refreshHpBar();
    return healed;
  }

  setStatusIcons(icons: Array<{ icon: string; stacks: number }>): void {
    if (!this.alive) {
      this.statusIcons.setText('');
      return;
    }
    this.statusIcons.setText(
      icons.map((entry) => (entry.stacks > 1 ? `${entry.icon}${entry.stacks}` : entry.icon)).join(''),
    );
  }

  /** Atualiza IA / barra / respawn. Com posição do jogador: persegue e ataca. */
  update(time: number, playerX?: number, playerY?: number): DecimalValue | null {
    if (!this.alive) {
      if (time >= this.respawnAt) {
        this.respawn();
      }
      return null;
    }

    if (playerX != null && playerY != null) {
      this.lastPlayerPos = { x: playerX, y: playerY };
    }

    let hitDamage: DecimalValue | null = null;
    if (this.pendingHit && time >= this.pendingHit.at) {
      const pending = this.pendingHit;
      this.pendingHit = null;
      if (this.lastPlayerPos && this.alive) {
        const dist = Math.hypot(
          this.lastPlayerPos.x - this.sprite.x,
          this.lastPlayerPos.y - this.sprite.y,
        );
        // Folga: o jogador pode ter recuado um pouco durante o wind-up.
        if (dist <= pending.range * 1.4) {
          hitDamage = pending.damage;
        }
      }
    }

    if (playerX != null && playerY != null && this.definition.chaseRadius > 0) {
      const started = this.updateCombatAi(time, playerX, playerY);
      if (hitDamage == null) hitDamage = started;
    } else if (time >= this.reactingUntil) {
      this.updatePatrol(time);
    } else {
      this.sprite.setVelocity(0, 0);
    }
    this.syncOverlays();
    return hitDamage;
  }

  /**
   * Persegue o jogador dentro de `chaseRadius`; golpeia em `ENEMY_ATTACK_RANGE`.
   * @returns dano bruto imediato (sem sheet de combo), ou null se o hit é adiado.
   */
  private updateCombatAi(time: number, playerX: number, playerY: number): DecimalValue | null {
    if (time < this.reactingUntil) {
      this.sprite.setVelocity(0, 0);
      return null;
    }

    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const dist = Math.hypot(dx, dy);
    const chase = this.definition.chaseRadius;

    if (dist > chase) {
      this.updatePatrol(time);
      return null;
    }

    // Em alcance de golpe: para, olha pro jogador e ataca.
    const attackReach = this.attackReach();
    if (dist <= attackReach) {
      this.sprite.setVelocity(0, 0);
      this.patrolTarget = null;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        this.facing = velocityToDirection(dx, dy);
        if (this.definition.walk?.lateral && Math.abs(dx) > 0.5) {
          this.sprite.setFlipX(dx < 0);
        }
      }
      if (
        !this.definition.skills?.length &&
        time - this.lastAttackAt < scaledAttackCooldown(ENEMY_ATTACK_COOLDOWN_MS, this.id)
      ) {
        this.playIdleAnim();
        return null;
      }
      if (this.definition.aiMode === 'external') {
        this.playIdleAnim();
        return null;
      }
      if (getStatusRuntime(this.scene).isStunned(this.id)) {
        this.playIdleAnim();
        return null;
      }
      this.lastAttackAt = time;
      return this.beginAttack(time, dist);
    }

    // Persegue até o alcance.
    this.patrolTarget = null;
    const move = getEffectiveCombatStats(this.id, { movementSpeed: this.definition.speed }).movementSpeed;
    const speed = Phaser.Math.Clamp(
      move * ENEMY_CHASE_SPEED_FACTOR,
      40 * this.layoutScale,
      110 * this.layoutScale,
    );
    const len = dist || 1;
    this.sprite.setVelocity((dx / len) * speed, (dy / len) * speed);
    this.playWalkAnim(dx, dy);
    return null;
  }

  /**
   * Toca combo/ataque se existir; agenda o hit no meio da animação.
   * Sem sheet: dano imediato (fallback atlas), ou habilidade WONSR com VFX.
   */
  private beginAttack(time: number, dist = 0): DecimalValue | null {
    if (this.definition.skills?.length) {
      const skill = this.pickSkill(dist, time);
      if (!skill) {
        this.playIdleAnim();
        return null;
      }
      return this.beginSkillAttack(time, skill);
    }

    const damage = this.attackDamage();
    const played = this.playAttackAnim();
    if (!played) {
      this.playIdleAnim();
      return damage;
    }

    const walk = this.definition.walk;
    const keys = walk?.attackAnimKeys;
    const idx = keys && keys.length > 0 ? (this.comboStep - 1 + keys.length) % keys.length : 0;
    const animKey = keys?.[idx];
    const anim = animKey ? this.scene.anims.get(animKey) : null;
    const durationMs = anim
      ? Math.max(280, Math.ceil((anim.frames.length / (anim.frameRate || 12)) * 1000))
      : 400;
    const hitDelay = Math.floor(durationMs * 0.55);
    const unlockAt = time + durationMs;
    this.reactingUntil = unlockAt;
    this.pendingHit = {
      damage,
      at: time + hitDelay,
      range: ENEMY_ATTACK_RANGE * this.layoutScale,
    };

    const epoch = this.reactionEpoch;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.reactionEpoch !== epoch || !this.alive || this.deathHold) return;
      if (this.reactingUntil !== unlockAt) return;
      this.reactingUntil = 0;
      this.playIdleAnim();
    });
    return null;
  }

  private beginSkillAttack(time: number, skill: EnemySkill): DecimalValue | null {
    const cooldown = Phaser.Math.Clamp(skill.intervalMs || ENEMY_ATTACK_COOLDOWN_MS, 700, 4200);
    this.skillReadyAt.set(skill.name, time + cooldown);
    this.comboStep += 1;

    const target = this.lastPlayerPos ?? { x: this.sprite.x, y: this.sprite.y };
    const hitDelay = playWonsrEnemySkillFx(this.scene, skill, { x: this.sprite.x, y: this.sprite.y }, target);
    const durationMs = Math.max(280, hitDelay + 80);
    const unlockAt = time + durationMs;
    this.reactingUntil = unlockAt;
    this.pendingHit = {
      damage: this.skillDamage(skill),
      at: time + hitDelay,
      range: this.skillReach(skill) * 1.15,
    };
    this.playIdleAnim();

    const epoch = this.reactionEpoch;
    this.scene.time.delayedCall(durationMs, () => {
      if (this.reactionEpoch !== epoch || !this.alive || this.deathHold) return;
      if (this.reactingUntil !== unlockAt) return;
      this.reactingUntil = 0;
      this.playIdleAnim();
    });
    return null;
  }

  private attackReach(): number {
    const skills = this.definition.skills;
    if (!skills?.length) return ENEMY_ATTACK_RANGE * this.layoutScale;
    return Math.max(...skills.map((skill) => this.skillReach(skill)));
  }

  private skillReach(skill: EnemySkill): number {
    const tiles = Math.max(1, skill.range || 1);
    return Math.max(ENEMY_ATTACK_RANGE, tiles * 32) * this.layoutScale;
  }

  private pickSkill(dist: number, time: number): EnemySkill | null {
    const skills = this.definition.skills;
    if (!skills?.length) return null;
    const ready = skills.filter((skill) => {
      const nextAt = this.skillReadyAt.get(skill.name) ?? 0;
      return time >= nextAt && dist <= this.skillReach(skill) * 1.2;
    });
    if (!ready.length) return null;
    const named = ready.filter((skill) => skill.name.toLowerCase() !== 'melee');
    const pool = named.length ? named : ready;
    return pool[this.comboStep % pool.length] ?? null;
  }

  private skillDamage(skill: EnemySkill): DecimalValue {
    const level = Math.max(1, this.stats.level);
    const avg = (Math.abs(skill.min) + Math.abs(skill.max)) / 2;
    const namedBonus = skill.name.toLowerCase() === 'melee' ? 0 : 4;
    return scaleEnemyLevelDamage(
      huntEnemyAtkForLevel(level).add(Math.min(16, avg / 500) + namedBonus),
      this.definition,
    );
  }

  /** Dano bruto antes da defesa do jogador. */
  private attackDamage(): DecimalValue {
    const level = Math.max(1, this.stats.level);
    return huntEnemyAtkForLevel(level);
  }

  /** Toca o próximo hit da cadeia de combo. @returns false se não há sheet. */
  private playAttackAnim(): boolean {
    const walk = this.definition.walk;
    const keys = walk?.attackAnimKeys;
    const textures = walk?.attackTextureKeys;
    if (!keys || keys.length === 0 || !textures || textures.length === 0) {
      return false;
    }

    const index = this.comboStep % keys.length;
    this.comboStep = (this.comboStep + 1) % keys.length;
    const animKey = keys[index];
    const textureKey = textures[index] ?? textures[0];
    if (!this.scene.anims.exists(animKey)) return false;

    this.sprite.setVelocity(0, 0);
    this.patrolTarget = null;
    this.reactionEpoch += 1;
    if (this.sprite.texture.key !== textureKey) {
      this.sprite.setTexture(textureKey, 0);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    // Lateral: flip já aplicado em updateCombatAi.
    this.sprite.anims.play(animKey, false);
    return true;
  }

  destroy(): void {
    this.mapCollider?.destroy();
    for (const floater of this.damageFloaters) floater.destroy();
    this.damageFloaters.length = 0;
    this.sprite.destroy();
    this.nameLabel.destroy();
    this.statusIcons.destroy();
    this.hpBarBorder.destroy();
    this.hpBarBg.destroy();
    this.hpBarFill.destroy();
    this.hpBarGloss.destroy();
  }

  private die(): void {
    this.alive = false;
    this.diedAt = this.scene.time.now;
    getStatusRuntime(this.scene).clearTarget(this.id);
    this.statusIcons.setText('');
    this.patrolTarget = null;
    this.reactingUntil = 0;
    this.pendingHit = null;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.clearTint();
    this.sprite.setVelocity(0, 0);
    this.sprite.body!.enable = false;
    this.setHpBarVisible(false);
    this.nameLabel.setVisible(false);
    this.respawnAt = this.definition.noRespawn
      ? Number.POSITIVE_INFINITY
      : this.scene.time.now + (this.definition.respawnMs ?? ENEMY_RESPAWN_MS);

    const playedDeath = this.playDeathAnim();
    if (!playedDeath) {
      this.sprite.anims.stop();
      this.sprite.setTint(0x555555);
      this.sprite.setAlpha(0.85);
    }

    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 0,
      delay: Math.max(0, ENEMY_CORPSE_MS - 350),
      duration: 350,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.alive) this.sprite.setVisible(false);
      },
    });
  }

  /**
   * Reusa a instância na fila lateral (mesmo look ou template cacheado).
   * Evita alocar physics body / nameplate / HP bar a cada kill — crítico em produção.
   */
  recycle(next: EnemyDefinition): void {
    this.scene.tweens.killTweensOf(this.sprite);
    this.scene.tweens.killTweensOf(this.hpBarFill);
    this.scene.tweens.killTweensOf(this.hpBarGloss);
    this.scene.tweens.killTweensOf(this.hpBarBorder);
    getStatusRuntime(this.scene).clearTarget(this.id);

    this.definition = next;
    this.alive = true;
    this.diedAt = 0;
    this.rewardClaimed = false;
    this.captureResolved = false;
    this.deathHold = false;
    this.reactingUntil = 0;
    this.pendingHit = null;
    this.comboStep = 0;
    this.patrolTarget = null;
    this.lastPlayerPos = null;
    this.skillReadyAt.clear();
    this.reactionEpoch += 1;
    this.respawnAt = 0;

    const hpMax = enemyMaxHpForDefinition(next);
    this.stats.hpMax = hpMax;
    this.stats.hp = hpMax;
    this.stats.level = next.level;
    this.stats.xp = next.xp;

    this.sprite.clearTint();
    this.sprite.setVisible(true);
    this.sprite.setAlpha(1);
    if (this.sprite.texture.key !== next.sprite) {
      this.sprite.setTexture(next.sprite, next.spriteFrame ?? 0);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    } else if (next.spriteFrame != null) {
      this.sprite.setFrame(next.spriteFrame);
    }
    this.sprite.enableBody(true, next.spawn.x, next.spawn.y, true, true);
    this.sprite.setVelocity(0, 0);
    this.sprite.setData('enemyId', next.id);
    this.sprite.setData('enemyLevel', next.level);

    this.nameLabel.setText(next.name);
    this.nameLabel.setVisible(true);
    this.statusIcons.setText('');
    this.setHpBarVisible(true);
    this.nextPatrolAt = this.scene.time.now + Phaser.Math.Between(250, 900);
    this.playIdleAnim();
    this.refreshHpBar();
    this.syncOverlays();
  }

  private respawn(): void {
    this.alive = true;
    this.diedAt = 0;
    this.rewardClaimed = false;
    this.captureResolved = false;
    this.deathHold = false;
    this.reactingUntil = 0;
    this.pendingHit = null;
    this.comboStep = 0;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.clearTint();
    this.sprite.setVisible(true);
    this.sprite.setAlpha(1);
    this.sprite.enableBody(true, this.definition.spawn.x, this.definition.spawn.y, true, true);
    this.sprite.setVelocity(0, 0);
    const hpMax = enemyMaxHpForDefinition(this.definition);
    this.stats.hpMax = hpMax;
    this.stats.hp = hpMax;
    this.nameLabel.setVisible(true);
    this.setHpBarVisible(true);
    this.nextPatrolAt = this.scene.time.now + Phaser.Math.Between(250, 900);
    this.playIdleAnim();
    this.refreshHpBar();
    this.syncOverlays();
  }

  private updatePatrol(time: number): void {
    if (time < this.reactingUntil) {
      this.sprite.setVelocity(0, 0);
      return;
    }

    if (this.patrolTarget) {
      const dx = this.patrolTarget.x - this.sprite.x;
      const dy = this.patrolTarget.y - this.sprite.y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 3 * this.layoutScale) {
        this.sprite.setPosition(this.patrolTarget.x, this.patrolTarget.y);
        this.sprite.setVelocity(0, 0);
        this.patrolTarget = null;
        this.nextPatrolAt = time + Phaser.Math.Between(250, 1000);
        this.playIdleAnim();
        return;
      }
      const move = getEffectiveCombatStats(this.id, { movementSpeed: this.definition.speed }).movementSpeed;
      const speed = Phaser.Math.Clamp(
        move * 0.24,
        28 * this.layoutScale,
        68 * this.layoutScale,
      );
      this.sprite.setVelocity((dx / distance) * speed, (dy / distance) * speed);
      this.playWalkAnim(dx, dy);
      return;
    }

    this.sprite.setVelocity(0, 0);
    this.playIdleAnim();
    if (time < this.nextPatrolAt) return;
    this.choosePatrolStep(time);
  }

  /** Toca a caminhada direcional (sheet) ou apenas espelha (atlas de 1 frame). */
  private playWalkAnim(dx: number, dy: number): void {
    if (this.scene.time.now < this.reactingUntil || this.deathHold) return;
    const direction = velocityToDirection(dx, dy);
    const walk = this.definition.walk;
    if (!walk) {
      this.sprite.setFlipX(dx < 0);
      return;
    }

    this.facing = walk.directions.includes(direction) ? direction : walk.directions[0];

    if (walk.lateral && walk.walkAnimKey) {
      if (walk.walkTextureKey && this.sprite.texture.key !== walk.walkTextureKey) {
        this.sprite.setTexture(walk.walkTextureKey);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      // Folhas laterais (Sakura, etc.): flip por componente horizontal.
      if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0);
      this.sprite.anims.play(walk.walkAnimKey, true);
      return;
    }

    const animKey = walk.anims[this.facing];
    if (animKey) this.sprite.anims.play(animKey, true);
  }

  private playIdleAnim(): void {
    if (this.scene.time.now < this.reactingUntil || this.deathHold) return;
    const walk = this.definition.walk;
    if (!walk) return;

    if (walk.lateral && walk.idleAnimKey) {
      if (walk.idleTextureKey && this.sprite.texture.key !== walk.idleTextureKey) {
        this.sprite.setTexture(walk.idleTextureKey);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      this.sprite.setFlipX(this.facing === 'west');
      this.sprite.anims.play(walk.idleAnimKey, true);
      return;
    }

    this.sprite.anims.stop();
    const frame = walk.idleFrames[this.facing] ?? walk.idleFrames[walk.directions[0]];
    if (frame != null) this.sprite.setFrame(frame);
  }

  /**
   * Hurt sheet se existir (Gaara etc.); senão flash tint clássico.
   */
  private playHurtReaction(): void {
    const walk = this.definition.walk;
    const animKey = walk?.hurtAnimKey;
    const textureKey = walk?.hurtTextureKey;
    if (animKey && textureKey && this.scene.anims.exists(animKey)) {
      this.sprite.setVelocity(0, 0);
      this.patrolTarget = null;
      if (this.sprite.texture.key !== textureKey) {
        this.sprite.setTexture(textureKey, 0);
        this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
      // Mantém o flip lateral atual.
      const epoch = ++this.reactionEpoch;
      this.sprite.anims.play(animKey, false);
      const anim = this.scene.anims.get(animKey);
      const durationMs = anim
        ? Math.max(160, Math.ceil((anim.frames.length / (anim.frameRate || 10)) * 1000))
        : 220;
      this.reactingUntil = this.scene.time.now + durationMs;
      this.scene.time.delayedCall(durationMs, () => {
        if (this.reactionEpoch !== epoch || !this.alive) return;
        this.reactingUntil = 0;
        this.playIdleAnim();
      });
      return;
    }
    this.flashHit();
  }

  /** @returns true se tocou animação de morte pack. */
  private playDeathAnim(): boolean {
    const walk = this.definition.walk;
    const animKey = walk?.deathAnimKey;
    const textureKey = walk?.deathTextureKey;
    if (!animKey || !textureKey || !this.scene.anims.exists(animKey)) return false;

    this.deathHold = true;
    this.reactionEpoch += 1;
    if (this.sprite.texture.key !== textureKey) {
      this.sprite.setTexture(textureKey, 0);
      this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.sprite.anims.play(animKey, false);
    // Phaser holds last frame after repeat:0 completes by default.
    return true;
  }

  /** Escolhe um tile vizinho livre; passos sucessivos fazem o inimigo percorrer o mapa. */
  private choosePatrolStep(time: number): void {
    const layer = this.collisionLayer;
    if (!layer) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.patrolTarget = {
        x: Phaser.Math.Clamp(
          this.sprite.x + Math.cos(angle) * 32,
          16,
          this.scene.physics.world.bounds.width - 16,
        ),
        y: Phaser.Math.Clamp(
          this.sprite.y + Math.sin(angle) * 32,
          16,
          this.scene.physics.world.bounds.height - 16,
        ),
      };
      return;
    }

    const tileX = layer.worldToTileX(this.sprite.x, true);
    const tileY = layer.worldToTileY(this.sprite.y, true);
    const directions = Phaser.Utils.Array.Shuffle([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]);

    for (const direction of directions) {
      const x = tileX + direction.x;
      const y = tileY + direction.y;
      if (x < 0 || y < 0 || x >= layer.layer.width || y >= layer.layer.height) continue;
      const tile = layer.getTileAt(x, y);
      if (tile && tile.index !== -1) continue;
      this.patrolTarget = {
        x: layer.tileToWorldX(x) + layer.layer.tileWidth / 2,
        y: layer.tileToWorldY(y) + layer.layer.tileHeight / 2,
      };
      return;
    }

    this.nextPatrolAt = time + 600;
  }

  private setHpBarVisible(visible: boolean): void {
    this.hpBarBorder.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.hpBarGloss.setVisible(visible);
  }

  private refreshHpBar(opts?: { pulse?: boolean }): void {
    const ratio = hpRatio(this.stats.hp, this.stats.hpMax);
    const width = Math.max(0, ENEMY_HP_BAR_WIDTH * this.layoutScale * ratio);
    const color = enemyHpFillColor(ratio);

    this.hpBarFill.width = width;
    this.hpBarFill.setFillStyle(color, 1);
    this.hpBarGloss.width = Math.max(0, width - 1);
    this.hpBarGloss.setVisible(width > 1 && this.alive);
    this.hpBarGloss.setFillStyle(0xffffff, ratio > 0.35 ? 0.32 : 0.2);

    if (opts?.pulse && width > 0 && this.alive) {
      this.scene.tweens.killTweensOf(this.hpBarBorder);
      this.hpBarBorder.setStrokeStyle(1, 0xf0e0b0, 0.95);
      this.scene.tweens.add({
        targets: this.hpBarBorder,
        alpha: { from: 1, to: 0.95 },
        duration: 120,
        onComplete: () => {
          if (!this.hpBarBorder.active) return;
          this.hpBarBorder.setAlpha(1);
          this.hpBarBorder.setStrokeStyle(1, 0x3a3228, 0.85);
        },
      });
    }
  }

  /**
   * Pilha do nameplate no topo do sprite:
   *   [barra HP em camadas]
   *   [nome]
   *   personagem
   */
  private syncOverlays(): void {
    const depth = worldDepthForY(this.sprite.y, 8);
    this.sprite.setDepth(depth);

    const s = this.layoutScale;
    const headY = this.sprite.y - this.spriteTopLift;
    const nameBottom = headY - NAMEPLATE_GAP_PX * s;
    this.nameLabel.setPosition(Math.round(this.sprite.x), Math.round(nameBottom));
    this.nameLabel.setDepth(combatTextDepthForY(this.sprite.y, 5));

    const barY =
      nameBottom -
      this.nameLabel.displayHeight -
      NAMEPLATE_BAR_GAP_PX * s -
      (ENEMY_HP_BAR_HEIGHT * s) / 2;
    const left = this.sprite.x - (ENEMY_HP_BAR_WIDTH * s) / 2;
    const glossY = barY - (ENEMY_HP_BAR_HEIGHT * s) / 2 + ENEMY_HP_BAR_GLOSS_H * s;

    this.hpBarBorder.setPosition(this.sprite.x, barY);
    this.hpBarBorder.setDepth(combatTextDepthForY(this.sprite.y, 1));
    this.hpBarBg.setPosition(this.sprite.x, barY);
    this.hpBarBg.setDepth(combatTextDepthForY(this.sprite.y, 2));
    this.hpBarFill.setPosition(left, barY);
    this.hpBarFill.setDepth(combatTextDepthForY(this.sprite.y, 3));
    this.hpBarGloss.setPosition(left + 0.5, glossY);
    this.hpBarGloss.setDepth(combatTextDepthForY(this.sprite.y, 4));
    this.statusIcons.setPosition(Math.round(this.sprite.x), Math.round(barY - (ENEMY_HP_BAR_HEIGHT * s) / 2 - 2 * s));
    this.statusIcons.setDepth(combatTextDepthForY(this.sprite.y, 6));
    this.statusIcons.setVisible(this.alive);
  }

  private flashHit(): void {
    // Tint flash — alpha blink seems like afterimage while the enemy moves.
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setAlpha(1);
    this.sprite.setTintFill(0xffefc2);
    this.scene.time.delayedCall(80, () => {
      if (!this.sprite.active || !this.alive) return;
      this.sprite.clearTint();
    });
  }

  private showDamage(amount: number | DecimalValue, tag?: 'RESIST' | 'WEAK' | 'IMMUNE'): void {
    const label = tag === 'IMMUNE' ? 'IMMUNE' : `-${formatStat(amount)}${tag ? ` ${tag}` : ''}`;
    const color = tag === 'IMMUNE' ? '#9bd0f5' : tag === 'WEAK' ? '#ffb347' : tag === 'RESIST' ? '#8ecae6' : '#ffffff';
    while (this.damageFloaters.length >= 10) {
      const oldest = this.damageFloaters.shift();
      oldest?.destroy();
    }
    const floater = this.scene.add
      .text(this.sprite.x, this.sprite.y - this.spriteTopLift * 0.55, label, {
        fontFamily: 'Tahoma, "Segoe UI", sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color,
        stroke: '#1a0808',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(combatTextDepthForY(this.sprite.y, 20));
    this.damageFloaters.push(floater);

    this.scene.tweens.add({
      targets: floater,
      y: floater.y - 26,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        floater.destroy();
        const index = this.damageFloaters.indexOf(floater);
        if (index >= 0) this.damageFloaters.splice(index, 1);
      },
    });
  }
}

/** Vetor de movimento → direção cardinal (sheets têm 4 direções reais). */
function velocityToDirection(dx: number, dy: number): WonsrDirection {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'west' : 'east';
  return dy < 0 ? 'north' : 'south';
}
