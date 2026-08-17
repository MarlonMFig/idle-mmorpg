/** Bônus e regras do VIP (spec AIW). */

export const VIP_EXP_MULT = 1.2;
/** Usado só no reroll de kill vazio (+15%). */
export const VIP_LOOT_MULT = 1.15;
export const VIP_POTION_RESTOCK_QTY = 10;
export const VIP_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const VIP_OFFLINE_HOURS_BONUS = 4;

export const VIP_BENEFITS = [
  { id: 'exp', label: '+20% EXP', detail: 'Progressão de conta mais rápida.' },
  {
    id: 'loot',
    label: '+15% anti-kill vazio',
    detail: 'Reroll quando o drop sair vazio — não infla Lendário/Mítico.',
  },
  {
    id: 'potion',
    label: 'Poção automática',
    detail: 'Recompra poções no mercado quando o inventário zera.',
  },
  {
    id: 'crystal',
    label: '+1 Cristal/semana',
    detail: '3 cristais de refinamento por semana (F2P: 2).',
  },
  {
    id: 'offline',
    label: 'Offline ampliado',
    detail: `+${VIP_OFFLINE_HOURS_BONUS}h de acúmulo idle.`,
  },
  {
    id: 'guild',
    label: 'Criação de guild',
    detail: 'Fundar guild é exclusivo VIP; entrar continua no Nv. 20.',
  },
  {
    id: 'cosmetic',
    label: 'Cosmético exclusivo',
    detail: 'Moldura/ícone VIP (em breve).',
  },
] as const;
