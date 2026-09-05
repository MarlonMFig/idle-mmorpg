import type { HeritageSlotId } from '@/constants/heritage-system';

export type SenninPhase = 'idle' | 'charging' | 'active' | 'cooldown';

/** Nível atual (1–5) por id de opção — progresso persiste ao trocar de opção. */
export type HeritageOptionLevels = Record<string, number>;

export interface HeritageLoadout {
  /**
   * Portão ativo (0 = fechado). Um único por vez — valores não cumulativos.
   * Pode ser qualquer nível ≤ unlockedGateLevel.
   */
  openGateLevel: number;
  /**
   * Maior portão já desbloqueado (0 = nenhum). Desbloqueio em ordem:
   * só ativa o N+1 depois de desbloquear o N.
   */
  unlockedGateLevel: number;
  claId: string | null;
  summonId: string | null;
  senninId: string | null;
  cursedSealId: string | null;
  /** Progresso de nível por opção (ex.: cla-uchiha: 4). */
  optionLevels: HeritageOptionLevels;
}

export interface SenninRuntimeState {
  phase: SenninPhase;
  /** Timestamp de início da fase atual. */
  phaseStartedAt: number;
  /** Se true, carga pausa (jogador atacou). */
  chargeInterrupted: boolean;
}

export interface HeritageState {
  loadout: HeritageLoadout;
  sennin: SenninRuntimeState;
}

export const DEFAULT_HERITAGE_LOADOUT: HeritageLoadout = {
  openGateLevel: 0,
  unlockedGateLevel: 0,
  claId: null,
  summonId: null,
  senninId: null,
  cursedSealId: null,
  optionLevels: {},
};

export const DEFAULT_SENNIN_RUNTIME: SenninRuntimeState = {
  phase: 'idle',
  phaseStartedAt: 0,
  chargeInterrupted: false,
};

export const DEFAULT_HERITAGE_STATE: HeritageState = {
  loadout: { ...DEFAULT_HERITAGE_LOADOUT, optionLevels: {} },
  sennin: { ...DEFAULT_SENNIN_RUNTIME },
};

export type HeritageSlotSelection = Record<HeritageSlotId, string | null>;
