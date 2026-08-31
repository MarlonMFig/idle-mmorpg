import { socialFetch, SocialApiError } from '@/lib/social-api-client';
import type { BossReward } from '@/types/boss';
import type { CloudSavePayload } from '@/server/social/save-service';
import type {
  GuildBossAttemptEndReason,
  GuildBossParticipant,
  GuildBossProvider,
  GuildBossState,
  GuildBossSubmitResult,
} from '@/types/guild-boss';

const POLL_HINT_MS = 5_000;

export class BackendGuildBossProvider implements GuildBossProvider {
  readonly id = 'backend';
  /** Intervalo sugerido de polling (UI). */
  readonly pollIntervalMs = POLL_HINT_MS;

  async getBossState(guildId: string): Promise<GuildBossState | null> {
    const data = await socialFetch<{ state: GuildBossState | null }>(
      `/api/social/guild-boss?guildId=${encodeURIComponent(guildId)}`,
    );
    return data.state;
  }

  async ensureCycle(guildId: string, guildLevel: number): Promise<GuildBossState> {
    const data = await socialFetch<{ state: GuildBossState }>('/api/social/guild-boss', {
      method: 'POST',
      body: JSON.stringify({ action: 'ensure', guildId, guildLevel }),
    });
    return data.state;
  }

  async startAttempt(input: { guildId: string; playerId: string; nickname: string }): Promise<{
    ok: boolean;
    reason?: string;
    attemptId?: string;
    startHp?: number;
    maxHp?: number;
  }> {
    try {
      return await socialFetch('/api/social/guild-boss', {
        method: 'POST',
        nickname: input.nickname,
        body: JSON.stringify({ action: 'start', guildId: input.guildId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, reason: e.message };
      throw e;
    }
  }

  async submitAttempt(input: {
    guildId: string;
    attemptId: string;
    playerId: string;
    damage: number;
    endReason: GuildBossAttemptEndReason;
  }): Promise<GuildBossSubmitResult> {
    try {
      return await socialFetch('/api/social/guild-boss', {
        method: 'POST',
        body: JSON.stringify({
          action: 'submit',
          guildId: input.guildId,
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

  async getParticipants(guildId: string): Promise<GuildBossParticipant[]> {
    const data = await socialFetch<{ participants: GuildBossParticipant[] }>(
      '/api/social/guild-boss',
      {
        method: 'POST',
        body: JSON.stringify({ action: 'participants', guildId }),
      },
    );
    return data.participants ?? [];
  }

  async claimReward(input: { guildId: string; playerId: string; claimId: string }): Promise<{
    ok: boolean;
    reason?: string;
    rewards?: BossReward[];
    serverApplied?: boolean;
    save?: CloudSavePayload;
  }> {
    try {
      return await socialFetch('/api/social/guild-boss', {
        method: 'POST',
        body: JSON.stringify({
          action: 'claim',
          guildId: input.guildId,
          claimId: input.claimId,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, reason: e.message };
      throw e;
    }
  }
}

export class UnavailableGuildBossProvider implements GuildBossProvider {
  readonly id = 'unavailable';
  private fail(): never {
    throw new SocialApiError(
      'UNAVAILABLE',
      'Guild Boss indisponível (backend não configurado).',
      503,
    );
  }
  async getBossState(): Promise<GuildBossState | null> {
    this.fail();
  }
  async ensureCycle(): Promise<GuildBossState> {
    this.fail();
  }
  async startAttempt(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: false, reason: 'Guild Boss indisponível.' };
  }
  async submitAttempt(): Promise<GuildBossSubmitResult> {
    return {
      ok: false,
      reason: 'Guild Boss indisponível.',
      validDamage: 0,
      currentHp: 0,
      defeated: false,
      alreadyProcessed: false,
      milestonesReached: [],
    };
  }
  async getParticipants(): Promise<GuildBossParticipant[]> {
    return [];
  }
  async claimReward(): Promise<{ ok: boolean; reason?: string }> {
    return { ok: false, reason: 'Guild Boss indisponível.' };
  }
}

let singleton: BackendGuildBossProvider | null = null;
export function getBackendGuildBossProvider(): BackendGuildBossProvider {
  if (!singleton) singleton = new BackendGuildBossProvider();
  return singleton;
}
