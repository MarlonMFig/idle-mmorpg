import {
  shouldFreezeOfficialProgress,
  OFFICIAL_SESSION_STORAGE_KEY,
  DEV_SESSION_STORAGE_KEY,
} from '@/config/devConfig';
import { isSocialBackendActive } from '@/config/social-backend';
import { STARTERS } from '@/data/starters';
import { addExperience } from '@/lib/player-progression';
import { decimalToSave, decimalFromSave } from '@/lib/decimal-persist';
import { d } from '@/lib/decimal';
import { MAP_KEYS, type MapKey } from '@/maps/map-registry';
import { accountStore } from '@/stores/account-store';
import { achievementsStore } from '@/stores/achievements-store';
import { missionsStore } from '@/stores/missions-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { bossStore } from '@/stores/boss-store';
import { attributesStore } from '@/stores/attributes-store';
import { gemStore } from '@/stores/gem-store';
import { guildStore } from '@/stores/guild-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore, type GameMode } from '@/stores/location-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { teamPresetStore } from '@/stores/team-preset-store';
import { villageStore } from '@/stores/village-store';
import { shopStore, type ShopPurchaseBucket } from '@/stores/shop-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { AchievementProgressState } from '@/types/achievements';
import {
  mergeLegacyGemAchievements,
  hasPendingLegacyAchievementClaims,
} from '@/lib/achievement-legacy-migration';
import type { MissionsProgressState } from '@/types/missions';
import type { DailyLoginState } from '@/types/daily-login';
import type { BossProgressState } from '@/types/boss';
import type { LineageId } from '@/types/character-meta';
import type { PlayerCreation, StarterCharacterId } from '@/types/player-creation';
import type { SealedCharacter } from '@/types/team';
import type { PersistedTeamPresets } from '@/types/team-preset';
import { isLineageId, normalizeSealedCharacter } from '@/utils/character-identity';
import { parsePersistedTeamPresets } from '@/lib/team-preset';
import {
  migrateLegacyPlayerLineageId,
  normalizePlayerLineageProgress,
} from '@/lib/lineage-progress';
import { parsePersistedInventory, type PersistedInventory } from '@/lib/inventory-persist';
import { rewardIdempotency } from '@/lib/reward-service';
import { setSessionSaveFlusher } from '@/lib/session-save-flush';
import { DEFAULT_PLAYER_LINEAGE_PROGRESS, type PlayerLineageProgress } from '@/types/lineage';
import { heritageStore } from '@/stores/heritage-store';
import type { HeritageLoadout } from '@/types/heritage';
import {
  beginOfficialProgressFreeze,
  clearOfficialProgressFreeze,
  getFrozenOfficialAccount,
  getFrozenOfficialAchievements,
  getFrozenOfficialDailyLogin,
  getFrozenOfficialGems,
  getFrozenOfficialInventory,
  getFrozenOfficialMissions,
  getFrozenOfficialTeam,
  getFrozenOfficialTeamPresets,
  getFrozenOfficialVitals,
  hasOfficialProgressFreeze,
  restoreOfficialProgressFromFreeze,
} from '@/lib/official-progress-freeze';

export {
  beginOfficialProgressFreeze,
  clearOfficialProgressFreeze,
  restoreOfficialProgressFromFreeze,
} from '@/lib/official-progress-freeze';

/**
 * Client session persistence (mock idle game — not auth).
 *
 * Official: `idle-mmorpg:session-v1`
 * Dev isolated: `idle-mmorpg:session-dev-v1` (nunca no boot oficial)
 * Clear official: `localStorage.removeItem('idle-mmorpg:session-v1')`
 */

/** localStorage key oficial — manter id estável; version interna migra schema. */
export const SESSION_STORAGE_KEY = OFFICIAL_SESSION_STORAGE_KEY;
const ACCOUNT_SESSION_PREFIX = `${SESSION_STORAGE_KEY}:user:`;
let sessionOwnerKey: string | null = null;
let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Define o dono do save antes do hydrate. O save legado é migrado uma única vez
 * para a conta autenticada, sem apagar o conteúdo.
 */
export function setSessionOwner(authUserId: string): void {
  const normalized = authUserId.trim();
  sessionOwnerKey = normalized
    ? `${ACCOUNT_SESSION_PREFIX}${encodeURIComponent(normalized)}`
    : null;
}

function getSessionStorageKey(): string {
  return sessionOwnerKey ?? SESSION_STORAGE_KEY;
}

/**
 * Schema atual (v13: XP Decimal em string).
 * v12: Team presets — Item 43. v11: Achievements unificados.
 */
const SESSION_VERSION = 13 as const;
const LEGACY_SESSION_VERSIONS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
const SAVE_DEBOUNCE_MS = 1_500;
const CLOUD_SAVE_DEBOUNCE_MS = 1_500;

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
  /** Decimal serializado (`"1e20"`). Number só em save legado. */
  xp: string;
}

export interface PersistedAccount {
  lineageProgress: PlayerLineageProgress;
  /** @deprecated migrado para lineageProgress.lineageId */
  clanId?: LineageId | null;
}

export interface PersistedGuild {
  playerId: string | null;
  guildId: string | null;
  guildCoins?: number;
  lastCheckInDay?: string | null;
  claimedMissions?: Record<string, boolean>;
  missionProgress?: Record<string, number>;
  bossDamage?: number;
  bossAttacks?: number;
  fragmentShopDay?: string | null;
  fragmentShopPurchases?: number;
}

export interface PersistedGems {
  balance: number;
  lastLoginDay: string | null;
  claimedAchievements: Record<string, boolean>;
  totalKills: number;
  weeklyCrystalWeek: string | null;
  weeklyCrystalPurchases: number;
}

export interface PersistedAchievements {
  unlocked: Record<string, true>;
  claimed: Record<string, true>;
  unlockedTitles: Record<string, true>;
  equippedTitleId: string | null;
}

export interface PersistedSession {
  version: typeof SESSION_VERSION;
  savedAt?: number;
  player: PlayerCreation;
  location: PersistedLocation;
  team: PersistedTeam;
  vitals: PersistedVitals;
  account: PersistedAccount;
  guild: PersistedGuild;
  gems?: PersistedGems;
  /** Item 23 — opcional em saves antigos. */
  achievements?: PersistedAchievements;
  /** Item 24 — opcional em saves antigos. */
  missions?: MissionsProgressState;
  /** Item 25 — opcional em saves antigos. */
  dailyLogin?: DailyLoginState;
  /** Item 26 — opcional em saves antigos. */
  bosses?: BossProgressState;
  /** Item 30 — limites de compra da loja. */
  shopPurchases?: Record<string, ShopPurchaseBucket>;
  /**
   * Item 31 — inventário (Copper = item-copper-coin nos slots).
   * Ausente em saves v6-: migration usa starter loadout via reset().
   */
  inventory?: PersistedInventory;
  /** Item 32 — transactionIds de reward claims (cap limitado). */
  rewardTransactions?: string[];
  /**
   * Item 43 — presets de equipe (referências a CharacterInstance IDs).
   * Ausente em saves v11-: migration cria defaults (Preset 1 = equipe atual).
   */
  teamPresets?: PersistedTeamPresets;
  /** Herança — portões / clã / invocação / sennin / selo (loadout). */
  heritage?: { loadout: HeritageLoadout };
}

let trackedPlayer: PlayerCreation | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubAutoSave: (() => void) | null = null;

function isIsolatingOfficial(): boolean {
  return shouldFreezeOfficialProgress() || hasOfficialProgressFreeze();
}

function isStarterId(value: unknown): value is StarterCharacterId {
  return typeof value === 'string' && STARTER_IDS.has(value);
}

function isMapKey(value: unknown): value is MapKey {
  return typeof value === 'string' && MAP_KEY_SET.has(value);
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'hub' || value === 'combat';
}

function parseTrueRecord(raw: unknown): Record<string, true> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, true> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value) out[key] = true;
  }
  return out;
}

function parseMissions(raw: unknown): MissionsProgressState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as MissionsProgressState;
}

function parseDailyLogin(raw: unknown): DailyLoginState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const data = raw as Record<string, unknown>;
  const dayRaw = typeof data.currentDay === 'number' ? Math.floor(data.currentDay) : 1;
  const currentDay = (dayRaw >= 1 && dayRaw <= 7 ? dayRaw : 1) as DailyLoginState['currentDay'];
  return {
    currentDay,
    lastClaimCycleId: typeof data.lastClaimCycleId === 'string' ? data.lastClaimCycleId : null,
    totalClaims:
      typeof data.totalClaims === 'number' && Number.isFinite(data.totalClaims)
        ? Math.max(0, Math.floor(data.totalClaims))
        : 0,
  };
}

function parseBosses(raw: unknown): BossProgressState | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as BossProgressState;
}

function normalizeSessionBlob(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const data = { ...(raw as Record<string, unknown>) };

  if (typeof data.version !== 'number' || !LEGACY_SESSION_VERSIONS.has(data.version)) {
    data.version = SESSION_VERSION;
  }

  const playerRaw = data.player;
  if (!playerRaw || typeof playerRaw !== 'object') return data;
  const player = { ...(playerRaw as Record<string, unknown>) };

  const starter = player.starterCharacterId;
  if (typeof starter !== 'string' || !STARTER_IDS.has(starter)) {
    if (starter === 'naruto' || starter === 'naruto-kid') player.starterCharacterId = 'naruto-classic';
    else if (starter === 'sasuke' || starter === 'sasuke-kid') player.starterCharacterId = 'sasuke-classic';
    else player.starterCharacterId = 'naruto-classic';
  }

  if (typeof player.villageId !== 'string' || !player.villageId) {
    player.villageId = 'konoha';
  }

  const nickname =
    typeof player.nickname === 'string'
      ? player.nickname.trim()
      : typeof player.name === 'string'
        ? player.name.trim()
        : '';
  if (nickname.length < 2) {
    player.nickname = 'Shinobi';
  } else {
    player.nickname = nickname;
  }

  data.player = player;
  return data;
}

function tryParseSessionFromRaw(raw: string): PersistedSession | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    const strict = parsePersistedSession(parsed);
    if (strict) return strict;
    return parsePersistedSession(normalizeSessionBlob(parsed));
  } catch {
    return null;
  }
}

function looksLikeSessionRaw(raw: string): boolean {
  return raw.length >= 24 && raw.includes('"player"') && raw.includes('"vitals"');
}

interface StoredSessionCandidate {
  storageKey: string;
  session: PersistedSession;
}

function collectStoredSessionCandidates(): StoredSessionCandidate[] {
  if (typeof window === 'undefined') return [];
  const keys = new Set<string>([
    getSessionStorageKey(),
    OFFICIAL_SESSION_STORAGE_KEY,
    DEV_SESSION_STORAGE_KEY,
  ]);
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.includes('idle-mmorpg') || key.includes('session')) keys.add(key);
  }

  const candidates: StoredSessionCandidate[] = [];
  const seen = new Set<string>();
  for (const storageKey of keys) {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw || !looksLikeSessionRaw(raw)) continue;
    const session = tryParseSessionFromRaw(raw);
    if (!session) continue;
    const fingerprint = `${session.player.nickname}|${session.vitals.level}|${session.player.starterCharacterId}|${session.team.collection.length}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    candidates.push({ storageKey, session });
  }
  return candidates;
}

export interface RecoverableSessionInfo {
  storageKey: string;
  nickname: string;
  level: number;
  starterCharacterId: StarterCharacterId;
  savedAt: number | null;
}

export function listRecoverableSessions(): RecoverableSessionInfo[] {
  return collectStoredSessionCandidates()
    .map(({ storageKey, session }) => ({
      storageKey,
      nickname: session.player.nickname,
      level: session.vitals.level,
      starterCharacterId: session.player.starterCharacterId,
      savedAt: session.savedAt ?? null,
    }))
    .sort((a, b) => {
      if (a.level !== b.level) return b.level - a.level;
      return (b.savedAt ?? 0) - (a.savedAt ?? 0);
    });
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
  const xp = decimalToSave(decimalFromSave(vitalsRaw?.xp));

  const accountRaw = data.account as Record<string, unknown> | undefined;
  const migratedId = migrateLegacyPlayerLineageId(accountRaw);
  const lineageProgress = accountRaw?.lineageProgress
    ? normalizePlayerLineageProgress(accountRaw.lineageProgress)
    : migratedId
      ? normalizePlayerLineageProgress({ lineageId: migratedId })
      : normalizePlayerLineageProgress(null);
  if (migratedId && !lineageProgress.lineageId) {
    lineageProgress.lineageId = migratedId;
  }

  const guildRaw = data.guild as Record<string, unknown> | undefined;
  const playerId =
    guildRaw && typeof guildRaw.playerId === 'string' && guildRaw.playerId.trim()
      ? guildRaw.playerId.trim()
      : null;
  const guildId =
    guildRaw && typeof guildRaw.guildId === 'string' && guildRaw.guildId.trim()
      ? guildRaw.guildId.trim()
      : null;

  const claimedMissions =
    guildRaw?.claimedMissions && typeof guildRaw.claimedMissions === 'object'
      ? (guildRaw.claimedMissions as Record<string, boolean>)
      : undefined;
  const missionProgress =
    guildRaw?.missionProgress && typeof guildRaw.missionProgress === 'object'
      ? (guildRaw.missionProgress as Record<string, number>)
      : undefined;

  const gemsRaw = data.gems as Record<string, unknown> | undefined;
  const gems: PersistedGems | undefined = gemsRaw
    ? {
        balance:
          typeof gemsRaw.balance === 'number' && Number.isFinite(gemsRaw.balance)
            ? Math.max(0, Math.floor(gemsRaw.balance))
            : 0,
        lastLoginDay:
          typeof gemsRaw.lastLoginDay === 'string' || gemsRaw.lastLoginDay === null
            ? (gemsRaw.lastLoginDay as string | null)
            : null,
        claimedAchievements:
          gemsRaw.claimedAchievements && typeof gemsRaw.claimedAchievements === 'object'
            ? (gemsRaw.claimedAchievements as Record<string, boolean>)
            : {},
        totalKills:
          typeof gemsRaw.totalKills === 'number' && Number.isFinite(gemsRaw.totalKills)
            ? Math.max(0, Math.floor(gemsRaw.totalKills))
            : 0,
        weeklyCrystalWeek:
          typeof gemsRaw.weeklyCrystalWeek === 'string' || gemsRaw.weeklyCrystalWeek === null
            ? (gemsRaw.weeklyCrystalWeek as string | null)
            : null,
        weeklyCrystalPurchases:
          typeof gemsRaw.weeklyCrystalPurchases === 'number' &&
          Number.isFinite(gemsRaw.weeklyCrystalPurchases)
            ? Math.max(0, Math.floor(gemsRaw.weeklyCrystalPurchases))
            : 0,
      }
    : undefined;

  const achievementsRaw = data.achievements as Record<string, unknown> | undefined;
  const achievements: PersistedAchievements | undefined = achievementsRaw
    ? {
        unlocked: parseTrueRecord(achievementsRaw.unlocked),
        claimed: parseTrueRecord(achievementsRaw.claimed),
        unlockedTitles: parseTrueRecord(achievementsRaw.unlockedTitles),
        equippedTitleId:
          typeof achievementsRaw.equippedTitleId === 'string'
            ? achievementsRaw.equippedTitleId
            : null,
      }
    : undefined;

  return {
    version: SESSION_VERSION,
    savedAt:
      typeof data.savedAt === 'number' && Number.isFinite(data.savedAt) ? data.savedAt : undefined,
    player: {
      nickname,
      villageId: playerRaw.villageId as PlayerCreation['villageId'],
      starterCharacterId: playerRaw.starterCharacterId,
    },
    location: { mode, mapKey, huntId },
    team: { collection, teamIds, activeId },
    vitals: { level, xp },
    account: { lineageProgress },
    guild: {
      playerId,
      guildId,
      guildCoins: typeof guildRaw?.guildCoins === 'number' ? guildRaw.guildCoins : undefined,
      lastCheckInDay:
        typeof guildRaw?.lastCheckInDay === 'string' || guildRaw?.lastCheckInDay === null
          ? (guildRaw.lastCheckInDay as string | null)
          : undefined,
      claimedMissions,
      missionProgress,
      bossDamage: typeof guildRaw?.bossDamage === 'number' ? guildRaw.bossDamage : undefined,
      bossAttacks: typeof guildRaw?.bossAttacks === 'number' ? guildRaw.bossAttacks : undefined,
    },
    gems,
    achievements,
    missions: parseMissions(data.missions),
    dailyLogin: parseDailyLogin(data.dailyLogin),
    bosses: parseBosses(data.bosses),
    shopPurchases:
      data.shopPurchases && typeof data.shopPurchases === 'object'
        ? (data.shopPurchases as Record<string, ShopPurchaseBucket>)
        : undefined,
    inventory: parsePersistedInventory(data.inventory) ?? undefined,
    rewardTransactions: Array.isArray(data.rewardTransactions)
      ? data.rewardTransactions.filter((id): id is string => typeof id === 'string')
      : undefined,
    teamPresets: (() => {
      const collectionIds = new Set(collection.map((c) => c.id));
      return parsePersistedTeamPresets(data.teamPresets, collectionIds, teamIds);
    })(),
    heritage:
      data.heritage && typeof data.heritage === 'object'
        ? { loadout: (data.heritage as { loadout?: HeritageLoadout }).loadout as HeritageLoadout }
        : undefined,
  };
}

function compareSessionProgress(a: PersistedSession, b: PersistedSession): number {
  const levelA = a.vitals?.level ?? 1;
  const levelB = b.vitals?.level ?? 1;
  if (levelA !== levelB) return levelA - levelB;
  const xpA = decimalFromSave(a.vitals?.xp ?? '0');
  const xpB = decimalFromSave(b.vitals?.xp ?? '0');
  return xpA.cmp(xpB);
}

function pickBetterSession(
  current: PersistedSession | null,
  candidate: PersistedSession | null,
): PersistedSession | null {
  if (!candidate) return current;
  if (!current) return candidate;
  const progressCmp = compareSessionProgress(candidate, current);
  if (progressCmp > 0) return candidate;
  if (progressCmp < 0) return current;
  const savedAtA = candidate.savedAt ?? 0;
  const savedAtB = current.savedAt ?? 0;
  return savedAtA >= savedAtB ? candidate : current;
}

function readSessionFromStorageKey(key: string): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  return tryParseSessionFromRaw(raw);
}

function selectBestLocalSession(): PersistedSession | null {
  let best: PersistedSession | null = null;
  for (const { session } of collectStoredSessionCandidates()) {
    best = pickBetterSession(best, session);
  }
  return best;
}

function persistRecoveredSession(session: PersistedSession): void {
  if (typeof window === 'undefined') return;
  const canonicalKey = getSessionStorageKey();
  const payload = { ...session, savedAt: session.savedAt ?? Date.now() };
  const current = readSessionFromStorageKey(canonicalKey);
  if (!current || compareSessionProgress(payload, current) >= 0) {
    writeSessionJson(canonicalKey, payload);
  }
}

export function recoverPersistedSession(): PersistedSession | null {
  return loadPersistedSession();
}

/** Hidrata automaticamente o melhor save local encontrado no navegador. */
export function bootstrapPlayerFromBestSave(): PlayerCreation | null {
  const ranked = [...collectStoredSessionCandidates()].sort((a, b) =>
    compareSessionProgress(b.session, a.session),
  );
  for (const { storageKey, session } of ranked) {
    try {
      persistRecoveredSession(session);
      return applyPersistedSession(session);
    } catch (error) {
      console.warn(`[Save] Falha ao hidratar ${storageKey}:`, error);
    }
  }
  return null;
}

export function loadPersistedSession(): PersistedSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const best = selectBestLocalSession();
    if (!best) return null;
    persistRecoveredSession(best);
    return best;
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
  setSessionSaveFlusher(null);
}

function ensureAutoSave(): void {
  if (unsubAutoSave || typeof window === 'undefined') return;
  const unsubs = [
    locationStore.subscribe(scheduleSessionSave),
    teamStore.subscribe(scheduleSessionSave),
    vitalsStore.subscribe(scheduleSessionSave),
    accountStore.subscribe(scheduleSessionSave),
    guildStore.subscribe(scheduleSessionSave),
    gemStore.subscribe(scheduleSessionSave),
    achievementsStore.subscribe(scheduleSessionSave),
    missionsStore.subscribe(scheduleSessionSave),
    dailyLoginStore.subscribe(scheduleSessionSave),
    bossStore.subscribe(scheduleSessionSave),
    shopStore.subscribe(scheduleSessionSave),
    inventoryStore.subscribe(scheduleSessionSave),
    teamPresetStore.subscribe(scheduleSessionSave),
    heritageStore.subscribe(scheduleSessionSave),
  ];
  unsubAutoSave = () => {
    for (const unsub of unsubs) unsub();
  };
  setSessionSaveFlusher(() => {
    flushAllSavesNow();
  });

  const flushOnExit = () => flushAllSavesNow();
  window.addEventListener('pagehide', flushOnExit);
  const prevUnsub = unsubAutoSave;
  unsubAutoSave = () => {
    window.removeEventListener('pagehide', flushOnExit);
    prevUnsub?.();
  };
}

export function clearPersistedSession(): void {
  trackedPlayer = null;
  stopAutoSave();
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getSessionStorageKey());
  } catch {
    // ignore
  }
}

function snapshotTeam(): PersistedTeam {
  const state = teamStore.getSnapshot();
  return {
    collection: state.collection.map((entry) => ({
      ...entry,
      xp: decimalToSave(entry.xp),
    })) as unknown as PersistedTeam['collection'],
    teamIds: [...state.teamIds],
    activeId: state.activeId,
  };
}

function snapshotVitals(): PersistedVitals {
  const frozen = getFrozenOfficialVitals();
  if (isIsolatingOfficial() && frozen) {
    return { level: frozen.level, xp: decimalToSave(frozen.xp) };
  }
  const { level, xp } = vitalsStore.getSnapshot();
  return { level, xp: decimalToSave(xp) };
}

function snapshotLocation(): PersistedLocation {
  const loc = locationStore.getSnapshot();
  if (loc.encounterKind === 'boss') {
    return { mode: 'hub', mapKey: MAP_KEYS.leafVillage, huntId: null };
  }
  return { mode: loc.mode, mapKey: loc.mapKey, huntId: loc.huntId };
}

function snapshotAccount(): PersistedAccount {
  const frozen = getFrozenOfficialAccount();
  if (isIsolatingOfficial() && frozen) {
    return {
      lineageProgress: frozen.lineageProgress
        ? { ...frozen.lineageProgress }
        : { ...DEFAULT_PLAYER_LINEAGE_PROGRESS },
    };
  }
  return { lineageProgress: accountStore.getLineageProgress() };
}

function snapshotGems(): PersistedGems {
  const frozen = getFrozenOfficialGems();
  if (isIsolatingOfficial() && frozen) {
    return {
      ...frozen,
      claimedAchievements: {},
    };
  }
  const g = gemStore.getSnapshot();
  return {
    balance: g.balance,
    lastLoginDay: g.lastLoginDay,
    /** Item 38 — não persiste claims legados após migration. */
    claimedAchievements: {},
    totalKills: g.totalKills,
    weeklyCrystalWeek: g.weeklyCrystalWeek,
    weeklyCrystalPurchases: g.weeklyCrystalPurchases,
  };
}

/** Item 38 — merge gem claimedAchievements → achievementsStore; limpa legado. Idempotente. */
export function applyAchievementLegacyMigration(): void {
  const gems = gemStore.getSnapshot();
  if (!hasPendingLegacyAchievementClaims(gems.claimedAchievements)) {
    gemStore.clearLegacyAchievementClaims();
    return;
  }
  const current = achievementsStore.getPersistedProgress();
  const merged = mergeLegacyGemAchievements(current, {
    claimedAchievements: gems.claimedAchievements,
  });
  if (merged.changed) {
    achievementsStore.hydrate(merged.progress);
  }
  gemStore.clearLegacyAchievementClaims();
  if (merged.unmappedLegacyIds.length > 0 && typeof console !== 'undefined') {
    console.warn('[AchievementMigration] IDs legados sem equivalente:', merged.unmappedLegacyIds);
  }
}

function snapshotGuild(): PersistedGuild {
  const { playerId, guildId, progress } = guildStore.getSnapshot();
  return {
    playerId,
    guildId,
    guildCoins: progress.guildCoins,
    lastCheckInDay: progress.lastCheckInDay,
    claimedMissions: progress.claimedMissions,
    missionProgress: progress.missionProgress,
    bossDamage: progress.bossDamage,
    bossAttacks: progress.bossAttacks,
    fragmentShopDay: progress.fragmentShopDay,
    fragmentShopPurchases: progress.fragmentShopPurchases,
  };
}

function snapshotAchievements(): PersistedAchievements {
  const frozen = getFrozenOfficialAchievements();
  if (isIsolatingOfficial() && frozen) {
    return {
      unlocked: { ...frozen.unlocked },
      claimed: { ...frozen.claimed },
      unlockedTitles: { ...frozen.unlockedTitles },
      equippedTitleId: frozen.equippedTitleId,
    };
  }
  const progress = achievementsStore.getPersistedProgress();
  return {
    unlocked: { ...progress.unlocked },
    claimed: { ...progress.claimed },
    unlockedTitles: { ...progress.unlockedTitles },
    equippedTitleId: progress.equippedTitleId,
  };
}

function buildSessionPayload(player: PlayerCreation): PersistedSession {
  const isolating = isIsolatingOfficial();
  const frozenTeam = getFrozenOfficialTeam();
  const frozenPresets = getFrozenOfficialTeamPresets();
  const frozenMissions = getFrozenOfficialMissions();
  const frozenDaily = getFrozenOfficialDailyLogin();
  const frozenInv = getFrozenOfficialInventory();
  return {
    version: SESSION_VERSION,
    player: { ...player },
    location: snapshotLocation(),
    team:
      isolating && frozenTeam
        ? {
            ...frozenTeam,
            collection: frozenTeam.collection.map((c) => ({ ...c })),
            teamIds: [...frozenTeam.teamIds],
          }
        : snapshotTeam(),
    vitals: snapshotVitals(),
    account: snapshotAccount(),
    guild: snapshotGuild(),
    gems: snapshotGems(),
    achievements: snapshotAchievements(),
    missions: isolating && frozenMissions ? frozenMissions : missionsStore.getPersistedProgress(),
    dailyLogin:
      isolating && frozenDaily ? { ...frozenDaily } : dailyLoginStore.getPersistedProgress(),
    bosses: bossStore.getPersistedProgress(),
    shopPurchases: shopStore.getPersistedPurchases(),
    inventory: isolating && frozenInv ? frozenInv : inventoryStore.getPersistedInventory(),
    rewardTransactions: rewardIdempotency.list(),
    teamPresets: isolating && frozenPresets ? frozenPresets : teamPresetStore.getPersisted(),
    heritage: heritageStore.toPersisted(),
  };
}

function flushCloudSaveNow(payload: PersistedSession): void {
  if (typeof window === 'undefined' || !isSocialBackendActive()) return;
  try {
    void fetch('/api/social/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      keepalive: true,
      body: JSON.stringify({ payload }),
    });
  } catch {
    // ignore
  }
}

function flushAllSavesNow(): void {
  if (!trackedPlayer) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  const payload = { ...buildSessionPayload(trackedPlayer), savedAt: Date.now() };
  writeSessionJson(getSessionStorageKey(), payload);
  flushCloudSaveNow(payload);
}

function writeSessionJson(key: string, session: PersistedSession): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(session));
  } catch {
    // ignore
  }
}

async function uploadCloudSave(payload: PersistedSession): Promise<void> {
  if (!isSocialBackendActive()) return;
  try {
    const response = await fetch('/api/social/save', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ payload }),
    });
    if (!response.ok && response.status !== 401) {
      console.warn('[CloudSave] upload falhou:', response.status);
    }
  } catch {
    // Local persistence remains the fallback when the network is unavailable.
  }
}

function scheduleCloudSave(payload: PersistedSession): void {
  if (typeof window === 'undefined') return;
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    void uploadCloudSave(payload);
  }, CLOUD_SAVE_DEBOUNCE_MS);
}

export async function hydrateSessionFromCloud(): Promise<PersistedSession | null> {
  if (typeof window === 'undefined' || !isSocialBackendActive()) return null;
  try {
    const response = await fetch('/api/social/save', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      save?: { payload?: unknown; updatedAt?: string } | null;
    };
    if (!body.save?.payload) return null;
    const remote =
      parsePersistedSession(body.save.payload) ??
      parsePersistedSession(normalizeSessionBlob(body.save.payload));
    if (!remote) return null;

    const local = loadPersistedSession();
    const remoteUpdatedAt = Date.parse(body.save.updatedAt ?? '');
    const localUpdatedAt = local?.savedAt ?? 0;
    if (local) {
      const progressCmp = compareSessionProgress(remote, local);
      if (progressCmp < 0 || (progressCmp === 0 && localUpdatedAt >= remoteUpdatedAt)) {
        scheduleCloudSave(local);
        return null;
      }
    }
    return remote;
  } catch {
    return null;
  }
}

export function savePersistedSession(): void {
  if (typeof window === 'undefined' || !trackedPlayer) return;

  // Official key: sempre estado congelado quando isolando (não contamina).
  const officialPayload = { ...buildSessionPayload(trackedPlayer), savedAt: Date.now() };
  writeSessionJson(getSessionStorageKey(), officialPayload);
  scheduleCloudSave(officialPayload);

  // Dev key: playground ao vivo (opcional) quando Lab/isolamento ativo.
  if (isIsolatingOfficial()) {
    const live: PersistedSession = {
      version: SESSION_VERSION,
      savedAt: Date.now(),
      player: { ...trackedPlayer },
      location: snapshotLocation(),
      team: snapshotTeam(),
      vitals: (() => {
        const { level, xp } = vitalsStore.getSnapshot();
        return { level, xp: decimalToSave(xp) };
      })(),
      account: { lineageProgress: accountStore.getLineageProgress() },
      guild: snapshotGuild(),
      gems: (() => {
        const g = gemStore.getSnapshot();
        return {
          balance: g.balance,
          lastLoginDay: g.lastLoginDay,
          claimedAchievements: {},
          totalKills: g.totalKills,
          weeklyCrystalWeek: g.weeklyCrystalWeek,
          weeklyCrystalPurchases: g.weeklyCrystalPurchases,
        };
      })(),
      achievements: (() => {
        const progress = achievementsStore.getPersistedProgress();
        return {
          unlocked: { ...progress.unlocked },
          claimed: { ...progress.claimed },
          unlockedTitles: { ...progress.unlockedTitles },
          equippedTitleId: progress.equippedTitleId,
        };
      })(),
      missions: missionsStore.getPersistedProgress(),
      dailyLogin: dailyLoginStore.getPersistedProgress(),
      bosses: bossStore.getPersistedProgress(),
      shopPurchases: shopStore.getPersistedPurchases(),
      inventory: inventoryStore.getPersistedInventory(),
      rewardTransactions: rewardIdempotency.list(),
      teamPresets: teamPresetStore.getPersisted(),
      heritage: heritageStore.toPersisted(),
    };
    writeSessionJson(DEV_SESSION_STORAGE_KEY, live);
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

function captureOfficialProgressFreeze(): void {
  if (!shouldFreezeOfficialProgress()) {
    return;
  }
  beginOfficialProgressFreeze();
}

export function trackSession(player: PlayerCreation): void {
  trackedPlayer = {
    nickname: player.nickname.trim(),
    villageId: player.villageId,
    starterCharacterId: player.starterCharacterId,
  };
  guildStore.ensurePlayerId();
  guildStore.setNickname(trackedPlayer.nickname);
  captureOfficialProgressFreeze();
  ensureAutoSave();
  savePersistedSession();
}

export function applyPersistedSession(session: PersistedSession): PlayerCreation {
  const player = session.player;

  villageStore.reset();
  villageStore.joinVillage(player.villageId, player.nickname);
  accountStore.hydrate(session.account ?? { lineageProgress: null });
  heritageStore.hydrate(session.heritage ?? null);
  guildStore.hydrate({
    playerId: session.guild?.playerId ?? null,
    guildId: session.guild?.guildId ?? null,
    nickname: player.nickname,
    progress: session.guild
      ? {
          guildCoins: session.guild.guildCoins,
          lastCheckInDay: session.guild.lastCheckInDay,
          claimedMissions: session.guild.claimedMissions,
          missionProgress: session.guild.missionProgress,
          bossDamage: session.guild.bossDamage,
          bossAttacks: session.guild.bossAttacks,
          fragmentShopDay: session.guild.fragmentShopDay,
          fragmentShopPurchases: session.guild.fragmentShopPurchases,
        }
      : null,
  });
  if (session.gems) {
    gemStore.hydrate(session.gems);
  }

  const progressSeed: Partial<AchievementProgressState> = session.achievements ?? {
    unlocked: {},
    claimed: {},
    unlockedTitles: {},
    equippedTitleId: null,
  };
  achievementsStore.hydrate(progressSeed);

  // Item 38: gem claimedAchievements → achievementsStore (sem conceder reward).
  applyAchievementLegacyMigration();

  missionsStore.hydrate(session.missions ?? null);
  dailyLoginStore.hydrate(session.dailyLogin ?? null);
  // Item 34: merge gem Daily Login legado → oficial; limpa lastLoginDay sem recompensar.
  dailyLoginStore.applyGemLegacyMigration();
  bossStore.hydrate(session.bosses ?? null);
  shopStore.hydrate({ purchases: session.shopPurchases ?? null });

  const teamOk = teamStore.hydrate(session.team);
  if (!teamOk) {
    teamStore.reset(player.starterCharacterId);
  }

  const teamSnap = teamStore.getSnapshot();
  teamPresetStore.hydrate(
    session.teamPresets,
    teamSnap.collection.map((c) => c.id),
    teamSnap.teamIds,
  );

  const active = teamStore.getActive();
  if (active?.starterId) {
    skillsStore.reset(active.starterId);
  } else {
    skillsStore.reset(player.starterCharacterId);
  }

  const { level, xp } = session.vitals;
  const xpDec = decimalFromSave(xp);
  teamStore.migrateMissingLevels(level, xpDec);
  const progressed = addExperience(Math.max(1, level), xpDec, 0);
  vitalsStore.reset({
    level: progressed.level,
    xp: progressed.xp,
    xpMax: progressed.xpMax,
    hp: d(100),
    hpMax: d(100),
  });

  // Item 31: hidratar inventário salvo; saves antigos sem inventory → starter (reset).
  // NÃO chamar reset() quando há blob válido — isso apagava Copper/itens após reload.
  if (session.inventory) {
    inventoryStore.hydrate(session.inventory);
  } else {
    inventoryStore.reset();
  }
  rewardIdempotency.hydrate(session.rewardTransactions);
  attributesStore.onLevelChanged(true);

  locationStore.hydrate(session.location);

  try {
    achievementsStore.evaluateAllRetroactive();
    missionsStore.ensureCycles();
    missionsStore.syncStateMissions({ silent: true });
  } catch (error) {
    console.warn('[Save] Pós-hydrate opcional falhou:', error);
  }

  trackSession(player);
  return player;
}
