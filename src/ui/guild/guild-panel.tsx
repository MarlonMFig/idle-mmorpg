'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  GUILD_CHECKIN_COINS,
  GUILD_CHECKIN_EXP,
  GUILD_COLORS,
  GUILD_CREATE_MIN_LEVEL,
  GUILD_DONATE_MIN,
  GUILD_EMBLEMS,
  GUILD_MAX_MEMBERS,
  GUILD_NAME_MAX,
  GUILD_TAG_MAX,
  guildExpForLevel,
} from '@/constants/guild';
import { GUILD_MISSION_DEFS, GUILD_SHOP_DEFS, GUILD_SKILL_DEFS } from '@/data/guild-content';
import { useStore } from '@/hooks/use-store';
import {
  guildStore,
  isValidGuildName,
  isValidGuildTag,
  normalizeGuildName,
  normalizeGuildTag,
} from '@/stores/guild-store';
import { vipStore } from '@/stores/vip-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { Guild, GuildTabId } from '@/types/guild';
import { GUILD_ROLE_LABEL, isLeadershipRole } from '@/types/guild';

function fmt(n: number): string {
  return n.toLocaleString('pt-BR');
}

function powerLabel(members: number, funds: number, level: number): string {
  const power = members * 120_000 + funds * 2 + level * 50_000;
  if (power >= 1_000_000) return `${(power / 1_000_000).toFixed(2)}M`;
  if (power >= 1_000) return `${(power / 1_000).toFixed(1)}K`;
  return String(power);
}

/** Brilho suave atrás do estandarte — sem moldura nem fundo sólido. */
function crestGlow(color: string): string {
  return `radial-gradient(circle, ${color}88 0%, ${color}2b 45%, transparent 72%)`;
}

function GuildEmblem({ value, className = '' }: { value: string; className?: string }) {
  if (!value.startsWith('/')) return <span className={className}>{value}</span>;
  return <Image src={value} alt="" width={160} height={210} className={className} unoptimized />;
}

const TABS: { id: GuildTabId; label: string; icon: string; manageOnly?: boolean }[] = [
  { id: 'members', label: 'Membros', icon: '👥' },
  { id: 'ranking', label: 'Ranking', icon: '🏆' },
  { id: 'missions', label: 'Missões', icon: '📜' },
  { id: 'boss', label: 'Boss', icon: '⚔️' },
  { id: 'skills', label: 'Habilidades', icon: '✨' },
  { id: 'shop', label: 'Loja', icon: '🛒' },
  { id: 'manage', label: 'Gestão', icon: '⚙️', manageOnly: true },
];

/**
 * Janela da Guilda — layout inspirado no protótipo Anime World Idle
 * (header, mural, abas: membros / ranking / missões / boss / skills / loja / gestão).
 */
export function GuildPanel() {
  const isOpen = useStore(guildStore, (s) => s.isOpen);
  const guildId = useStore(guildStore, (s) => s.guildId);
  const playerId = useStore(guildStore, (s) => s.playerId);
  const nickname = useStore(guildStore, (s) => s.nickname);
  const registryTick = useStore(guildStore, (s) => s.registryTick);
  const progress = useStore(guildStore, (s) => s.progress);
  const level = useStore(vitalsStore, (s) => s.level);
  const vipActive = useStore(vipStore, (s) => s.active);
  const canJoin = level >= GUILD_CREATE_MIN_LEVEL;
  const canCreate = canJoin && vipActive;

  const [tab, setTab] = useState<GuildTabId>('members');
  const [fullscreen, setFullscreen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTag, setCreateTag] = useState('');
  const [emblemIdx, setEmblemIdx] = useState(0);
  const [emblemColor, setEmblemColor] = useState<string>(GUILD_COLORS[0]);
  const [donateAmt, setDonateAmt] = useState(String(GUILD_DONATE_MIN));
  const [noticeDraft, setNoticeDraft] = useState('');
  const [lobbyMode, setLobbyMode] = useState<'join' | 'create'>('create');

  const myGuild = useMemo(() => {
    void registryTick;
    void guildId;
    return guildStore.getMyGuild();
  }, [registryTick, guildId]);

  const guilds = useMemo(() => {
    void registryTick;
    return guildStore.listGuilds();
  }, [registryTick]);

  const role = useMemo(() => {
    void registryTick;
    return guildStore.getMyRole();
  }, [registryTick, guildId, playerId]);

  const rank = useMemo(() => {
    if (!myGuild) return 0;
    return guildStore.serverRank(myGuild.id);
  }, [myGuild, registryTick]);

  const checkedIn = guildStore.isCheckedInToday();
  const canLead = role ? isLeadershipRole(role) : false;

  const unclaimedMissions = useMemo(() => {
    return GUILD_MISSION_DEFS.filter((m) => {
      const p = progress.missionProgress[m.id] ?? 0;
      return p >= m.target && !progress.claimedMissions[m.id];
    }).length;
  }, [progress]);

  useEffect(() => {
    if (!isOpen) return;
    if (myGuild) {
      setTab('members');
      setNoticeDraft(myGuild.notice);
    } else {
      setLobbyMode(canCreate ? 'create' : 'join');
    }
  }, [isOpen, myGuild?.id, canCreate]);

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

  const expMax = myGuild ? guildExpForLevel(myGuild.level) : 1;
  const expPct = myGuild ? Math.min(100, Math.round((myGuild.exp / expMax) * 100)) : 0;

  return (
    <div
      className="guild-win-overlay"
      role="presentation"
      onClick={() => guildStore.setOpen(false)}
    >
      <div
        className={`guild-win${fullscreen ? ' is-full' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Janela da Guilda"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titlebar */}
        <header className="guild-win__titlebar">
          <div className="guild-win__titlebar-left">
            <span aria-hidden>🚩</span>
            <h1 className="guild-win__app-title">Janela da Guilda</h1>
            <span className="guild-win__version">v1.2</span>
          </div>
          <div className="guild-win__titlebar-actions">
            {!canJoin ? (
              <span className="guild-win__lock-chip">Nv. {GUILD_CREATE_MIN_LEVEL}+</span>
            ) : !canCreate ? (
              <span className="guild-win__lock-chip">VIP</span>
            ) : null}
            <button
              type="button"
              className="guild-win__icon-btn"
              title={fullscreen ? 'Restaurar' : 'Maximizar'}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? '⤓' : '⤢'}
            </button>
            <button
              type="button"
              className="guild-win__icon-btn guild-win__icon-btn--close"
              title="Fechar"
              aria-label="Fechar"
              onClick={() => guildStore.setOpen(false)}
            >
              ×
            </button>
          </div>
        </header>

        {!myGuild ? (
          <LobbyView
            canJoin={canJoin}
            canCreate={canCreate}
            level={level}
            mode={lobbyMode}
            setMode={setLobbyMode}
            guilds={guilds}
            createName={createName}
            setCreateName={setCreateName}
            createTag={createTag}
            setCreateTag={setCreateTag}
            emblemIdx={emblemIdx}
            setEmblemIdx={setEmblemIdx}
            emblemColor={emblemColor}
            setEmblemColor={setEmblemColor}
          />
        ) : (
          <>
            {/* Guild Header */}
            <section className="guild-win__header">
              <div className="guild-win__header-top">
                <div className="guild-win__identity">
                  <div
                    className="guild-win__crest"
                    style={{ background: crestGlow(myGuild.emblemBg) }}
                  >
                    <GuildEmblem value={myGuild.emblemIcon} className="guild-win__crest-icon" />
                    <span className="guild-win__crest-lv">Lv.{myGuild.level}</span>
                  </div>
                  <div>
                    <div className="guild-win__name-row">
                      <h2 className="guild-win__name">{myGuild.name}</h2>
                      <span className="guild-win__tag">[{myGuild.tag}]</span>
                      {canLead ? (
                        <button
                          type="button"
                          className="guild-win__manage-link"
                          onClick={() => setTab('manage')}
                        >
                          ⚙️ Gestão
                        </button>
                      ) : null}
                    </div>
                    <p className="guild-win__meta">
                      Líder:{' '}
                      <strong>
                        {myGuild.members.find((m) => m.playerId === myGuild.leaderId)?.nickname ??
                          '—'}
                      </strong>
                      <span className="guild-win__dot">•</span>
                      Membros:{' '}
                      <strong className="is-green">
                        {myGuild.members.length}/{myGuild.maxMembers}
                      </strong>
                      <span className="guild-win__dot">•</span>
                      Ranking: <strong className="is-gold">#{rank}</strong>
                    </p>
                  </div>
                </div>

                <div className="guild-win__wallet">
                  <div className="guild-win__currency">
                    <span>🏛️ Fundos da Guilda:</span>
                    <strong className="is-green">{fmt(myGuild.funds)}</strong>
                  </div>
                  <div className="guild-win__currency">
                    <span>🪙 Moedas de Guilda:</span>
                    <strong className="is-gold">{fmt(progress.guildCoins)}</strong>
                  </div>
                  <button
                    type="button"
                    className={`guild-win__checkin${checkedIn ? ' is-done' : ''}`}
                    disabled={checkedIn}
                    onClick={() => guildStore.checkIn()}
                  >
                    {checkedIn ? (
                      <>✓ Presença Confirmada!</>
                    ) : (
                      <>
                        <span>Marcar Presença</span>
                        <small>
                          +{GUILD_CHECKIN_COINS} moedas • +{GUILD_CHECKIN_EXP} EXP
                        </small>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="guild-win__btn-danger guild-win__leave-btn"
                    onClick={() => {
                      const alone = myGuild.members.length <= 1;
                      const asLeader = role === 'leader' && !alone;
                      const message = alone
                        ? 'Sair dissolve a guilda (você é o único membro). Continuar?'
                        : asLeader
                          ? 'Sair transfere a liderança ao membro mais antigo. Continuar?'
                          : 'Sair desta guilda?';
                      if (window.confirm(message)) guildStore.leaveGuild();
                    }}
                  >
                    Sair da guild
                  </button>
                </div>
              </div>

              <div className="guild-win__exp-row">
                <span className="guild-win__exp-label">Progresso Nv. {myGuild.level}:</span>
                <span className="guild-win__exp-nums">
                  {fmt(myGuild.exp)} / {fmt(expMax)} EXP ({expPct}%)
                </span>
                <div className="guild-win__exp-bar">
                  <span style={{ width: `${expPct}%` }} />
                </div>
                <span className="guild-win__power">
                  Poder ≈ {powerLabel(myGuild.members.length, myGuild.funds, myGuild.level)}
                </span>
              </div>
            </section>

            {/* Tabs */}
            <nav className="guild-win__tabs" aria-label="Abas da guilda">
              {TABS.filter((t) => !t.manageOnly || canLead).map((t) => {
                const label =
                  t.id === 'members'
                    ? `${t.label} (${myGuild.members.length})`
                    : t.id === 'missions' && unclaimedMissions > 0
                      ? `${t.label} (${unclaimedMissions})`
                      : t.label;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`guild-win__tab${tab === t.id ? ' is-active' : ''}`}
                    onClick={() => setTab(t.id)}
                  >
                    <span aria-hidden>{t.icon}</span>
                    {label}
                  </button>
                );
              })}
            </nav>

            {/* Notice mural */}
            <div className="guild-win__mural">
              <span className="guild-win__mural-label">Mural Oficial</span>
              <p>{myGuild.notice}</p>
            </div>

            {/* Body */}
            <div className="guild-win__body">
              {tab === 'members' ? (
                <MembersBody
                  guild={myGuild}
                  playerId={playerId}
                  donateAmt={donateAmt}
                  setDonateAmt={setDonateAmt}
                />
              ) : null}
              {tab === 'ranking' ? <RankingBody guilds={guilds} myId={myGuild.id} /> : null}
              {tab === 'missions' ? <MissionsBody progress={progress} /> : null}
              {tab === 'boss' ? (
                <BossBody
                  guild={myGuild}
                  playerDamage={progress.bossDamage}
                  playerAttacks={progress.bossAttacks}
                  playerName={nickname ?? 'Você'}
                />
              ) : null}
              {tab === 'skills' ? (
                <SkillsBody guild={myGuild} coins={progress.guildCoins} canLead={canLead} />
              ) : null}
              {tab === 'shop' ? <ShopBody guild={myGuild} coins={progress.guildCoins} /> : null}
              {tab === 'manage' && canLead ? (
                <ManageBody
                  guild={myGuild}
                  noticeDraft={noticeDraft}
                  setNoticeDraft={setNoticeDraft}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LobbyView({
  canJoin,
  canCreate,
  level,
  mode,
  setMode,
  guilds,
  createName,
  setCreateName,
  createTag,
  setCreateTag,
  emblemIdx,
  setEmblemIdx,
  emblemColor,
  setEmblemColor,
}: {
  canJoin: boolean;
  canCreate: boolean;
  level: number;
  mode: 'join' | 'create';
  setMode: (m: 'join' | 'create') => void;
  guilds: Guild[];
  createName: string;
  setCreateName: (v: string) => void;
  createTag: string;
  setCreateTag: (v: string) => void;
  emblemIdx: number;
  setEmblemIdx: (v: number) => void;
  emblemColor: string;
  setEmblemColor: (v: string) => void;
}) {
  const emblem = GUILD_EMBLEMS[emblemIdx] ?? GUILD_EMBLEMS[0];

  return (
    <div className="guild-win__lobby">
      <div className="guild-win__lobby-hero">
        <Image src="/ui/hub-menu/guild.png" alt="" width={48} height={48} unoptimized />
        <div>
          <h2>Guildas do Servidor</h2>
          <p>
            Entre a partir do nível {GUILD_CREATE_MIN_LEVEL}. Criar guild é exclusivo VIP (máx.{' '}
            {GUILD_MAX_MEMBERS} membros).
          </p>
          <p className="guild-win__lobby-lv">
            Seu nível: <strong>{level}</strong>
            {!canJoin
              ? ` — faltam ${GUILD_CREATE_MIN_LEVEL - level}`
              : canCreate
                ? ' — criar e entrar liberados'
                : ' — entrar liberado · criar exige VIP'}
          </p>
        </div>
      </div>

      <div className="guild-win__lobby-tabs">
        <button
          type="button"
          className={mode === 'join' ? 'is-active' : ''}
          onClick={() => setMode('join')}
        >
          Entrar
        </button>
        <button
          type="button"
          className={mode === 'create' ? 'is-active' : ''}
          onClick={() => setMode('create')}
        >
          Criar
        </button>
      </div>

      {mode === 'create' ? (
        <form
          className="guild-win__create-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isValidGuildName(createName) || !isValidGuildTag(createTag)) return;
            guildStore.createGuild({
              name: createName,
              tag: createTag,
              emblemIcon: emblem.icon,
              emblemBg: emblemColor,
            });
          }}
        >
          <label>
            Nome
            <input
              value={createName}
              maxLength={GUILD_NAME_MAX}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Ex.: Nuvem Negra"
            />
          </label>
          <label>
            Tag
            <input
              value={createTag}
              maxLength={GUILD_TAG_MAX}
              onChange={(e) => setCreateTag(normalizeGuildTag(e.target.value))}
              placeholder="CLD"
            />
          </label>
          <div className="guild-win__identity-builder">
            <div
              className="guild-win__identity-preview"
              style={{ background: crestGlow(emblemColor) }}
              aria-label={`Preview: ${emblem.label}`}
            >
              <GuildEmblem value={emblem.icon} />
            </div>
            <div className="guild-win__identity-options">
              <div className="guild-win__emblem-picks">
                <span>Emblema</span>
                <div>
                  {GUILD_EMBLEMS.map((em, i) => (
                    <button
                      key={em.label}
                      type="button"
                      className={`guild-win__emblem-btn${emblemIdx === i ? ' is-on' : ''}`}
                      title={em.label}
                      aria-label={em.label}
                      aria-pressed={emblemIdx === i}
                      onClick={() => setEmblemIdx(i)}
                    >
                      <GuildEmblem value={em.icon} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="guild-win__color-picks">
                <span>Cor do brilho</span>
                <div>
                  {GUILD_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={emblemColor === color ? 'is-on' : ''}
                      style={{ background: color }}
                      title={color}
                      aria-label={`Cor ${color}`}
                      aria-pressed={emblemColor === color}
                      onClick={() => setEmblemColor(color)}
                    />
                  ))}
                  <label className="guild-win__color-custom" title="Escolher outra cor">
                    <input
                      type="color"
                      value={emblemColor}
                      onChange={(event) => setEmblemColor(event.target.value)}
                      aria-label="Escolher outra cor"
                    />
                    <span>+</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <p className="guild-win__preview">
            Preview: [{normalizeGuildTag(createTag) || 'TAG'}]{' '}
            {normalizeGuildName(createName) || 'Nome'}
          </p>
          <button type="submit" className="guild-win__btn-gold" disabled={!canCreate}>
            {canCreate ? 'Criar guilda' : 'Criar guilda (VIP)'}
          </button>
          {!canCreate ? (
            <p className="guild-win__lobby-lv">
              {canJoin
                ? 'Ative o VIP no menu superior para criar uma guild.'
                : `Criar exige VIP e nível ${GUILD_CREATE_MIN_LEVEL}.`}
            </p>
          ) : null}
        </form>
      ) : (
        <ul className="guild-win__browse">
          {guilds.length === 0 ? (
            <li className="guild-win__empty">Nenhuma guild criada ainda.</li>
          ) : (
            guilds.map((g, i) => {
              const full = g.members.length >= g.maxMembers;
              return (
                <li key={g.id} className="guild-win__browse-row">
                  <span className="guild-win__browse-rank">#{i + 1}</span>
                  <span
                    className="guild-win__browse-crest"
                    style={{ background: crestGlow(g.emblemBg) }}
                  >
                    <GuildEmblem value={g.emblemIcon} />
                  </span>
                  <div className="guild-win__browse-info">
                    <strong>
                      [{g.tag}] {g.name}
                    </strong>
                    <span>
                      Lv.{g.level} · {g.members.length}/{g.maxMembers} · Fundos {fmt(g.funds)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="guild-win__btn-green"
                    disabled={!canJoin || full}
                    onClick={() => guildStore.joinGuild(g.id)}
                  >
                    {full ? 'Cheia' : 'Entrar'}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function MembersBody({
  guild,
  playerId,
  donateAmt,
  setDonateAmt,
}: {
  guild: Guild;
  playerId: string | null;
  donateAmt: string;
  setDonateAmt: (v: string) => void;
}) {
  const sorted = [...guild.members].sort((a, b) => {
    const order = { leader: 0, vice: 1, officer: 2, member: 3 };
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    return b.coinsDonated - a.coinsDonated;
  });

  return (
    <div className="guild-win__members">
      <div className="guild-win__donate">
        <label>
          Doar cobre aos fundos
          <input
            type="number"
            min={GUILD_DONATE_MIN}
            value={donateAmt}
            onChange={(e) => setDonateAmt(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="guild-win__btn-gold"
          onClick={() => guildStore.donate(Number(donateAmt) || 0)}
        >
          Doar
        </button>
        <span className="guild-win__hint">
          Mín. {GUILD_DONATE_MIN} · Você recebe 10% em moedas de guilda
        </span>
      </div>
      <ul className="guild-win__member-list">
        {sorted.map((m) => (
          <li key={m.playerId} className={m.playerId === playerId ? 'is-me' : ''}>
            <span className="guild-win__member-name">
              {m.nickname}
              {m.playerId === playerId ? ' (você)' : ''}
            </span>
            <span className={`guild-win__role guild-win__role--${m.role}`}>
              {GUILD_ROLE_LABEL[m.role]}
            </span>
            <span className="guild-win__member-stat">
              Doado {fmt(m.coinsDonated)} · EXP {fmt(m.expContributed)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankingBody({ guilds, myId }: { guilds: Guild[]; myId: string }) {
  return (
    <div className="guild-win__ranking">
      <p className="guild-win__hint">Ranking local por nível e fundos da guilda.</p>
      <ol className="guild-win__rank-list">
        {guilds.map((g, i) => (
          <li key={g.id} className={g.id === myId ? 'is-mine' : ''}>
            <span className="guild-win__rank-pos">#{i + 1}</span>
            <span className="guild-win__browse-crest" style={{ background: crestGlow(g.emblemBg) }}>
              <GuildEmblem value={g.emblemIcon} />
            </span>
            <div>
              <strong>
                [{g.tag}] {g.name}
              </strong>
              <span>
                Lv.{g.level} · {g.members.length} membros · {fmt(g.funds)} fundos
              </span>
            </div>
            {g.id === myId ? <em>Sua guild</em> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function MissionsBody({
  progress,
}: {
  progress: {
    missionProgress: Record<string, number>;
    claimedMissions: Record<string, boolean>;
  };
}) {
  return (
    <div className="guild-win__missions">
      <div className="guild-win__missions-top">
        <p>Missões diárias e de guilda — resgate recompensas ao completar.</p>
        <button
          type="button"
          className="guild-win__btn-gold"
          onClick={() => guildStore.claimAllMissions()}
        >
          Resgatar todas
        </button>
      </div>
      <div className="guild-win__mission-grid">
        {GUILD_MISSION_DEFS.map((m) => {
          const cur = progress.missionProgress[m.id] ?? 0;
          const done = cur >= m.target;
          const claimed = Boolean(progress.claimedMissions[m.id]);
          const pct = Math.min(100, Math.round((cur / m.target) * 100));
          return (
            <article key={m.id} className="guild-win__mission-card">
              <header>
                <span>{m.icon}</span>
                <div>
                  <strong>{m.title}</strong>
                  <em>{m.category}</em>
                </div>
              </header>
              <p>{m.description}</p>
              <div className="guild-win__mission-bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <footer>
                <span>
                  {fmt(Math.min(cur, m.target))}/{fmt(m.target)} · +{m.rewardCoins}🪙 +{m.rewardExp}{' '}
                  EXP
                </span>
                <button
                  type="button"
                  className="guild-win__btn-green"
                  disabled={!done || claimed}
                  onClick={() => guildStore.claimMission(m.id)}
                >
                  {claimed ? 'Resgatado' : done ? 'Resgatar' : 'Em progresso'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function BossBody({
  guild,
  playerDamage,
  playerAttacks,
  playerName,
}: {
  guild: Guild;
  playerDamage: number;
  playerAttacks: number;
  playerName: string;
}) {
  const pct = Math.max(0, Math.round((guild.bossHp / guild.bossMaxHp) * 100));
  const dead = guild.bossHp <= 0;

  return (
    <div className="guild-win__boss">
      <div className="guild-win__boss-card">
        <div className="guild-win__boss-art" aria-hidden>
          🔥
        </div>
        <div>
          <h3>Kurama — Nove Caudas</h3>
          <p className="guild-win__hint">Besta com Cauda · Nível 80 · Fogo / Chakra</p>
          <p className={dead ? 'is-green' : 'is-gold'}>{dead ? 'DERROTADO' : 'DISPONÍVEL'}</p>
          <div className="guild-win__boss-hp">
            <span style={{ width: `${pct}%` }} />
          </div>
          <p className="guild-win__exp-nums">
            {fmt(guild.bossHp)} / {fmt(guild.bossMaxHp)} HP ({pct}%)
          </p>
          <button
            type="button"
            className="guild-win__btn-gold"
            disabled={dead}
            onClick={() => guildStore.attackBoss()}
          >
            Atacar Boss
          </button>
        </div>
      </div>
      <div className="guild-win__boss-rank">
        <h4>Seu dano na wave</h4>
        <p>
          {playerName}: <strong>{fmt(playerDamage)}</strong> em {playerAttacks} ataque(s)
        </p>
        <p className="guild-win__hint">Cada ataque concede +50 moedas de guilda.</p>
      </div>
    </div>
  );
}

function SkillsBody({ guild, coins, canLead }: { guild: Guild; coins: number; canLead: boolean }) {
  return (
    <div className="guild-win__skills">
      {!canLead ? (
        <p className="guild-win__hint">Somente Líder/Vice podem aprimorar habilidades.</p>
      ) : null}
      <div className="guild-win__skill-grid">
        {GUILD_SKILL_DEFS.map((sk) => {
          const lv = guild.skillLevels[sk.id] ?? 0;
          const maxed = lv >= sk.maxLevel;
          const costFunds = Math.floor(sk.baseFunds * Math.pow(1.25, lv));
          const costCoins = Math.floor(sk.baseCoins * Math.pow(1.2, lv));
          return (
            <article key={sk.id} className="guild-win__skill-card">
              <header>
                <span>{sk.icon}</span>
                <div>
                  <strong>{sk.name}</strong>
                  <em>
                    Nv. {lv}/{sk.maxLevel}
                  </em>
                </div>
              </header>
              <p>{sk.description}</p>
              <p className="is-gold">{sk.effectText}</p>
              <footer>
                <span>
                  🏛️ {fmt(costFunds)} · 🪙 {fmt(costCoins)}
                </span>
                <button
                  type="button"
                  className="guild-win__btn-green"
                  disabled={!canLead || maxed || guild.funds < costFunds || coins < costCoins}
                  onClick={() => guildStore.upgradeSkill(sk.id)}
                >
                  {maxed ? 'Máx' : 'Aprimorar'}
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ShopBody({ guild, coins }: { guild: Guild; coins: number }) {
  const fragmentOffer = guildStore.getDailyFragmentOffer();

  return (
    <div className="guild-win__shop">
      <p className="guild-win__hint">
        Compre com Selos de Aliança. Fragmento rotativo muda todo dia (máx. 2/dia).
      </p>

      {fragmentOffer ? (
        <article className="guild-win__shop-card guild-win__shop-card--featured">
          <header>
            <span>🧩</span>
            <div>
              <strong>Fragmento do dia — {fragmentOffer.label}</strong>
              <em>Rotativo</em>
            </div>
          </header>
          <p>1 fragmento para evolução por estrela (+1★ = 10 fragmentos).</p>
          <footer>
            <span>
              🪙 {fmt(fragmentOffer.priceCoins)} · {fragmentOffer.purchasesLeft} compras restantes
            </span>
            <button
              type="button"
              className="guild-win__btn-gold"
              disabled={fragmentOffer.purchasesLeft <= 0 || coins < fragmentOffer.priceCoins}
              onClick={() => guildStore.buyDailyFragment()}
            >
              Comprar fragmento
            </button>
          </footer>
        </article>
      ) : null}

      <div className="guild-win__shop-grid">
        {GUILD_SHOP_DEFS.map((item) => {
          const stock = guild.shopStock[item.id] ?? 0;
          const locked = guild.level < item.reqGuildLevel;
          const afford = coins >= item.priceCoins;
          return (
            <article key={item.id} className="guild-win__shop-card">
              <header>
                <span>{item.icon}</span>
                <div>
                  <strong>{item.name}</strong>
                  <em>{item.category}</em>
                </div>
              </header>
              <p>{item.description}</p>
              <footer>
                <span>
                  🪙 {fmt(item.priceCoins)} · Estoque {stock}/{item.maxStock}
                  {locked ? ` · Lv.${item.reqGuildLevel}` : ''}
                </span>
                <button
                  type="button"
                  className="guild-win__btn-gold"
                  disabled={locked || stock <= 0 || !afford}
                  onClick={() => guildStore.buyShopItem(item.id)}
                >
                  Comprar
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ManageBody({
  guild,
  noticeDraft,
  setNoticeDraft,
}: {
  guild: Guild;
  noticeDraft: string;
  setNoticeDraft: (v: string) => void;
}) {
  return (
    <div className="guild-win__manage">
      <label className="guild-win__field">
        Mural oficial
        <textarea
          rows={3}
          maxLength={280}
          value={noticeDraft}
          onChange={(e) => setNoticeDraft(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="guild-win__btn-gold"
        onClick={() => guildStore.updateNotice(noticeDraft)}
      >
        Salvar mural
      </button>

      <div className="guild-win__emblem-picks">
        <span>Identidade da guilda</span>
        <div>
          {GUILD_EMBLEMS.map((em) => (
            <button
              key={em.label}
              type="button"
              className={`guild-win__emblem-btn${guild.emblemIcon === em.icon ? ' is-on' : ''}`}
              title={em.label}
              aria-label={em.label}
              aria-pressed={guild.emblemIcon === em.icon}
              onClick={() => guildStore.updateEmblem(em.icon, guild.emblemBg)}
            >
              <GuildEmblem value={em.icon} />
            </button>
          ))}
        </div>
      </div>
      <div className="guild-win__color-picks">
        <span>Cor do brilho</span>
        <div>
          {GUILD_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={guild.emblemBg === color ? 'is-on' : ''}
              style={{ background: color }}
              aria-label={`Cor ${color}`}
              aria-pressed={guild.emblemBg === color}
              onClick={() => guildStore.updateEmblem(guild.emblemIcon, color)}
            />
          ))}
          <label className="guild-win__color-custom" title="Escolher outra cor">
            <input
              type="color"
              value={guild.emblemBg}
              onChange={(event) => guildStore.updateEmblem(guild.emblemIcon, event.target.value)}
              aria-label="Escolher outra cor"
            />
            <span>+</span>
          </label>
        </div>
      </div>

      <div className="guild-win__danger-zone">
        <h4>Zona de risco</h4>
        <p>
          Sair da guilda. Se for o único membro, a guilda é dissolvida. Se for líder com membros, a
          liderança é transferida.
        </p>
        <button
          type="button"
          className="guild-win__btn-danger"
          onClick={() => {
            if (window.confirm('Sair da guilda?')) guildStore.leaveGuild();
          }}
        >
          {guild.members.length <= 1 ? 'Dissolver guilda' : 'Sair da guilda'}
        </button>
      </div>
    </div>
  );
}
