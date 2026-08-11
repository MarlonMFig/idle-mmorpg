'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
  CHARACTER_CLAN_GLYPHS,
  CHARACTER_CLAN_ICONS,
  CHARACTER_CLAN_LABELS,
  CHARACTER_QUALITY_COLORS,
  CHARACTER_QUALITY_LABELS,
  CHARACTER_QUALITY_RANK_LABELS,
  CLAN_SYSTEM_UNLOCK_LEVEL,
  FORGE_MATERIAL_COST_BY_QUALITY,
  MAX_CHARACTER_STARS,
} from '@/constants/character-progression';
import { INVENTORY_COLUMNS, INVENTORY_SLOT_COUNT } from '@/constants/inventory';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { getItem, RARITY_CSS } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { planForgeStar } from '@/systems/forge';
import { accountStore } from '@/stores/account-store';
import { attributesStore } from '@/stores/attributes-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { InventorySlot } from '@/types/inventory';
import type { SealedCharacter } from '@/types/team';
import { characterMetaLine, formatStars } from '@/utils/character-display';
import { computePlayerAttributes } from '@/utils/attributes';
import { HudPanel, HudPanelCollapsed } from '@/ui/hud/hud-panel';

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

/** Compacto estilo 2.15M / 249K. */
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
  const attrs = computePlayerAttributes({ level, stars });
  return Math.max(1, Math.round(attrs.totals.hp));
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

function TeamMemberCard({
  member,
  isActive,
  selected,
  accountLevel,
  hp,
  hpMax,
  expPct,
  onSelect,
}: {
  member: SealedCharacter;
  isActive: boolean;
  selected: boolean;
  accountLevel: number;
  hp: number;
  hpMax: number;
  expPct: number;
  onSelect: () => void;
}) {
  const qualityColor = CHARACTER_QUALITY_COLORS[member.quality];
  const hpSafe = Math.max(1, hpMax);
  const hpPct = Math.max(0, Math.min(100, (hp / hpSafe) * 100));
  const expSafe = Math.max(0, Math.min(100, expPct));

  return (
    <button
      type="button"
      className={`team-card${isActive ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
      title={member.name}
    >
      {isActive ? <span className="team-card__ribbon">ATIVO</span> : null}

      <div className="team-card__avatar" style={{ ['--q' as string]: qualityColor }}>
        <span className="team-card__halo" aria-hidden />
        <Image
          className="team-card__sprite"
          src={member.previewUrl}
          alt=""
          width={52}
          height={52}
          unoptimized
        />
        <span className="team-card__rank" style={{ background: qualityColor }}>
          {member.quality}
        </span>
      </div>

      <div className="team-card__body">
        <div className="team-card__title-row">
          <span className="team-card__name">{member.name}</span>
          <span className="team-card__lv">Lv.{accountLevel}</span>
        </div>
        <div className="team-card__bar team-card__bar--hp">
          <span className="team-card__bar-fill" style={{ width: `${hpPct}%` }} />
          <span className="team-card__bar-label">
            {formatCompact(hp)}/{formatCompact(hpMax)}
          </span>
        </div>
        <div className="team-card__bar team-card__bar--exp">
          <span className="team-card__bar-fill" style={{ width: `${expSafe}%` }} />
          <span className="team-card__bar-label">EXP {Math.round(expSafe)}%</span>
        </div>
        <div className="team-card__meta">
          <StarRow stars={member.stars} />
          {member.isFavorite ? <span className="team-card__tag">★</span> : null}
          {member.isLocked ? <span className="team-card__tag">#</span> : null}
        </div>
      </div>
    </button>
  );
}

function TeamEmptySlot({ index }: { index: number }) {
  return (
    <div className="team-card team-card--empty" aria-label={`Slot de equipe ${index + 1} vazio`}>
      <div className="team-card__avatar team-card__avatar--empty">
        <span>+</span>
      </div>
      <div className="team-card__body">
        <p className="team-card__empty-label">Slot vazio</p>
        <p className="team-card__empty-hint">Adicione da coleção</p>
      </div>
    </div>
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

function IconBtn({
  label,
  title,
  active,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  title: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`char-icon-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function CharacterDetail({
  member,
  inTeam,
  isActive,
}: {
  member: SealedCharacter;
  inTeam: boolean;
  isActive: boolean;
}) {
  const level = useStore(vitalsStore, (s) => s.level);
  return (
    <div className="char-detail" title={characterMetaLine(member, level)}>
      <div className="char-detail__head">
        <Portrait member={member} size={56} inTeam={inTeam} isActive={isActive} />
        <div className="char-detail__text">
          <p className="char-detail__name">{member.name}</p>
          <div className="char-detail__chips">
            <span className="char-chip char-chip--level">Nv.{level}</span>
            <span
              className="char-chip char-chip--quality"
              style={{
                borderColor: CHARACTER_QUALITY_COLORS[member.quality],
                color: CHARACTER_QUALITY_COLORS[member.quality],
              }}
              title={CHARACTER_QUALITY_RANK_LABELS[member.quality]}
            >
              {member.quality} · {CHARACTER_QUALITY_LABELS[member.quality]}
            </span>
            <span className="char-chip" title={CHARACTER_CLAN_LABELS[member.clanId]}>
              {CHARACTER_CLAN_GLYPHS[member.clanId]} · {CHARACTER_CLAN_LABELS[member.clanId]}
            </span>
          </div>
          <StarRow stars={member.stars} />
        </div>
      </div>
      <div className="char-detail__actions" role="toolbar" aria-label="Ações do personagem">
        {!inTeam ? (
          <IconBtn label="＋" title="Adicionar à equipe" onClick={() => teamStore.addToTeam(member.id)} />
        ) : (
          <IconBtn label="✓" title="Na equipe" active disabled onClick={() => undefined} />
        )}
        {inTeam && !isActive ? (
          <IconBtn label="▶" title="Tornar principal" onClick={() => switchActiveCharacter(member.id)} />
        ) : null}
        {inTeam && isActive ? (
          <IconBtn label="●" title="Principal ativo" active disabled onClick={() => undefined} />
        ) : null}
        {inTeam && !isActive ? (
          <IconBtn
            label="✕"
            title="Remover da equipe"
            danger
            onClick={() => teamStore.removeFromTeam(member.id)}
          />
        ) : null}
        <IconBtn
          label={member.isFavorite ? '★' : '☆'}
          title={member.isFavorite ? 'Remover favorito' : 'Marcar favorito'}
          active={member.isFavorite}
          onClick={() => teamStore.setFavorite(member.id, !member.isFavorite)}
        />
        <IconBtn
          label={member.isLocked ? '#' : '='}
          title={member.isLocked ? 'Desbloquear' : 'Bloquear (protege da forja)'}
          active={member.isLocked}
          onClick={() => teamStore.setLocked(member.id, !member.isLocked)}
        />
      </div>
    </div>
  );
}

function ClanSection() {
  const clanId = useStore(accountStore, (s) => s.clanId);
  const level = useStore(vitalsStore, (s) => s.level);
  const unlocked = level >= CLAN_SYSTEM_UNLOCK_LEVEL;

  if (!unlocked) {
    return (
      <div className="char-clan char-clan--locked">
        <span className="char-clan__icon" aria-hidden>
          ?
        </span>
        <p className="char-clan__text">
          Clãs no nível {CLAN_SYSTEM_UNLOCK_LEVEL}
          <span className="char-clan__sub">Agora: {level}</span>
        </p>
      </div>
    );
  }

  if (clanId) {
    return (
      <div className="char-clan char-clan--set">
        <Image
          className="char-clan__icon-img"
          src={CHARACTER_CLAN_ICONS[clanId]}
          alt=""
          width={28}
          height={28}
          unoptimized
        />
        <p className="char-clan__text">
          {CHARACTER_CLAN_LABELS[clanId]}
          <span className="char-clan__sub">Troca indisponível</span>
        </p>
      </div>
    );
  }

  return (
    <div className="char-clan">
      <p className="char-clan__hint">Escolha o clã no menu Clã</p>
      <button type="button" className="char-clan__pick" onClick={() => accountStore.setOpen(true)}>
        Abrir clãs
      </button>
    </div>
  );
}

function CharactersTab() {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);
  const [selectedId, setSelectedId] = useState<string | null>(activeId);

  const teamMembers = teamIds
    .map((id) => collection.find((entry) => entry.id === id))
    .filter((entry): entry is SealedCharacter => entry != null);

  const selected =
    collection.find((entry) => entry.id === selectedId) ??
    collection.find((entry) => entry.id === activeId) ??
    collection[0] ??
    null;

  const expPct = vitals.xpMax > 0 ? (vitals.xp / vitals.xpMax) * 100 : 0;

  return (
    <div className="char-panel">
      <section className="team-window" aria-label="Equipe">
        <header className="team-window__head">
          <div>
            <h3 className="team-window__title">Equipe</h3>
            <p className="team-window__sub">
              Conta · Nível {vitals.level} · {teamMembers.length}/{TEAM_SLOT_COUNT}
            </p>
          </div>
        </header>

        <ul className="team-window__list">
          {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
            const member = teamMembers[index] ?? null;
            if (!member) {
              return (
                <li key={`empty-${index}`}>
                  <TeamEmptySlot index={index} />
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
                <TeamMemberCard
                  member={member}
                  isActive={isActive}
                  selected={selected?.id === member.id}
                  accountLevel={vitals.level}
                  hp={hp}
                  hpMax={hpMax}
                  expPct={expPct}
                  onSelect={() => setSelectedId(member.id)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="char-panel__section" aria-label="Coleção">
        <header className="char-panel__head">
          <h3 className="char-panel__title">Coleção</h3>
          <span className="char-panel__count">{collection.length}</span>
        </header>
        {collection.length === 0 ? (
          <p className="char-panel__empty">Nenhum personagem selado.</p>
        ) : (
          <div className="char-grid" role="list">
            {collection.map((member) => {
              const inTeam = teamIds.includes(member.id);
              const isActive = member.id === activeId;
              return (
                <div key={member.id} className="char-grid__cell" role="listitem">
                  <Portrait
                    member={member}
                    size={48}
                    selected={selected?.id === member.id}
                    inTeam={inTeam}
                    isActive={isActive}
                    onSelect={() => setSelectedId(member.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selected ? (
        <CharacterDetail
          member={selected}
          inTeam={teamIds.includes(selected.id)}
          isActive={selected.id === activeId}
        />
      ) : null}

      <section className="char-panel__section" aria-label="Clã">
        <header className="char-panel__head">
          <h3 className="char-panel__title">Clã</h3>
        </header>
        <ClanSection />
      </section>
    </div>
  );
}

function ForgeTab() {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const targets = useMemo(
    () => collection.filter((entry) => entry.stars < MAX_CHARACTER_STARS),
    [collection],
  );

  const plan = targetId ? planForgeStar({ targetId, collection, teamIds }) : null;
  const commonCost = FORGE_MATERIAL_COST_BY_QUALITY.D ?? 20;
  const target = plan?.target ?? targets.find((entry) => entry.id === targetId) ?? null;

  return (
    <div className="char-forge">
      <p className="char-forge__hint">
        +1★ com {commonCost} cópias do mesmo personagem (Comum). Fora da equipe · sem fav · sem
        bloqueio.
      </p>

      <header className="char-panel__head">
        <h3 className="char-panel__title">Escolha o alvo</h3>
      </header>
      <div className="char-grid char-grid--forge" role="list">
        {targets.map((entry) => (
          <div key={entry.id} className="char-grid__cell" role="listitem">
            <Portrait
              member={entry}
              size={44}
              selected={targetId === entry.id}
              inTeam={teamIds.includes(entry.id)}
              isActive={false}
              onSelect={() => {
                setTargetId(entry.id);
                setPendingConfirm(false);
              }}
            />
          </div>
        ))}
      </div>

      {target ? (
        <div className="char-forge__plan">
          <div className="char-forge__target-line">
            <Portrait member={target} size={40} />
            <div>
              <p className="char-detail__name">{target.name}</p>
              <p className="char-forge__meta">
                {formatStars(target.stars)} → {formatStars(Math.min(5, target.stars + 1))} · custo{' '}
                {plan?.cost ?? commonCost}
              </p>
            </div>
          </div>

          {plan?.reason === 'quality-not-configured' ? (
            <p className="char-forge__warn">Rank sem custo de forja definido.</p>
          ) : null}
          {plan?.reason === 'max-stars' ? (
            <p className="char-forge__warn">Já está no máximo de estrelas.</p>
          ) : null}

          {plan && (plan.reason === 'not-enough-materials' || plan.reason === 'ok') ? (
            <>
              <header className="char-panel__head">
                <h3 className="char-panel__title">Consumir</h3>
                <span className="char-panel__count">
                  {plan.materialIds.length}/{plan.cost || commonCost}
                </span>
              </header>
              <div className="char-grid char-grid--forge" role="list">
                {plan.materialIds.map((id) => {
                  const m = collection.find((entry) => entry.id === id);
                  if (!m) return null;
                  return (
                    <div key={id} className="char-grid__cell" role="listitem">
                      <Portrait member={m} size={36} />
                    </div>
                  );
                })}
              </div>
              {plan.reason === 'not-enough-materials' ? (
                <p className="char-forge__warn">Faltam cópias elegíveis.</p>
              ) : null}
              {plan.reason === 'ok' ? (
                <div className="char-forge__actions">
                  {!pendingConfirm ? (
                    <button
                      type="button"
                      className="char-forge__cta"
                      onClick={() => setPendingConfirm(true)}
                    >
                      Revisar forja
                    </button>
                  ) : (
                    <>
                      <p className="char-forge__warn">
                        Confirma consumir {plan.cost} cópias?
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
                        Confirmar
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
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inventário, grade de personagens e forja — sem equipamentos.
 */
export function InventoryPanel() {
  const isOpen = useStore(inventoryStore, (s) => s.isOpen);
  const slots = useStore(inventoryStore, (s) => s.slots);
  const selectedIndex = useStore(inventoryStore, (s) => s.selectedIndex);
  const tab = useStore(teamStore, (s) => s.inventoryTab);

  if (!isOpen) {
    return (
      <HudPanelCollapsed
        label="Inventário (I)"
        ariaLabel="Abrir inventário"
        className="hud-inventory"
        onOpen={() => inventoryStore.setOpen(true)}
      />
    );
  }

  const selected = selectedIndex != null ? slots[selectedIndex] : null;

  return (
    <HudPanel
      title="Inventário"
      badge="I"
      ariaLabel="Inventário"
      className="hud-inventory"
      onClose={() => inventoryStore.setOpen(false)}
    >
      <div className="hud-inventory__tabs" role="tablist" aria-label="Seções do inventário">
        {(
          [
            ['items', 'Itens'],
            ['characters', 'Chars'],
            ['forge', 'Forja'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`hud-inventory__tab${tab === id ? ' is-active' : ''}`}
            onClick={() => teamStore.setInventoryTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'items' ? (
        <>
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

          <footer className="hud-inventory__footer">
            <p className="hud-inventory__hint">
              {selected
                ? slotLabel(selected)
                : `Clique para mover · ${INVENTORY_SLOT_COUNT} slots`}
            </p>
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
          </footer>
        </>
      ) : null}

      {tab === 'characters' ? <CharactersTab /> : null}
      {tab === 'forge' ? <ForgeTab /> : null}
    </HudPanel>
  );
}
