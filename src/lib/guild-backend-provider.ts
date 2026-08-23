import { socialFetch, SocialApiError } from '@/lib/social-api-client';
import type {
  CreateGuildInput,
  Guild,
  GuildApplication,
  GuildMemberRole,
  GuildProvider,
  GuildSearchQuery,
  GuildSearchResult,
} from '@/types/guild';

export class BackendGuildProvider implements GuildProvider {
  readonly id = 'backend';

  async createGuild(
    input: CreateGuildInput,
    founder: { playerId: string; nickname: string; playerLevel: number },
  ): Promise<Guild> {
    const data = await socialFetch<{ guild: Guild }>('/api/social/guild', {
      method: 'POST',
      nickname: founder.nickname,
      body: JSON.stringify({ action: 'create', ...input, playerLevel: founder.playerLevel }),
    });
    return data.guild;
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    const data = await socialFetch<{ guild: Guild | null }>(
      `/api/social/guild?guildId=${encodeURIComponent(guildId)}`,
    );
    return data.guild;
  }

  async findGuildIdByPlayer(_playerId: string): Promise<string | null> {
    const data = await socialFetch<{ guildId: string | null }>('/api/social/guild?mine=1');
    return data.guildId;
  }

  async searchGuilds(query: GuildSearchQuery): Promise<GuildSearchResult> {
    const params = new URLSearchParams();
    if (query.query) params.set('q', query.query);
    if (query.page != null) params.set('page', String(query.page));
    if (query.pageSize != null) params.set('pageSize', String(query.pageSize));
    return socialFetch(`/api/social/guild?${params}`);
  }

  async joinGuild(
    guildId: string,
    player: { playerId: string; nickname: string; playerLevel: number },
  ): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        nickname: player.nickname,
        body: JSON.stringify({
          action: 'join',
          guildId,
          playerLevel: player.playerLevel,
        }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async leaveGuild(guildId: string, _playerId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'leave', guildId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async dissolveGuild(guildId: string, _playerId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'dissolve', guildId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async updateMemberRole(
    guildId: string,
    _actorId: string,
    targetId: string,
    role: GuildMemberRole,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'role', guildId, targetId, role }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async transferLeadership(
    guildId: string,
    _actorId: string,
    newLeaderId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'transfer', guildId, newLeaderId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async kickMember(
    guildId: string,
    _actorId: string,
    targetId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'kick', guildId, targetId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async editGuild(
    guildId: string,
    _actorId: string,
    patch: import('@/types/guild').EditGuildPatch,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'edit', guildId, ...patch }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async getApplications(guildId: string): Promise<GuildApplication[]> {
    const data = await socialFetch<{ applications: GuildApplication[] }>('/api/social/guild', {
      method: 'POST',
      body: JSON.stringify({ action: 'applications', guildId }),
    });
    return data.applications ?? [];
  }

  async approveApplication(
    guildId: string,
    _actorId: string,
    applicantId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'approve', guildId, applicantId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async rejectApplication(
    guildId: string,
    _actorId: string,
    applicantId: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      return await socialFetch('/api/social/guild', {
        method: 'POST',
        body: JSON.stringify({ action: 'reject', guildId, applicantId }),
      });
    } catch (e) {
      if (e instanceof SocialApiError) return { ok: false, error: e.message };
      throw e;
    }
  }

  async grantOnlineKillProgress(
    guildId: string,
    _playerId: string,
    opts?: { source?: 'online' | 'offline' | 'dev' },
  ): Promise<{ guildXp: number; contribution: number }> {
    return socialFetch('/api/social/guild', {
      method: 'POST',
      body: JSON.stringify({ action: 'grantOnlineKill', guildId, source: opts?.source }),
    });
  }

  async addGuildXp(guildId: string, amount: number): Promise<Guild | null> {
    // Via ensure/boss path; exposed for interface — not used by UI directly.
    void guildId;
    void amount;
    return null;
  }
}

export class UnavailableGuildProvider implements GuildProvider {
  readonly id = 'unavailable';
  private fail(): never {
    throw new SocialApiError('UNAVAILABLE', 'Guild indisponível (backend não configurado).', 503);
  }
  async createGuild(): Promise<Guild> {
    this.fail();
  }
  async getGuild(): Promise<Guild | null> {
    this.fail();
  }
  async searchGuilds(): Promise<GuildSearchResult> {
    this.fail();
  }
  async joinGuild(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async leaveGuild(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async dissolveGuild(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async updateMemberRole(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async transferLeadership(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async kickMember(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async editGuild(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async getApplications(): Promise<GuildApplication[]> {
    this.fail();
  }
  async approveApplication(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async rejectApplication(): Promise<{ ok: boolean; error?: string }> {
    return { ok: false, error: 'Guild indisponível.' };
  }
  async grantOnlineKillProgress(): Promise<{ guildXp: number; contribution: number }> {
    return { guildXp: 0, contribution: 0 };
  }
  async addGuildXp(): Promise<Guild | null> {
    return null;
  }
}

let singleton: BackendGuildProvider | null = null;
export function getBackendGuildProvider(): BackendGuildProvider {
  if (!singleton) singleton = new BackendGuildProvider();
  return singleton;
}
