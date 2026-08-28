import { isDevMode } from '@/config/devConfig';
import {
  JOURNEY_START_ID,
  getMissionDefinition,
  listDailyMissionPool,
  listWeeklyMissionPool,
} from '@/data/missions/mission-registry';
import { enqueueMissionCompleteToast } from '@/lib/game-toast';
import { getDailyCycleId, getWeeklyCycleId, missionNow } from '@/lib/mission-cycle';
import {
  evaluateStateCondition,
  isEventMissionCondition,
  isStateMissionCondition,
  missionTarget,
} from '@/lib/mission-evaluation';
import { grantMissionRewards } from '@/lib/mission-rewards';
import { selectCycleMissions } from '@/lib/mission-select';
import { buildMissionWorldSnapshot } from '@/lib/mission-snapshot';
import { createStore } from '@/stores/create-store';
import type {
  MissionCycleBucket,
  MissionDefinition,
  MissionEntryState,
  MissionProgressSource,
  MissionsProgressState,
  MissionType,
  MissionUiStatus,
} from '@/types/missions';
import { DEFAULT_MISSIONS_PROGRESS } from '@/types/missions';

export type MissionsPanelTab = 'daily' | 'weekly' | 'journey';

interface MissionsStoreState extends MissionsProgressState {
  isOpen: boolean;
  panelTab: MissionsPanelTab;
}

const claimInFlight = new Set<string>();

const store = createStore<MissionsStoreState>({
  ...DEFAULT_MISSIONS_PROGRESS,
  daily: { cycleId: '', selectedIds: [], missions: {} },
  weekly: { cycleId: '', selectedIds: [], missions: {} },
  journey: { currentId: null, missions: {} },
  isOpen: false,
  panelTab: 'daily',
});

function emptyEntry(): MissionEntryState {
  return { progress: 0, completed: false, claimed: false };
}

function cloneEntry(entry: MissionEntryState | undefined): MissionEntryState {
  if (!entry) return emptyEntry();
  return {
    progress: entry.progress,
    completed: entry.completed,
    claimed: entry.claimed,
    uniqueKeys: entry.uniqueKeys ? { ...entry.uniqueKeys } : undefined,
  };
}

function cloneBucket(bucket: MissionCycleBucket): MissionCycleBucket {
  const missions: Record<string, MissionEntryState> = {};
  for (const [id, entry] of Object.entries(bucket.missions)) {
    missions[id] = cloneEntry(entry);
  }
  return { cycleId: bucket.cycleId, selectedIds: [...bucket.selectedIds], missions };
}

function cloneProgress(state: MissionsProgressState): MissionsProgressState {
  const journeyMissions: Record<string, MissionEntryState> = {};
  for (const [id, entry] of Object.entries(state.journey.missions)) {
    journeyMissions[id] = cloneEntry(entry);
  }
  return {
    daily: cloneBucket(state.daily),
    weekly: cloneBucket(state.weekly),
    journey: { currentId: state.journey.currentId, missions: journeyMissions },
  };
}

function parseBucket(raw: unknown): MissionCycleBucket {
  if (!raw || typeof raw !== 'object') return { cycleId: '', selectedIds: [], missions: {} };
  const data = raw as Record<string, unknown>;
  const missions: Record<string, MissionEntryState> = {};
  if (data.missions && typeof data.missions === 'object') {
    for (const [id, value] of Object.entries(data.missions as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      const uniqueKeys: Record<string, true> = {};
      if (row.uniqueKeys && typeof row.uniqueKeys === 'object') {
        for (const [key, flag] of Object.entries(row.uniqueKeys as Record<string, unknown>)) {
          if (flag) uniqueKeys[key] = true;
        }
      }
      missions[id] = {
        progress: typeof row.progress === 'number' ? Math.max(0, row.progress) : 0,
        completed: Boolean(row.completed),
        claimed: Boolean(row.claimed),
        uniqueKeys: Object.keys(uniqueKeys).length ? uniqueKeys : undefined,
      };
    }
  }
  const selectedIds = Array.isArray(data.selectedIds)
    ? data.selectedIds.filter((id): id is string => typeof id === 'string')
    : Object.keys(missions);
  return {
    cycleId: typeof data.cycleId === 'string' ? data.cycleId : '',
    selectedIds,
    missions,
  };
}

function shouldIgnoreSource(source: MissionProgressSource): boolean {
  if (source === 'dev' || source === 'offline' || source === 'mission-reward') return true;
  return false;
}

function markCompleted(
  entry: MissionEntryState,
  def: MissionDefinition,
  silent: boolean,
): MissionEntryState {
  if (entry.completed) return entry;
  const next = { ...entry, progress: missionTarget(def.condition), completed: true };
  if (!silent) enqueueMissionCompleteToast(def.id, def.name);
  return next;
}

function syncStateEntry(def: MissionDefinition, entry: MissionEntryState, silent: boolean): MissionEntryState {
  if (entry.claimed || entry.completed) return entry;
  if (!isStateMissionCondition(def.condition.type)) return entry;
  const evaled = evaluateStateCondition(def.condition, buildMissionWorldSnapshot());
  const progress = Math.min(evaled.required, evaled.current);
  if (evaled.completed) {
    return markCompleted({ ...entry, progress }, def, silent);
  }
  return { ...entry, progress };
}

function generateBucket(
  type: 'daily' | 'weekly',
  cycleId: string,
): MissionCycleBucket {
  const pool = type === 'daily' ? listDailyMissionPool() : listWeeklyMissionPool();
  const selectedIds = selectCycleMissions(pool, `${type}:${cycleId}`, 5);
  const missions: Record<string, MissionEntryState> = {};
  for (const id of selectedIds) {
    const def = getMissionDefinition(id);
    if (!def) continue;
    missions[id] = syncStateEntry(def, emptyEntry(), true);
  }
  return { cycleId, selectedIds, missions };
}

/**
 * Missões da conta (Item 24). Independente de questStore (NPC) e achievementsStore.
 */
export const missionsStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  setOpen(open: boolean): void {
    this.ensureCycles();
    store.setState({ ...store.getSnapshot(), isOpen: open });
  },

  toggleOpen(): void {
    this.ensureCycles();
    const state = store.getSnapshot();
    store.setState({ ...state, isOpen: !state.isOpen });
  },

  setPanelTab(tab: MissionsPanelTab): void {
    store.setState({ ...store.getSnapshot(), panelTab: tab });
  },

  reset(): void {
    const ui = store.getSnapshot();
    store.setState({
      daily: { cycleId: '', selectedIds: [], missions: {} },
      weekly: { cycleId: '', selectedIds: [], missions: {} },
      journey: { currentId: null, missions: {} },
      isOpen: false,
      panelTab: ui.panelTab,
    });
  },

  hydrate(partial: Partial<MissionsProgressState> | null | undefined): void {
    const ui = store.getSnapshot();
    if (!partial) {
      this.reset();
      return;
    }
    const journeyRaw = partial.journey;
    store.setState({
      daily: parseBucket(partial.daily),
      weekly: parseBucket(partial.weekly),
      journey: {
        currentId:
          journeyRaw && typeof journeyRaw.currentId === 'string' ? journeyRaw.currentId : null,
        missions: parseBucket({ missions: journeyRaw?.missions ?? {} }).missions,
      },
      isOpen: ui.isOpen,
      panelTab: ui.panelTab,
    });
  },

  getPersistedProgress(): MissionsProgressState {
    return cloneProgress(store.getSnapshot());
  },

  ensureCycles(nowMs = missionNow()): void {
    const state = store.getSnapshot();
    const dailyId = getDailyCycleId(nowMs);
    const weeklyId = getWeeklyCycleId(nowMs);
    const next = cloneProgress(state);
    let changed = false;

    if (next.daily.cycleId !== dailyId) {
      next.daily = generateBucket('daily', dailyId);
      changed = true;
    }
    if (next.weekly.cycleId !== weeklyId) {
      next.weekly = generateBucket('weekly', weeklyId);
      changed = true;
    }
    if (!next.journey.currentId) {
      next.journey.currentId = JOURNEY_START_ID;
      changed = true;
    }
    const currentId = next.journey.currentId;
    if (currentId && !next.journey.missions[currentId]) {
      next.journey.missions[currentId] = emptyEntry();
      changed = true;
    }
    if (currentId) {
      const def = getMissionDefinition(currentId);
      if (def) {
        const synced = syncStateEntry(def, next.journey.missions[currentId], true);
        if (
          synced.progress !== next.journey.missions[currentId].progress ||
          synced.completed !== next.journey.missions[currentId].completed
        ) {
          next.journey.missions[currentId] = synced;
          changed = true;
        }
      }
    }

    if (changed) {
      store.setState({ ...store.getSnapshot(), ...next });
    }
  },

  syncStateMissions(options?: { silent?: boolean }): void {
    this.ensureCycles();
    const state = store.getSnapshot();
    const next = cloneProgress(state);
    let changed = false;
    const silent = options?.silent ?? false;

    const syncBucket = (bucket: MissionCycleBucket) => {
      for (const id of bucket.selectedIds) {
        const def = getMissionDefinition(id);
        if (!def) continue;
        const synced = syncStateEntry(def, bucket.missions[id] ?? emptyEntry(), silent);
        bucket.missions[id] = synced;
      }
    };
    syncBucket(next.daily);
    syncBucket(next.weekly);

    const journeyId = next.journey.currentId;
    if (journeyId) {
      const def = getMissionDefinition(journeyId);
      if (def) {
        next.journey.missions[journeyId] = syncStateEntry(
          def,
          next.journey.missions[journeyId] ?? emptyEntry(),
          silent,
        );
      }
    }

    const before = JSON.stringify(cloneProgress(state));
    const after = JSON.stringify(next);
    if (before !== after) {
      changed = true;
    }
    if (changed) store.setState({ ...store.getSnapshot(), ...next });
  },

  getStatus(id: string): MissionUiStatus {
    const entry = this.getEntry(id);
    if (!entry) return 'active';
    if (entry.claimed) return 'claimed';
    if (entry.completed) return 'completed';
    return 'active';
  },

  getEntry(id: string): MissionEntryState | null {
    const state = store.getSnapshot();
    return (
      state.daily.missions[id] ??
      state.weekly.missions[id] ??
      state.journey.missions[id] ??
      null
    );
  },

  getProgressDisplay(id: string): { current: number; required: number } {
    const def = getMissionDefinition(id);
    if (!def) return { current: 0, required: 1 };
    const required = missionTarget(def.condition);
    const entry = this.getEntry(id);
    if (isStateMissionCondition(def.condition.type)) {
      const evaled = evaluateStateCondition(def.condition, buildMissionWorldSnapshot());
      return { current: Math.min(required, evaled.current), required };
    }
    return { current: Math.min(required, entry?.progress ?? 0), required };
  },

  claimableCount(): number {
    const state = store.getSnapshot();
    let count = 0;
    for (const id of state.daily.selectedIds) {
      const entry = state.daily.missions[id];
      if (entry?.completed && !entry.claimed) count += 1;
    }
    for (const id of state.weekly.selectedIds) {
      const entry = state.weekly.missions[id];
      if (entry?.completed && !entry.claimed) count += 1;
    }
    const jid = state.journey.currentId;
    if (jid) {
      const entry = state.journey.missions[jid];
      if (entry?.completed && !entry.claimed) count += 1;
    }
    return count;
  },

  applyGameplayEvent(
    event: {
      kind:
        | 'onlineKill'
        | 'capture'
        | 'combatDrop'
        | 'combatCopper'
        | 'potion'
        | 'revive'
        | 'masteryXp'
        | 'bossDefeated';
      amount?: number;
      huntId?: string | null;
      enemyId?: string;
      lineageCompatible?: boolean;
      itemId?: string;
    },
    source: MissionProgressSource = 'gameplay',
  ): void {
    if (shouldIgnoreSource(source)) return;
    this.ensureCycles();
    const amount = Math.max(0, Math.floor(event.amount ?? 1));
    if (amount <= 0 && event.kind !== 'onlineKill') return;

    const state = store.getSnapshot();
    const next = cloneProgress(state);
    const defs: Array<{ def: MissionDefinition; loc: 'daily' | 'weekly' | 'journey' }> = [];

    for (const id of next.daily.selectedIds) {
      const def = getMissionDefinition(id);
      if (def) defs.push({ def, loc: 'daily' });
    }
    for (const id of next.weekly.selectedIds) {
      const def = getMissionDefinition(id);
      if (def) defs.push({ def, loc: 'weekly' });
    }
    if (next.journey.currentId) {
      const def = getMissionDefinition(next.journey.currentId);
      if (def) defs.push({ def, loc: 'journey' });
    }

    let changed = false;
    for (const { def, loc } of defs) {
      if (!isEventMissionCondition(def.condition.type)) continue;
      const bucketMissions =
        loc === 'journey' ? next.journey.missions : loc === 'daily' ? next.daily.missions : next.weekly.missions;
      const entry = cloneEntry(bucketMissions[def.id]);
      if (entry.completed || entry.claimed) continue;
      if (def.condition.type === 'uniqueEnemiesKilled' && event.enemyId && entry.uniqueKeys?.[event.enemyId]) {
        continue;
      }
      const delta = eventDelta(def, event, amount);
      if (delta <= 0) continue;
      const required = missionTarget(def.condition);
      entry.progress = Math.min(required, entry.progress + delta);
      if (def.condition.type === 'uniqueEnemiesKilled' && event.enemyId) {
        entry.uniqueKeys = { ...(entry.uniqueKeys ?? {}), [event.enemyId]: true };
        entry.progress = Math.min(required, Object.keys(entry.uniqueKeys).length);
      }
      if (entry.progress >= required) {
        bucketMissions[def.id] = markCompleted(entry, def, false);
      } else {
        bucketMissions[def.id] = entry;
      }
      changed = true;
    }

    if (changed) store.setState({ ...store.getSnapshot(), ...next });
  },

  claim(missionId: string): { ok: boolean; reason?: string } {
    if (claimInFlight.has(missionId)) return { ok: false, reason: 'Resgate em andamento' };
    const def = getMissionDefinition(missionId);
    if (!def) return { ok: false, reason: 'Missão inexistente' };

    claimInFlight.add(missionId);
    try {
      this.ensureCycles();
      this.syncStateMissions({ silent: true });
      const state = store.getSnapshot();
      const loc = locateMission(state, def);
      if (!loc) return { ok: false, reason: 'Missão fora do ciclo atual' };
      if (def.type === 'journey' && state.journey.currentId !== missionId) {
        return { ok: false, reason: 'Não é a etapa atual da Jornada' };
      }
      const entry = cloneEntry(loc.entry);
      if (entry.claimed) return { ok: false, reason: 'Já resgatada' };
      if (!entry.completed) return { ok: false, reason: 'Ainda ativa' };

      const cycleId =
        def.type === 'daily'
          ? state.daily.cycleId
          : def.type === 'weekly'
            ? state.weekly.cycleId
            : 'journey';

      const grant = grantMissionRewards(def.rewards, {
        cycleId,
        missionId,
      });
      if (!grant.ok) {
        return { ok: false, reason: grant.reason };
      }

      entry.claimed = true;
      const next = cloneProgress(store.getSnapshot());
      writeEntry(next, def, entry);
      store.setState({ ...store.getSnapshot(), ...next });

      if (def.type === 'journey' && def.nextMissionId) {
        const after = cloneProgress(store.getSnapshot());
        after.journey.currentId = def.nextMissionId;
        after.journey.missions[def.nextMissionId] = syncStateEntry(
          getMissionDefinition(def.nextMissionId) ?? def,
          after.journey.missions[def.nextMissionId] ?? emptyEntry(),
          false,
        );
        store.setState({ ...store.getSnapshot(), ...after });
      }
      return { ok: true };
    } finally {
      claimInFlight.delete(missionId);
    }
  },

  claimAll(group?: MissionType): { claimed: string[]; failed: string[] } {
    this.ensureCycles();
    this.syncStateMissions({ silent: true });
    const claimed: string[] = [];
    const failed: string[] = [];
    const ids = listClaimableIds(store.getSnapshot(), group);
    for (const id of ids) {
      const result = this.claim(id);
      if (result.ok) claimed.push(id);
      else failed.push(id);
    }
    return { claimed, failed };
  },

  // —— DEV ——
  devRegenerateDaily(): void {
    if (!isDevMode()) return;
    const cycleId = getDailyCycleId();
    const daily = generateBucket('daily', `${cycleId}:dev`);
    daily.cycleId = cycleId;
    store.setState({ ...store.getSnapshot(), daily });
  },

  devRegenerateWeekly(): void {
    if (!isDevMode()) return;
    const cycleId = getWeeklyCycleId();
    const weekly = generateBucket('weekly', `${cycleId}:dev`);
    weekly.cycleId = cycleId;
    store.setState({ ...store.getSnapshot(), weekly });
  },

  devComplete(missionId: string): void {
    if (!isDevMode()) return;
    const def = getMissionDefinition(missionId);
    if (!def) return;
    this.ensureCycles();
    const next = cloneProgress(store.getSnapshot());
    const entry = cloneEntry(this.getEntry(missionId) ?? emptyEntry());
    entry.progress = missionTarget(def.condition);
    entry.completed = true;
    writeEntry(next, def, entry);
    store.setState({ ...store.getSnapshot(), ...next });
  },

  devResetMission(missionId: string): void {
    if (!isDevMode()) return;
    const def = getMissionDefinition(missionId);
    if (!def) return;
    const next = cloneProgress(store.getSnapshot());
    writeEntry(next, def, emptyEntry());
    store.setState({ ...store.getSnapshot(), ...next });
  },

  devSetProgress(missionId: string, progress: number): void {
    if (!isDevMode()) return;
    const def = getMissionDefinition(missionId);
    if (!def) return;
    const required = missionTarget(def.condition);
    const next = cloneProgress(store.getSnapshot());
    const entry = cloneEntry(this.getEntry(missionId) ?? emptyEntry());
    entry.progress = Math.max(0, Math.min(required, Math.floor(progress)));
    entry.completed = false;
    entry.claimed = false;
    writeEntry(next, def, entry);
    store.setState({ ...store.getSnapshot(), ...next });
  },

  devAdvanceJourney(): void {
    if (!isDevMode()) return;
    this.ensureCycles();
    const currentId = store.getSnapshot().journey.currentId;
    if (!currentId) return;
    const def = getMissionDefinition(currentId);
    if (!def?.nextMissionId) return;
    const next = cloneProgress(store.getSnapshot());
    next.journey.currentId = def.nextMissionId;
    next.journey.missions[def.nextMissionId] = syncStateEntry(
      getMissionDefinition(def.nextMissionId) ?? def,
      next.journey.missions[def.nextMissionId] ?? emptyEntry(),
      true,
    );
    store.setState({ ...store.getSnapshot(), ...next });
  },

  devResetJourney(): void {
    if (!isDevMode()) return;
    store.setState({
      ...store.getSnapshot(),
      journey: { currentId: JOURNEY_START_ID, missions: { [JOURNEY_START_ID]: emptyEntry() } },
    });
    this.syncStateMissions({ silent: true });
  },
};

function locateMission(
  state: MissionsProgressState,
  def: MissionDefinition,
): { entry: MissionEntryState } | null {
  if (def.type === 'daily') {
    if (state.daily.selectedIds.includes(def.id) && state.daily.missions[def.id]) {
      return { entry: state.daily.missions[def.id] };
    }
    return null;
  }
  if (def.type === 'weekly') {
    if (state.weekly.selectedIds.includes(def.id) && state.weekly.missions[def.id]) {
      return { entry: state.weekly.missions[def.id] };
    }
    return null;
  }
  if (state.journey.missions[def.id]) return { entry: state.journey.missions[def.id] };
  return null;
}

function writeEntry(
  state: MissionsProgressState,
  def: MissionDefinition,
  entry: MissionEntryState,
): void {
  if (def.type === 'daily') state.daily.missions[def.id] = entry;
  else if (def.type === 'weekly') state.weekly.missions[def.id] = entry;
  else state.journey.missions[def.id] = entry;
}

function listClaimableIds(state: MissionsProgressState, group?: MissionType): string[] {
  const ids: string[] = [];
  if (!group || group === 'daily') {
    for (const id of state.daily.selectedIds) {
      const entry = state.daily.missions[id];
      if (entry?.completed && !entry.claimed) ids.push(id);
    }
  }
  if (!group || group === 'weekly') {
    for (const id of state.weekly.selectedIds) {
      const entry = state.weekly.missions[id];
      if (entry?.completed && !entry.claimed) ids.push(id);
    }
  }
  if (!group || group === 'journey') {
    const id = state.journey.currentId;
    if (id) {
      const entry = state.journey.missions[id];
      if (entry?.completed && !entry.claimed) ids.push(id);
    }
  }
  return ids;
}

function eventDelta(
  def: MissionDefinition,
  event: {
    kind: string;
    huntId?: string | null;
    enemyId?: string;
    lineageCompatible?: boolean;
    itemId?: string;
  },
  amount: number,
): number {
  const c = def.condition;
  switch (c.type) {
    case 'onlineKills':
      return event.kind === 'onlineKill' ? 1 : 0;
    case 'onlineKillsInHunt':
      return event.kind === 'onlineKill' && event.huntId === c.huntId ? 1 : 0;
    case 'lineageCompatibleKills':
      return event.kind === 'onlineKill' && event.lineageCompatible ? 1 : 0;
    case 'uniqueEnemiesKilled':
      return event.kind === 'onlineKill' && event.enemyId ? 1 : 0;
    case 'charactersCaptured':
      return event.kind === 'capture' ? 1 : 0;
    case 'itemsDropped':
      return event.kind === 'combatDrop' ? amount : 0;
    case 'specificItemDropped':
      return event.kind === 'combatDrop' && event.itemId === c.itemId ? amount : 0;
    case 'copperEarnedFromCombat':
      return event.kind === 'combatCopper' ? amount : 0;
    case 'potionsUsed':
      return event.kind === 'potion' ? amount : 0;
    case 'revivesUsed':
      return event.kind === 'revive' ? amount : 0;
    case 'masteryXpGained':
      return event.kind === 'masteryXp' ? amount : 0;
    case 'bossDefeated':
      return event.kind === 'bossDefeated' ? 1 : 0;
    default:
      return 0;
  }
}
