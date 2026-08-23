'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GUILD_COLORS,
  GUILD_CREATE_MIN_LEVEL,
  GUILD_DEFAULT_EMBLEM,
  GUILD_DESCRIPTION_MAX,
  GUILD_EMBLEMS,
  GUILD_MEMBER_LIMIT,
  GUILD_NAME_MAX,
  GUILD_TAG_MAX,
  GUILD_TOP_CONTRIBUTORS,
  guildXpForLevel,
} from '@/constants/guild';
import { useStore } from '@/hooks/use-store';
import {
  canDemoteMember,
  canDissolveGuild,
  canKickMember,
  canLeaveGuild,
  canPromoteMember,
  canTransferLeadership,
  canGuildMemberPerform,
} from '@/lib/guild-permissions';
import {
  guildStore,
  isValidGuildName,
  isValidGuildTag,
  normalizeGuildName,
  normalizeGuildTag,
} from '@/stores/guild-store';
import {
  crestGlow,
  GuildBannerPicker,
  GuildEmblem,
  resolveEmblemIndex,
} from '@/ui/guild/guild-banner-picker';
import { GuildBossTab } from '@/ui/guild/guild-boss-tab';
import { GuildShopTab } from '@/ui/guild/guild-shop-tab';
import { MgrWindow } from '@/ui/mgr';
import { vitalsStore } from '@/stores/vitals-store';
import type {
  Guild,
  GuildJoinMode,
  GuildMember,
  GuildPublicSummary,
  GuildUiTabId,
} from '@/types/guild';
import { GUILD_ROLE_LABEL, GUILD_ROLE_ORDER } from '@/types/guild';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const TABS: { id: GuildUiTabId; label: string }[] = [
  { id: 'overview', label: 'Visão Geral' },
  { id: 'members', label: 'Membros' },
  { id: 'progress', label: 'Progresso' },
  { id: 'applications', label: 'Solicitações' },
  { id: 'boss', label: 'Boss' },
  { id: 'shop', label: 'Loja' },
];

type MemberSort = 'role' | 'contribution' | 'playerLevel' | 'lastActiveAt';

/**
 * Guild UI (Item 28) — social/progressivo.
 * Sem Boss / War / Ranking / Shop / bônus de combate.
 */
export function GuildPanel() {
  const isOpen = useStore(guildStore, (s) => s.isOpen);
  const guildId = useStore(guildStore, (s) => s.guildId);
  const playerId = useStore(guildStore, (s) => s.playerId);
  const registryTick = useStore(guildStore, (s) => s.registryTick);
  const uiTab = useStore(guildStore, (s) => s.uiTab);
  const lobbyMode = useStore(guildStore, (s) => s.lobbyMode);
  const level = useStore(vitalsStore, (s) => s.level);
  const canAccess = level >= GUILD_CREATE_MIN_LEVEL;

  const myGuild = useMemo(() => {
    void registryTick;
    void guildId;
    return guildStore.getMyGuild();
  }, [registryTick, guildId]);

  const myMember = useMemo(() => {
    if (!myGuild || !playerId) return null;
    return myGuild.members.find((m) => m.playerId === playerId) ?? null;
  }, [myGuild, playerId, registryTick]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        guildStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <MgrWindow
      title="Guild"
      lede={
        myGuild
          ? `${myGuild.name} · Nv. ${myGuild.level}`
          : 'Grupos sociais multi-linhagem do hub'
      }
      pill={
        !canAccess
          ? `Nv. ${GUILD_CREATE_MIN_LEVEL}+`
          : myGuild
            ? `[${myGuild.tag}]`
            : undefined
      }
      icon="⚑"
      size="lg"
      tabs={myGuild ? TABS : undefined}
      activeTab={uiTab}
      onTabChange={(id) => guildStore.setUiTab(id as GuildUiTabId)}
      onClose={() => guildStore.setOpen(false)}
    >
      {!myGuild ? (
        <LobbyView canAccess={canAccess} level={level} mode={lobbyMode} />
      ) : (
        <GuildHome
          guild={myGuild}
          me={myMember}
          playerId={playerId}
          tab={uiTab}
          onTab={(t) => guildStore.setUiTab(t)}
        />
      )}
    </MgrWindow>
  );
}

function LobbyView({
  canAccess,
  level,
  mode,
}: {
  canAccess: boolean;
  level: number;
  mode: 'home' | 'create' | 'search';
}) {
  if (mode === 'create') {
    return <CreateGuildForm canAccess={canAccess} onBack={() => guildStore.setLobbyMode('home')} />;
  }
  if (mode === 'search') {
    return <SearchGuildView canAccess={canAccess} onBack={() => guildStore.setLobbyMode('home')} />;
  }
  return (
    <div className="guild-win__lobby">
      <div className="guild-win__lobby-hero">
        <div>
          <h2>Você não está em uma Guild</h2>
          <p>
            Guilds são grupos sociais multi-linhagem. Liberadas no nível {GUILD_CREATE_MIN_LEVEL}.
            Seu nível: <strong>{level}</strong>
          </p>
        </div>
      </div>
      <div className="guild-win__lobby-actions">
        <button
          type="button"
          className="guild-win__btn-gold"
          disabled={!canAccess}
          onClick={() => guildStore.setLobbyMode('create')}
        >
          Criar Guild
        </button>
        <button
          type="button"
          className="guild-win__btn-green"
          disabled={!canAccess}
          onClick={() => guildStore.setLobbyMode('search')}
        >
          Buscar Guild
        </button>
      </div>
    </div>
  );
}

function CreateGuildForm({ canAccess, onBack }: { canAccess: boolean; onBack: () => void }) {
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [description, setDescription] = useState('');
  const [joinMode, setJoinMode] = useState<GuildJoinMode>('open');
  const [emblemIdx, setEmblemIdx] = useState(0);
  const [emblemColor, setEmblemColor] = useState<string>(GUILD_COLORS[0]);
  const emblem = GUILD_EMBLEMS[emblemIdx] ?? GUILD_EMBLEMS[0];

  return (
    <form
      className="guild-win__create-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValidGuildName(name) || !isValidGuildTag(tag)) return;
        void guildStore.createGuild({
          name,
          tag,
          description,
          joinMode,
          emblemIcon: emblem?.icon ?? GUILD_DEFAULT_EMBLEM,
          emblemBg: emblemColor,
        });
      }}
    >
      <button type="button" className="guild-win__link-back" onClick={onBack}>
        ← Voltar
      </button>
      <h2>Criar Guild</h2>
      <label>
        Nome
        <input
          value={name}
          maxLength={GUILD_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Anime Legends"
        />
      </label>
      <label>
        Tag
        <input
          value={tag}
          maxLength={GUILD_TAG_MAX}
          onChange={(e) => setTag(normalizeGuildTag(e.target.value))}
          placeholder="AL"
        />
      </label>
      <label>
        Descrição
        <textarea
          rows={3}
          maxLength={GUILD_DESCRIPTION_MAX}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <GuildBannerPicker
        emblemIdx={emblemIdx}
        emblemColor={emblemColor}
        onEmblemIdx={setEmblemIdx}
        onEmblemColor={setEmblemColor}
      />
      <fieldset className="guild-win__join-mode">
        <legend>Modo de entrada</legend>
        <label>
          <input
            type="radio"
            checked={joinMode === 'open'}
            onChange={() => setJoinMode('open')}
          />{' '}
          Open (entrada direta)
        </label>
        <label>
          <input
            type="radio"
            checked={joinMode === 'approval'}
            onChange={() => setJoinMode('approval')}
          />{' '}
          Approval (aprovação)
        </label>
      </fieldset>
      <p className="guild-win__hint">
        Preview: [{normalizeGuildTag(tag) || 'TAG'}] {normalizeGuildName(name) || 'Nome'} · Limite{' '}
        {GUILD_MEMBER_LIMIT} membros · Sem custo neste item
      </p>
      <button type="submit" className="guild-win__btn-gold" disabled={!canAccess}>
        Criar
      </button>
    </form>
  );
}

function SearchGuildView({ canAccess, onBack }: { canAccess: boolean; onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<GuildPublicSummary[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void guildStore.searchGuilds(query, page).then((res) => {
      if (cancelled) return;
      setRows(res.guilds);
      setTotal(res.total);
    });
    return () => {
      cancelled = true;
    };
  }, [query, page]);

  return (
    <div className="guild-win__search">
      <button type="button" className="guild-win__link-back" onClick={onBack}>
        ← Voltar
      </button>
      <h2>Buscar Guild</h2>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(0);
        }}
        placeholder="Nome ou tag"
      />
      <ul className="guild-win__browse">
        {rows.length === 0 ? (
          <li className="guild-win__empty">Nenhuma Guild encontrada.</li>
        ) : (
          rows.map((g) => {
            const full = g.memberCount >= g.maxMembers;
            const bg = g.emblemBg ?? '#7f1d1d';
            const icon = g.emblemIcon ?? GUILD_DEFAULT_EMBLEM;
            return (
              <li key={g.id} className="guild-win__browse-row">
                <span className="guild-win__browse-crest" style={{ background: crestGlow(bg) }}>
                  <GuildEmblem value={icon} />
                </span>
                <div className="guild-win__browse-info">
                  <strong>
                    [{g.tag}] {g.name}
                  </strong>
                  <span>
                    Lv.{g.level} · {g.memberCount}/{g.maxMembers} ·{' '}
                    {g.joinMode === 'open' ? 'Open' : 'Approval'}
                  </span>
                </div>
                <button
                  type="button"
                  className="guild-win__btn-green"
                  disabled={!canAccess || full}
                  onClick={() => void guildStore.joinGuild(g.id)}
                >
                  {full ? 'Cheia' : g.joinMode === 'open' ? 'Entrar' : 'Solicitar'}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <div className="guild-win__pager">
        <button type="button" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          Anterior
        </button>
        <span>
          Página {page + 1} · {total} guilds
        </span>
        <button
          type="button"
          disabled={(page + 1) * 20 >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

function GuildHome({
  guild,
  me,
  playerId,
  tab,
}: {
  guild: Guild;
  me: GuildMember | null;
  playerId: string | null;
  tab: GuildUiTabId;
  onTab?: (t: GuildUiTabId) => void;
}) {
  const xpNeed = guildXpForLevel(guild.level);
  const xpPct = Math.min(100, Math.round((guild.xp / xpNeed) * 100));
  const leader = guild.members.find((m) => m.playerId === guild.leaderId);
  const emblemIcon = guild.legacy?.emblemIcon ?? GUILD_DEFAULT_EMBLEM;
  const emblemBg = guild.legacy?.emblemBg ?? '#7f1d1d';

  return (
    <>
      <section className="guild-win__header">
        <div className="guild-win__header-identity">
          <span className="guild-win__header-crest" style={{ background: crestGlow(emblemBg) }}>
            <GuildEmblem value={emblemIcon} className="guild-win__crest-icon" />
          </span>
          <div>
            <div className="guild-win__name-row">
              <h2 className="guild-win__name">{guild.name}</h2>
              <span className="guild-win__tag">[{guild.tag}]</span>
            </div>
            <p className="guild-win__meta">
              Level <strong>{guild.level}</strong>
              <span className="guild-win__dot">•</span>
              Membros{' '}
              <strong>
                {guild.members.length}/{guild.maxMembers}
              </strong>
              <span className="guild-win__dot">•</span>
              Líder <strong>{leader?.nickname ?? '—'}</strong>
              <span className="guild-win__dot">•</span>
              {guild.joinMode === 'open' ? 'Open' : 'Approval'}
            </p>
          </div>
        </div>
        <div className="guild-win__exp-row">
          <span className="guild-win__exp-label">Guild XP</span>
          <span className="guild-win__exp-nums">
            {fmt(guild.xp)} / {fmt(xpNeed)} ({xpPct}%)
          </span>
          <div className="guild-win__exp-bar">
            <span style={{ width: `${xpPct}%` }} />
          </div>
        </div>
      </section>

      <div className="guild-win__body">
        {tab === 'overview' ? <OverviewTab guild={guild} me={me} /> : null}
        {tab === 'members' ? <MembersTab guild={guild} me={me} playerId={playerId} /> : null}
        {tab === 'progress' ? <ProgressTab guild={guild} /> : null}
        {tab === 'applications' ? <ApplicationsTab guild={guild} me={me} /> : null}
        {tab === 'boss' ? <GuildBossTab guild={guild} /> : null}
        {tab === 'shop' ? <GuildShopTab guild={guild} /> : null}
      </div>
    </>
  );
}

function OverviewTab({ guild, me }: { guild: Guild; me: GuildMember | null }) {
  const leaveCheck = canLeaveGuild(me, guild.members.length);
  const [desc, setDesc] = useState(guild.description);
  const canEdit = canGuildMemberPerform(me, 'editGuild');
  const [emblemIdx, setEmblemIdx] = useState(() => resolveEmblemIndex(guild.legacy?.emblemIcon));
  const [emblemColor, setEmblemColor] = useState(guild.legacy?.emblemBg ?? GUILD_COLORS[0]);

  useEffect(() => {
    setDesc(guild.description);
    setEmblemIdx(resolveEmblemIndex(guild.legacy?.emblemIcon));
    setEmblemColor(guild.legacy?.emblemBg ?? GUILD_COLORS[0]);
  }, [guild.id, guild.description, guild.legacy?.emblemIcon, guild.legacy?.emblemBg]);

  return (
    <div className="guild-win__overview">
      <p className="guild-win__desc">{guild.description || 'Sem descrição.'}</p>
      {canEdit ? (
        <div className="guild-win__edit-block">
          <label>
            Descrição
            <textarea
              rows={2}
              maxLength={GUILD_DESCRIPTION_MAX}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </label>
          <GuildBannerPicker
            emblemIdx={emblemIdx}
            emblemColor={emblemColor}
            onEmblemIdx={setEmblemIdx}
            onEmblemColor={setEmblemColor}
          />
          <div className="guild-win__row-actions">
            <button
              type="button"
              className="guild-win__btn-gold"
              onClick={() =>
                void guildStore.editGuild({
                  description: desc,
                  emblemIcon: GUILD_EMBLEMS[emblemIdx]?.icon ?? GUILD_DEFAULT_EMBLEM,
                  emblemBg: emblemColor,
                })
              }
            >
              Salvar descrição e banner
            </button>
            <button
              type="button"
              className="guild-win__btn-green"
              onClick={() =>
                void guildStore.editGuild({
                  joinMode: guild.joinMode === 'open' ? 'approval' : 'open',
                })
              }
            >
              Alternar modo ({guild.joinMode === 'open' ? '→ Approval' : '→ Open'})
            </button>
          </div>
        </div>
      ) : null}

      <h4>Histórico recente</h4>
      <ul className="guild-win__activity">
        {guild.activity.length === 0 ? (
          <li className="guild-win__empty">Nenhum evento ainda.</li>
        ) : (
          guild.activity.slice(0, 12).map((a) => (
            <li key={a.id}>
              <span>{fmtTime(a.timestamp)}</span> {a.message}
            </li>
          ))
        )}
      </ul>

      <div className="guild-win__danger-zone">
        {leaveCheck.ok ? (
          <button
            type="button"
            className="guild-win__btn-danger"
            onClick={() => {
              if (window.confirm('Sair desta Guild?')) void guildStore.leaveGuild();
            }}
          >
            Sair da Guild
          </button>
        ) : (
          <p className="guild-win__hint">{leaveCheck.reason}</p>
        )}
        {canDissolveGuild(me) ? (
          <button
            type="button"
            className="guild-win__btn-danger"
            onClick={() => {
              const a = window.prompt('Digite DISSOLVER para confirmar a dissolução da Guild:');
              if (a === 'DISSOLVER') void guildStore.dissolveGuild();
            }}
          >
            Dissolver Guild
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MembersTab({
  guild,
  me,
  playerId,
}: {
  guild: Guild;
  me: GuildMember | null;
  playerId: string | null;
}) {
  const [sort, setSort] = useState<MemberSort>('role');
  const sorted = useMemo(() => {
    const list = [...guild.members];
    list.sort((a, b) => {
      if (sort === 'role') {
        if (GUILD_ROLE_ORDER[a.role] !== GUILD_ROLE_ORDER[b.role]) {
          return GUILD_ROLE_ORDER[a.role] - GUILD_ROLE_ORDER[b.role];
        }
        return b.contribution - a.contribution;
      }
      if (sort === 'contribution') return b.contribution - a.contribution;
      if (sort === 'playerLevel') return b.playerLevel - a.playerLevel;
      return b.lastActiveAt - a.lastActiveAt;
    });
    return list;
  }, [guild.members, sort]);

  return (
    <div className="guild-win__members">
      <div className="guild-win__sort">
        <span>Ordenar:</span>
        {(
          [
            ['role', 'Cargo'],
            ['contribution', 'Contribution'],
            ['playerLevel', 'Level'],
            ['lastActiveAt', 'Atividade'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={sort === id ? 'is-active' : undefined}
            onClick={() => setSort(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="guild-win__member-list">
        {sorted.map((m) => (
          <li key={m.playerId} className={m.playerId === playerId ? 'is-me' : ''}>
            <div className="guild-win__member-main">
              <span className="guild-win__member-name">
                {m.nickname}
                {m.playerId === playerId ? ' (você)' : ''}
              </span>
              <span className={`guild-win__role guild-win__role--${m.role}`}>
                {GUILD_ROLE_LABEL[m.role]}
              </span>
            </div>
            <span className="guild-win__member-stat">
              Lv.{m.playerLevel} · Contrib. {fmt(m.contribution)} · {fmtTime(m.lastActiveAt)}
            </span>
            <div className="guild-win__member-actions">
              {canPromoteMember(me, m, 'officer') ? (
                <button type="button" onClick={() => void guildStore.setMemberRole(m.playerId, 'officer')}>
                  Promover
                </button>
              ) : null}
              {canDemoteMember(me, m) ? (
                <button type="button" onClick={() => void guildStore.setMemberRole(m.playerId, 'member')}>
                  Rebaixar
                </button>
              ) : null}
              {canKickMember(me, m) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Expulsar ${m.nickname}?`)) {
                      void guildStore.kickMember(m.playerId);
                    }
                  }}
                >
                  Expulsar
                </button>
              ) : null}
              {canTransferLeadership(me, m) ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Transferir liderança para ${m.nickname}?`)) {
                      void guildStore.transferLeadership(m.playerId);
                    }
                  }}
                >
                  Transferir liderança
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProgressTab({ guild }: { guild: Guild }) {
  const need = guildXpForLevel(guild.level);
  const totalContribution = guild.members.reduce((sum, m) => sum + m.contribution, 0);
  const top = [...guild.members]
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, GUILD_TOP_CONTRIBUTORS);

  return (
    <div className="guild-win__progress">
      <p>
        Guild Level <strong>{guild.level}</strong>
      </p>
      <p>
        XP {fmt(guild.xp)} / {fmt(need)}
      </p>
      <p>Contribution total (all-time): {fmt(totalContribution)}</p>
      <h4>Top contribuidores</h4>
      <ol>
        {top.map((m, i) => (
          <li key={m.playerId}>
            #{i + 1} {m.nickname} — {fmt(m.contribution)}
          </li>
        ))}
      </ol>
      <p className="guild-win__hint">
        Kills Online geram Guild XP e Contribution. Offline / Dev Lab: 0.
      </p>
    </div>
  );
}

function ApplicationsTab({ guild, me }: { guild: Guild; me: GuildMember | null }) {
  const canApprove = canGuildMemberPerform(me, 'approveMember');
  if (guild.joinMode !== 'approval') {
    return (
      <p className="guild-win__hint">
        Esta Guild está em modo Open. Solicitações só aparecem no modo Approval.
      </p>
    );
  }
  if (!canApprove) {
    return <p className="guild-win__hint">Apenas Líder/Oficial gerenciam solicitações.</p>;
  }
  if (guild.applications.length === 0) {
    return <p className="guild-win__hint">Nenhuma solicitação pendente.</p>;
  }
  return (
    <ul className="guild-win__apps">
      {guild.applications.map((a) => (
        <li key={a.playerId}>
          <div>
            <strong>{a.nickname}</strong> · Lv.{a.playerLevel} · {fmtTime(a.requestedAt)}
          </div>
          <div className="guild-win__row-actions">
            <button
              type="button"
              className="guild-win__btn-green"
              onClick={() => void guildStore.approveApplication(a.playerId)}
            >
              Aprovar
            </button>
            <button
              type="button"
              className="guild-win__btn-danger"
              onClick={() => void guildStore.rejectApplication(a.playerId)}
            >
              Recusar
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
