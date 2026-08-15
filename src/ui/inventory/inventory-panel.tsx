'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import {
  CHARACTER_QUALITY_COLORS,
  CHARACTER_QUALITY_LABELS,
  FORGE_MATERIAL_COST_BY_QUALITY,
  MAX_CHARACTER_STARS,
} from '@/constants/character-progression';
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
import { computePlayerAttributes } from '@/utils/attributes';
import { HudPanel } from '@/ui/hud/hud-panel';

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

function StarRow({ stars, max = MAX_CHARACTER_STARS }: { stars: number; max?: number }) {
  const n = Math.max(0, Math.min(max, Math.floor(stars)));
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
        <StarRow stars={member.stars} />
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
          .filter((entry) => entry.stars < MAX_CHARACTER_STARS)
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
  const currentStats = target
    ? computePlayerAttributes({ level: Math.max(1, target.level), stars: target.stars }).totals
    : null;
  const nextStars = target ? Math.min(MAX_CHARACTER_STARS, target.stars + 1) : 0;
  const nextStats = target
    ? computePlayerAttributes({ level: Math.max(1, target.level), stars: nextStars }).totals
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
                      <small>{CHARACTER_QUALITY_LABELS[entry.quality]}</small>
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
                  <div className="char-forge__star-upgrade">
                    <span>{formatStars(target.stars)}</span>
                    <b>→</b>
                    <span className="is-next">{formatStars(nextStars)}</span>
                  </div>
                </div>
              </div>

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
                  <p className="char-forge__warn">Este personagem já alcançou 5 estrelas.</p>
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

  return (
    <div
      className="hud-modal-layer hud-modal-layer--inventory"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) inventoryStore.setOpen(false);
      }}
    >
      <HudPanel
        title="Inventário"
        badge="I"
        ariaLabel="Inventário"
        className="hud-inventory"
        onClose={() => inventoryStore.setOpen(false)}
      >
        <div className="hud-inventory__summary">
          <div>
            <p className="hud-inventory__eyebrow">Bolsa de itens</p>
            <p className="hud-inventory__summary-title">Seus recursos e consumíveis</p>
          </div>
          <span
            className="hud-inventory__capacity"
            aria-label={`${occupied} de ${slots.length} slots`}
          >
            <strong>{occupied}</strong>
            <span>/ {slots.length}</span>
          </span>
        </div>

        <div className="hud-inventory__body">
          <div
            className="hud-inventory__grid"
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
                  className={`hud-inventory__slot${selectedClass}${slot ? ' has-item' : ''}`}
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
                          className="hud-inventory__item-art"
                          src={def.iconSrc}
                          alt=""
                          width={36}
                          height={36}
                          draggable={false}
                        />
                      ) : (
                        <span
                          className="hud-inventory__item-icon"
                          style={{ color: def ? RARITY_CSS[def.rarity] : undefined }}
                        >
                          {monogram}
                        </span>
                      )}
                      {slot.quantity > 1 ? (
                        <span className="hud-inventory__qty">{slot.quantity}</span>
                      ) : null}
                    </>
                  ) : null}
                </button>
              );
            })}
          </div>

          <aside className={`hud-inventory__detail${selected ? ' has-selection' : ''}`}>
            {selected ? (
              <>
                <div
                  className="hud-inventory__detail-icon"
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
                      width={52}
                      height={52}
                      draggable={false}
                    />
                  ) : (
                    <span>
                      {itemMonogram(selected.itemId, selectedDef?.name ?? selected.itemId)}
                    </span>
                  )}
                </div>
                <div className="hud-inventory__detail-copy">
                  <p className="hud-inventory__detail-name">
                    {selectedDef?.name ?? selected.itemId}
                  </p>
                  <p
                    className="hud-inventory__detail-rarity"
                    style={{ color: selectedDef ? RARITY_CSS[selectedDef.rarity] : undefined }}
                  >
                    {selectedDef?.rarity ?? 'item'} · Quantidade {selected.quantity}
                  </p>
                  <p className="hud-inventory__detail-help">
                    Selecione outro slot para mover ou empilhar este item.
                  </p>
                </div>
              </>
            ) : (
              <div className="hud-inventory__detail-empty">
                <span aria-hidden>◇</span>
                <p>Selecione um item para ver os detalhes.</p>
              </div>
            )}

            <div className="hud-inventory__actions">
              <button
                type="button"
                className="hud-inventory__action hud-inventory__action--danger"
                disabled={selectedIndex == null || !selected}
                onClick={() => {
                  if (selectedIndex != null) inventoryStore.discardSlot(selectedIndex);
                }}
              >
                Descartar
              </button>
            </div>
          </aside>
        </div>

        <footer className="hud-inventory__footer">
          <p className="hud-inventory__hint">
            Clique em dois slots para mover ou empilhar · {INVENTORY_SLOT_COUNT} espaços
          </p>
        </footer>
      </HudPanel>
    </div>
  );
}
