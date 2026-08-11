/**
 * Client session persistence (mock idle game — not auth).
 *
 * Storage key: `idle-mmorpg:session-v1`
 * Clear: `localStorage.removeItem('idle-mmorpg:session-v1')` or `clearPersistedSession()`.
 *
 * Restores nickname, starter pack, mode/map/hunt, team collection, vitals, clan.
 */

import { STARTERS } from '@/data/starters';
import { xpRequiredForLevel } from '@/data/xp-stages';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';
import { accountStore } from '@/stores/account-store';
import { attributesStore } from '@/stores/attributes-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { CharacterClanId } from '@/types/character-meta';
import type { PlayerCreation, StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter } from '@/types/team';
import { isCharacterClanId, normalizeSealedCharacter } from '@/utils/character-identity';

/** localStorage key — manter id estável; version interna migra schema. */
export const SESSION_STORAGE_KEY = 'idle-mmorpg:session-v1';

/** Schema atual (v2: quality/stars/clan + account clan). */
const SESSION_VERSION = 2 as const;
const LEGACY_SESSION_VERSIONS = new Set([1, 2]);
const SAVE_DEBOUNCE_MS = 250;

const STARTER_IDS = new Set<string>(STARTERS.map((entry) => entry.id));
const MAP_KEY_SET = new Set<string>(Object.values(MAP_KEYS));

export interface PersistedLocation {
  mode: GameMode;
  mapKey: MapKey;
  huntId: string | null;
}

export interface PersistedTeam {
  collection: SealedCharacter[];
  teamIds: string[];
  activeId: string | null;
}

export interface PersistedVitals {
  level: number;
  xp: number;
}

export interface PersistedAccount {
  clanId: CharacterClanId | null;
}

export interface PersistedSession {
  version: typeof SESSION_VERSION;
  player: PlayerCreation;
  location: PersistedLocation;
  team: PersistedTeam;
  vitals: PersistedVitals;
  account: PersistedAccount;
}

let trackedPlayer: PlayerCreation | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubAutoSave: (() => void) | null = null;

function isStarterId(value: unknown): value is StarterCharacterId {
  return typeof value === 'string' && STARTER_IDS.has(value);
}

function isMapKey(value: unknown): value is MapKey {
  return typeof value === 'string' && MAP_KEY_SET.has(value);
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'hub' || value === 'combat';
}

/**
 * Parses and validates raw localStorage JSON.
 * Invalid/missing starter pack → null (caller shows new-game screen).
 */
export function parsePersistedSession(raw: unknown): PersistedSession | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.version !== 'number' || !LEGACY_SESSION_VERSIONS.has(data.version)) {
    return null;
  }

  const playerRaw = data.player as Record<string, unknown> | undefined;
  if (!playerRaw) return null;

  const nickname = typeof playerRaw.nickname === 'string' ? playerRaw.nickname.trim() : '';
  if (nickname.length < 2) return null;
  if (!isStarterId(playerRaw.starterCharacterId)) return null;
  if (typeof playerRaw.villageId !== 'string' || !playerRaw.villageId) return null;

  const locRaw = data.location as Record<string, unknown> | undefined;
  let mode: GameMode = 'hub';
  let mapKey: MapKey = MAP_KEYS.leafVillage;
  let huntId: string | null = null;

  if (locRaw) {
    if (isGameMode(locRaw.mode)) mode = locRaw.mode;
    if (isMapKey(locRaw.mapKey)) mapKey = locRaw.mapKey;
    if (typeof locRaw.huntId === 'string' && locRaw.huntId) huntId = locRaw.huntId;
    if (locRaw.huntId === null) huntId = null;
  }

  if (mode === 'combat' && !isMapKey(mapKey)) {
    mode = 'hub';
    mapKey = MAP_KEYS.leafVillage;
    huntId = null;
  }
  if (mode === 'hub') {
    mapKey = MAP_KEYS.leafVillage;
    huntId = null;
  }

  const teamRaw = data.team as Record<string, unknown> | undefined;
  const collection = Array.isArray(teamRaw?.collection)
    ? teamRaw.collection
        .map((entry) => normalizeSealedCharacter(entry))
        .filter((entry): entry is SealedCharacter => entry != null)
    : [];
  const teamIds = Array.isArray(teamRaw?.teamIds)
    ? teamRaw.teamIds.filter((id): id is string => typeof id === 'string')
    : [];
  const activeId =
    typeof teamRaw?.activeId === 'string' || teamRaw?.activeId === null
      ? (teamRaw.activeId as string | null)
      : null;

  const vitalsRaw = data.vitals as Record<string, unknown> | undefined;
  const level =
    typeof vitalsRaw?.level === 'number' && Number.isFinite(vitalsRaw.level)
      ? Math.max(1, Math.floor(vitalsRaw.level))
      : 1;
  const xp =
    typeof vitalsRaw?.xp === 'number' && Number.isFinite(vitalsRaw.xp)
      ? Math.max(0, Math.floor(vitalsRaw.xp))
      : 0;

  const accountRaw = data.account as Record<string, unknown> | undefined;
  const clanId =
    accountRaw && isCharacterClanId(accountRaw.clanId) ? accountRaw.clanId : null;

  return {
    version: SESSION_VERSION,
    player: {
      nickname,
      villageId: playerRaw.villageId as PlayerCreation['villageId'],
      starterCharacterId: playerRaw.starterCharacterId,
    },
    location: { mode, mapKey, huntId },
    team: { collection, teamIds, activeId },
    vitals: { level, xp },
    account: { clanId },
  };
}

export function loadPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return parsePersistedSession(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function stopAutoSave(): void {
  if (unsubAutoSave) {
    unsubAutoSave();
    unsubAutoSave = null;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function ensureAutoSave(): void {
  if (unsubAutoSave || typeof window === 'undefined') return;
  const unsubs = [
    locationStore.subscribe(scheduleSessionSave),
    teamStore.subscribe(scheduleSessionSave),
    vitalsStore.subscribe(scheduleSessionSave),
    accountStore.subscribe(scheduleSessionSave),
  ];
  unsubAutoSave = () => {
    for (const unsub of unsubs) unsub();
  };
}

export function clearPersistedSession(): void {
  trackedPlayer = null;
  stopAutoSave();
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function snapshotTeam(): PersistedTeam {
  const state = teamStore.getSnapshot();
  return {
    collection: state.collection.map((entry) => ({ ...entry })),
    teamIds: [...state.teamIds],
    activeId: state.activeId,
  };
}

function snapshotVitals(): PersistedVitals {
  const { level, xp } = vitalsStore.getSnapshot();
  return { level, xp };
}

function snapshotLocation(): PersistedLocation {
  const { mode, mapKey, huntId } = locationStore.getSnapshot();
  return { mode, mapKey, huntId };
}

function snapshotAccount(): PersistedAccount {
  return { clanId: accountStore.getClanId() };
}

export function savePersistedSession(): void {
  if (typeof window === 'undefined' || !trackedPlayer) return;

  const session: PersistedSession = {
    version: SESSION_VERSION,
    player: { ...trackedPlayer },
    location: snapshotLocation(),
    team: snapshotTeam(),
    vitals: snapshotVitals(),
    account: snapshotAccount(),
  };

  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function scheduleSessionSave(): void {
  if (!trackedPlayer) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    savePersistedSession();
  }, SAVE_DEBOUNCE_MS);
}

export function trackSession(player: PlayerCreation): void {
  trackedPlayer = {
    nickname: player.nickname.trim(),
    villageId: player.villageId,
    starterCharacterId: player.starterCharacterId,
  };
  ensureAutoSave();
  savePersistedSession();
}

export function applyPersistedSession(session: PersistedSession): PlayerCreation {
  const player = session.player;

  villageStore.reset();
  villageStore.joinVillage(player.villageId, player.nickname);
  accountStore.hydrate(session.account ?? { clanId: null });

  const teamOk = teamStore.hydrate(session.team);
  if (!teamOk) {
    teamStore.reset(player.starterCharacterId);
  }

  const active = teamStore.getActive();
  if (active?.starterId) {
    skillsStore.reset(active.starterId);
  } else {
    skillsStore.reset(player.starterCharacterId);
  }

  const { level, xp } = session.vitals;
  const xpMax = xpRequiredForLevel(level);
  vitalsStore.reset({
    level,
    xp: Math.min(xp, Math.max(0, xpMax - 1)),
    xpMax,
    hp: 100,
    hpMax: 100,
  });

  inventoryStore.reset();
  attributesStore.onLevelChanged(true);

  locationStore.hydrate(session.location);

  trackSession(player);
  return player;
}
