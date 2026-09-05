'use client';

import Image from 'next/image';
import { useEffect, useMemo, type RefObject } from 'react';
import { CHARACTER_QUALITY_COLORS } from '@/constants/character-progression';
import { getHeritageOption } from '@/constants/heritage-system';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { getTitleDefinition } from '@/data/achievements/title-registry';
import { getLineageCatalogEntry } from '@/data/lineages/catalog';
import { getLineageDefinition } from '@/data/lineages/registry';
import { getHeritageClanIcon } from '@/data/heritage-clan-art';
import { getVillage } from '@/data/villages';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { d } from '@/lib/decimal';
import { formatStat } from '@/lib/format-stat';
import { getLineageIdProgress, rankNameFor } from '@/lib/lineage-progress';
import { accountStore } from '@/stores/account-store';
import { achievementsStore } from '@/stores/achievements-store';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import { guildStore } from '@/stores/guild-store';
import { heritageStore } from '@/stores/heritage-store';
import { teamStore } from '@/stores/team-store';
import { villageStore } from '@/stores/village-store';
import { vitalsStore } from '@/stores/vitals-store';
import { resolveMemberProfileUrl } from '@/data/character-profiles';
import type { SealedCharacter } from '@/types/team';

/** Perfis do zip pixel-art; fallback só se não houver arte para o personagem. */
function resolveProfileSrc(member: SealedCharacter): string {
  return (
    resolveMemberProfileUrl(member) ||
    member.previewUrl ||
    '/ui/hub-menu/equipe.png?v=color'
  );
}

function vitalPercent(
  value: number | { toNumber?: () => number },
  max: number | { toNumber?: () => number },
): number {
  const valueDec = d(value as number);
  const maxDec = d(max as number);
  const safeMax = maxDec.lte(0) ? d(1) : maxDec;
  const ratio = valueDec.div(safeMax).toNumber();
  return Math.round(Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100);
}

function ActiveTeamVital({
  label,
  valueText,
  percent,
  variant,
}: {
  label: string;
  valueText: string;
  percent: number;
  variant: 'hp' | 'chakra';
}) {
  return (
    <div className={`active-team__vital active-team__vital--${variant}`}>
      <span className="active-team__vital-ico" aria-hidden>
        {variant === 'hp' ? '♥' : '◆'}
      </span>
      <div className="active-team__vital-body">
        <div
          className="active-team__vital-track"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <div className="active-team__vital-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <span className="active-team__vital-values">{valueText}</span>
    </div>
  );
}

function ActiveTeamPortrait({
  member,
  isActive,
  index,
}: {
  member: SealedCharacter;
  isActive: boolean;
  index: number;
}) {
  const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];

  return (
    <button
      type="button"
      className={`active-team__slot${isActive ? ' is-active' : ''}`}
      style={{ ['--q' as string]: qualityColor }}
      onClick={() => {
        if (!isActive) switchActiveCharacter(member.id);
      }}
      title={isActive ? `${member.name} (ativo)` : `Tornar ${member.name} ativo`}
      aria-label={
        isActive
          ? `Slot ${index + 1}: ${member.name}, ativo`
          : `Slot ${index + 1}: ${member.name}`
      }
      data-no-drag
    >
      <span className="active-team__frame" aria-hidden>
        <Image
          className="active-team__avatar"
          src={resolveProfileSrc(member)}
          alt=""
          width={128}
          height={128}
          unoptimized
          style={{ width: '100%', height: '100%' }}
        />
      </span>
      <span className="active-team__slot-meta">
        <span className="active-team__slot-name">{member.name}</span>
        <span className="active-team__slot-lv">Nv. {member.level}</span>
      </span>
      {isActive ? <span className="active-team__active-dot" aria-hidden /> : null}
    </button>
  );
}

function ActiveTeamEmpty({ index }: { index: number }) {
  return (
    <button
      type="button"
      className="active-team__slot active-team__slot--empty"
      onClick={() => teamStore.setOpen(true)}
      title="Abrir equipe"
      aria-label={`Slot de equipe ${index + 1} vazio`}
      data-no-drag
    >
      <span className="active-team__frame active-team__frame--empty" aria-hidden>
        +
      </span>
    </button>
  );
}

export interface TeamCombatStripProps {
  nickname: string;
}

/**
 * Cartão do jogador + equipe — layout glass (Modelo 6).
 */
export function TeamCombatStrip({ nickname }: TeamCombatStripProps) {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const guildId = useStore(guildStore, (s) => s.guildId);
  const guildRegistryTick = useStore(guildStore, (s) => s.registryTick);
  const equippedTitleId = useStore(achievementsStore, (s) => s.equippedTitleId);
  const lineageProgress = useStore(accountStore, (s) => s.lineageProgress);
  const heritageClaId = useStore(heritageStore, (s) => s.loadout.claId);
  const hp = useStore(vitalsStore, (s) => s.hp);
  const hpMax = useStore(vitalsStore, (s) => s.hpMax);
  const level = useStore(vitalsStore, (s) => s.level);
  const energy = useStore(combatEnergyStore, (s) => s.currentEnergy);
  const energyMax = useStore(combatEnergyStore, (s) => s.maxEnergy);
  const playerVillageId = useStore(villageStore, (s) => s.playerVillageId);

  useEffect(() => {
    teamStore.refreshPreviews();
  }, []);

  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('active-team-portraits', {
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

  const guild = useMemo(
    () => (guildId ? guildStore.getMyGuild() : null),
    [guildId, guildRegistryTick],
  );
  const equippedTitle = getTitleDefinition(equippedTitleId);
  const lineageId = lineageProgress.lineageId;
  const lineage = lineageId ? getLineageCatalogEntry(lineageId) : null;
  const heritageCla = heritageClaId ? getHeritageOption('cla', heritageClaId) : null;
  const heritageClaOption = heritageCla && 'levels' in heritageCla ? heritageCla : null;
  const heritageClaIcon = heritageClaOption
    ? getHeritageClanIcon(heritageClaOption.id)
    : null;

  const village = playerVillageId ? getVillage(playerVillageId) : null;
  const graduationName = useMemo(() => {
    if (!lineageId) return null;
    const definition = getLineageDefinition(lineageId);
    if (!definition) return null;
    const idProgress = getLineageIdProgress(lineageProgress, lineageId);
    if (idProgress.rank <= 0) return null;
    return rankNameFor(definition.ranks, idProgress.rank);
  }, [lineageId, lineageProgress]);

  const accent = village?.accent ?? lineage?.color ?? guild?.legacy?.emblemBg ?? '#6aa8ff';

  const hpPct = vitalPercent(hp, hpMax);
  const chakraPct = vitalPercent(Math.round(energy), energyMax);

  return (
    <aside
      ref={panelRef as RefObject<HTMLElement>}
      className={`active-team${isDragging ? ' is-dragging' : ''}`}
      style={{ ...style, ['--at-accent' as string]: accent }}
      aria-label="Equipe ativa"
    >
      <div
        className="active-team__card active-team__card--drag"
        title="Arrastar para mover"
        {...handleProps}
      >
        <div className="active-team__info">
          <div className="active-team__hero">
            <div className="active-team__nameplate">
              <div className="active-team__name-block">
                <p className="active-team__nick" title={nickname}>
                  {nickname || 'Shinobi'}
                </p>
                {equippedTitle ? (
                  <p className="active-team__title" title={equippedTitle.description}>
                    {equippedTitle.name}
                  </p>
                ) : null}
              </div>
              <span className="active-team__level" title={`Nível ${level}`}>
                Nv. {level}
              </span>
            </div>

            {guild ? (
              <div
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
                    height={22}
                    unoptimized
                  />
                ) : (
                  <span className="active-team__guild-tag">[{guild.tag}]</span>
                )}
                <span className="active-team__guild-kicker">Guild</span>
                <span className="active-team__guild-name">{guild.name}</span>
                <span className="active-team__guild-count">
                  {guild.members.length}/{guild.maxMembers}
                </span>
              </div>
            ) : null}
          </div>

          <div className="active-team__chips" aria-label="Graduação, vila e clã">
            <span
              className="active-team__chip"
              title={graduationName ? `Graduação ${graduationName}` : 'Sem graduação'}
            >
              <span className="active-team__chip-kicker">Graduação</span>
              <span className="active-team__chip-row">
                <Image
                  className="active-team__chip-ico"
                  src="/ui/hub-menu/graduacao.png"
                  alt=""
                  width={16}
                  height={16}
                  unoptimized
                />
                <span className="active-team__chip-text">{graduationName ?? '—'}</span>
              </span>
            </span>
            <span
              className="active-team__chip"
              title={village?.fullName ?? 'Sem vila'}
              style={village ? { ['--chip' as string]: village.accent } : undefined}
            >
              <span className="active-team__chip-kicker">Vila</span>
              <span className="active-team__chip-row">
                {village ? (
                  <Image
                    className="active-team__chip-ico"
                    src={village.iconSrc}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                  />
                ) : null}
                <span className="active-team__chip-text">{village?.shortLabel ?? '—'}</span>
              </span>
            </span>
            <span
              className="active-team__chip"
              title={
                heritageClaOption
                  ? heritageClaOption.tecnica
                    ? `${heritageClaOption.name} — ${heritageClaOption.tecnica}`
                    : heritageClaOption.name
                  : 'Sem clã'
              }
            >
              <span className="active-team__chip-kicker">Clã</span>
              <span className="active-team__chip-row">
                {heritageClaIcon ? (
                  <Image
                    className="active-team__chip-ico"
                    src={heritageClaIcon}
                    alt=""
                    width={16}
                    height={16}
                    unoptimized
                  />
                ) : null}
                <span className="active-team__chip-text">
                  {heritageClaOption?.name ?? '—'}
                </span>
              </span>
            </span>
          </div>

          <div className="active-team__vitals" aria-label="HP e Chakra" data-no-drag>
            <ActiveTeamVital
              label="HP"
              valueText={`${formatStat(hp)} / ${formatStat(hpMax)}`}
              percent={hpPct}
              variant="hp"
            />
            <ActiveTeamVital
              label="Chakra"
              valueText={`${formatStat(Math.round(energy))} / ${formatStat(energyMax)}`}
              percent={chakraPct}
              variant="chakra"
            />
          </div>
        </div>
      </div>

      <div className="active-team__roster">
        <p className="active-team__roster-label">Equipe</p>
        <ul className="active-team__list">
          {teamMembers.map((member, index) => (
            <li key={member?.id ?? `empty-${index}`}>
              {member ? (
                <ActiveTeamPortrait member={member} isActive={member.id === activeId} index={index} />
              ) : (
                <ActiveTeamEmpty index={index} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
