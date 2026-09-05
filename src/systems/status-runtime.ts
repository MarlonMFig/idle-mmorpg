import * as Phaser from 'phaser';
import {
  categoryForStatusType,
  DEFAULT_STATUS_ICONS,
  identityModifiers,
  type StatusEffectDefinition,
  type StatusModifiers,
} from '@/data/status-effect-def';
import { getStatusDefinition } from '@/data/status/registry';
import { getVfxDefinition, sharedVfxTextureKey } from '@/data/vfx/registry';
import { ensureSharedVfxTexture } from '@/data/vfx/load-shared-vfx';
import { vfxDepthForLayer } from '@/constants/render-layers';
import type { Enemy } from '@/entities/enemy';
import { characterLabStore, isCharacterLabSession } from '@/stores/character-lab-store';
import { combatStatusHudStore } from '@/stores/combat-status-hud-store';
import { vitalsStore } from '@/stores/vitals-store';
import { getCombatAffinity } from '@/systems/combat-affinity';
import {
  bindCombatStatModifiers,
  getEffectiveCombatStats,
  mitigateIncomingDamage,
  PLAYER_STATUS_UNIT_ID,
  unbindCombatStatModifiers,
} from '@/systems/combat-stats';
import { applyElementalResistance } from '@/systems/elemental-resistance';
import { DEFAULT_SKILL_ELEMENT, type DamageElement } from '@/data/damage-elements';
import { Decimal, d, type Decimal as DecimalValue } from '@/lib/decimal';

export interface StatusInstance {
  instanceId: string;
  statusId: string;
  sourceId: string;
  targetId: string;
  startedAt: number;
  expiresAt: number;
  stacks: number;
  tickCount: number;
  nextTickAt: number | null;
  shieldRemaining: number;
  def: StatusEffectDefinition;
}

export interface StatusWorldHooks {
  getEnemy: (id: string) => Enemy | null;
  getTargetPos: (id: string) => { x: number; y: number } | null;
  isPlayerDead: () => boolean;
  onEnemyKilled: (enemy: Enemy, sourceId: string) => void;
}

const worlds = new WeakMap<Phaser.Scene, StatusEffectRuntime>();

export function getStatusRuntime(scene: Phaser.Scene): StatusEffectRuntime {
  let world = worlds.get(scene);
  if (!world) {
    world = new StatusEffectRuntime(scene);
    worlds.set(scene, world);
  }
  return world;
}

export function clearStatusRuntime(scene: Phaser.Scene): void {
  worlds.get(scene)?.clearAll();
}

export function unbindStatusRuntime(scene: Phaser.Scene): void {
  const world = worlds.get(scene);
  if (!world) return;
  world.clearAll();
  world.destroy();
  worlds.delete(scene);
}

function statusLog(text: string): void {
  if (isCharacterLabSession()) characterLabStore.pushEvent(text);
}

let nextInstanceId = 1;

export class StatusEffectRuntime {
  private readonly instances = new Map<string, StatusInstance>();
  private readonly timers = new Map<string, Phaser.Time.TimerEvent[]>();
  private readonly vfx = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly icons = new Map<string, Phaser.GameObjects.Text>();
  private hooks: StatusWorldHooks | null = null;
  private destroyed = false;

  constructor(private readonly scene: Phaser.Scene) {
    bindCombatStatModifiers((unitId) => this.aggregatedModifiers(unitId));
  }

  setHooks(hooks: StatusWorldHooks | null): void {
    this.hooks = hooks;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearAll();
    unbindCombatStatModifiers();
  }

  listFor(targetId: string): StatusInstance[] {
    return [...this.instances.values()].filter((row) => row.targetId === targetId && row.expiresAt > this.now());
  }

  isStunned(unitId: string): boolean {
    return this.listFor(unitId).some((row) => categoryForStatusType(row.def.type) === 'stun');
  }

  hasStatus(targetId: string, statusId: string): boolean {
    return this.listFor(targetId).some((row) => row.statusId === statusId);
  }

  aggregatedModifiers(unitId: string): Required<StatusModifiers> {
    const total = identityModifiers();
    for (const row of this.listFor(unitId)) {
      const mods = row.def.modifiers;
      if (!mods) continue;
      const stacks = row.def.stackScalesValue ? row.stacks : 1;
      const scale = (value: number | undefined, key: keyof Required<StatusModifiers>) => {
        if (value == null) return;
        let next = value;
        for (let i = 1; i < stacks; i += 1) next *= value;
        total[key] *= next;
      };
      scale(mods.attackMultiplier, 'attackMultiplier');
      scale(mods.defenseMultiplier, 'defenseMultiplier');
      scale(mods.movementSpeedMultiplier, 'movementSpeedMultiplier');
      scale(mods.attackSpeedMultiplier, 'attackSpeedMultiplier');
      scale(mods.criticalChanceMultiplier, 'criticalChanceMultiplier');
      scale(mods.criticalDamageMultiplier, 'criticalDamageMultiplier');
    }
    return total;
  }

  aggregatedElementResistance(unitId: string, element: DamageElement): number {
    let bonus = 0;
    for (const row of this.listFor(unitId)) {
      const value = row.def.modifiers?.elementResistanceModifiers?.[element];
      if (value == null || !Number.isFinite(value)) continue;
      const stacks = row.def.stackScalesValue ? row.stacks : 1;
      bonus += value * stacks;
    }
    return bonus;
  }

  apply(input: {
    def: StatusEffectDefinition;
    sourceId: string;
    targetId: string;
  }): StatusInstance | null {
    if (this.destroyed) return null;
    if (input.targetId === PLAYER_STATUS_UNIT_ID && this.hooks?.isPlayerDead()) return null;
    if (input.targetId !== PLAYER_STATUS_UNIT_ID && input.targetId.startsWith('companion:') === false) {
      const enemy = this.hooks?.getEnemy(input.targetId);
      if (enemy && !enemy.isAlive) return null;
    }

    const existing = this.findOnTarget(input.targetId, input.def.id);
    const mode = input.def.stackMode;

    if (existing && mode === 'ignore') {
      statusLog(`[Status] ${input.def.name} ignored`);
      return existing;
    }
    if (existing && mode === 'refresh-duration') {
      this.refresh(existing, input.def, input.sourceId);
      statusLog(`[Status] ${input.def.name} refreshed`);
      return existing;
    }
    if (existing && mode === 'stack') {
      existing.stacks = Math.min(input.def.maxStacks, existing.stacks + 1);
      existing.def = input.def;
      existing.sourceId = input.sourceId;
      existing.shieldRemaining = this.initialShield(input.def, existing.stacks);
      this.refreshTimers(existing);
      this.syncHud();
      statusLog(`[Status] ${input.def.name} stacked (${existing.stacks}/${input.def.maxStacks})`);
      return existing;
    }
    if (existing && mode === 'replace') {
      this.remove(existing.instanceId, 'replaced');
    }

    const now = this.now();
    const instance: StatusInstance = {
      instanceId: `status-${nextInstanceId++}`,
      statusId: input.def.id,
      sourceId: input.sourceId,
      targetId: input.targetId,
      startedAt: now,
      expiresAt: now + input.def.duration,
      stacks: 1,
      tickCount: 0,
      nextTickAt: this.firstTickAt(now, input.def),
      shieldRemaining: this.initialShield(input.def, 1),
      def: input.def,
    };
    this.instances.set(instance.instanceId, instance);
    this.armTimers(instance);
    void this.spawnVfx(instance);
    this.syncHud();
    statusLog(`[Skill] ${input.def.name} applied`);
    return instance;
  }

  absorbShield(targetId: string, amount: number | DecimalValue): DecimalValue {
    const incoming = d(amount);
    if (incoming.lte(0)) return d(0);
    let remaining = incoming;
    const shields = this.listFor(targetId)
      .filter((row) => categoryForStatusType(row.def.type) === 'shield' && row.shieldRemaining > 0)
      .sort((a, b) => a.startedAt - b.startedAt);
    for (const row of shields) {
      if (remaining.lte(0)) break;
      const used = Decimal.min(d(row.shieldRemaining), remaining);
      row.shieldRemaining = d(row.shieldRemaining).sub(used).toNumber();
      remaining = remaining.sub(used);
      if (row.shieldRemaining <= 0) this.remove(row.instanceId, 'shield-break');
    }
    return incoming.sub(remaining);
  }

  clearTarget(targetId: string): void {
    for (const row of [...this.instances.values()]) {
      if (row.targetId === targetId) this.remove(row.instanceId, 'cleared');
    }
  }

  clearAll(): void {
    for (const id of [...this.instances.keys()]) this.remove(id, 'cleared');
    this.instances.clear();
    this.syncHud();
  }

  updateFollow(): void {
    if (this.destroyed) return;
    for (const [id, sprite] of this.vfx) {
      const row = this.instances.get(id);
      if (!row || !sprite.active) {
        if (sprite && !sprite.active) this.vfx.delete(id);
        continue;
      }
      const pos = this.hooks?.getTargetPos(row.targetId);
      if (!pos) continue;
      sprite.x = pos.x;
      sprite.y = pos.y;
      sprite.setDepth(vfxDepthForLayer(getVfxDefinition(row.def.vfxId)?.renderLayer, pos.y));
    }
    this.syncEnemyIcons();
    this.publishDebug();
  }

  private findOnTarget(targetId: string, statusId: string): StatusInstance | undefined {
    return [...this.instances.values()].find(
      (row) => row.targetId === targetId && row.statusId === statusId && row.expiresAt > this.now(),
    );
  }

  private refresh(instance: StatusInstance, def: StatusEffectDefinition, sourceId: string): void {
    instance.def = def;
    instance.sourceId = sourceId;
    instance.startedAt = this.now();
    instance.expiresAt = instance.startedAt + def.duration;
    instance.shieldRemaining = Math.max(instance.shieldRemaining, this.initialShield(def, instance.stacks));
    this.refreshTimers(instance);
    this.syncHud();
  }

  private firstTickAt(now: number, def: StatusEffectDefinition): number | null {
    const category = categoryForStatusType(def.type);
    if (category !== 'damage-over-time' && category !== 'heal-over-time') return null;
    const interval = def.tickInterval ?? 0;
    if (interval <= 0) return null;
    return now + interval;
  }

  private initialShield(def: StatusEffectDefinition, stacks: number): number {
    if (categoryForStatusType(def.type) !== 'shield') return 0;
    const amount = def.shieldAmount ?? 0;
    return def.stackScalesValue ? amount * stacks : amount;
  }

  private stackedValue(base: number, instance: StatusInstance): number {
    if (!instance.def.stackScalesValue) return base;
    return base * instance.stacks;
  }

  private armTimers(instance: StatusInstance): void {
    this.clearTimers(instance.instanceId);
    const list: Phaser.Time.TimerEvent[] = [];
    const category = categoryForStatusType(instance.def.type);
    if (category === 'damage-over-time' || category === 'heal-over-time') {
      const interval = instance.def.tickInterval ?? 0;
      if (interval > 0) {
        const duration = instance.def.duration;
        for (let at = interval; at <= duration; at += interval) {
          list.push(
            this.scene.time.delayedCall(at, () => {
              this.tick(instance.instanceId);
            }),
          );
        }
      }
    }
    list.push(
      this.scene.time.delayedCall(instance.def.duration, () => {
        this.remove(instance.instanceId, 'expired');
      }),
    );
    this.timers.set(instance.instanceId, list);
  }

  private refreshTimers(instance: StatusInstance): void {
    instance.nextTickAt = this.firstTickAt(this.now(), instance.def);
    instance.expiresAt = this.now() + instance.def.duration;
    this.armTimers(instance);
  }

  private tick(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    if (this.now() > instance.expiresAt) return;
    if (instance.targetId === PLAYER_STATUS_UNIT_ID && this.hooks?.isPlayerDead()) {
      this.remove(instanceId, 'dead');
      return;
    }
    if (!instance.targetId.startsWith('companion:') && instance.targetId !== PLAYER_STATUS_UNIT_ID) {
      const enemy = this.hooks?.getEnemy(instance.targetId);
      if (!enemy || !enemy.isAlive) {
        this.remove(instanceId, 'dead');
        return;
      }
    }

    instance.tickCount += 1;
    instance.nextTickAt = instance.def.tickInterval
      ? this.now() + instance.def.tickInterval
      : null;
    const category = categoryForStatusType(instance.def.type);
    if (category === 'damage-over-time') {
      const raw = this.stackedValue(instance.def.damagePerTick ?? 0, instance);
      this.applyDamage(
        instance.targetId,
        raw,
        instance.sourceId,
        instance.def.element ?? DEFAULT_SKILL_ELEMENT,
      );
      statusLog(`[Status] ${instance.def.name} tick ${instance.tickCount}`);
    } else if (category === 'heal-over-time') {
      const raw = this.stackedValue(instance.def.healPerTick ?? 0, instance);
      this.applyHeal(instance.targetId, raw);
      statusLog(`[Status] ${instance.def.name} tick ${instance.tickCount}`);
    }
    this.syncHud();
  }

  private applyDamage(targetId: string, raw: number, sourceId: string, element: DamageElement): void {
    if (raw <= 0) return;
    const enemy =
      targetId === PLAYER_STATUS_UNIT_ID || targetId.startsWith('companion:')
        ? null
        : this.hooks?.getEnemy(targetId) ?? null;
    applyDirectDamage({
      runtime: this,
      targetId,
      rawAmount: raw,
      sourceId,
      enemy,
      element,
      onKill: (killed) => this.hooks?.onEnemyKilled(killed, sourceId),
    });
  }

  private applyHeal(targetId: string, amount: number): void {
    if (amount <= 0) return;
    if (targetId === PLAYER_STATUS_UNIT_ID) {
      vitalsStore.heal(amount);
      return;
    }
    this.hooks?.getEnemy(targetId)?.heal(amount);
  }

  private remove(instanceId: string, reason: string): void {
    const instance = this.instances.get(instanceId);
    if (!instance) return;
    this.clearTimers(instanceId);
    const sprite = this.vfx.get(instanceId);
    if (sprite?.active) sprite.destroy();
    this.vfx.delete(instanceId);
    const icon = this.icons.get(instanceId);
    if (icon?.active) icon.destroy();
    this.icons.delete(instanceId);
    this.instances.delete(instanceId);
    if (reason === 'expired') statusLog(`[Status] ${instance.def.name} expired`);
    this.syncHud();
  }

  private clearTimers(instanceId: string): void {
    const list = this.timers.get(instanceId) ?? [];
    for (const timer of list) {
      try {
        timer.remove(false);
      } catch {
        // scene gone
      }
    }
    this.timers.set(instanceId, []);
  }

  private async spawnVfx(instance: StatusInstance): Promise<void> {
    const vfxId = instance.def.vfxId;
    if (!vfxId) return;
    const def = getVfxDefinition(vfxId);
    if (!def) return;
    try {
      await ensureSharedVfxTexture(this.scene, def);
    } catch {
      return;
    }
    if (!this.instances.has(instance.instanceId)) return;
    const key = sharedVfxTextureKey(def.id);
    if (!this.scene.textures.exists(key)) return;
    const pos = this.hooks?.getTargetPos(instance.targetId) ?? { x: 0, y: 0 };
    const sprite = this.scene.add.sprite(pos.x, pos.y, key, 0);
    sprite.setDepth(vfxDepthForLayer(def.renderLayer, pos.y));
    const animKey = `status-vfx-${def.id}`;
    if (!this.scene.anims.exists(animKey)) {
      const frames = this.scene.anims.generateFrameNumbers(key, {
        start: 0,
        end: Math.max(0, def.frameCount - 1),
      });
      if (frames.length > 0) {
        this.scene.anims.create({
          key: animKey,
          frames,
          frameRate: def.frameRate || 12,
          repeat: -1,
        });
      }
    }
    if (this.scene.anims.exists(animKey)) sprite.play(animKey);
    this.vfx.set(instance.instanceId, sprite);
  }

  private syncEnemyIcons(): void {
    const byTarget = new Map<string, StatusInstance[]>();
    for (const row of this.instances.values()) {
      const list = byTarget.get(row.targetId) ?? [];
      list.push(row);
      byTarget.set(row.targetId, list);
    }
    for (const [targetId, rows] of byTarget) {
      if (targetId === PLAYER_STATUS_UNIT_ID || targetId.startsWith('companion:')) continue;
      const enemy = this.hooks?.getEnemy(targetId);
      if (!enemy?.isAlive) continue;
      enemy.setStatusIcons(
        rows.map((row) => ({
          icon: row.def.icon || DEFAULT_STATUS_ICONS[row.def.type],
          stacks: row.stacks,
        })),
      );
    }
  }

  private syncHud(): void {
    const playerRows = this.listFor(PLAYER_STATUS_UNIT_ID);
    combatStatusHudStore.setPlayerIcons(
      playerRows.map((row) => ({
        statusId: row.statusId,
        icon: row.def.icon || DEFAULT_STATUS_ICONS[row.def.type],
        stacks: row.stacks,
        remainingMs: Math.max(0, row.expiresAt - this.now()),
      })),
    );
  }

  private publishDebug(): void {
    if (!isCharacterLabSession()) return;
    const now = this.now();
    combatStatusHudStore.setDebug(
      [...this.instances.values()].map((row) => ({
        instanceId: row.instanceId,
        name: row.def.name,
        statusId: row.statusId,
        stacks: row.stacks,
        remainingMs: Math.max(0, row.expiresAt - now),
        nextTickMs: row.nextTickAt != null ? Math.max(0, row.nextTickAt - now) : null,
        targetId: row.targetId,
      })),
    );
  }

  private now(): number {
    return this.scene.time.now;
  }
}

export function applyDirectDamage(opts: {
  runtime: StatusEffectRuntime;
  targetId: string;
  rawAmount: number | DecimalValue;
  sourceId: string;
  enemy: Enemy | null;
  element?: DamageElement;
  onKill: (enemy: Enemy, sourceId: string) => void;
}): boolean {
  const element = opts.element ?? DEFAULT_SKILL_ELEMENT;
  const raw = d(opts.rawAmount);
  const absorbed = opts.runtime.absorbShield(opts.targetId, raw);
  const afterShield = raw.sub(absorbed);
  if (afterShield.lte(0)) return false;
  const afterDefense = mitigateIncomingDamage(afterShield, getEffectiveCombatStats(opts.targetId));
  const profile = getCombatAffinity(opts.targetId, opts.enemy?.definition);
  const elemental = applyElementalResistance(
    afterDefense,
    element,
    profile,
    opts.runtime.aggregatedElementResistance(opts.targetId, element),
  );
  if (isCharacterLabSession()) {
    characterLabStore.setDamageDebug({
      rawOutgoing: raw,
      afterShield,
      afterDefense,
      element,
      resistance: elemental.resistance,
      immune: elemental.immune,
      skipped: elemental.skipped,
      afterResistance: elemental.afterResistance,
      finalDamage: elemental.finalDamage,
      tag: elemental.tag,
      targetId: opts.targetId,
    });
  }

  const incoming = elemental.finalDamage;
  if (opts.targetId === PLAYER_STATUS_UNIT_ID) {
    if (elemental.immune || incoming.lte(0)) return false;
    const { died } = vitalsStore.applyHpLoss(incoming);
    if (died) opts.runtime.clearTarget(PLAYER_STATUS_UNIT_ID);
    return true;
  }
  if (!opts.enemy) return false;
  if (elemental.immune) {
    opts.enemy.takeDamage(0, { tag: 'IMMUNE' });
    return false;
  }
  if (incoming.lte(0)) return false;
  const died = opts.enemy.takeDamage(incoming, { tag: elemental.tag ?? undefined });
  if (died) {
    opts.runtime.clearTarget(opts.targetId);
    opts.onKill(opts.enemy, opts.sourceId);
  }
  return true;
}
