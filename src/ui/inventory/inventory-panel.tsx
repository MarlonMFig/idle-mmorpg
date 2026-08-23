'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  CHARACTER_QUALITY_COLORS,
  CHARACTER_QUALITY_LABELS,
  FORGE_MATERIAL_COST_BY_QUALITY,
} from '@/constants/character-progression';
import { formatQualityStatMultiplier } from '@/constants/character-quality-stats';
import { formatMaxStarsReachedMessage, getMaxStarsForRarity } from '@/config/gameConfig';
import { ATTRIBUTE_LABELS, ATTRIBUTE_ORDER } from '@/constants/attributes';
import { INVENTORY_COLUMNS, INVENTORY_SLOT_COUNT } from '@/constants/inventory';
import { getItem, RARITY_CSS } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { planForgeStar } from '@/systems/forge';
import { attributesStore } from '@/stores/attributes-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { InventorySlot } from '@/types/inventory';
import type { SealedCharacter } from '@/types/team';
import { formatStars } from '@/utils/character-display';
import { computeInstanceTotals } from '@/lib/character-instance-stats';

function slotLabel(slot: InventorySlot): string {
  if (!slot) return '';
  const def = getItem(slot.itemId);
  const name = def?.name ?? slot.itemId;
  const qty = slot.quantity > 1 ? ` ×${slot.quantity}` : '';
  return `${name}${qty}`;
}

/** Monograma visual para slots sem asset de ícone. */
function itemMonogram(itemId: string, name: string): string {
  if (itemId.includes('coin') || itemId.includes('2148')) return '¢';
  if (itemId.includes('scroll') || itemId.includes('seal')) return 'Sc';
  if (itemId.includes('kunai') || itemId.includes('sword')) return 'W';
  const clean = name.replace(/[^A-Za-zÀ-ÿ0-9]/g, '');
  return (clean.slice(0, 2) || '??').toUpperCase();
}

function StarRow({ stars, max }: { stars: number; max: number }) {
  const n = Math.max(0, Math.min(max, Math.floor(stars)));
  if (max <= 0) return null;
  return (
    <span className="char-stars" aria-label={`${n} de ${max} estrelas`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`char-stars__dot${i < n ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

function Portrait({
  member,
  size = 52,
  selected = false,
  inTeam = false,
  isActive = false,
  onSelect,
}: {
  member: SealedCharacter;
  size?: number;
  selected?: boolean;
  inTeam?: boolean;
  isActive?: boolean;
  onSelect?: () => void;
}) {
  const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];
  const body = (
    <>
      <span className="char-portrait__frame" style={{ borderColor: qualityColor }}>
        <Image
          className="char-portrait__img"
          src={member.previewUrl}
          alt=""
          width={size}
          height={size}
          unoptimized
        />
        <span className="char-portrait__rank" style={{ background: qualityColor }}>
          {member.quality}
        </span>
        {member.isFavorite ? (
          <span className="char-portrait__flag char-portrait__flag--fav" title="Favorito">
            ★
          </span>
        ) : null}
        {member.isLocked ? (
          <span className="char-portrait__flag char-portrait__flag--lock" title="Bloqueado">
            #
          </span>
        ) : null}
        {isActive ? (
          <span className="char-portrait__badge char-portrait__badge--active">ATIVO</span>
        ) : null}
        {!isActive && inTeam ? (
          <span className="char-portrait__badge char-portrait__badge--team">EQ</span>
        ) : null}
      </span>
      <span className="char-portrait__stars">
        <StarRow stars={member.stars} max={getMaxStarsForRarity(member.quality)} />
      </span>
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className={`char-portrait${selected ? ' is-selected' : ''}${isActive ? ' is-active' : ''}`}
        style={{ width: size + 8, height: size + 22 }}
        title={member.name}
        aria-pressed={selected}
        onClick={onSelect}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      className={`char-portrait${isActive ? ' is-active' : ''}`}
      style={{ width: size + 8, height: size + 22 }}
      title={member.name}
    >
      {body}
    </div>
  );
}

export function ForgeTab() {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const groups = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; representative: SealedCharacter; entries: SealedCharacter[] }
    >();
    const team = new Set(teamIds);

    for (const entry of collection) {
      const key = `${entry.characterKey}::${entry.quality}`;
      const group = grouped.get(key);
      if (group) group.entries.push(entry);
      else grouped.set(key, { key, representative: entry, entries: [entry] });
    }

    return [...grouped.values()]
      .map((group) => {
        const candidates = group.entries
          .filter((entry) => entry.stars < getMaxStarsForRarity(entry.quality))
          .sort((a, b) => {
            const teamDiff = Number(team.has(b.id)) - Number(team.has(a.id));
            if (teamDiff !== 0) return teamDiff;
            if (b.stars !== a.stars) return b.stars - a.stars;
            return b.level - a.level;
          });
        const maxed = [...group.entries].sort((a, b) => b.stars - a.stars || b.level - a.level);
        return { ...group, representative: candidates[0] ?? maxed[0] };
      })
      .sort(
        (a, b) =>
          a.representative.name.localeCompare(b.representative.name, 'pt-BR') ||
          a.representative.quality.localeCompare(b.representative.quality),
      );
  }, [collection, teamIds]);

  useEffect(() => {
    if (targetId && collection.some((entry) => entry.id === targetId)) return;
    setTargetId(groups[0]?.representative.id ?? null);
    setPendingConfirm(false);
  }, [collection, groups, targetId]);

  const plan = targetId ? planForgeStar({ targetId, collection, teamIds }) : null;
  const commonCost = FORGE_MATERIAL_COST_BY_QUALITY.D ?? 20;
  const target = plan?.target ?? collection.find((entry) => entry.id === targetId) ?? null;
  const selectedGroup = groups.find((group) => group.entries.some((entry) => entry.id === targetId));
  const currentStats = target ? computeInstanceTotals(target) : null;
  const starCap = target ? getMaxStarsForRarity(target.quality) : 0;
  const atStarCap = Boolean(target && starCap > 0 && target.stars >= starCap);
  const nextStars = target ? Math.min(starCap, target.stars + 1) : 0;
  const nextStats = target
    ? computeInstanceTotals({ ...target, stars: nextStars as SealedCharacter['stars'] })
    : null;
  const formatStat = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return (
    <div className="char-forge">
      <div className="char-forge__layout">
        <aside className="char-forge__roster">
          <header className="char-forge__section-head">
            <div>
              <p className="char-forge__eyebrow">Personagens</p>
              <h3>Escolha quem aprimorar</h3>
            </div>
            <span>{groups.length}</span>
          </header>
          <div className="char-forge__roster-list" role="list">
            {groups.length === 0 ? (
              <p className="char-forge__empty">Nenhum personagem obtido.</p>
            ) : (
              groups.map((group) => {
                const entry = group.representative;
                const selected = selectedGroup?.key === group.key;
                const qualityColor = CHARACTER_QUALITY_COLORS[entry.quality];
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={`char-forge__roster-item${selected ? ' is-selected' : ''}`}
                    style={{ ['--quality' as string]: qualityColor }}
                    onClick={() => {
                      setTargetId(entry.id);
                      setPendingConfirm(false);
                    }}
                    role="listitem"
                    aria-pressed={selected}
                  >
                    <span className="char-forge__roster-avatar">
                      <Image
                        src={entry.previewUrl}
                        alt=""
                        width={42}
                        height={42}
                        unoptimized
                      />
                    </span>
                    <span className="char-forge__roster-copy">
                      <strong>{entry.name}</strong>
                      <small>
                        {CHARACTER_QUALITY_LABELS[entry.quality]}{' '}
                        {formatQualityStatMultiplier(entry.qualityStatMultiplier)}
                      </small>
                    </span>
                    <span className="char-forge__roster-qty">×{group.entries.length}</span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="char-forge__detail">
          {target && currentStats && nextStats ? (
            <>
              <div className="char-forge__hero">
                <div
                  className="char-forge__hero-portrait"
                  style={{ ['--quality' as string]: CHARACTER_QUALITY_COLORS[target.quality] }}
                >
                  <Image
                    src={target.previewUrl}
                    alt=""
                    width={92}
                    height={92}
                    unoptimized
                  />
                  <span>{target.quality}</span>
                </div>
                <div className="char-forge__hero-copy">
                  <p>{CHARACTER_QUALITY_LABELS[target.quality]} · Nível {target.level}</p>
                  <h3>{target.name}</h3>
                  {atStarCap ? (
                    <div className="char-forge__star-upgrade">
                      <span>
                        {target.quality} {target.stars}★
                      </span>
                      <b>MAX</b>
                    </div>
                  ) : (
                    <div className="char-forge__star-upgrade">
                      <span>{formatStars(target.stars, starCap)}</span>
                      <b>→</b>
                      <span className="is-next">{formatStars(nextStars, starCap)}</span>
                    </div>
                  )}
                </div>
              </div>

              {atStarCap ? (
                <p className="char-forge__warn">{formatMaxStarsReachedMessage(target.quality)}</p>
              ) : (
              <>
              <div className="char-forge__stats">
                <header>
                  <h4>Atributos após a forja</h4>
                  <span>+2% nos atributos base</span>
                </header>
                <ul>
                  {ATTRIBUTE_ORDER.map((id) => {
                    const before = currentStats[id];
                    const after = nextStats[id];
                    return (
                      <li key={id}>
                        <span>{ATTRIBUTE_LABELS[id]}</span>
                        <strong>{formatStat(before)}</strong>
                        <b>→</b>
                        <strong className="is-next">{formatStat(after)}</strong>
                        <em>+{formatStat(after - before)}</em>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="char-forge__cost">
                <div>
                  <span>Cópias para aprimorar</span>
                  <strong>
                    {plan?.materialIds.length ?? 0}/{plan?.cost || commonCost}
                  </strong>
                </div>
                {plan?.reason === 'quality-not-configured' ? (
                  <p className="char-forge__warn">
                    A forja de qualidade {CHARACTER_QUALITY_LABELS[target.quality]} ainda não está
                    disponível.
                  </p>
                ) : null}
                {plan?.reason === 'max-stars' ? (
                  <p className="char-forge__warn">{formatMaxStarsReachedMessage(target.quality)}</p>
                ) : null}
                {plan?.reason === 'not-enough-materials' ? (
                  <p className="char-forge__warn">
                    Faltam {(plan.cost || commonCost) - plan.materialIds.length} cópias elegíveis.
                  </p>
                ) : null}
              </div>

              {plan?.reason === 'ok' ? (
                <div className="char-forge__actions">
                  {!pendingConfirm ? (
                    <button
                      type="button"
                      className="char-forge__cta"
                      onClick={() => setPendingConfirm(true)}
                    >
                      Aprimorar para {nextStars}★
                    </button>
                  ) : (
                    <>
                      <p className="char-forge__confirm">
                        Consumir {plan.cost} cópias de {target.name}?
                      </p>
                      <button
                        type="button"
                        className="char-forge__cta"
                        onClick={() => {
                          const ok = teamStore.forgeStar(plan.target!.id, plan.materialIds);
                          if (ok) attributesStore.onActiveCharacterChanged(false);
                          setPendingConfirm(false);
                        }}
                      >
                        Confirmar forja
                      </button>
                      <button
                        type="button"
                        className="char-forge__cta char-forge__cta--ghost"
                        onClick={() => setPendingConfirm(false)}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              ) : null}
              </>
              )}
            </>
          ) : (
            <div className="char-forge__empty-detail">
              <span>★</span>
              <p>Selecione um personagem para ver a evolução.</p>
            </div>
          )}
        </section>
      </div>
      <p className="char-forge__hint">
        Cada linha reúne todas as cópias do mesmo personagem e qualidade. A forja preserva o
        personagem principal e consome apenas cópias fora da equipe, desbloqueadas e não favoritas.
      </p>
    </div>
  );
}

/** Inventário de itens. Personagens e forja possuem fluxos próprios. */
export function InventoryPanel() {
  const isOpen = useStore(inventoryStore, (s) => s.isOpen);
  const slots = useStore(inventoryStore, (s) => s.slots);
  const selectedIndex = useStore(inventoryStore, (s) => s.selectedIndex);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        inventoryStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const selected = selectedIndex != null ? slots[selectedIndex] : null;
  const selectedDef = selected ? getItem(selected.itemId) : undefined;
  const occupied = slots.reduce((total, slot) => total + (slot ? 1 : 0), 0);
  const freeSlots = slots.length - occupied;

  const panel = (
    <div
      className="inv-mgr inv-mgr--modal"
      role="dialog"
      aria-modal="true"
      aria-label="Inventário"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <header className="inv-mgr__top">
        <div className="inv-mgr__brand">
          <span className="inv-mgr__brand-icon" aria-hidden>
            ▣
          </span>
          <div className="inv-mgr__brand-copy">
            <div className="inv-mgr__brand-row">
              <h2 className="inv-mgr__brand-title">Inventário</h2>
              <span className="inv-mgr__pill">
                {occupied}/{slots.length} ocupados
              </span>
            </div>
            <p className="inv-mgr__brand-lede">
              Gerencie recursos, consumíveis e materiais da bolsa
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inv-mgr__close"
          aria-label="Fechar inventário"
          onClick={() => inventoryStore.setOpen(false)}
        >
          ×
        </button>
      </header>

      <div className="inv-mgr__body">
        <section className="inv-mgr__summary" aria-label="Capacidade da bolsa">
          <header className="inv-mgr__pane-head">
            <span className="inv-mgr__pane-icon" aria-hidden>
              ◇
            </span>
            <div className="inv-mgr__pane-copy">
              <h3 className="inv-mgr__pane-title">Bolsa de Itens</h3>
              <p className="inv-mgr__pane-lede">
                {freeSlots} livres · clique em dois slots para mover ou empilhar
              </p>
            </div>
            <span className="inv-mgr__count" aria-label={`${occupied} de ${slots.length} slots`}>
              {occupied}/{slots.length}
            </span>
          </header>
        </section>

        <div className="inv-mgr__workspace">
          <section className="inv-mgr__inspector" aria-label="Inspetor do item">
            {selected ? (
              <>
                <div className="inv-mgr__inspector-hero">
                  <div
                    className="inv-mgr__item-thumb"
                    style={{
                      ['--item-rarity' as string]: selectedDef
                        ? RARITY_CSS[selectedDef.rarity]
                        : '#aab2bd',
                    }}
                  >
                    {selectedDef?.iconSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selectedDef.iconSrc}
                        alt=""
                        width={56}
                        height={56}
                        draggable={false}
                      />
                    ) : (
                      <span>
                        {itemMonogram(selected.itemId, selectedDef?.name ?? selected.itemId)}
                      </span>
                    )}
                  </div>
                  <div className="inv-mgr__inspector-meta">
                    <p className="inv-mgr__inspector-lv">
                      Qty. {selected.quantity}
                    </p>
                    <h3 className="inv-mgr__inspector-name">
                      {selectedDef?.name ?? selected.itemId}
                    </h3>
                    <span
                      className="inv-mgr__rarity"
                      style={{
                        ['--q' as string]: selectedDef
                          ? RARITY_CSS[selectedDef.rarity]
                          : '#94a3b8',
                      }}
                    >
                      {selectedDef?.rarity ?? 'item'}
                    </span>
                  </div>
                </div>

                <p className="inv-mgr__inspector-help">
                  Selecione outro slot para mover ou empilhar este item.
                </p>

                <div className="inv-mgr__actions">
                  <button
                    type="button"
                    className="inv-mgr__btn inv-mgr__btn--danger"
                    disabled={selectedIndex == null || !selected}
                    onClick={() => {
                      if (selectedIndex != null) inventoryStore.discardSlot(selectedIndex);
                    }}
                  >
                    Descartar
                  </button>
                </div>
              </>
            ) : (
              <p className="inv-mgr__inspector-empty">
                Selecione um item na bolsa para inspecionar
              </p>
            )}
          </section>

          <section className="inv-mgr__pane inv-mgr__pane--box" aria-label="Grade da bolsa">
            <header className="inv-mgr__pane-head">
              <span className="inv-mgr__pane-icon" aria-hidden>
                ▣
              </span>
              <div className="inv-mgr__pane-copy">
                <h3 className="inv-mgr__pane-title">Slots da Bolsa</h3>
                <p className="inv-mgr__pane-lede">Toque para selecionar ou mover</p>
              </div>
            </header>

            <div
              className="inv-mgr__slots"
              style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, minmax(0, 1fr))` }}
              role="list"
            >
              {slots.map((slot, index) => {
                const def = slot ? getItem(slot.itemId) : undefined;
                const selectedClass = selectedIndex === index ? ' is-selected' : '';
                const monogram = slot ? itemMonogram(slot.itemId, def?.name ?? slot.itemId) : '';
                return (
                  <button
                    key={index}
                    type="button"
                    role="listitem"
                    className={`inv-mgr__slot${selectedClass}${slot ? ' has-item' : ''}`}
                    data-slot-index={index}
                    data-item-id={slot?.itemId ?? ''}
                    data-quantity={slot?.quantity ?? 0}
                    draggable={false}
                    title={slotLabel(slot)}
                    aria-label={slot ? slotLabel(slot) : `Slot ${index + 1} vazio`}
                    onClick={() => inventoryStore.interactSlot(index)}
                  >
                    {slot ? (
                      <>
                        {def?.iconSrc ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className="inv-mgr__slot-art"
                            src={def.iconSrc}
                            alt=""
                            width={36}
                            height={36}
                            draggable={false}
                          />
                        ) : (
                          <span
                            className="inv-mgr__slot-icon"
                            style={{ color: def ? RARITY_CSS[def.rarity] : undefined }}
                          >
                            {monogram}
                          </span>
                        )}
                        {slot.quantity > 1 ? (
                          <span className="inv-mgr__slot-qty">{slot.quantity}</span>
                        ) : null}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="inv-mgr__foot inv-mgr__foot--slim">
        <p className="inv-mgr__hint">
          Clique em dois slots para mover ou empilhar · {INVENTORY_SLOT_COUNT} espaços
        </p>
      </footer>
    </div>
  );

  return (
    <div
      className="inv-mgr-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) inventoryStore.setOpen(false);
      }}
    >
      {panel}
    </div>
  );
}
