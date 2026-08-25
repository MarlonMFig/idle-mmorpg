import { getXpMultiplier } from '@/config/devConfig';
import { d, type Decimal } from '@/lib/decimal';
import { computeHuntKillXp } from '@/lib/hunt-kill-xp';
import { applyStageXpGain } from '@/lib/player-progression';
import { expProgressMultiplier } from '@/lib/progression-bonuses';
import { achievementsStore } from '@/stores/achievements-store';
import { attributesStore } from '@/stores/attributes-store';
import { missionsStore } from '@/stores/missions-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import { vitalsStore } from '@/stores/vitals-store';

function syncAccountLevelUp(accountLeveled: boolean): void {
  achievementsStore.evaluate('playerLevel');
  missionsStore.syncStateMissions();
  if (!accountLeveled) return;
  const villageId = villageStore.getPlayerVillageId();
  if (villageId) {
    skillsStore.syncLevelUnlocks(villageId, vitalsStore.getLevel());
  }
}

/** Concede XP (com rate de stage WONSR) e sincroniza atributos em level-up.
 *  @returns XP efetivamente concedido (após multiplicadores).
 */
export function grantPlayerXp(amount: number | Decimal): Decimal {
  const raw = d(amount);
  if (raw.lte(0)) return d(0);
  const scaled = applyStageXpGain(
    raw.mul(getXpMultiplier()).mul(expProgressMultiplier()),
    vitalsStore.getLevel(),
  );
  const accountLeveled = vitalsStore.addXp(scaled);
  syncAccountLevelUp(accountLeveled);
  const active = teamStore.getActive();
  const characterLeveled = active ? teamStore.addCharacterXp(active.id, scaled) : false;
  if (characterLeveled) {
    attributesStore.onLevelChanged(true);
  }
  return scaled;
}

/** Personagem da caçada: o ativo. Sem ativo, o primeiro da formação. */
function huntHunter(): { id: string; level: number } | null {
  const active = teamStore.getActive();
  if (active) return { id: active.id, level: Math.max(1, active.level) };
  const { teamIds } = teamStore.getSnapshot();
  for (const id of teamIds) {
    if (!id) continue;
    const member = teamStore.getCharacterInstance(id);
    if (member) return { id: member.id, level: Math.max(1, member.level) };
  }
  return null;
}

/**
 * XP de kill na Hunt: HP × Δ do caçador. Sem faixas WONSR.
 * Só o personagem escolhido para a caçada ganha XP (não a equipe).
 * A conta ainda recebe o mesmo valor; o Δ é o do caçador, nunca vitals.level.
 * Captura não chama isto.
 */
export function grantHuntKillXp(enemyHp: number | Decimal, enemyLevel: number): Decimal {
  const hunter = huntHunter();
  const boosts = getXpMultiplier() * expProgressMultiplier();
  const row = computeHuntKillXp({
    playerLevel: hunter?.level ?? 1,
    enemyLevel,
    enemyHp,
    xpMultiplier: boosts,
  });
  const amount = row.finalXp;
  const accountLeveled = vitalsStore.addXp(amount);
  syncAccountLevelUp(accountLeveled);
  if (hunter && teamStore.addCharacterXp(hunter.id, amount)) {
    attributesStore.onLevelChanged(true);
  }
  return amount;
}
