'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CHARACTER_QUALITY_COLORS,
  CHARACTER_QUALITY_LABELS,
} from '@/constants/character-progression';
import { formatQualityStatMultiplier, formatCharacterGrade } from '@/constants/character-quality-stats';
import { FRAGMENTS_PER_STAR } from '@/constants/aiw-quality';
import { getMaxStarsForRarity } from '@/config/gameConfig';
import { TEAM_SLOT_COUNT, SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { getCuratedPackByLookType } from '@/data/character-packs';
import { narutoFragmentItemId } from '@/data/naruto-loot-tiers';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { forgeStore } from '@/stores/forge-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { CharacterQuality } from '@/types/character-meta';
import { CHARACTER_QUALITIES } from '@/types/character-meta';
import type { SealedCharacter } from '@/types/team';
import { computeInstanceTotals, estimateInstanceCombatPower } from '@/lib/character-instance-stats';
import { formatStat } from '@/lib/format-stat';
import { Decimal, d, hpRatio } from '@/lib/decimal';
import {
  formatMasteryLevel,
  getMasteryXpRequired,
  isMaxMastery,
  nextMasteryMilestone,
} from '@/lib/character-mastery';
import { grantMasteryXp } from '@/lib/grant-mastery-xp';
import { MASTERY_MAX_LEVEL } from '@/constants/character-mastery';
import { CharacterAwakeningSection } from '@/ui/team/character-awakening-section';
import { TeamPresetsSection } from '@/ui/team/team-presets-section';
import { isDevMode } from '@/config/devConfig';

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

function formatInt(value: number): string {
  return Math.round(Math.max(0, value)).toLocaleString('pt-BR');
}

function memberLevel(member: SealedCharacter, activeId: string | null, vitalsLevel: number): number {
  if (member.id === activeId) return Math.max(1, vitalsLevel);
  return Math.max(1, member.level || 1);
}

function memberAttrs(member: SealedCharacter, level: number) {
  return computeInstanceTotals(member, level);
}

function estimateCombatPower(member: SealedCharacter, level: number): number {
  return estimateInstanceCombatPower(member, level);
}

function StarRow({ stars, max }: { stars: number; max: number }) {
  const cap = Math.max(0, Math.min(5, max || 5));
  const n = Math.max(0, Math.min(cap, Math.floor(stars)));
  return (
    <span className="team-mgr__stars" aria-label={`${n} de ${cap} estrelas`}>
      {Array.from({ length: cap }, (_, i) => (
        <span key={i} className={i < n ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

const FORMATION_COLLAPSE_KEY = 'idle-team-formation-collapsed';
const SPLIT_PCT_KEY = 'idle-team-inspector-pct';
const SPLIT_MIN = 28;
const SPLIT_MAX = 72;

function readStoredCollapse(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FORMATION_COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredSplitPct(): number {
  if (typeof window === 'undefined') return 55;
  try {
    const raw = Number(window.localStorage.getItem(SPLIT_PCT_KEY));
    if (!Number.isFinite(raw)) return 55;
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, raw));
  } catch {
    return 55;
  }
}

/**
 * Gestor Equipe + Box — layout Immersive (formação / inspetor / box).
 * Abre pelo botão Equipe do menu superior (ou tecla E).
 */
export function TeamPanel({ variant = 'modal' }: { variant?: 'docked' | 'modal' }) {
  const isOpen = useStore(teamStore, (s) => s.isOpen);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);
  const inventorySlots = useStore(inventoryStore, (s) => s.slots);
  const copper = useStore(inventoryStore, () => inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID));

  const [query, setQuery] = useState('');
  const [qualityFilter, setQualityFilter] = useState<CharacterQuality | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'main' | 'presets'>('main');
  const [boxView, setBoxView] = useState<'grid' | 'list'>('grid');
  const [formationCollapsed, setFormationCollapsed] = useState(false);
  const [inspectorPct, setInspectorPct] = useState(55);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const draggingSplit = useRef(false);
  const inspectorPctRef = useRef(55);

  useEffect(() => {
    inspectorPctRef.current = inspectorPct;
  }, [inspectorPct]);

  useEffect(() => {
    setFormationCollapsed(readStoredCollapse());
    setInspectorPct(readStoredSplitPct());
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    teamStore.refreshPreviews();
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

  const toggleFormationCollapsed = useCallback(() => {
    setFormationCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(FORMATION_COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const updateSplitFromClientX = useCallback((clientX: number) => {
    const root = workspaceRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, pct));
    inspectorPctRef.current = clamped;
    setInspectorPct(clamped);
  }, []);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!draggingSplit.current) return;
      event.preventDefault();
      updateSplitFromClientX(event.clientX);
    };
    const onUp = () => {
      if (!draggingSplit.current) return;
      draggingSplit.current = false;
      document.body.classList.remove('team-mgr-resizing');
      try {
        window.localStorage.setItem(
          SPLIT_PCT_KEY,
          String(Math.round(inspectorPctRef.current)),
        );
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [updateSplitFromClientX]);

  const teamSlots = useMemo(() => {
    const slots: (SealedCharacter | null)[] = Array.from({ length: TEAM_SLOT_COUNT }, () => null);
    teamIds.forEach((id, index) => {
      if (index >= TEAM_SLOT_COUNT) return;
      slots[index] = collection.find((entry) => entry.id === id) ?? null;
    });
    return slots;
  }, [teamIds, collection]);

  const teamMembers = useMemo(
    () => teamSlots.filter((entry): entry is SealedCharacter => entry != null),
    [teamSlots],
  );

  const totalCp = useMemo(
    () =>
      teamMembers.reduce(
        (sum, member) =>
          sum + estimateCombatPower(member, memberLevel(member, activeId, vitals.level)),
        0,
      ),
    [teamMembers, activeId, vitals.level],
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
    return filtered.slice().sort((a, b) => {
      const aIn = teamIds.includes(a.id) ? 1 : 0;
      const bIn = teamIds.includes(b.id) ? 1 : 0;
      if (aIn !== bIn) return aIn - bIn;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const powerDiff =
        estimateCombatPower(b, memberLevel(b, activeId, vitals.level)) -
        estimateCombatPower(a, memberLevel(a, activeId, vitals.level));
      if (powerDiff !== 0) return powerDiff;
      return a.name.localeCompare(b.name, 'pt');
    });
  }, [collection, query, qualityFilter, teamIds, activeId, vitals.level]);

  if (!isOpen) return null;

  const selected =
    collection.find((entry) => entry.id === selectedId) ??
    collection.find((entry) => entry.id === activeId) ??
    null;

  const selectedFragmentId = selected
    ? (() => {
        const charId =
          selected.sourceId ?? getCuratedPackByLookType(selected.lookType)?.id ?? null;
        return charId
          ? narutoFragmentItemId(charId)
          : 'item-anime-naruto-fragmento-personagem';
      })()
    : null;
  const selectedFragmentCount = selectedFragmentId
    ? inventorySlots.reduce(
        (total, slot) =>
          slot?.itemId === selectedFragmentId ? total + slot.quantity : total,
        0,
      )
    : 0;

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

  function focusBox(): void {
    setViewTab('main');
    const el = document.getElementById('team-box-pane');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const selectedLevel = selected ? memberLevel(selected, activeId, vitals.level) : 1;
  const selectedTotals = selected ? memberAttrs(selected, selectedLevel) : null;
  const selectedHpMax = selected
    ? selected.id === activeId
      ? Decimal.max(d(1), vitals.hpMax)
      : d(Math.max(1, Math.round(selectedTotals?.hp ?? 1)))
    : d(1);
  const selectedHp = selected
    ? selected.id === activeId
      ? vitals.hp
      : selectedHpMax
    : d(0);
  const selectedAtk = Math.round(selectedTotals?.strength ?? 0);
  const selectedDef = Math.round(selectedTotals?.defense ?? 0);
  const selectedCrit = Math.round(selectedTotals?.critical ?? 0);
  const masteryLevel = selected?.masteryLevel ?? 0;
  const masteryXp = selected?.masteryXp ?? 0;
  const masteryXpNeed = getMasteryXpRequired(masteryLevel);
  const masteryPct = isMaxMastery(masteryLevel)
    ? 100
    : Math.min(100, Math.round((masteryXp / Math.max(1, masteryXpNeed)) * 100));

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
            ⚔
          </span>
          <div className="team-mgr__brand-copy">
            <div className="team-mgr__brand-row">
              <h2 className="team-mgr__brand-title">Formação de Equipe</h2>
              <span className="team-mgr__pill">
                {teamMembers.length}/{TEAM_SLOT_COUNT} ativos
              </span>
            </div>
            <p className="team-mgr__brand-lede">
              Selecione e gerencie sua tríade de combate
            </p>
          </div>
        </div>

        <div className="team-mgr__tabs" role="tablist" aria-label="Visões da equipe">
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'main'}
            className={`team-mgr__tab${viewTab === 'main' ? ' is-on' : ''}`}
            onClick={() => setViewTab('main')}
          >
            Equipe & Box
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewTab === 'presets'}
            className={`team-mgr__tab${viewTab === 'presets' ? ' is-on' : ''}`}
            onClick={() => setViewTab('presets')}
          >
            Presets
          </button>
        </div>

        <div className="team-mgr__status">
          <div className="team-mgr__currency">
            <span aria-hidden>◎</span>
            <strong>{copper.toLocaleString('pt-BR')}</strong>
            <em>Cobre</em>
          </div>
          <button
            type="button"
            className="team-mgr__close"
            aria-label="Fechar equipe"
            onClick={() => teamStore.setOpen(false)}
          >
            ×
          </button>
        </div>
      </header>

      <div className="team-mgr__body">
        <section
          className={`team-mgr__formation${formationCollapsed ? ' is-collapsed' : ''}`}
          aria-label="Formação de combate"
        >
          <header className="team-mgr__formation-head">
            <div className="team-mgr__formation-brand">
              <span className="team-mgr__pane-icon" aria-hidden>
                ⚔
              </span>
              <div className="team-mgr__pane-copy">
                <div className="team-mgr__brand-row">
                  <h3 className="team-mgr__pane-title">Formação de Combate</h3>
                  <span className="team-mgr__pill">
                    {teamMembers.length}/{TEAM_SLOT_COUNT} ativos
                  </span>
                </div>
                <p className="team-mgr__pane-lede">
                  {formationCollapsed
                    ? `Poder ${formatInt(totalCp)} · clique para expandir`
                    : 'O ativo lidera a caça e concede bônus à formação'}
                </p>
              </div>
            </div>
            <div className="team-mgr__formation-tools">
              {!formationCollapsed ? (
                <div className="team-mgr__cp">
                  <span className="team-mgr__cp-label">Poder de Luta</span>
                  <strong className="team-mgr__cp-value">{formatInt(totalCp)}</strong>
                </div>
              ) : (
                <div className="team-mgr__cp team-mgr__cp--compact">
                  <strong className="team-mgr__cp-value">{formatInt(totalCp)}</strong>
                </div>
              )}
              <button
                type="button"
                className="team-mgr__collapse-btn"
                aria-expanded={!formationCollapsed}
                aria-controls="team-formation-body"
                title={formationCollapsed ? 'Expandir formação' : 'Minimizar formação'}
                onClick={toggleFormationCollapsed}
              >
                {formationCollapsed ? '▾' : '▴'}
              </button>
            </div>
          </header>

          <div
            id="team-formation-body"
            className="team-mgr__formation-body"
            hidden={formationCollapsed}
          >
          <div className="team-mgr__slots">
            {teamSlots.map((member, index) => {
              if (!member) {
                return (
                  <button
                    key={`empty-${index}`}
                    type="button"
                    className="team-mgr__slot-card team-mgr__slot-card--empty"
                    onClick={focusBox}
                  >
                    <span className="team-mgr__slot-plus">+</span>
                    <strong>
                      {index === 0 ? 'Posição líder (vazio)' : `Posição ${index + 1} vazia`}
                    </strong>
                    <span>Clique para equipar</span>
                    <em>Slot 0{index + 1}</em>
                  </button>
                );
              }

              const isActive = member.id === activeId;
              const isSelected = selected?.id === member.id;
              const level = memberLevel(member, activeId, vitals.level);
              const qColor = CHARACTER_QUALITY_COLORS[member.quality];

              return (
                <article
                  key={member.id}
                  className={[
                    'team-mgr__slot-card',
                    isSelected ? 'is-selected' : '',
                    isActive ? 'is-leader' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  style={{ ['--q' as string]: qColor }}
                  onClick={() => select(member.id)}
                  onDoubleClick={() => makeActive(member.id)}
                >
                  <div className="team-mgr__slot-card-top">
                    <div className="team-mgr__slot-tags">
                      <span className="team-mgr__quality" style={{ ['--q' as string]: qColor }}>
                        {CHARACTER_QUALITY_LABELS[member.quality]} · {formatCharacterGrade(member.grade)}{' '}
                        {formatQualityStatMultiplier(member.qualityStatMultiplier)}
                      </span>
                      {isActive ? (
                        <span className="team-mgr__leader-tag">♛ Líder</span>
                      ) : null}
                    </div>
                    {member.id !== activeId ? (
                      <button
                        type="button"
                        className="team-mgr__slot-x"
                        title="Guardar no Box"
                        aria-label={`Remover ${member.name} da equipe`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFromTeam(member.id);
                        }}
                      >
                        ×
                      </button>
                    ) : null}
                  </div>

                  <div className="team-mgr__slot-card-body">
                    <span className="team-mgr__thumb" style={{ ['--q' as string]: qColor }}>
                      <span className="team-mgr__thumb-halo" aria-hidden />
                      <Image
                        className="team-mgr__thumb-img"
                        src={member.previewUrl}
                        alt=""
                        width={72}
                        height={72}
                        unoptimized
                      />
                    </span>
                    <div className="team-mgr__slot-meta">
                      <h4>{member.name}</h4>
                      <p>
                        Lv. {level}
                        {member.stars > 0 ? ` · ${member.stars}★` : ''}
                      </p>
                      <StarRow
                        stars={member.stars}
                        max={getMaxStarsForRarity(member.quality)}
                      />
                    </div>
                  </div>

                  <div className="team-mgr__slot-card-foot">
                    <span>
                      Maestria Lv.{formatMasteryLevel(member.masteryLevel ?? 0)}
                    </span>
                    {isActive ? (
                      <em>Líder ativo</em>
                    ) : (
                      <button
                        type="button"
                        className="team-mgr__slot-leader-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          makeActive(member.id);
                        }}
                      >
                        Tornar líder
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <footer className="team-mgr__synergy">
            <div>
              <strong>Sinergias ativas</strong>
              {teamMembers.length >= 2 ? (
                <span className="team-mgr__synergy-chip is-on">✓ Formação completa parcial</span>
              ) : (
                <span className="team-mgr__synergy-hint">
                  Adicione pelo menos 2 heróis na formação
                </span>
              )}
            </div>
            <span>
              Slots ativos: {teamMembers.length}/{TEAM_SLOT_COUNT}
            </span>
          </footer>
          </div>
        </section>

        {viewTab === 'presets' ? (
          <div className="team-mgr__presets-wrap">
            <TeamPresetsSection />
          </div>
        ) : (
          <div
            className="team-mgr__workspace"
            ref={workspaceRef}
            style={{
              ['--inspector-pct' as string]: `${inspectorPct}%`,
            }}
          >
            <section className="team-mgr__inspector" aria-label="Inspetor do personagem">
              {selected && selectedTotals ? (
                <>
                  <div className="team-mgr__inspector-hero">
                    <span
                      className="team-mgr__thumb team-mgr__thumb--lg"
                      style={{ ['--q' as string]: CHARACTER_QUALITY_COLORS[selected.quality] }}
                    >
                      <span className="team-mgr__thumb-halo" aria-hidden />
                      <Image
                        className="team-mgr__thumb-img"
                        src={selected.previewUrl}
                        alt=""
                        width={96}
                        height={96}
                        unoptimized
                      />
                    </span>
                    <div className="team-mgr__inspector-meta">
                      <p className="team-mgr__inspector-lv">
                        Lv. {selectedLevel}
                        <span>·</span>
                        <span
                          className="team-mgr__quality"
                          style={{
                            ['--q' as string]: CHARACTER_QUALITY_COLORS[selected.quality],
                          }}
                        >
                          {CHARACTER_QUALITY_LABELS[selected.quality]} · {formatCharacterGrade(selected.grade)}
                        </span>
                      </p>
                      <h3 className="team-mgr__inspector-name">{selected.name}</h3>
                      <StarRow
                        stars={selected.stars}
                        max={getMaxStarsForRarity(selected.quality)}
                      />
                      {selected.id === activeId ? (
                        <span className="team-mgr__active-tag">Líder ativo</span>
                      ) : null}
                    </div>
                    <div className="team-mgr__inspector-tools">
                      <button
                        type="button"
                        className={`team-mgr__icon-btn${selected.isFavorite ? ' is-on' : ''}`}
                        title={selected.isFavorite ? 'Favorito' : 'Favoritar'}
                        onClick={() =>
                          teamStore.setFavorite(selected.id, !selected.isFavorite)
                        }
                      >
                        {selected.isFavorite ? '★' : '☆'}
                      </button>
                      <button
                        type="button"
                        className={`team-mgr__icon-btn${selected.isLocked ? ' is-lock' : ''}`}
                        title={selected.isLocked ? 'Desbloquear' : 'Bloquear'}
                        onClick={() =>
                          teamStore.setLocked(selected.id, !selected.isLocked)
                        }
                      >
                        {selected.isLocked ? '#' : '○'}
                      </button>
                      <button
                        type="button"
                        className="team-mgr__icon-btn"
                        title="Forja"
                        onClick={() => {
                          teamStore.setOpen(false);
                          forgeStore.open();
                        }}
                      >
                        ⌂
                      </button>
                    </div>
                  </div>

                  <div className="team-mgr__meters">
                    <div className="team-mgr__meter">
                      <div className="team-mgr__meter-row">
                        <span>Ataque base</span>
                        <strong>{formatInt(selectedAtk)}</strong>
                      </div>
                      <div className="team-mgr__meter-track">
                        <span
                          className="team-mgr__meter-fill is-atk"
                          style={{ width: `${Math.min(100, (selectedAtk / 80) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="team-mgr__meter">
                      <div className="team-mgr__meter-row">
                        <span>Defesa (crit {selectedCrit}%)</span>
                        <strong>{formatInt(selectedDef)}</strong>
                      </div>
                      <div className="team-mgr__meter-track">
                        <span
                          className="team-mgr__meter-fill is-def"
                          style={{ width: `${Math.min(100, (selectedDef / 40) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="team-mgr__meter">
                      <div className="team-mgr__meter-row">
                        <span>Pontos de vida (HP)</span>
                        <strong>
                          {formatStat(selectedHp)} / {formatStat(selectedHpMax)}
                        </strong>
                      </div>
                      <div className="team-mgr__meter-track">
                        <span
                          className="team-mgr__meter-fill is-hp"
                          style={{
                            width: `${Math.min(100, hpRatio(selectedHp, selectedHpMax) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="team-mgr__meter">
                      <div className="team-mgr__meter-row">
                        <span>Velocidade</span>
                        <strong>{formatInt(selectedTotals.speed)}</strong>
                      </div>
                      <div className="team-mgr__meter-track">
                        <span
                          className="team-mgr__meter-fill is-spd"
                          style={{
                            width: `${Math.min(100, (selectedTotals.speed / 200) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="team-mgr__mastery-card">
                    <div className="team-mgr__mastery-head">
                      <strong>Maestria do herói</strong>
                      <span>
                        Lv. {formatMasteryLevel(masteryLevel)} / {MASTERY_MAX_LEVEL}
                      </span>
                    </div>
                    <div className="team-mgr__meter-track">
                      <span
                        className="team-mgr__meter-fill is-mastery"
                        style={{ width: `${masteryPct}%` }}
                      />
                    </div>
                    <div className="team-mgr__mastery-foot">
                      <span>
                        XP:{' '}
                        {isMaxMastery(masteryLevel)
                          ? 'MAX'
                          : `${masteryXp} / ${masteryXpNeed}`}
                      </span>
                      <span>Só o herói ativo ganha XP</span>
                    </div>
                    {nextMasteryMilestone(masteryLevel) ? (
                      <p className="team-mgr__mastery-next">
                        Próximo marco: {nextMasteryMilestone(masteryLevel)}
                      </p>
                    ) : null}
                    {isDevMode() ? (
                      <div className="team-mgr__actions">
                        <button
                          type="button"
                          className="team-mgr__btn team-mgr__btn--ghost"
                          onClick={() => grantMasteryXp(selected.id, 100, { force: true })}
                        >
                          DEV +100 M.XP
                        </button>
                        <button
                          type="button"
                          className="team-mgr__btn team-mgr__btn--ghost"
                          onClick={() =>
                            teamStore.setCharacterMastery(selected.id, {
                              masteryLevel: 0,
                              masteryXp: 0,
                            })
                          }
                        >
                          DEV Reset Maestria
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <CharacterAwakeningSection selected={selected} />

                  <div className="team-mgr__actions team-mgr__actions--stack">
                    {getMaxStarsForRarity(selected.quality) > 0 &&
                    selected.stars < getMaxStarsForRarity(selected.quality) ? (
                      <button
                        type="button"
                        className="team-mgr__btn team-mgr__btn--gold"
                        disabled={selectedFragmentCount < FRAGMENTS_PER_STAR}
                        title={`${selectedFragmentCount}/${FRAGMENTS_PER_STAR} fragmentos`}
                        onClick={() => teamStore.upgradeStarWithFragments(selected.id)}
                      >
                        +1★ ({selectedFragmentCount}/{FRAGMENTS_PER_STAR})
                      </button>
                    ) : null}

                    {!teamIds.includes(selected.id) ? (
                      <button
                        type="button"
                        className="team-mgr__btn team-mgr__btn--gold team-mgr__btn--wide"
                        onClick={() => sendToTeam(selected.id)}
                      >
                        + Equipar na equipe
                      </button>
                    ) : selected.id === activeId ? (
                      <span className="team-mgr__btn team-mgr__btn--gold team-mgr__btn--wide is-static">
                        Líder ativo da equipe
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="team-mgr__btn team-mgr__btn--gold team-mgr__btn--wide"
                          onClick={() => makeActive(selected.id)}
                        >
                          Tornar líder ativo
                        </button>
                        <button
                          type="button"
                          className="team-mgr__btn team-mgr__btn--ghost"
                          onClick={() => removeFromTeam(selected.id)}
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="team-mgr__inspector-empty">
                  Selecione um herói no Box para inspecionar
                </p>
              )}
            </section>

            <div
              className="team-mgr__split"
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionar inspetor e box"
              aria-valuemin={SPLIT_MIN}
              aria-valuemax={SPLIT_MAX}
              aria-valuenow={Math.round(inspectorPct)}
              tabIndex={0}
              onPointerDown={(event) => {
                event.preventDefault();
                draggingSplit.current = true;
                document.body.classList.add('team-mgr-resizing');
                (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                updateSplitFromClientX(event.clientX);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  const delta = event.key === 'ArrowLeft' ? -2 : 2;
                  const next = Math.min(
                    SPLIT_MAX,
                    Math.max(SPLIT_MIN, inspectorPctRef.current + delta),
                  );
                  inspectorPctRef.current = next;
                  setInspectorPct(next);
                  try {
                    window.localStorage.setItem(SPLIT_PCT_KEY, String(Math.round(next)));
                  } catch {
                    /* ignore */
                  }
                }
              }}
            >
              <span className="team-mgr__split-grip" aria-hidden />
            </div>

            <section
              id="team-box-pane"
              className="team-mgr__pane team-mgr__pane--box"
              aria-label="Box de personagens"
            >
              <header className="team-mgr__pane-head">
                <span className="team-mgr__pane-icon" aria-hidden>
                  ▣
                </span>
                <div className="team-mgr__pane-copy">
                  <h3 className="team-mgr__pane-title">Inventário Box</h3>
                  <p className="team-mgr__pane-lede">
                    Selecione heróis para inspecionar ou equipar
                  </p>
                </div>
                <span className="team-mgr__count">
                  {boxMembers.length}/{collection.length}
                </span>
              </header>

              <div className="team-mgr__box-toolbar">
                <label className="team-mgr__search">
                  <span className="team-mgr__search-icon" aria-hidden>
                    ⌕
                  </span>
                  <input
                    type="search"
                    placeholder="Filtrar herói..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className="team-mgr__view-toggle" role="group" aria-label="Modo de lista">
                  <button
                    type="button"
                    className={boxView === 'grid' ? 'is-on' : ''}
                    onClick={() => setBoxView('grid')}
                    title="Grade"
                  >
                    ▦
                  </button>
                  <button
                    type="button"
                    className={boxView === 'list' ? 'is-on' : ''}
                    onClick={() => setBoxView('list')}
                    title="Lista"
                  >
                    ☰
                  </button>
                </div>
              </div>

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

              {boxMembers.length === 0 ? (
                <p className="team-mgr__box-empty">Nenhum personagem com estes filtros.</p>
              ) : (
                <div
                  className={`team-mgr__box-list${boxView === 'list' ? ' is-list' : ' is-grid'}`}
                >
                  {boxMembers.map((member) => {
                    const inTeam = teamIds.includes(member.id);
                    const isActive = member.id === activeId;
                    const isSelected = selected?.id === member.id;
                    const level = memberLevel(member, activeId, vitals.level);
                    const atk = Math.round(memberAttrs(member, level).strength);
                    const qColor = CHARACTER_QUALITY_COLORS[member.quality];

                    return (
                      <article
                        key={member.id}
                        className={[
                          'team-mgr__box-card',
                          isSelected ? 'is-selected' : '',
                          inTeam ? 'is-inteam' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        style={{ ['--q' as string]: qColor }}
                        onClick={() => select(member.id)}
                        onDoubleClick={() => makeActive(member.id)}
                      >
                        {inTeam ? <span className="team-mgr__box-dot" aria-hidden /> : null}
                        <div className="team-mgr__box-card-top">
                          <span className="team-mgr__quality" style={{ ['--q' as string]: qColor }}>
                            {CHARACTER_QUALITY_LABELS[member.quality]} · {formatCharacterGrade(member.grade)} {formatQualityStatMultiplier(member.qualityStatMultiplier)}
                          </span>
                          {inTeam ? (
                            <span className="team-mgr__mini-badge">
                              {isActive ? 'Líder' : 'Na equipe'}
                            </span>
                          ) : null}
                          <span className="team-mgr__box-flags">
                            {member.isFavorite ? '★' : null}
                            {member.isLocked ? '#' : null}
                          </span>
                        </div>

                        <div className="team-mgr__box-card-body">
                          <span className="team-mgr__thumb" style={{ ['--q' as string]: qColor }}>
                            <Image
                              className="team-mgr__thumb-img"
                              src={member.previewUrl}
                              alt=""
                              width={48}
                              height={48}
                              unoptimized
                            />
                          </span>
                          <div>
                            <h4>
                              {member.name}
                              <StarRow
                                stars={member.stars}
                                max={Math.min(5, getMaxStarsForRarity(member.quality))}
                              />
                            </h4>
                            <p>
                              <em>Lv.{level}</em> · ATK {formatCompact(atk)}
                            </p>
                          </div>
                        </div>

                        <div className="team-mgr__box-card-foot">
                          <span>Maestria Lv.{formatMasteryLevel(member.masteryLevel ?? 0)}</span>
                          {inTeam ? (
                            member.id !== activeId ? (
                              <button
                                type="button"
                                className="team-mgr__box-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeFromTeam(member.id);
                                }}
                              >
                                Remover
                              </button>
                            ) : (
                              <span className="team-mgr__box-action is-static">Ativo</span>
                            )
                          ) : (
                            <button
                              type="button"
                              className="team-mgr__box-action is-equip"
                              onClick={(event) => {
                                event.stopPropagation();
                                sendToTeam(member.id);
                              }}
                            >
                              + Equipar
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              <footer className="team-mgr__box-cap">
                <span>
                  Capacidade box: {collection.length}
                </span>
                <span>
                  Heróis na equipe: {teamMembers.length}/{TEAM_SLOT_COUNT}
                </span>
              </footer>
            </section>
          </div>
        )}
      </div>
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
