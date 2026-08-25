/**
 * Freeze/restore do progresso oficial durante Dev Lab (Item 35).
 * Não importa character-lab-store (evita ciclo).
 */
import { shouldFreezeOfficialProgress } from '@/config/devConfig';
import { cloneDecimal, type Decimal } from '@/lib/decimal';
import { addExperience } from '@/lib/player-progression';
import { accountStore } from '@/stores/account-store';
import { achievementsStore } from '@/stores/achievements-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { gemStore } from '@/stores/gem-store';
import { inventoryStore } from '@/stores/inventory-store';
import { missionsStore } from '@/stores/missions-store';
import { teamStore } from '@/stores/team-store';
import { teamPresetStore } from '@/stores/team-preset-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { PersistedInventory } from '@/lib/inventory-persist';
import type { DailyLoginState } from '@/types/daily-login';
import type { MissionsProgressState } from '@/types/missions';
import type { PlayerLineageProgress } from '@/types/lineage';
import type { SealedCharacter } from '@/types/team';
import type { PersistedTeamPresets } from '@/types/team-preset';
import { clonePersistedTeamPresets } from '@/lib/team-preset';

interface FreezeVitals {
  level: number;
  xp: Decimal;
}

interface FreezeGems {
  balance: number;
  lastLoginDay: string | null;
  claimedAchievements: Record<string, boolean>;
  totalKills: number;
  weeklyCrystalWeek: string | null;
  weeklyCrystalPurchases: number;
}

interface FreezeTeam {
  collection: SealedCharacter[];
  teamIds: string[];
  activeId: string | null;
}

interface FreezeAchievements {
  unlocked: Record<string, true>;
  claimed: Record<string, true>;
  unlockedTitles: Record<string, true>;
  equippedTitleId: string | null;
}

interface FreezeAccount {
  lineageProgress: PlayerLineageProgress | null;
}

let frozenVitals: FreezeVitals | null = null;
let frozenGems: FreezeGems | null = null;
let frozenInventory: PersistedInventory | null = null;
let frozenTeam: FreezeTeam | null = null;
let frozenTeamPresets: PersistedTeamPresets | null = null;
let frozenAccount: FreezeAccount | null = null;
let frozenMissions: MissionsProgressState | null = null;
let frozenDailyLogin: DailyLoginState | null = null;
let frozenAchievements: FreezeAchievements | null = null;

function snapshotTeam(): FreezeTeam {
  const state = teamStore.getSnapshot();
  return {
    collection: state.collection.map((entry) => ({
      ...entry,
      xp: cloneDecimal(entry.xp),
    })),
    teamIds: [...state.teamIds],
    activeId: state.activeId,
  };
}

export function hasOfficialProgressFreeze(): boolean {
  return frozenVitals != null;
}

export function getFrozenOfficialVitals(): FreezeVitals | null {
  return frozenVitals ? { ...frozenVitals } : null;
}

export function getFrozenOfficialGems(): FreezeGems | null {
  return frozenGems
    ? { ...frozenGems, claimedAchievements: { ...frozenGems.claimedAchievements } }
    : null;
}

export function getFrozenOfficialInventory(): PersistedInventory | null {
  return frozenInventory;
}

export function getFrozenOfficialTeam(): FreezeTeam | null {
  return frozenTeam
    ? {
        collection: frozenTeam.collection.map((c) => ({ ...c, xp: cloneDecimal(c.xp) })),
        teamIds: [...frozenTeam.teamIds],
        activeId: frozenTeam.activeId,
      }
    : null;
}

export function getFrozenOfficialTeamPresets(): PersistedTeamPresets | null {
  return frozenTeamPresets ? clonePersistedTeamPresets(frozenTeamPresets) : null;
}

export function getFrozenOfficialAccount(): FreezeAccount | null {
  return frozenAccount
    ? {
        lineageProgress: frozenAccount.lineageProgress
          ? { ...frozenAccount.lineageProgress }
          : null,
      }
    : null;
}

export function getFrozenOfficialMissions(): MissionsProgressState | null {
  return frozenMissions;
}

export function getFrozenOfficialDailyLogin(): DailyLoginState | null {
  return frozenDailyLogin ? { ...frozenDailyLogin } : null;
}

export function getFrozenOfficialAchievements(): FreezeAchievements | null {
  return frozenAchievements
    ? {
        unlocked: { ...frozenAchievements.unlocked },
        claimed: { ...frozenAchievements.claimed },
        unlockedTitles: { ...frozenAchievements.unlockedTitles },
        equippedTitleId: frozenAchievements.equippedTitleId,
      }
    : null;
}

/** Caça real com Lab aberto: o selo e o pergaminho entram no snapshot oficial. */
export function applyHuntCaptureToOfficialFreeze(
  instance: SealedCharacter,
  scrollItemId: string,
): void {
  if (!frozenTeam || !frozenInventory) return;
  if (frozenTeam.collection.some((entry) => entry.id === instance.id)) return;
  frozenTeam = {
    ...frozenTeam,
    collection: frozenTeam.collection.map((entry) => ({ ...entry })).concat([{ ...instance }]),
  };
  frozenInventory = {
    slots: frozenInventory.slots.map((slot) => {
      if (!slot || slot.itemId !== scrollItemId) return slot ? { ...slot } : null;
      const nextQty = slot.quantity - 1;
      return nextQty > 0 ? { itemId: slot.itemId, quantity: nextQty } : null;
    }),
  };
}

export function beginOfficialProgressFreeze(): void {
  if (frozenVitals && frozenGems) return;
  const { level, xp } = vitalsStore.getSnapshot();
  frozenVitals = { level, xp: cloneDecimal(xp) };
  const g = gemStore.getSnapshot();
  frozenGems = {
    balance: g.balance,
    lastLoginDay: g.lastLoginDay,
    claimedAchievements: {},
    totalKills: g.totalKills,
    weeklyCrystalWeek: g.weeklyCrystalWeek,
    weeklyCrystalPurchases: g.weeklyCrystalPurchases,
  };
  frozenInventory = inventoryStore.getPersistedInventory();
  frozenTeam = snapshotTeam();
  frozenTeamPresets = clonePersistedTeamPresets(teamPresetStore.getPersisted());
  frozenAccount = { lineageProgress: accountStore.getLineageProgress() };
  frozenMissions = missionsStore.getPersistedProgress();
  frozenDailyLogin = dailyLoginStore.getPersistedProgress();
  const progress = achievementsStore.getPersistedProgress();
  frozenAchievements = {
    unlocked: { ...progress.unlocked },
    claimed: { ...progress.claimed },
    unlockedTitles: { ...progress.unlockedTitles },
    equippedTitleId: progress.equippedTitleId,
  };
}

export function clearOfficialProgressFreeze(): void {
  frozenVitals = null;
  frozenGems = null;
  frozenInventory = null;
  frozenTeam = null;
  frozenTeamPresets = null;
  frozenAccount = null;
  frozenMissions = null;
  frozenDailyLogin = null;
  frozenAchievements = null;
}

export function restoreOfficialProgressFromFreeze(): void {
  if (!frozenVitals) {
    clearOfficialProgressFreeze();
    return;
  }
  const { level, xp } = frozenVitals;
  const progressed = addExperience(Math.max(1, level), xp, 0);
  const vitals = vitalsStore.getSnapshot();
  vitalsStore.reset({
    level: progressed.level,
    xp: progressed.xp,
    xpMax: progressed.xpMax,
    hp: vitals.hp,
    hpMax: vitals.hpMax,
  });
  if (frozenGems) gemStore.hydrate(frozenGems);
  if (frozenInventory) inventoryStore.hydrate(frozenInventory);
  if (frozenTeam) teamStore.hydrate(frozenTeam);
  if (frozenTeamPresets) {
    const team = teamStore.getSnapshot();
    teamPresetStore.hydrate(
      frozenTeamPresets,
      team.collection.map((c) => c.id),
      team.teamIds,
    );
  }
  if (frozenAccount) accountStore.hydrate(frozenAccount);
  if (frozenMissions) missionsStore.hydrate(frozenMissions);
  if (frozenDailyLogin) dailyLoginStore.hydrate(frozenDailyLogin);
  if (frozenAchievements) {
    achievementsStore.hydrate({
      unlocked: frozenAchievements.unlocked,
      claimed: frozenAchievements.claimed,
      unlockedTitles: frozenAchievements.unlockedTitles,
      equippedTitleId: frozenAchievements.equippedTitleId,
    });
  }
  clearOfficialProgressFreeze();
}

/** Compat: se freeze deve estar ativo, captura. */
export function captureOfficialProgressFreezeIfNeeded(): void {
  if (!shouldFreezeOfficialProgress()) return;
  beginOfficialProgressFreeze();
}
