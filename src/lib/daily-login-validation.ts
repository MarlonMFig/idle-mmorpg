import { getItem } from '@/data/items';
import { DAILY_LOGIN_REWARDS } from '@/data/daily-login/daily-login-rewards';
import { DAILY_LOGIN_CYCLE_LENGTH } from '@/types/daily-login';

export function validateDailyLoginCatalog(): string[] {
  const warnings: string[] = [];
  if (DAILY_LOGIN_REWARDS.length !== DAILY_LOGIN_CYCLE_LENGTH) {
    warnings.push(
      `[DailyLoginValidation] esperado ${DAILY_LOGIN_CYCLE_LENGTH} dias, encontrou ${DAILY_LOGIN_REWARDS.length}`,
    );
  }
  const days = new Set<number>();
  for (const row of DAILY_LOGIN_REWARDS) {
    if (days.has(row.day)) {
      warnings.push(`[DailyLoginValidation] dia duplicado: ${row.day}`);
    }
    days.add(row.day);
    if (row.day < 1 || row.day > 7) {
      warnings.push(`[DailyLoginValidation] day inválido: ${row.day}`);
    }
    if (!row.rewards.length) {
      warnings.push(`[DailyLoginValidation] Dia ${row.day} sem recompensas`);
    }
    for (const reward of row.rewards) {
      if (reward.type === 'copper' && !(reward.amount > 0)) {
        warnings.push(`[DailyLoginValidation] Dia ${row.day} copper inválido`);
      }
      if (reward.type === 'item') {
        if (!getItem(reward.id)) {
          warnings.push(`[DailyLoginValidation] Dia ${row.day} item inexistente: ${reward.id}`);
        }
        if (!(reward.amount > 0)) {
          warnings.push(`[DailyLoginValidation] Dia ${row.day} quantidade inválida`);
        }
      }
    }
  }
  for (let day = 1; day <= 7; day += 1) {
    if (!days.has(day)) warnings.push(`[DailyLoginValidation] falta Dia ${day}`);
  }
  return warnings;
}
