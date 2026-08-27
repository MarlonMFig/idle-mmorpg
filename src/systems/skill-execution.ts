import * as Phaser from 'phaser';
import type { CharacterSkillAnimDef, SkillDamageTrigger } from '@/data/character-packs';
import {
  cloneExecutionDef,
  hasExecutionType,
  isInstantExecution,
  normalizeHits,
  planTickOffsets,
  resolveExecutionType,
  resolveExecutionTypes,
  tickMultiplier,
  type LabExecutionDebug,
  type SkillExecutionDef,
  type SkillExecutionType,
} from '@/data/skill-execution-def';
import type { Player } from '@/entities/player';
import { skillActionLockMs } from '@/lib/combat-visual-timing';
import { logVfxLifecycle } from '@/lib/vfx-lifecycle-log';
import { warnSkillVisualIssues } from '@/lib/dev/skill-visual-validation';
import { slotForSkillId, type LabSkillSlot } from '@/lib/dev/lab-skill-slots';
import { characterLabStore, isCharacterLabSession } from '@/stores/character-lab-store';
import { scheduleSkillFx, type SkillFxAim, type SkillFxHooks } from '@/systems/pack-fx';
import type { SkillDefinition } from '@/types/skill';

export type SkillExecutionPhase =
  | 'pose'
  | 'cast'
  | 'effect'
  | 'impact'
  | 'beam-active'
  | 'persistent-active'
  | 'finished';

export type SkillImpactKind = 'single' | 'hit' | 'tick' | 'area';

export interface SkillImpact {
  multiplier: number;
  kind: SkillImpactKind;
  index: number;
  radius?: number;
}

export interface SkillExecution {
  executionId: string;
  characterId: string;
  skillId: string;
  slot: LabSkillSlot | null;
  targetId: string | null;
  startedAt: number;
  endsAt: number | null;
  phase: SkillExecutionPhase;
  executionType: SkillExecutionType;
  currentHit: number;
  tickCount: number;
  damageApplied: boolean;
  damageArmed: boolean;
  cancelled: boolean;
  appliedKeys: Set<string>;
  statusRolled: Set<string>;
  activeVfx: Phaser.GameObjects.Sprite[];
  followMode: 'target' | 'caster' | 'world' | null;
}

/** Ausente no pack = comportamento legado (hitDelay). */
export function resolveSkillDamageTrigger(anim: CharacterSkillAnimDef | undefined): SkillDamageTrigger {
  return anim?.damageTrigger ?? 'hit-delay';
}

export function resolveSkillExecutionDef(
  anim: CharacterSkillAnimDef | undefined,
  skill: SkillDefinition,
): SkillExecutionDef {
  return cloneExecutionDef(anim?.execution ?? skill.execution);
}

/**
 * Skills com `targeting.mode` (Lab) usam Cast Delay para o VFX.
 * Sem mode = timing legado (`fxReleaseMs` / hitDelay).
 */
export function officialVfxStartDelayMs(anim: CharacterSkillAnimDef | undefined): number | null {
  if (!anim?.targeting?.mode) return null;
  return Math.max(0, Math.round(anim.castDelayMs ?? 0));
}

/** Depois do Cast Delay, o VFX começa na hora — sem somar `fxReleaseMs` legado. */
export function playbackAnimForOfficialVfx(anim: CharacterSkillAnimDef): CharacterSkillAnimDef {
  if (!anim.targeting?.mode) return anim;
  return { ...anim, fxReleaseMs: 0 };
}

let nextExecutionId = 1;

/**
 * Runtime de uma execução de Skill. Não persiste (sem localStorage).
 */
export class SkillExecutionRuntime {
  private readonly executions = new Map<string, SkillExecution>();
  private readonly timersById = new Map<string, Phaser.Time.TimerEvent[]>();
  private readonly follow = new Map<
    string,
    {
      getTarget: () => { x: number; y: number } | null;
      getCaster: () => { x: number; y: number };
    }
  >();

  begin(input: {
    characterId: string;
    skillId: string;
    slot?: LabSkillSlot | null;
    targetId: string | null;
    startedAt: number;
    executionType?: SkillExecutionType;
  }): SkillExecution {
    const execution: SkillExecution = {
      executionId: `skill-exec-${nextExecutionId++}`,
      characterId: input.characterId,
      skillId: input.skillId,
      slot: input.slot ?? null,
      targetId: input.targetId,
      startedAt: input.startedAt,
      endsAt: null,
      phase: 'pose',
      executionType: input.executionType ?? 'single-hit',
      currentHit: 0,
      tickCount: 0,
      damageApplied: false,
      damageArmed: true,
      cancelled: false,
      appliedKeys: new Set(),
      statusRolled: new Set(),
      activeVfx: [],
      followMode: null,
    };
    this.executions.set(execution.executionId, execution);
    this.timersById.set(execution.executionId, []);
    return execution;
  }

  get(id: string): SkillExecution | undefined {
    return this.executions.get(id);
  }

  /** Beam / multi-hit / pose bloqueiam nova Skill. Persistent após o lançamento não. */
  blocksNewAction(characterId: string): boolean {
    for (const execution of this.executions.values()) {
      if (execution.cancelled || execution.phase === 'finished') continue;
      if (execution.characterId !== characterId) continue;
      if (execution.phase === 'persistent-active') continue;
      return true;
    }
    return false;
  }

  setPhase(id: string, phase: SkillExecutionPhase): void {
    const execution = this.executions.get(id);
    if (execution && !execution.cancelled) execution.phase = phase;
  }

  isCancelled(id: string): boolean {
    return this.executions.get(id)?.cancelled === true;
  }

  trackTimer(id: string, timer: Phaser.Time.TimerEvent): Phaser.Time.TimerEvent {
    const list = this.timersById.get(id);
    if (list) list.push(timer);
    return timer;
  }

  trackSprite(id: string, sprite: Phaser.GameObjects.Sprite): void {
    const execution = this.executions.get(id);
    if (!execution || execution.cancelled) {
      if (sprite.active) sprite.destroy();
      return;
    }
    execution.activeVfx.push(sprite);
  }

  setFollow(
    id: string,
    mode: SkillExecution['followMode'],
    helpers: {
      getTarget: () => { x: number; y: number } | null;
      getCaster: () => { x: number; y: number };
    },
  ): void {
    const execution = this.executions.get(id);
    if (!execution) return;
    execution.followMode = mode;
    this.follow.set(id, helpers);
  }

  updateFollow(): void {
    for (const execution of this.executions.values()) {
      if (execution.cancelled || !execution.followMode || execution.followMode === 'world') continue;
      const helpers = this.follow.get(execution.executionId);
      if (!helpers) continue;
      const pos =
        execution.followMode === 'caster' ? helpers.getCaster() : helpers.getTarget();
      if (!pos) continue;
      for (const sprite of execution.activeVfx) {
        if (!sprite.active) continue;
        sprite.x = pos.x;
        sprite.y = pos.y;
      }
    }
  }

  tryApplyKey(id: string, key: string): boolean {
    const execution = this.executions.get(id);
    if (!execution || execution.cancelled || !execution.damageArmed) return false;
    if (execution.appliedKeys.has(key)) return false;
    execution.appliedKeys.add(key);
    execution.damageApplied = true;
    execution.phase = 'impact';
    return true;
  }

  /** Single-hit legado: uma aplicação por execução. */
  tryApplyDamage(id: string): boolean {
    return this.tryApplyKey(id, 'single');
  }

  disarmDamage(id: string): void {
    const execution = this.executions.get(id);
    if (execution) execution.damageArmed = false;
  }

  finish(id: string, options?: { keepVfx?: boolean }): void {
    const execution = this.executions.get(id);
    if (!execution) return;
    execution.phase = 'finished';
    this.clearTimers(id);
    if (!options?.keepVfx) this.destroySprites(id);
    this.follow.delete(id);
  }

  cancel(id: string): void {
    const execution = this.executions.get(id);
    if (!execution) return;
    execution.cancelled = true;
    execution.phase = 'finished';
    this.clearTimers(id);
    this.destroySprites(id);
    this.follow.delete(id);
  }

  cancelAll(): void {
    for (const id of [...this.executions.keys()]) this.cancel(id);
    this.executions.clear();
    this.timersById.clear();
    this.follow.clear();
  }

  private clearTimers(id: string): void {
    const timers = this.timersById.get(id) ?? [];
    for (const timer of timers) {
      try {
        timer.remove(false);
      } catch {
        // scene already gone
      }
    }
    this.timersById.set(id, []);
  }

  private destroySprites(id: string): void {
    const execution = this.executions.get(id);
    if (!execution) return;
    for (const sprite of execution.activeVfx) {
      if (sprite.active) sprite.destroy();
    }
    execution.activeVfx = [];
  }
}

export interface OfficialSkillFxSchedule {
  scene: Phaser.Scene;
  runtime: SkillExecutionRuntime;
  player: Player;
  skill: SkillDefinition;
  anim: CharacterSkillAnimDef | undefined;
  from: { x: number; y: number };
  to: { x: number; y: number };
  aim: SkillFxAim | null;
  targetId: string | null;
  hitDelayMs: number;
  isCasterDead: () => boolean;
  isOriginalTargetDead: () => boolean;
  getTargetPos: () => { x: number; y: number } | null;
  onHit: (impact: SkillImpact, execution: SkillExecution) => void;
  onStatusMoment?: (
    moment: 'on-start' | 'on-end',
    execution: SkillExecution,
  ) => void;
}

function labLog(text: string): void {
  if (isCharacterLabSession()) characterLabStore.pushEvent(text);
}

function publishLabDebug(execution: SkillExecution, extra: Partial<LabExecutionDebug>): void {
  if (!isCharacterLabSession()) return;
  characterLabStore.setExecutionDebug({
    type: execution.executionType,
    status: extra.status ?? execution.phase,
    elapsedMs: extra.elapsedMs ?? 0,
    durationMs: extra.durationMs ?? 0,
    tick: extra.tick ?? execution.tickCount,
    tickMax: extra.tickMax ?? 0,
    currentHit: extra.currentHit ?? execution.currentHit,
    hitMax: extra.hitMax ?? 0,
  });
}

/**
 * Pose já começou. Agenda Cast Delay → VFX (registry/targeting) e o Damage Trigger.
 * Sem `targeting.mode`, o timing do VFX permanece legado (`fxReleaseMs` / hitDelay).
 */
export function scheduleOfficialSkillFx(opts: OfficialSkillFxSchedule): SkillExecution {
  const {
    scene,
    runtime,
    player,
    skill,
    anim,
    from,
    to,
    aim,
    targetId,
    hitDelayMs,
    isCasterDead,
    isOriginalTargetDead,
    getTargetPos,
    onHit,
    onStatusMoment,
  } = opts;

  warnSkillVisualIssues(player.pack, skill.id);
  const execDef = resolveSkillExecutionDef(anim, skill);
  const types = resolveExecutionTypes(execDef);
  const type = resolveExecutionType(execDef);
  const instant = isInstantExecution(execDef);
  const area = hasExecutionType(execDef, 'area');
  const persistVfx = hasExecutionType(execDef, 'beam') || hasExecutionType(execDef, 'persistent');

  const execution = runtime.begin({
    characterId: player.pack.id,
    skillId: skill.id,
    slot: slotForSkillId(player.pack, skill.id),
    targetId,
    startedAt: scene.time.now,
    executionType: type,
  });

  const abortIfDeadTarget = (): boolean => {
    if (!targetId) return false;
    if (!isOriginalTargetDead()) return false;
    if (hasExecutionType(execDef, 'persistent') && execDef.persistentAnchor === 'world-position') {
      runtime.disarmDamage(execution.executionId);
      labLog('persistent: alvo morto — dano interrompido');
      return false;
    }
    runtime.cancel(execution.executionId);
    labLog(`${types.join('+')}: alvo morto — execução encerrada`);
    return true;
  };

  const hitKindFor = (fallback: SkillImpactKind): SkillImpactKind => (area ? 'area' : fallback);

  const applySingle = () => {
    if (isCasterDead() || runtime.isCancelled(execution.executionId)) return;
    if (abortIfDeadTarget()) return;
    if (!runtime.tryApplyDamage(execution.executionId)) return;
    onHit(
      {
        multiplier: 1,
        kind: hitKindFor(area ? 'area' : 'single'),
        index: 0,
        radius: area ? execDef.radius : undefined,
      },
      execution,
    );
    if (instant) {
      onStatusMoment?.('on-end', execution);
    }
  };

  const startAdvancedFromEffect = () => {
    if (runtime.isCancelled(execution.executionId) || isCasterDead()) return;
    const effectAt = scene.time.now;
    execution.startedAt = effectAt;

    // Prioridade: persistent > beam > multi-hit. Area é modificador ortogonal.
    if (hasExecutionType(execDef, 'persistent')) {
      const duration = execDef.duration ?? 5000;
      const interval = execDef.tickInterval ?? 1000;
      const offsets = planTickOffsets(duration, interval);
      const perTick = tickMultiplier(execDef, offsets.length);
      execution.endsAt = effectAt + duration;
      runtime.setPhase(execution.executionId, 'persistent-active');
      const anchor = execDef.persistentAnchor ?? 'target';
      runtime.setFollow(execution.executionId, anchor === 'world-position' ? 'world' : anchor, {
        getTarget: getTargetPos,
        getCaster: () => ({ x: player.x, y: player.y }),
      });
      labLog(area ? 'Persistent Area Effect' : 'Persistent Effect');
      offsets.forEach((at, index) => {
        runtime.trackTimer(
          execution.executionId,
          scene.time.delayedCall(at, () => {
            if (runtime.isCancelled(execution.executionId) || isCasterDead()) return;
            if (abortIfDeadTarget()) return;
            if (!runtime.get(execution.executionId)?.damageArmed) return;
            const key = `tick:${index}`;
            if (!runtime.tryApplyKey(execution.executionId, key)) return;
            execution.tickCount = index + 1;
            publishLabDebug(execution, {
              status: area ? 'Persistent Area' : 'Persistent Effect',
              tick: index + 1,
              tickMax: offsets.length,
              elapsedMs: at,
              durationMs: duration,
            });
            labLog(`Persistent tick ${index + 1} / ${offsets.length}`);
            onHit(
              {
                multiplier: perTick,
                kind: hitKindFor('tick'),
                index,
                radius: area ? execDef.radius : undefined,
              },
              execution,
            );
          }),
        );
      });
      runtime.trackTimer(
        execution.executionId,
        scene.time.delayedCall(duration, () => {
          if (runtime.isCancelled(execution.executionId)) return;
          labLog('Persistent End');
          onStatusMoment?.('on-end', execution);
          runtime.finish(execution.executionId, { keepVfx: false });
        }),
      );
      return;
    }

    if (hasExecutionType(execDef, 'beam')) {
      const duration = execDef.beamDuration ?? 2000;
      const interval = execDef.tickInterval ?? 250;
      const offsets = planTickOffsets(duration, interval);
      const perTick = tickMultiplier(execDef, offsets.length);
      execution.endsAt = effectAt + duration;
      runtime.setPhase(execution.executionId, 'beam-active');
      if (execDef.trackTarget) {
        runtime.setFollow(execution.executionId, 'target', {
          getTarget: getTargetPos,
          getCaster: () => ({ x: player.x, y: player.y }),
        });
      }
      labLog(area ? 'Beam Area Active' : 'Beam Active');
      offsets.forEach((at, index) => {
        runtime.trackTimer(
          execution.executionId,
          scene.time.delayedCall(at, () => {
            if (runtime.isCancelled(execution.executionId) || isCasterDead()) return;
            if (abortIfDeadTarget()) return;
            const key = `tick:${index}`;
            if (!runtime.tryApplyKey(execution.executionId, key)) return;
            execution.tickCount = index + 1;
            labLog(`Tick ${index + 1}`);
            publishLabDebug(execution, {
              status: area ? 'Beam Area Active' : 'Beam Active',
              tick: index + 1,
              tickMax: offsets.length,
              elapsedMs: at,
              durationMs: duration,
            });
            onHit(
              {
                multiplier: perTick,
                kind: hitKindFor('tick'),
                index,
                radius: area ? execDef.radius : undefined,
              },
              execution,
            );
          }),
        );
      });
      runtime.trackTimer(
        execution.executionId,
        scene.time.delayedCall(duration, () => {
          if (runtime.isCancelled(execution.executionId)) return;
          labLog('Beam End');
          onStatusMoment?.('on-end', execution);
          runtime.finish(execution.executionId, { keepVfx: false });
        }),
      );
      return;
    }

    if (hasExecutionType(execDef, 'multi-hit')) {
      const hits = normalizeHits(execDef.hits);
      publishLabDebug(execution, {
        status: area ? 'multi-hit area' : 'multi-hit',
        hitMax: hits.length,
        durationMs: hits.at(-1)?.delay ?? 0,
      });
      hits.forEach((hit, index) => {
        runtime.trackTimer(
          execution.executionId,
          scene.time.delayedCall(hit.delay, () => {
            if (runtime.isCancelled(execution.executionId) || isCasterDead()) return;
            if (abortIfDeadTarget()) return;
            const key = `hit:${index}`;
            if (!runtime.tryApplyKey(execution.executionId, key)) return;
            execution.currentHit = index + 1;
            const elapsed = Math.round(scene.time.now - effectAt);
            labLog(`Hit ${index + 1} fired @ ${elapsed}ms`);
            publishLabDebug(execution, {
              status: `Hit ${index + 1} / ${hits.length}`,
              currentHit: index + 1,
              hitMax: hits.length,
              elapsedMs: elapsed,
              durationMs: hits.at(-1)?.delay ?? 0,
            });
            onHit(
              {
                multiplier: hit.damageMultiplier,
                kind: hitKindFor('hit'),
                index,
                radius: area ? execDef.radius : undefined,
              },
              execution,
            );
            if (index === hits.length - 1) {
              onStatusMoment?.('on-end', execution);
              runtime.finish(execution.executionId, { keepVfx: true });
            }
          }),
        );
      });
      return;
    }

    if (area) {
      applySingle();
    }
  };

  const trigger = resolveSkillDamageTrigger(anim);
  const hasFx = Boolean(anim?.fx);
  const officialDelay = officialVfxStartDelayMs(anim);
  const hooks: SkillFxHooks = {
    persist: persistVfx,
    onSpawn: (sprite) => {
      runtime.trackSprite(execution.executionId, sprite);
    },
  };

  if (instant) {
    if (hasFx && trigger === 'on-effect-start') hooks.onEffectStart = applySingle;
    if (hasFx && trigger === 'on-arrival') hooks.onArrival = applySingle;
  } else {
    hooks.onEffectStart = startAdvancedFromEffect;
  }

  const userEffectStart = hooks.onEffectStart;
  hooks.onEffectStart = () => {
    logVfxLifecycle('effect start', { skillId: skill.id });
    userEffectStart?.();
  };
  const userArrival = hooks.onArrival;
  if (userArrival) {
    hooks.onArrival = () => {
      logVfxLifecycle('arrival', { skillId: skill.id });
      userArrival();
    };
  }

  const startFx = () => {
    if (runtime.isCancelled(execution.executionId)) {
      logVfxLifecycle('spawn failed', { reason: 'execution cancelled before spawn', skillId: skill.id });
      return;
    }
    if (isCasterDead()) return;
    runtime.setPhase(execution.executionId, 'effect');
    onStatusMoment?.('on-start', execution);
    if (!anim) {
      if (!instant) startAdvancedFromEffect();
      return;
    }
    const playback = officialDelay != null ? playbackAnimForOfficialVfx(anim) : anim;
    scheduleSkillFx(
      scene,
      player,
      playback,
      officialDelay != null ? 0 : hitDelayMs,
      from,
      to,
      aim,
      hooks,
    );
    if (!instant && !hasFx) startAdvancedFromEffect();
  };

  if (officialDelay != null && officialDelay > 0) {
    runtime.setPhase(execution.executionId, 'cast');
    runtime.trackTimer(execution.executionId, scene.time.delayedCall(officialDelay, startFx));
  } else if (anim) {
    startFx();
  } else if (!instant) {
    onStatusMoment?.('on-start', execution);
    startAdvancedFromEffect();
  } else {
    onStatusMoment?.('on-start', execution);
  }

  const needsLegacyTimer = instant && (!hasFx || trigger === 'hit-delay');
  if (needsLegacyTimer) {
    runtime.trackTimer(execution.executionId, scene.time.delayedCall(hitDelayMs, applySingle));
  }

  if (instant) {
    const lockMs = skillActionLockMs(anim);
    runtime.trackTimer(
      execution.executionId,
      scene.time.delayedCall(lockMs, () => {
        if (runtime.isCancelled(execution.executionId)) return;
        runtime.finish(execution.executionId, { keepVfx: true });
      }),
    );
  }

  return execution;
}
