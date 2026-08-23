import { socialFetch, SocialApiError } from '@/lib/social-api-client';
import type { BossReward } from '@/types/boss';
import type {
  WorldBossAttemptEndReason,
  WorldBossCycleState,
  WorldBossProvider,
  WorldBossRankingSnapshot,
  WorldBossSubmitResult,
} from '@/types/world-boss';

const POLL_HINT_MS = 5_000;

export class BackendWorldBossProvider implements WorldBossProvider {
  readonly id = 'backend';
  /** Intervalo sugerido de polling (UI). */
  readonly pollIntervalMs = POLL_HINT_MS;

  async getState(): Promise<WorldBossCycleState | null> {
    const data = await socialFetch<{ state: WorldBossCycleState | null }>(
      '/api/social/world-boss',
    );
    return data.state;
  }

  async ensureCycle(playerLevel?: number): Promise<WorldBossCycleState> {
    const data = await socialFetch<{ state: WorldBossCycleState }>('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({ action: 'ensure', playerLevel }),
    });
    return data.state;
  }

  async startAttempt(input: {
    playerId: string;
    nickname: string;
    playerLevel: number;
  }): Promise<{
    ok: boolean;
    reason?: string;
    attemptId?: string;
    startHp?: number;
    maxHp?: number;
    cycleId?: string;
  }> {
    try {
      return await socialFetch('/api/social/world-boss', {
        method: 'POST',
        nickname: input.nickname,
        body: JSON.stringify({
          action: 'start',
          playerLevel: input.playerLevel,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, reason: e.message };
      throw e;
    }
  }

  async submitAttempt(input: {
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: WorldBossAttemptEndReason;
  }): Promise<WorldBossSubmitResult> {
    try {
      return await socialFetch('/api/social/world-boss', {
        method: 'POST',
        body: JSON.stringify({
          action: 'submit',
          attemptId: input.attemptId,
          damage: input.damage,
          endReason: input.endReason,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) {
        return {
          ok: false,
          reason: e.message,
          validDamage: 0,
          currentHp: 0,
          defeated: false,
          alreadyProcessed: false,
          milestonesReached: [],
        };
      }
      throw e;
    }
  }

  async getRanking(playerId: string): Promise<WorldBossRankingSnapshot> {
    const data = await socialFetch<{ ranking: WorldBossRankingSnapshot }>(
      '/api/social/world-boss',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'ranking', playerId }),
      },
    );
    return data.ranking ?? { top: [], myRank: null, totalParticipants: 0 };
  }

  async claimReward(input: {
    playerId: string;
    claimId: string;
  }): Promise<{ ok: boolean; reason?: string; rewards?: BossReward[] }> {
    try {
      return await socialFetch('/api/social/world-boss', {
        method: 'POST',
        body: JSON.stringify({
          action: 'claim',
          claimId: input.claimId,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, reason: e.message };
      throw e;
    }
  }

  async applyExternalDamage(
    damage: number,
    actorId?: string,
    nickname?: string,
  ): Promise<WorldBossSubmitResult> {
    return socialFetch('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({
        action: 'mockDamage',
        damage,
        actorId,
        actorNickname: nickname,
      }),
    });
  }

  async setSharedHp(hp: number): Promise<void> {
    await socialFetch('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({ action: 'setHp', hp }),
    });
  }

  async forceDefeat(opts?: { grantEntitlements?: boolean }): Promise<void> {
    await socialFetch('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({
        action: 'forceDefeat',
        grantEntitlements: opts?.grantEntitlements,
      }),
    });
  }

  async resetCycle(): Promise<void> {
    await socialFetch('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({ action: 'resetCycle' }),
    });
  }

  async resetPlayerAttempts(playerId: string): Promise<void> {
    await socialFetch('/api/social/world-boss', {
      method: 'POST',
      body: JSON.stringify({ action: 'resetAttempts', targetPlayerId: playerId }),
    });
  }
}

export class UnavailableWorldBossProvider implements WorldBossProvider {
  readonly id = 'unavailable';

  private fail(): never {
    throw new SocialApiError(
      'UNAVAILABLE',
      'World Boss indisponível (backend não configurado).',
      503,
    );
  }

  async getState(): Promise<WorldBossCycleState | null> {
    this.fail();
  }

  async ensureCycle(): Promise<WorldBossCycleState> {
    this.fail();
  }

  async startAttempt(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: false, reason: 'World Boss indisponível.' };
  }

  async submitAttempt(): Promise<WorldBossSubmitResult> {
    return {
      ok: false,
      reason: 'World Boss indisponível.',
      validDamage: 0,
      currentHp: 0,
      defeated: false,
      alreadyProcessed: false,
      milestonesReached: [],
    };
  }

  async getRanking(): Promise<WorldBossRankingSnapshot> {
    return { top: [], myRank: null, totalParticipants: 0 };
  }

  async claimReward(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: false, reason: 'World Boss indisponível.' };
  }
}

let singleton: BackendWorldBossProvider | null = null;

export function getBackendWorldBossProvider(): BackendWorldBossProvider {
  if (!singleton) singleton = new BackendWorldBossProvider();
  return singleton;
}
