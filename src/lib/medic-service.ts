/**
 * Serviço oficial do Médico (Item 42).
 * Hub only: recupera HP (inclui KO). Não toca Energia, cooldowns, poções ou Revive.
 */

import { MEDIC_CONFIG } from '@/constants/medic';
import { Decimal, d, decimalToUnsafeNumber, floorNonNeg } from '@/lib/decimal';
import { economyService } from '@/lib/economy-service';
import { vitalsStore } from '@/stores/vitals-store';
import { medicStore } from '@/stores/medic-store';
import { emitSystemMessage } from '@/lib/system-log';

export interface MedicHpSnapshot {
  currentHp: number;
  maxHp: number;
  missingHp: number;
}

export interface MedicQuote {
  snapshot: MedicHpSnapshot;
  /** true se há HP a recuperar. */
  needsRecovery: boolean;
  /** Copper a cobrar (0 se equipe saudável). */
  cost: number;
  canAfford: boolean;
  copperBalance: number;
}

export type MedicRecoverResult =
  | { ok: true; cost: number; healedHp: number }
  | {
      ok: false;
      reason: 'full' | 'insufficient-copper' | 'busy' | 'invalid';
      cost: number;
    };

let busy = false;

export function getMedicHpSnapshot(): MedicHpSnapshot {
  const { hp, hpMax } = vitalsStore.getSnapshot();
  const maxHp = Decimal.max(d(1), floorNonNeg(hpMax));
  const currentHp = Decimal.max(d(0), floorNonNeg(hp));
  const missingHp = Decimal.max(d(0), maxHp.sub(currentHp));
  return {
    currentHp: decimalToUnsafeNumber(currentHp),
    maxHp: decimalToUnsafeNumber(maxHp),
    missingHp: decimalToUnsafeNumber(missingHp),
  };
}

/**
 * Custo monotônico em missingHp.
 * missingHp === 0 → 0.
 * Caso contrário: clamp(base + missing * rate, min, max).
 */
export function calculateMedicCost(missingHp: number, maxHp = 1): number {
  const missing = Math.max(0, Math.floor(missingHp));
  if (missing <= 0) return 0;
  void maxHp; // reservado p/ modifiers futuros (VIP/guild) — não usado agora
  const raw =
    MEDIC_CONFIG.baseCost + Math.floor(missing * MEDIC_CONFIG.costPerMissingHp);
  return Math.max(
    MEDIC_CONFIG.minimumCost,
    Math.min(MEDIC_CONFIG.maximumCost, raw),
  );
}

export function quoteMedicRecovery(): MedicQuote {
  const snapshot = getMedicHpSnapshot();
  const cost = calculateMedicCost(snapshot.missingHp, snapshot.maxHp);
  const copperBalance = economyService.getBalance('copper');
  return {
    snapshot,
    needsRecovery: snapshot.missingHp > 0,
    cost,
    canAfford: cost <= 0 || copperBalance >= cost,
    copperBalance,
  };
}

/**
 * Recupera HP da equipe (vitals oficiais do combatente ativo).
 * KO (hp=0) → healFull, sem consumir Revive.
 * Não chama clearCooldowns. Não altera Energia.
 */
export function recoverTeamAtMedic(): MedicRecoverResult {
  if (busy) {
    return { ok: false, reason: 'busy', cost: 0 };
  }
  busy = true;
  try {
    // Revalidação imediata (double-click / estado mudou).
    const quote = quoteMedicRecovery();
    if (!quote.needsRecovery || quote.cost <= 0) {
      return { ok: false, reason: 'full', cost: 0 };
    }
    if (!quote.canAfford) {
      emitSystemMessage('Centro de Cura: Copper insuficiente.');
      return { ok: false, reason: 'insufficient-copper', cost: quote.cost };
    }

    const before = getMedicHpSnapshot();
    if (before.missingHp <= 0) {
      return { ok: false, reason: 'full', cost: 0 };
    }
    const cost = calculateMedicCost(before.missingHp, before.maxHp);
    if (cost <= 0) {
      return { ok: false, reason: 'full', cost: 0 };
    }
    if (!economyService.canAfford('copper', cost)) {
      emitSystemMessage('Centro de Cura: Copper insuficiente.');
      return { ok: false, reason: 'insufficient-copper', cost };
    }

    // Spend antes da cura; se spend falhar, não cura.
    if (!economyService.spendCurrency('copper', cost, 'medic', {
      missingHp: before.missingHp,
      maxHp: before.maxHp,
    })) {
      emitSystemMessage('Centro de Cura: Copper insuficiente.');
      return { ok: false, reason: 'insufficient-copper', cost };
    }

    // Cura HP (inclui KO). healFull não depende de clearCooldowns.
    vitalsStore.healFull();
    const after = getMedicHpSnapshot();
    const healedHp = Math.max(0, after.currentHp - before.currentHp);

    // Se por algum motivo não curou (ex.: invencível absurdo), estorno.
    if (after.missingHp > 0 && after.currentHp <= before.currentHp) {
      economyService.grantCurrency('copper', cost, 'medic', { refund: true });
      return { ok: false, reason: 'invalid', cost };
    }

    medicStore.markHealed();
    emitSystemMessage(
      `Centro de Cura: equipe recuperada (−${cost} Copper).`,
    );
    return { ok: true, cost, healedHp };
  } finally {
    busy = false;
  }
}

/** Testes: libera o lock sem efeitos. */
export function resetMedicBusyForTests(): void {
  busy = false;
}
