import type { GuildAction, GuildMember, GuildMemberRole } from '@/types/guild';

/**
 * Permissions engine — regras centralizadas.
 * UI e provider devem consultar isto; não espalhar `if role === leader`.
 */
const ROLE_ACTIONS: Record<GuildMemberRole, ReadonlySet<GuildAction>> = {
  leader: new Set([
    'editGuild',
    'inviteMember',
    'approveMember',
    'kickMember',
    'promoteMember',
    'demoteMember',
    'transferLeadership',
    'dissolveGuild',
    'leaveGuild',
    'viewApplications',
  ]),
  officer: new Set([
    'inviteMember',
    'approveMember',
    'kickMember',
    'viewApplications',
    'leaveGuild',
  ]),
  member: new Set(['leaveGuild']),
};

export function canGuildMemberPerform(
  member: Pick<GuildMember, 'role'> | null | undefined,
  action: GuildAction,
): boolean {
  if (!member) return false;
  return ROLE_ACTIONS[member.role]?.has(action) ?? false;
}

/** Kick: actor precisa da ação; não pode kickar líder; officer só kicka member. */
export function canKickMember(
  actor: Pick<GuildMember, 'playerId' | 'role'> | null,
  target: Pick<GuildMember, 'playerId' | 'role'> | null,
): boolean {
  if (!actor || !target) return false;
  if (actor.playerId === target.playerId) return false;
  if (target.role === 'leader') return false;
  if (!canGuildMemberPerform(actor, 'kickMember')) return false;
  if (actor.role === 'officer' && target.role !== 'member') return false;
  return true;
}

/** Promote: só leader; target não pode já ser leader; promote máximo a officer. */
export function canPromoteMember(
  actor: Pick<GuildMember, 'role'> | null,
  target: Pick<GuildMember, 'role'> | null,
  nextRole: GuildMemberRole,
): boolean {
  if (!actor || !target) return false;
  if (!canGuildMemberPerform(actor, 'promoteMember')) return false;
  if (nextRole === 'leader') return false;
  if (target.role === 'leader') return false;
  if (nextRole === 'officer' && target.role === 'member') return true;
  return false;
}

export function canDemoteMember(
  actor: Pick<GuildMember, 'role'> | null,
  target: Pick<GuildMember, 'role'> | null,
): boolean {
  if (!actor || !target) return false;
  if (!canGuildMemberPerform(actor, 'demoteMember')) return false;
  if (target.role === 'leader') return false;
  return target.role === 'officer';
}

export function canTransferLeadership(
  actor: Pick<GuildMember, 'playerId' | 'role'> | null,
  target: Pick<GuildMember, 'playerId' | 'role'> | null,
): boolean {
  if (!actor || !target) return false;
  if (actor.playerId === target.playerId) return false;
  if (!canGuildMemberPerform(actor, 'transferLeadership')) return false;
  return target.role !== 'leader';
}

export function canDissolveGuild(actor: Pick<GuildMember, 'role'> | null): boolean {
  return canGuildMemberPerform(actor, 'dissolveGuild');
}

/** Leader não pode leave direto — precisa transferir ou dissolver. */
export function canLeaveGuild(
  member: Pick<GuildMember, 'role'> | null,
  memberCount: number,
): { ok: boolean; reason?: string } {
  if (!member) return { ok: false, reason: 'Não é membro.' };
  if (member.role === 'leader') {
    if (memberCount <= 1) {
      return { ok: false, reason: 'Dissolva a Guild (você é o único membro).' };
    }
    return { ok: false, reason: 'Transfira a liderança antes de sair, ou dissolva a Guild.' };
  }
  return { ok: true };
}
