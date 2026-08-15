'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  CHARACTER_QUALITY_COLORS,
  CHARACTER_QUALITY_LABELS,
} from '@/constants/character-progression';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { forgeStore } from '@/stores/forge-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
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

function MemberThumb({ member }: { member: SealedCharacter }) {
  const color = CHARACTER_QUALITY_COLORS[member.quality];
  return (
    <span className="team-mgr__thumb" style={{ ['--q' as string]: color }}>
      <span className="team-mgr__thumb-halo" aria-hidden />
      <Image
        className="team-mgr__thumb-img"
        src={member.previewUrl}
        alt=""
        width={48}
        height={48}
        unoptimized
      />
    </span>
  );
}

/**
 * Gestor Equipe + Box — abre pelo botão Equipe do menu superior (ou tecla E).
 * Layout de referência: esquerda equipe, direita coleção (box), busca e filtros.
 */
export function TeamPanel({ variant = 'modal' }: { variant?: 'docked' | 'modal' }) {
  const isOpen = useStore(teamStore, (s) => s.isOpen);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);

  const [query, setQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState<CharacterQuality | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    teamStore.refreshPreviews();
    // Garante seleção inicial no ativo.
    setSelectedId((prev) => prev ?? activeId ?? teamIds[0] ?? collection[0]?.id ?? null);
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        teamStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, activeId, teamIds, collection]);

  const teamMembers = useMemo(
    () =>
      teamIds
        .map((id) => collection.find((entry) => entry.id === id))
        .filter((entry): entry is SealedCharacter => entry != null),
    [teamIds, collection],
  );

  const boxMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = collection.filter((entry) => {
      if (qualityFilter !== 'all' && entry.quality !== qualityFilter) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        CHARACTER_QUALITY_LABELS[entry.quality].toLowerCase().includes(q) ||
        entry.quality.toLowerCase() === q
      );
    });
    // Box: fora da equipe primeiro; ativos/equipe no fim (como lista de reserva).
    return filtered.slice().sort((a, b) => {
      const aIn = teamIds.includes(a.id) ? 1 : 0;
      const bIn = teamIds.includes(b.id) ? 1 : 0;
      if (aIn !== bIn) return aIn - bIn;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return a.name.localeCompare(b.name, 'pt');
    });
  }, [collection, query, qualityFilter, teamIds]);

  if (!isOpen) return null;

  const selected =
    collection.find((entry) => entry.id === selectedId) ??
    collection.find((entry) => entry.id === activeId) ??
    null;

  function select(id: string): void {
    setSelectedId(id);
  }

  function sendToTeam(id: string): void {
    if (teamStore.addToTeam(id)) setSelectedId(id);
  }

  function removeFromTeam(id: string): void {
    if (teamStore.removeFromTeam(id)) setSelectedId(id);
  }

  function makeActive(id: string): void {
    if (!teamIds.includes(id)) {
      if (!teamStore.addToTeam(id)) return;
    }
    switchActiveCharacter(id);
    setSelectedId(id);
  }

  /** Ação rápida no chevron: equipe↔box. */
  function quickTransfer(member: SealedCharacter, from: 'team' | 'box'): void {
    if (from === 'team') {
      if (member.id === activeId) {
        select(member.id);
        return;
      }
      removeFromTeam(member.id);
      return;
    }
    if (teamIds.includes(member.id)) {
      makeActive(member.id);
      return;
    }
    sendToTeam(member.id);
  }

  function renderMemberRow(member: SealedCharacter, opts: { from: 'team' | 'box'; empty?: false }) {
    const isActive = member.id === activeId;
    const isSelected = selected?.id === member.id;
    const inTeam = teamIds.includes(member.id);
    const memberLevel = Math.max(1, member.level || 1);
    const hpMax = isActive ? Math.max(1, vitals.hpMax) : estimateHpMax(member.stars, memberLevel);
    const hp = isActive ? vitals.hp : hpMax;
    const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];

    return (
      <li key={member.id}>
        <button
          type="button"
          className={[
            'team-mgr__row',
            isActive ? 'is-active' : '',
            isSelected ? 'is-selected' : '',
            inTeam && opts.from === 'box' ? 'is-inteam' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => select(member.id)}
          onDoubleClick={() => {
            if (opts.from === 'box') makeActive(member.id);
            else if (!isActive) makeActive(member.id);
          }}
        >
          <MemberThumb member={member} />
          <div className="team-mgr__row-body">
            <p className="team-mgr__name">
              <span className="team-mgr__name-text">{member.name}</span>
              {isActive ? <span className="team-mgr__active-tag">ATIVO</span> : null}
              {!isActive && inTeam && opts.from === 'box' ? (
                <span className="team-mgr__mini-badge">EQ</span>
              ) : null}
            </p>
            <p className="team-mgr__stats">
              Lv {memberLevel} · HP {formatCompact(hp)}/{formatCompact(hpMax)}
              {member.stars > 0 ? ` · ${member.stars}★` : ''}
            </p>
            <span className="team-mgr__quality" style={{ ['--q' as string]: qualityColor }}>
              {CHARACTER_QUALITY_LABELS[member.quality]}
            </span>
          </div>
          <span
            className="team-mgr__chev"
            role="presentation"
            title={
              opts.from === 'team'
                ? isActive
                  ? 'Principal ativo'
                  : 'Guardar no Box'
                : inTeam
                  ? 'Tornar ativo'
                  : 'Enviar à Equipe'
            }
            onClick={(event) => {
              event.stopPropagation();
              quickTransfer(member, opts.from);
            }}
          >
            ›
          </span>
        </button>
      </li>
    );
  }

  const panel = (
    <div
      className={`team-mgr${variant === 'modal' ? ' team-mgr--modal' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Equipe"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="team-mgr__top">
        <div className="team-mgr__brand">
          <span className="team-mgr__brand-icon" aria-hidden>
            🧬
          </span>
          <h2 className="team-mgr__brand-title">Equipe</h2>
          <span className="team-mgr__pill">
            {teamMembers.length}/{TEAM_SLOT_COUNT} equipe
          </span>
        </div>
        <button
          type="button"
          className="team-mgr__close"
          aria-label="Fechar equipe"
          onClick={() => teamStore.setOpen(false)}
        >
          ×
        </button>
      </header>

      <div className="team-mgr__grid">
        <section className="team-mgr__pane" aria-label="Membros da equipe">
          <header className="team-mgr__pane-head">
            <span className="team-mgr__pane-icon" aria-hidden>
              ⚔
            </span>
            <h3 className="team-mgr__pane-title">Equipe</h3>
          </header>

          <ul className="team-mgr__list">
            {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
              const member = teamMembers[index] ?? null;
              if (!member) {
                return (
                  <li key={`empty-${index}`} className="team-mgr__row team-mgr__row--empty">
                    <span className="team-mgr__thumb team-mgr__thumb--empty">+</span>
                    <div className="team-mgr__row-body">
                      <p className="team-mgr__name muted">Slot vazio</p>
                      <p className="team-mgr__stats">Envie alguém do Box</p>
                    </div>
                  </li>
                );
              }
              return renderMemberRow(member, { from: 'team' });
            })}
          </ul>
        </section>

        <section className="team-mgr__pane team-mgr__pane--box" aria-label="Box de personagens">
          <header className="team-mgr__pane-head">
            <span className="team-mgr__pane-icon" aria-hidden>
              ▣
            </span>
            <h3 className="team-mgr__pane-title">Box</h3>
            <span className="team-mgr__count">{collection.length}</span>
            <label className="team-mgr__search team-mgr__search--inline">
              <span className="team-mgr__search-icon" aria-hidden>
                ⌕
              </span>
              <input
                type="search"
                placeholder="Buscar..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </header>

          <div className="team-mgr__filters" role="group" aria-label="Filtrar por qualidade">
            <button
              type="button"
              className={`team-mgr__filter${qualityFilter === 'all' ? ' is-on' : ''}`}
              onClick={() => setQualityFilter('all')}
            >
              Todos
            </button>
            {CHARACTER_QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                className={`team-mgr__filter${qualityFilter === q ? ' is-on' : ''}`}
                style={{ ['--q' as string]: CHARACTER_QUALITY_COLORS[q] }}
                onClick={() => setQualityFilter(q)}
                title={CHARACTER_QUALITY_LABELS[q]}
              >
                {CHARACTER_QUALITY_LABELS[q]}
              </button>
            ))}
          </div>

          <ul className="team-mgr__list team-mgr__list--box">
            {boxMembers.length === 0 ? (
              <li className="team-mgr__row team-mgr__row--empty">
                <div className="team-mgr__row-body">
                  <p className="team-mgr__name muted">Nenhum personagem</p>
                </div>
              </li>
            ) : (
              boxMembers.map((member) => renderMemberRow(member, { from: 'box' }))
            )}
          </ul>
        </section>
      </div>

      <footer className="team-mgr__foot">
        <div className="team-mgr__actions">
          <button
            type="button"
            className="team-mgr__btn team-mgr__btn--gold"
            onClick={() => {
              teamStore.setOpen(false);
              forgeStore.open();
            }}
          >
            Forja
          </button>
          {selected ? (
            <>
              {!teamIds.includes(selected.id) ? (
                <button
                  type="button"
                  className="team-mgr__btn"
                  onClick={() => sendToTeam(selected.id)}
                >
                  Enviar à equipe
                </button>
              ) : (
                <>
                  {selected.id !== activeId ? (
                    <button
                      type="button"
                      className="team-mgr__btn"
                      onClick={() => makeActive(selected.id)}
                    >
                      Tornar ativo
                    </button>
                  ) : (
                    <span className="team-mgr__btn-label">Principal ativo</span>
                  )}
                  {selected.id !== activeId ? (
                    <button
                      type="button"
                      className="team-mgr__btn team-mgr__btn--ghost"
                      onClick={() => removeFromTeam(selected.id)}
                    >
                      Guardar no Box
                    </button>
                  ) : null}
                </>
              )}
              <button
                type="button"
                className="team-mgr__btn team-mgr__btn--ghost"
                onClick={() => teamStore.setFavorite(selected.id, !selected.isFavorite)}
              >
                {selected.isFavorite ? '★ Favorito' : '☆ Favoritar'}
              </button>
              <button
                type="button"
                className="team-mgr__btn team-mgr__btn--ghost"
                onClick={() => teamStore.setLocked(selected.id, !selected.isLocked)}
              >
                {selected.isLocked ? 'Desbloquear' : 'Bloquear'}
              </button>
            </>
          ) : null}
        </div>
        <p className="team-mgr__hint">
          Guarde no Box ou envie para a Equipe (máx. {TEAM_SLOT_COUNT}). Só o ativo caça e sobe XP.
          Clique › para mover rápido · duplo clique torna ativo · Forja abre em janela própria.
        </p>
      </footer>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        className="team-mgr-overlay"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) teamStore.setOpen(false);
        }}
      >
        {panel}
      </div>
    );
  }

  return panel;
}

/** Fecha inventário e abre/fecha o gestor de equipe (menu + tecla E). */
export function toggleTeamManager(): void {
  const willOpen = !teamStore.getSnapshot().isOpen;
  if (willOpen) {
    inventoryStore.setOpen(false);
    forgeStore.close();
    teamStore.refreshPreviews();
  }
  teamStore.setOpen(willOpen);
}
