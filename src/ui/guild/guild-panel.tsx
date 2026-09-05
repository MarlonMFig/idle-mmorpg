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

const HALL_TABS: { id: GuildUiTabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Salão', icon: '⌂' },
  { id: 'members', label: 'Membros', icon: '👥' },
  { id: 'progress', label: 'Progresso', icon: '◆' },
  { id: 'applications', label: 'Solicitações', icon: '✉' },
  { id: 'boss', label: 'Boss', icon: '⚔' },
  { id: 'shop', label: 'Loja', icon: '◈' },
];

/**
 * Guild UI — lobby no MgrWindow; guild ativa no shell Salão (sidebar).
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

  if (myGuild) {
    return (
      <GuildHallShell
        guild={myGuild}
        me={myMember}
        playerId={playerId}
        tab={uiTab}
        onTab={(t) => guildStore.setUiTab(t)}
        onClose={() => guildStore.setOpen(false)}
      />
    );
  }

  return (
    <MgrWindow
      title="Guild"
      lede="Grupos sociais multi-linhagem do hub"
      pill={!canAccess ? `Nv. ${GUILD_CREATE_MIN_LEVEL}+` : undefined}
      icon="⚑"
      size="lg"
      onClose={() => guildStore.setOpen(false)}
    >
      <LobbyView canAccess={canAccess} level={level} mode={lobbyMode} />
    </MgrWindow>
  );
}

function GuildHallShell({
  guild,
  me,
  playerId,
  tab,
  onTab,
  onClose,
}: {
  guild: Guild;
  me: GuildMember | null;
  playerId: string | null;
  tab: GuildUiTabId;
  onTab: (t: GuildUiTabId) => void;
  onClose: () => void;
}) {
  const emblemIcon = guild.legacy?.emblemIcon ?? GUILD_DEFAULT_EMBLEM;
  const emblemBg = guild.legacy?.emblemBg ?? '#7f1d1d';

  return (
    <div
      className="guild-hall-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="guild-hall"
        role="dialog"
        aria-modal="true"
        aria-label={`Salão da Guild — ${guild.name}`}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        style={{ ['--guild-accent' as string]: emblemBg }}
      >
        <aside className="guild-hall__sidebar" aria-label="Navegação da guild">
          <div className="guild-hall__brand">
            <span className="guild-hall__brand-crest" style={{ background: crestGlow(emblemBg) }}>
              <GuildEmblem value={emblemIcon} className="guild-hall__brand-emblem" />
            </span>
            <div className="guild-hall__brand-copy">
              <p className="guild-hall__brand-kicker">Guild</p>
              <p className="guild-hall__brand-tag">[{guild.tag}]</p>
            </div>
          </div>

          <nav className="guild-hall__nav" role="tablist" aria-label="Abas da guild">
            {HALL_TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`guild-hall__nav-btn${tab === entry.id ? ' is-active' : ''}`}
                onClick={() => onTab(entry.id)}
              >
                <span className="guild-hall__nav-icon" aria-hidden>
                  {entry.icon}
                </span>
                <span>{entry.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="guild-hall__main">
          <header className="guild-hall__topbar">
            <div className="guild-hall__topbar-title">
              <h2>{HALL_TABS.find((t) => t.id === tab)?.label ?? 'Guild'}</h2>
              <p>
                {guild.name} · Nv. {guild.level}
              </p>
            </div>
            <button
              type="button"
              className="guild-hall__close"
              onClick={onClose}
              aria-label="Fechar guild"
            >
              ×
            </button>
          </header>

          <div className="guild-hall__content">
            {tab === 'overview' ? (
              <HallOverview guild={guild} me={me} onTab={onTab} />
            ) : null}
            {tab === 'members' ? (
              <MembersTab guild={guild} me={me} playerId={playerId} onTab={onTab} />
            ) : null}
            {tab === 'progress' ? <ProgressTab guild={guild} /> : null}
            {tab === 'applications' ? <ApplicationsTab guild={guild} me={me} /> : null}
            {tab === 'boss' ? <GuildBossTab guild={guild} /> : null}
            {tab === 'shop' ? <GuildShopTab guild={guild} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HallOverview({
  guild,
  me,
  onTab,
}: {
  guild: Guild;
  me: GuildMember | null;
  onTab: (t: GuildUiTabId) => void;
}) {
  const leaveCheck = canLeaveGuild(me, guild.members.length);
  const canEdit = canGuildMemberPerform(me, 'editGuild');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [desc, setDesc] = useState(guild.description);
  const [emblemIdx, setEmblemIdx] = useState(() => resolveEmblemIndex(guild.legacy?.emblemIcon));
  const [emblemColor, setEmblemColor] = useState(guild.legacy?.emblemBg ?? GUILD_COLORS[0]);

  const xpNeed = guildXpForLevel(guild.level);
  const xpPct = Math.min(100, Math.round((guild.xp / Math.max(1, xpNeed)) * 100));
  const leader = guild.members.find((m) => m.playerId === guild.leaderId);
  const emblemIcon = guild.legacy?.emblemIcon ?? GUILD_DEFAULT_EMBLEM;
  const emblemBg = guild.legacy?.emblemBg ?? '#7f1d1d';
  const totalContribution = guild.members.reduce((sum, m) => sum + m.contribution, 0);

  useEffect(() => {
    setDesc(guild.description);
    setEmblemIdx(resolveEmblemIndex(guild.legacy?.emblemIcon));
    setEmblemColor(guild.legacy?.emblemBg ?? GUILD_COLORS[0]);
  }, [guild.id, guild.description, guild.legacy?.emblemIcon, guild.legacy?.emblemBg]);

  return (
    <div className="guild-hall__salon">
      <div className="guild-hall__salon-grid">
        <div
          className="guild-hall__banner"
          style={{ background: crestGlow(emblemBg), ['--banner' as string]: emblemBg }}
        >
          <div className="guild-hall__banner-frame">
            <GuildEmblem value={emblemIcon} className="guild-hall__banner-emblem" />
          </div>
        </div>

        <div className="guild-hall__salon-info">
          <div className="guild-hall__identity">
            <div className="guild-hall__name-block">
              <h3 className="guild-hall__name">{guild.name}</h3>
              <span className="guild-hall__tag">[{guild.tag}]</span>
            </div>
            <div className="guild-hall__level-row">
              <span className="guild-hall__level">Lv. {guild.level}</span>
              <div className="guild-hall__xp">
                <div className="guild-hall__xp-track" role="progressbar" aria-valuenow={xpPct} aria-valuemin={0} aria-valuemax={100}>
                  <span style={{ width: `${xpPct}%` }} />
                </div>
                <p className="guild-hall__xp-nums">
                  {fmt(guild.xp)} / {fmt(xpNeed)} EXP
                </p>
              </div>
            </div>
          </div>

          <div className="guild-hall__stats">
            <HallStat icon="👥" label="Membros" value={`${guild.members.length}/${guild.maxMembers}`} />
            <HallStat icon="◆" label="Contribuição" value={fmt(totalContribution)} />
            <HallStat
              icon="⚑"
              label="Entrada"
              value={guild.joinMode === 'open' ? 'Open' : 'Approval'}
            />
          </div>

          <section className="guild-hall__message" aria-label="Mensagem do líder">
            <h4>Mensagem do Líder</h4>
            <p>{guild.description?.trim() || 'Sem mensagem.'}</p>
            <footer>— Líder: {leader?.nickname ?? '—'}</footer>
          </section>
        </div>
      </div>

      <footer className="guild-hall__actions">
        {canEdit ? (
          <button
            type="button"
            className="guild-hall__action-btn"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <span aria-hidden>⚙</span> Configurações
          </button>
        ) : null}
        <button
          type="button"
          className="guild-hall__action-btn"
          onClick={() => onTab('progress')}
        >
          <span aria-hidden>📜</span> Registro
        </button>
        {leaveCheck.ok ? (
          <button
            type="button"
            className="guild-hall__action-btn guild-hall__action-btn--danger"
            onClick={() => {
              if (window.confirm('Sair desta Guild?')) void guildStore.leaveGuild();
            }}
          >
            <span aria-hidden>↩</span> Sair
          </button>
        ) : (
          <span className="guild-hall__action-hint">{leaveCheck.reason}</span>
        )}
        {canDissolveGuild(me) ? (
          <button
            type="button"
            className="guild-hall__action-btn guild-hall__action-btn--danger"
            onClick={() => {
              const a = window.prompt('Digite DISSOLVER para confirmar a dissolução da Guild:');
              if (a === 'DISSOLVER') void guildStore.dissolveGuild();
            }}
          >
            Dissolver
          </button>
        ) : null}
      </footer>

      {settingsOpen && canEdit ? (
        <div className="guild-hall__settings">
          <h4>Configurações da Guild</h4>
          <label>
            Mensagem / descrição
            <textarea
              rows={3}
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
          <div className="guild-hall__settings-actions">
            <button
              type="button"
              className="guild-win__btn-gold"
              onClick={() => {
                void guildStore.editGuild({
                  description: desc,
                  emblemIcon: GUILD_EMBLEMS[emblemIdx]?.icon ?? GUILD_DEFAULT_EMBLEM,
                  emblemBg: emblemColor,
                });
                setSettingsOpen(false);
              }}
            >
              Salvar
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
            <button type="button" className="guild-hall__action-btn" onClick={() => setSettingsOpen(false)}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HallStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="guild-hall__stat">
      <span className="guild-hall__stat-icon" aria-hidden>
        {icon}
      </span>
      <div>
        <span className="guild-hall__stat-label">{label}</span>
        <strong className="guild-hall__stat-value">{value}</strong>
      </div>
    </div>
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
        <div className="guild-win__lobby-crest" aria-hidden>
          ⚑
        </div>
        <div>
          <p className="guild-win__feature-eyebrow">Social</p>
          <h2>Você não está em uma Guild</h2>
          <p>
            Forme um grupo multi-linhagem, enfrentem o Boss semanal e usem a loja compartilhada.
            Liberado no nível {GUILD_CREATE_MIN_LEVEL}. Seu nível: <strong>{level}</strong>
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

function formatLastAccess(ts: number, now = Date.now()): { label: string; online: boolean } {
  const delta = Math.max(0, now - ts);
  if (delta < 5 * 60_000) return { label: 'Online', online: true };
  const mins = Math.floor(delta / 60_000);
  if (mins < 60) return { label: `${mins}min atrás`, online: false };
  const hours = Math.floor(mins / 60);
  if (hours < 48) return { label: `${hours}h atrás`, online: false };
  const days = Math.floor(hours / 24);
  return { label: `${days}d atrás`, online: false };
}

/** Estimativa visual de poder (sem stat real no modelo). */
function estimateMemberPower(m: GuildMember): number {
  return Math.max(0, m.playerLevel * 12_500 + m.contribution * 40);
}

function MembersTab({
  guild,
  me,
  playerId,
  onTab,
}: {
  guild: Guild;
  me: GuildMember | null;
  playerId: string | null;
  onTab: (t: GuildUiTabId) => void;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const leaveCheck = canLeaveGuild(me, guild.members.length);
  const canInvite =
    canGuildMemberPerform(me, 'inviteMember') || canGuildMemberPerform(me, 'approveMember');
  const canManage =
    canGuildMemberPerform(me, 'promoteMember') ||
    canGuildMemberPerform(me, 'demoteMember') ||
    canGuildMemberPerform(me, 'kickMember') ||
    canGuildMemberPerform(me, 'transferLeadership');

  const sorted = useMemo(() => {
    const list = [...guild.members];
    list.sort((a, b) => {
      if (GUILD_ROLE_ORDER[a.role] !== GUILD_ROLE_ORDER[b.role]) {
        return GUILD_ROLE_ORDER[a.role] - GUILD_ROLE_ORDER[b.role];
      }
      return b.contribution - a.contribution;
    });
    return list;
  }, [guild.members]);

  return (
    <div className="guild-members">
      <div className="guild-members__panel">
        <header className="guild-members__head">
          <h3>Membros da Guild</h3>
          <span>
            {guild.members.length} / {guild.maxMembers}
          </span>
        </header>

        <div className="guild-members__table-wrap">
          <table className="guild-members__table">
            <thead>
              <tr>
                <th>Membro</th>
                <th>Nível</th>
                <th>Poder</th>
                <th>Cargo</th>
                <th>Contribuição</th>
                <th>Último Acesso</th>
                {manageOpen ? <th>Ações</th> : null}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const access = formatLastAccess(m.lastActiveAt);
                const initial = (m.nickname.trim().charAt(0) || '?').toUpperCase();
                return (
                  <tr key={m.playerId} className={m.playerId === playerId ? 'is-me' : undefined}>
                    <td>
                      <div className="guild-members__who">
                        <span
                          className={`guild-members__avatar guild-members__avatar--${m.role}`}
                          aria-hidden
                        >
                          {initial}
                        </span>
                        <div className="guild-members__who-text">
                          <strong>
                            {m.nickname}
                            {m.playerId === playerId ? ' (você)' : ''}
                          </strong>
                          {m.role === 'leader' ? (
                            <span className="guild-members__leader-tag">Líder</span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td>Lv.{m.playerLevel}</td>
                    <td className="guild-members__power">{fmt(estimateMemberPower(m))}</td>
                    <td>
                      <span className={`guild-members__badge guild-members__badge--${m.role}`}>
                        {GUILD_ROLE_LABEL[m.role]}
                      </span>
                    </td>
                    <td>{fmt(m.contribution)}</td>
                    <td>
                      <span className={access.online ? 'is-online' : 'is-offline'}>{access.label}</span>
                    </td>
                    {manageOpen ? (
                      <td>
                        <div className="guild-members__row-actions">
                          {canPromoteMember(me, m, 'officer') ? (
                            <button
                              type="button"
                              onClick={() => void guildStore.setMemberRole(m.playerId, 'officer')}
                            >
                              Promover
                            </button>
                          ) : null}
                          {canDemoteMember(me, m) ? (
                            <button
                              type="button"
                              onClick={() => void guildStore.setMemberRole(m.playerId, 'member')}
                            >
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
                              Transferir
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="guild-members__footer">
        <button
          type="button"
          className="guild-members__footer-btn"
          disabled={!canInvite}
          onClick={() => {
            if (guild.joinMode === 'approval') {
              onTab('applications');
              return;
            }
            const text = `[${guild.tag}] ${guild.name}`;
            void navigator.clipboard?.writeText(text).catch(() => undefined);
            window.alert(`Convite: compartilhe a tag ${text} (modo Open — entrada direta).`);
          }}
        >
          Convidar
        </button>
        <button
          type="button"
          className={`guild-members__footer-btn${manageOpen ? ' is-on' : ''}`}
          disabled={!canManage}
          onClick={() => setManageOpen((v) => !v)}
        >
          Gerenciar Cargos
        </button>
        {leaveCheck.ok ? (
          <button
            type="button"
            className="guild-members__footer-btn guild-members__footer-btn--danger"
            onClick={() => {
              if (window.confirm('Sair desta Guild?')) void guildStore.leaveGuild();
            }}
          >
            Sair da Guild
          </button>
        ) : (
          <button
            type="button"
            className="guild-members__footer-btn guild-members__footer-btn--danger"
            disabled
            title={leaveCheck.reason}
          >
            Sair da Guild
          </button>
        )}
      </footer>
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
      <section className="guild-win__feature-panel">
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
      </section>
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
