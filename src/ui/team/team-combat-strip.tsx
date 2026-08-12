'use client';

import Image from 'next/image';
import { useEffect, useMemo, type RefObject } from 'react';
import { CHARACTER_QUALITY_COLORS } from '@/constants/character-progression';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { SealedCharacter } from '@/types/team';
import { computePlayerAttributes } from '@/utils/attributes';

function formatCompact(value: number): string {
  const n = Math.max(0, value);
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    const text = v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${text.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1')}M`;
  }
  if (n >= 1_000) {
    const v = n / 1_000;
    const text = v >= 100 ? String(Math.round(v)) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return `${text.replace(/\.0+$/, '')}K`;
  }
  return String(Math.round(n));
}

function estimateHpMax(stars: number, level: number): number {
  return Math.max(1, Math.round(computePlayerAttributes({ level, stars }).totals.hp));
}

function ActiveTeamRow({
  member,
  isActive,
  level,
  hp,
  hpMax,
  expPct,
}: {
  member: SealedCharacter;
  isActive: boolean;
  level: number;
  hp: number;
  hpMax: number;
  expPct: number;
}) {
  const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];
  const hpSafe = Math.max(1, hpMax);
  const hpPct = Math.max(0, Math.min(100, (hp / hpSafe) * 100));
  const expSafe = Math.max(0, Math.min(100, expPct));

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
          <span className="active-team__name">{member.name}</span>
          <span className="active-team__lv">Lv.{level}</span>
        </div>
        <div className="active-team__bar active-team__bar--hp">
          <span className="active-team__bar-fill" style={{ width: `${hpPct}%` }} />
          <span className="active-team__bar-label">
            {formatCompact(hp)}/{formatCompact(hpMax)}
          </span>
        </div>
        <div className="active-team__bar active-team__bar--exp">
          <span className="active-team__bar-fill" style={{ width: `${expSafe}%` }} />
          <span className="active-team__bar-label">EXP {Math.round(expSafe)}%</span>
        </div>
      </div>
    </button>
  );
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

  useEffect(() => {
    teamStore.refreshPreviews();
  }, []);
  const vitals = useStore(vitalsStore, (s) => s);
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

  const expPct =
    vitals.xpMax > 0 ? Math.max(0, Math.min(100, (vitals.xp / vitals.xpMax) * 100)) : 0;

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
        <h2 className="active-team__player">{nickname || 'Shinobi'}</h2>
        <p className="active-team__sub">
          Nível {vitals.level}
          {activeMember ? ` — ${activeMember.name}` : ''}
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
          const hpMax = isActive
            ? Math.max(1, vitals.hpMax)
            : estimateHpMax(member.stars, vitals.level);
          const hp = isActive ? vitals.hp : hpMax;

          return (
            <li key={member.id}>
              <ActiveTeamRow
                member={member}
                isActive={isActive}
                level={vitals.level}
                hp={hp}
                hpMax={hpMax}
                expPct={isActive ? expPct : 0}
              />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
