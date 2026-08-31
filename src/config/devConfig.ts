/**
 * DevModeService (Item 35) — única fonte de ambiente DEV vs gameplay oficial.
 *
 * Storage keys (documentadas):
 * - Official player save: `idle-mmorpg:session-v1`
 * - Dev player save (opcional/isolado): `idle-mmorpg:session-dev-v1`
 * - Dev settings (prefs inofensivas): `idle-mmorpg:dev-settings-v1`
 * - Character Lab prefs: `idle-mmorpg:dev-character-lab-v1`
 * - Offline official: `idle-mmorpg:offline-progress-v1`
 *
 * Limitação: XP/Copper já contaminados historicamente NÃO são revertidos automaticamente
 * (origem incerta). Isolation impede contaminação futura.
 */

import { Decimal, d, floorNonNeg, type Decimal as DecimalValue } from '@/lib/decimal';

export const OFFICIAL_SESSION_STORAGE_KEY = 'idle-mmorpg:session-v1';
/** Save de playground DEV — nunca carregar no boot oficial. */
export const DEV_SESSION_STORAGE_KEY = 'idle-mmorpg:session-dev-v1';
/** Prefs inofensivas (aba, zoom, etc.). */
export const DEV_SETTINGS_STORAGE_KEY = 'idle-mmorpg:dev-settings-v1';

/** @deprecated Use OFFICIAL_SESSION_STORAGE_KEY — mantido para imports existentes. */
export const SESSION_STORAGE_KEY_ALIAS = OFFICIAL_SESSION_STORAGE_KEY;

export interface DevDebugOverlays {
  showHitbox: boolean;
  showHurtbox: boolean;
  showSpriteOrigin: boolean;
  showVfxOrigin: boolean;
  showCurrentFrame: boolean;
  showHitDelay: boolean;
  showAnimationDuration: boolean;
}

export interface DevFlags {
  /**
   * Acesso a Dev Lab / ferramentas.
   * Em runtime: ligado só se ambiente DEV (NODE_ENV development).
   * Não usar `true` hardcoded em produção.
   */
  enabled: boolean;
  /** `null` = nível real da Hunt. */
  forceHuntLevel: number | null;
  enemyHpMultiplier: number;
  xpMultiplier: number;
  playerInvincible: boolean;
  infiniteChakra: boolean;
  ignoreSkillCooldown: boolean;
  damageMultiplier: number;
  gameSpeed: number;
  testCatalogLookType: number | null;
  /** DEV Lab / overrides → não grava progresso oficial. Default true. */
  isolateOfficialSave: boolean;
  forceAllSkillsLevel1: boolean;
  debug: DevDebugOverlays;
}

const DEV_DEBUG_DEFAULT: DevDebugOverlays = {
  showHitbox: false,
  showHurtbox: false,
  showSpriteOrigin: false,
  showVfxOrigin: false,
  showCurrentFrame: false,
  showHitDelay: false,
  showAnimationDuration: false,
};

/** Safe defaults — sem multiplicadores invisíveis. */
export const DEV_FLAGS_SAFE: Readonly<DevFlags> = Object.freeze({
  enabled: false,
  forceHuntLevel: null,
  enemyHpMultiplier: 1,
  xpMultiplier: 1,
  playerInvincible: false,
  infiniteChakra: false,
  ignoreSkillCooldown: false,
  damageMultiplier: 1,
  gameSpeed: 1,
  testCatalogLookType: null,
  isolateOfficialSave: true,
  forceAllSkillsLevel1: false,
  debug: { ...DEV_DEBUG_DEFAULT },
});

function detectDevEnvironment(): boolean {
  // Produção Next: NODE_ENV === 'production' → bloqueado.
  // Scripts/tsx e `next dev`: development ou unset → permitido.
  if (typeof process === 'undefined') return false;
  return process.env?.NODE_ENV !== 'production';
}

/**
 * Fonte mutável (DEV Lab / testes). Começa SAFE.
 * `enabled` é sincronizado com o ambiente — não fica `true` em produção.
 */
export const DEV_FLAGS: DevFlags = {
  ...DEV_FLAGS_SAFE,
  debug: { ...DEV_DEBUG_DEFAULT },
  enabled: detectDevEnvironment(),
};

/** Alias legado. */
export const CHARACTER_TEST_MODE = DEV_FLAGS;

/** Lab session (aberto) — setado pelo character-lab-store (evita import circular). */
let labSessionActive = false;
let runtimeLookType: number | null = DEV_FLAGS.testCatalogLookType;

export function isDevEnvironment(): boolean {
  return detectDevEnvironment();
}

/** Dev Lab / painéis DEV acessíveis (nunca em production build). */
export function isDevMode(): boolean {
  if (!isDevEnvironment()) return false;
  return DEV_FLAGS.enabled === true;
}

export function setDevLabSessionActive(active: boolean): void {
  labSessionActive = active === true;
}

export function isDevLabSessionActive(): boolean {
  return labSessionActive;
}

/**
 * Testes / teardown: fecha Lab e re-sincroniza `enabled` com o ambiente.
 * Não persiste em localStorage — `labSessionActive` é só memória de processo.
 */
export function resetDevLabSessionState(): void {
  labSessionActive = false;
  resetDangerousDevOverrides();
}

/** Reaplica `DEV_FLAGS.enabled` após mudança de NODE_ENV (scripts). */
export function syncDevFlagsWithEnvironment(): void {
  DEV_FLAGS.enabled = isDevEnvironment();
}

/**
 * Overrides perigosos de combate/progressão só valem com Lab aberto
 * (ou isolate explícito + ambiente DEV).
 */
export function isDevGameplayOverrideActive(): boolean {
  if (!isDevMode()) return false;
  return labSessionActive;
}

export function assertDevEnvironment(action = 'dev action'): void {
  if (!isDevEnvironment()) {
    throw new Error(`[DEV] Bloqueado em produção: ${action}`);
  }
}

/** Reseta flags perigosas para safe (não remove enabled do ambiente). */
export function resetDangerousDevOverrides(): void {
  const envEnabled = isDevEnvironment();
  DEV_FLAGS.forceHuntLevel = null;
  DEV_FLAGS.enemyHpMultiplier = 1;
  DEV_FLAGS.xpMultiplier = 1;
  DEV_FLAGS.playerInvincible = false;
  DEV_FLAGS.infiniteChakra = false;
  DEV_FLAGS.ignoreSkillCooldown = false;
  DEV_FLAGS.damageMultiplier = 1;
  DEV_FLAGS.gameSpeed = 1;
  DEV_FLAGS.forceAllSkillsLevel1 = false;
  DEV_FLAGS.testCatalogLookType = null;
  DEV_FLAGS.isolateOfficialSave = true;
  DEV_FLAGS.debug = { ...DEV_DEBUG_DEFAULT };
  runtimeLookType = null;
  DEV_FLAGS.enabled = envEnabled;
}

/** Lista overrides ativos (DEBUG). */
export function listActiveDevOverrides(): string[] {
  if (!isDevMode() || !isDevGameplayOverrideActive()) return [];
  const rows: string[] = [];
  if (DEV_FLAGS.xpMultiplier !== 1) rows.push(`XP ×${DEV_FLAGS.xpMultiplier}`);
  if (DEV_FLAGS.enemyHpMultiplier !== 1) rows.push(`Enemy HP ×${DEV_FLAGS.enemyHpMultiplier}`);
  if (DEV_FLAGS.forceHuntLevel != null) rows.push(`Force Hunt Level ${DEV_FLAGS.forceHuntLevel}`);
  if (DEV_FLAGS.forceAllSkillsLevel1) rows.push('Force All Skills Level 1');
  if (DEV_FLAGS.playerInvincible) rows.push('Player Invincible');
  if (DEV_FLAGS.infiniteChakra) rows.push('Energia Infinita');
  if (DEV_FLAGS.ignoreSkillCooldown) rows.push('Ignore Cooldown');
  if (DEV_FLAGS.damageMultiplier !== 1) rows.push(`Damage ×${DEV_FLAGS.damageMultiplier}`);
  if (DEV_FLAGS.gameSpeed !== 1) rows.push(`Game Speed ×${DEV_FLAGS.gameSpeed}`);
  if (getDevTestCatalogLookType() != null)
    rows.push(`Test Catalog Look ${getDevTestCatalogLookType()}`);
  if (DEV_FLAGS.isolateOfficialSave) rows.push('Isolate Official Save');
  return rows;
}

export function getForceHuntLevel(): number | null {
  if (!isDevMode()) return null;
  return DEV_FLAGS.forceHuntLevel;
}

export function getEnemyHpMultiplier(): number {
  if (!isDevGameplayOverrideActive()) return 1;
  const value = DEV_FLAGS.enemyHpMultiplier;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getXpMultiplier(): number {
  if (!isDevGameplayOverrideActive()) return 1;
  const value = DEV_FLAGS.xpMultiplier;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getDamageMultiplier(): number {
  if (!isDevGameplayOverrideActive()) return 1;
  const value = DEV_FLAGS.damageMultiplier;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getDevGameSpeed(): number {
  if (!isDevGameplayOverrideActive()) return 1;
  const value = DEV_FLAGS.gameSpeed;
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function isPlayerInvincible(): boolean {
  return isDevGameplayOverrideActive() && DEV_FLAGS.playerInvincible;
}

export function isInfiniteChakra(): boolean {
  return isDevGameplayOverrideActive() && DEV_FLAGS.infiniteChakra;
}

export function isSkillCooldownIgnored(): boolean {
  return (
    isDevGameplayOverrideActive() && (DEV_FLAGS.ignoreSkillCooldown || DEV_FLAGS.infiniteChakra)
  );
}

export function scaleOutgoingDamage(damage: number | DecimalValue): DecimalValue {
  const mul = getDamageMultiplier();
  const raw = d(damage);
  if (mul === 1) return floorNonNeg(raw);
  return Decimal.max(d(0), raw.mul(mul).floor());
}

export function hasArtificialCombatRules(): boolean {
  if (!isDevGameplayOverrideActive()) return false;
  return (
    DEV_FLAGS.forceHuntLevel != null ||
    getEnemyHpMultiplier() !== 1 ||
    getXpMultiplier() !== 1 ||
    getDamageMultiplier() !== 1 ||
    DEV_FLAGS.playerInvincible ||
    getDevTestCatalogLookType() != null
  );
}

export function getDevTestCatalogLookType(): number | null {
  if (!isDevMode()) return null;
  return runtimeLookType;
}

export function setDevTestCatalogLookType(lookType: number | null): void {
  runtimeLookType = lookType;
}

/**
 * Isola selamentos / progresso oficial.
 * Default: true sempre que Lab aberto ou flag isolate.
 */
export function shouldIsolateOfficialSave(): boolean {
  if (!isDevMode()) return false;
  return DEV_FLAGS.isolateOfficialSave === true;
}

export function shouldFreezeOfficialProgress(): boolean {
  return shouldIsolateOfficialSave();
}

export function shouldForceAllSkillsLevel1(): boolean {
  return isDevMode() && DEV_FLAGS.forceAllSkillsLevel1;
}

export function isTestAnalyzerSession(): boolean {
  return shouldIsolateOfficialSave();
}

export function getDevDebugOverlays(): DevDebugOverlays {
  if (!isDevMode()) return { ...DEV_DEBUG_DEFAULT };
  return { ...DEV_FLAGS.debug };
}

/** Key do save oficial — boot sempre carrega esta. */
export function getOfficialSessionStorageKey(): string {
  return OFFICIAL_SESSION_STORAGE_KEY;
}

/** Key do save DEV isolado. */
export function getDevSessionStorageKey(): string {
  return DEV_SESSION_STORAGE_KEY;
}

/**
 * Fachada DevModeService.
 */
export const devModeService = {
  isEnvironment: isDevEnvironment,
  isMode: isDevMode,
  isLabSession: isDevLabSessionActive,
  setLabSession: setDevLabSessionActive,
  isGameplayOverrideActive: isDevGameplayOverrideActive,
  shouldIsolateOfficialSave,
  shouldFreezeOfficialProgress,
  resetDangerousOverrides: resetDangerousDevOverrides,
  resetLabSessionState: resetDevLabSessionState,
  syncFlagsWithEnvironment: syncDevFlagsWithEnvironment,
  listActiveOverrides: listActiveDevOverrides,
  assertEnvironment: assertDevEnvironment,
  flags: DEV_FLAGS,
  safeDefaults: DEV_FLAGS_SAFE,
  keys: {
    officialSession: OFFICIAL_SESSION_STORAGE_KEY,
    devSession: DEV_SESSION_STORAGE_KEY,
    devSettings: DEV_SETTINGS_STORAGE_KEY,
  },
};
