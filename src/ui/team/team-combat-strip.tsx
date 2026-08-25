'use client';

import Image from 'next/image';
import { useEffect, useMemo, type RefObject } from 'react';
import { CHARACTER_QUALITY_COLORS } from '@/constants/character-progression';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { getXpBarPercent, isMaxLevel } from '@/lib/player-progression';
import { guildStore } from '@/stores/guild-store';
import { achievementsStore } from '@/stores/achievements-store';
import { getTitleDefinition } from '@/data/achievements/title-registry';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import { combatStatusHudStore } from '@/stores/combat-status-hud-store';
import type { CombatStatusHudIcon } from '@/stores/combat-status-hud-store';
import type { SealedCharacter } from '@/types/team';
import { formatStat } from '@/lib/format-stat';
import { Decimal, d, hpRatio } from '@/lib/decimal';
import { computeInstanceTotals } from '@/lib/character-instance-stats';

function estimateHpMax(member: SealedCharacter, level: number): number {
  return Math.max(
    1,
    Math.round(
      computeInstanceTotals(member, level).hp,
    ),
  );
}

function ActiveTeamRow({
  member,
  isActive,
  level,
  hp,
  hpMax,
  energy,
  energyMax,
  expPct,
  atMaxLevel,
  statusIcons,
}: {
  member: SealedCharacter;
  isActive: boolean;
  level: number;
  hp: number | import('@/lib/decimal').Decimal;
  hpMax: number | import('@/lib/decimal').Decimal;
  energy: number | null;
  energyMax: number | null;
  expPct: number;
  atMaxLevel: boolean;
  statusIcons: CombatStatusHudIcon[];
}) {
  const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];
  const hpSafe = Decimal.max(d(1), d(hpMax));
  const hpPct = hpRatio(hp, hpSafe) * 100;
  const expSafe = Math.max(0, Math.min(100, expPct));
  const energySafeMax = Math.max(1, energyMax ?? 1);
  const energyPct =
    energy != null && energyMax != null
      ? Math.max(0, Math.min(100, (energy / energySafeMax) * 100))
      : null;

  return (
    <button
      type="button"
      className={`active-team__row${isActive ? ' is-active' : ''}`}
      onClick={() => {
        if (!isActive) switchActiveCharacter(member.id);
      }}
      title={isActive ? `${member.name} (ativo)` : `Tornar ${member.name} ativo`}
    >
      <div className="active-team__avatar" style={{ ['--q' as string]: qualityColor }}>
        <Image
          className="active-team__sprite"
          src={member.previewUrl}
          alt=""
          width={52}
          height={52}
          unoptimized
        />
        <span className="active-team__rank" style={{ background: qualityColor }}>
          {member.quality}
        </span>
      </div>

      <div className="active-team__stats">
        <div className="active-team__title-row">
          <span className="active-team__name">
            <span className="active-team__name-quality" style={{ color: qualityColor }}>
              [{member.quality}]
            </span>{' '}
            {member.name}
          </span>
          <span className="active-team__lv">
            Lv.{level}
            {atMaxLevel ? ' MAX' : ''}
          </span>
        </div>
        <div className="active-team__bar active-team__bar--hp">
          <span className="active-team__bar-fill" style={{ width: `${hpPct}%` }} />
          <span className="active-team__bar-label">
            {formatStat(hp)}/{formatStat(hpMax)}
          </span>
        </div>
        {energyPct != null && energy != null && energyMax != null ? (
          <div className="active-team__bar active-team__bar--energy" title="ENERGIA">
            <span className="active-team__bar-fill" style={{ width: `${energyPct}%` }} />
            <span className="active-team__bar-label">
              ENERGIA {formatStat(Math.floor(energy))}/{formatStat(Math.floor(energyMax))}
            </span>
          </div>
        ) : null}
        {statusIcons.length > 0 ? (
          <div className="active-team__status" aria-label="Status ativos">
            {entryIcons(statusIcons)}
          </div>
        ) : null}
        <div className="active-team__bar active-team__bar--exp">
          <span className="active-team__bar-fill" style={{ width: `${expSafe}%` }} />
          <span className="active-team__bar-label">
            {atMaxLevel ? 'EXP MAX' : `EXP ${Math.round(expSafe)}%`}
          </span>
        </div>
      </div>
    </button>
  );
}

function entryIcons(statusIcons: CombatStatusHudIcon[]) {
  return statusIcons.map((entry) => (
    <span key={entry.statusId} title={`${entry.statusId}${entry.stacks > 1 ? ` x${entry.stacks}` : ''}`}>
      {entry.icon}
      {entry.stacks > 1 ? entry.stacks : ''}
    </span>
  ));
}

function ActiveTeamEmpty({ index }: { index: number }) {
  return (
    <button
      type="button"
      className="active-team__row active-team__row--empty"
      onClick={() => teamStore.setOpen(true)}
      title="Abrir equipe"
      aria-label={`Slot de equipe ${index + 1} vazio`}
    >
      <div className="active-team__avatar active-team__avatar--empty">
        <span>+</span>
      </div>
      <div className="active-team__stats">
        <p className="active-team__empty-label">Slot vazio</p>
        <p className="active-team__empty-hint">Toque para equipar</p>
      </div>
    </button>
  );
}

export interface TeamCombatStripProps {
  nickname: string;
}

/**
 * Janela Equipe Ativa no mapa de caça — arrastável pelo cabeçalho.
 */
export function TeamCombatStrip({ nickname }: TeamCombatStripProps) {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const guildId = useStore(guildStore, (s) => s.guildId);
  const guildRegistryTick = useStore(guildStore, (s) => s.registryTick);
  const equippedTitleId = useStore(achievementsStore, (s) => s.equippedTitleId);
  const equippedTitle = getTitleDefinition(equippedTitleId);

  useEffect(() => {
    teamStore.refreshPreviews();
  }, []);
  const vitals = useStore(vitalsStore, (s) => s);
  const energyState = useStore(combatEnergyStore, (s) => s);
  const statusIcons = useStore(combatStatusHudStore, (s) => s.playerIcons);
  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('active-team', {
    zIndex: 32,
    dragZIndex: 95,
  });

  const teamMembers = useMemo(
    () =>
      Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
        const id = teamIds[index];
        if (!id) return null;
        return collection.find((entry) => entry.id === id) ?? null;
      }),
    [teamIds, collection],
  );

  const activeMember =
    teamMembers.find((entry) => entry?.id === activeId) ?? teamMembers.find(Boolean) ?? null;
  const guild = useMemo(
    () => (guildId ? guildStore.getMyGuild() : null),
    // registryTick garante releitura quando emblema/nome mudam no registro.
    [guildId, guildRegistryTick],
  );

  return (
    <aside
      ref={panelRef as RefObject<HTMLElement>}
      className={`active-team${isDragging ? ' is-dragging' : ''}`}
      style={style}
      aria-label="Equipe ativa"
    >
      <header
        className="active-team__head active-team__head--drag"
        title="Arrastar para mover"
        {...handleProps}
      >
        <p className="active-team__brand">Equipe</p>
        <h2 className="active-team__player">
          <span className="active-team__nick-wrap">
            <span className="active-team__nick">{nickname || 'Shinobi'}</span>
            {equippedTitle ? (
              <span className="active-team__title" title={equippedTitle.description}>
                [{equippedTitle.name}]
              </span>
            ) : null}
          </span>
          {guild ? (
            <span
              className="active-team__guild"
              style={{ ['--g' as string]: guild.legacy?.emblemBg ?? '#7f1d1d' }}
              title={`Guild ${guild.name} [${guild.tag}]`}
            >
              {(guild.legacy?.emblemIcon ?? '').startsWith('/') ? (
                <Image
                  className="active-team__guild-emblem"
                  src={guild.legacy!.emblemIcon!}
                  alt=""
                  width={22}
                  height={28}
                  unoptimized
                />
              ) : (
                <span className="active-team__guild-emblem">[{guild.tag}]</span>
              )}
              <span className="active-team__guild-name">{guild.name}</span>
            </span>
          ) : null}
        </h2>
        <p className="active-team__sub">
          Conta Nv. {vitals.level}
          {isMaxLevel(vitals.level) ? ' (máx.)' : ''}
          {activeMember ? ` — ${activeMember.name} Nv.${Math.max(1, activeMember.level || 1)}` : ''}
        </p>
      </header>

      <ul className="active-team__list">
        {teamMembers.map((member, index) => {
          if (!member) {
            return (
              <li key={`empty-${index}`}>
                <ActiveTeamEmpty index={index} />
              </li>
            );
          }

          const isActive = member.id === activeId;
          const memberLevel = Math.max(1, member.level || 1);
          const atMaxLevel = isMaxLevel(memberLevel);
          const hpMax = isActive
            ? Decimal.max(d(1), vitals.hpMax)
            : d(estimateHpMax(member, memberLevel));
          const hp = isActive ? vitals.hp : hpMax;
          const expPct = getXpBarPercent(member.xp, memberLevel);

          return (
            <li key={member.id}>
              <ActiveTeamRow
                member={member}
                isActive={isActive}
                level={memberLevel}
                hp={hp}
                hpMax={hpMax}
                energy={isActive ? energyState.currentEnergy : null}
                energyMax={isActive ? energyState.maxEnergy : null}
                expPct={expPct}
                atMaxLevel={atMaxLevel}
                statusIcons={isActive ? statusIcons : []}
              />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
