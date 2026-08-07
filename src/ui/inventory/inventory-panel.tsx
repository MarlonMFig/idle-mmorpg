'use client';

import Image from 'next/image';
import {
  EQUIP_SLOT_LABELS,
  EQUIP_SLOT_ORDER,
  INVENTORY_COLUMNS,
  INVENTORY_SLOT_COUNT,
} from '@/constants/inventory';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { formatItemBonuses, getItem, isEquippable, RARITY_CSS } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import type { InventorySlot } from '@/types/inventory';
import { HudPanel, HudPanelCollapsed } from '@/ui/hud/hud-panel';

function slotLabel(slot: InventorySlot): string {
  if (!slot) return '';
  const def = getItem(slot.itemId);
  const name = def?.name ?? slot.itemId;
  const bonuses = formatItemBonuses(slot.itemId);
  const qty = slot.quantity > 1 ? ` ×${slot.quantity}` : '';
  return bonuses ? `${name}${qty} (${bonuses})` : `${name}${qty}`;
}

/**
 * Painel de inventário + equipamentos + personagens selados.
 */
export function InventoryPanel() {
  const isOpen = useStore(inventoryStore, (s) => s.isOpen);
  const slots = useStore(inventoryStore, (s) => s.slots);
  const equipment = useStore(inventoryStore, (s) => s.equipment);
  const selectedIndex = useStore(inventoryStore, (s) => s.selectedIndex);
  const tab = useStore(teamStore, (s) => s.inventoryTab);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);

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
  const canEquip = selected != null && isEquippable(selected.itemId);
  const teamMembers = teamIds
    .map((id) => collection.find((entry) => entry.id === id))
    .filter((entry): entry is NonNullable<typeof entry> => entry != null);

  return (
    <HudPanel
      title="Inventário"
      badge="I"
      ariaLabel="Inventário"
      className="hud-inventory"
      onClose={() => inventoryStore.setOpen(false)}
    >
      <div className="hud-inventory__tabs" role="tablist" aria-label="Seções do inventário">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'items'}
          className={`hud-inventory__tab${tab === 'items' ? ' is-active' : ''}`}
          onClick={() => teamStore.setInventoryTab('items')}
        >
          Itens
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'characters'}
          className={`hud-inventory__tab${tab === 'characters' ? ' is-active' : ''}`}
          onClick={() => teamStore.setInventoryTab('characters')}
        >
          Personagens Selados
        </button>
      </div>

      {tab === 'items' ? (
        <>
          <div className="hud-inventory__equip" aria-label="Equipamentos">
            {EQUIP_SLOT_ORDER.map((slot) => {
              const stack = equipment[slot];
              const def = stack ? getItem(stack.itemId) : undefined;
              const title = stack
                ? `${EQUIP_SLOT_LABELS[slot]}: ${slotLabel(stack)}`
                : EQUIP_SLOT_LABELS[slot];
              return (
                <button
                  key={slot}
                  type="button"
                  className="hud-inventory__equip-slot"
                  data-equip-slot={slot}
                  title={title}
                  onClick={() => {
                    if (stack) inventoryStore.unequip(slot);
                  }}
                >
                  <span className="hud-inventory__equip-label">{EQUIP_SLOT_LABELS[slot]}</span>
                  <span
                    className="hud-inventory__equip-item"
                    style={def ? { color: RARITY_CSS[def.rarity] } : undefined}
                  >
                    {def ? def.name.slice(0, 8) : ''}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="hud-inventory__grid"
            style={{ gridTemplateColumns: `repeat(${INVENTORY_COLUMNS}, minmax(0, 1fr))` }}
            role="list"
          >
            {slots.map((slot, index) => {
              const def = slot ? getItem(slot.itemId) : undefined;
              const selectedClass = selectedIndex === index ? ' is-selected' : '';
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
                  onDoubleClick={() => {
                    if (slot && isEquippable(slot.itemId)) {
                      inventoryStore.equipFromSlot(index);
                    }
                  }}
                >
                  {slot ? (
                    <>
                      <span
                        className="hud-inventory__item-name"
                        style={{ color: def ? RARITY_CSS[def.rarity] : undefined }}
                      >
                        {def?.name.slice(0, 3) ?? '???'}
                      </span>
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
              Clique: mover · Duplo clique: equipar · {INVENTORY_SLOT_COUNT} slots
            </p>
            <div className="hud-inventory__actions">
              <button
                type="button"
                className="hud-inventory__action"
                disabled={!canEquip || selectedIndex == null}
                onClick={() => {
                  if (selectedIndex != null) inventoryStore.equipFromSlot(selectedIndex);
                }}
              >
                Equipar
              </button>
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
      ) : (
        <div className="hud-team">
          <section className="hud-team__section" aria-label="Equipe">
            <h3 className="hud-team__title">
              Equipe ({teamMembers.length}/{TEAM_SLOT_COUNT})
            </h3>
            <ul className="hud-team__slots">
              {Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
                const member = teamMembers[index] ?? null;
                const isActive = member?.id === activeId;
                return (
                  <li
                    key={member?.id ?? `empty-${index}`}
                    className={`hud-team__slot${isActive ? ' is-active' : ''}${member ? '' : ' is-empty'}`}
                  >
                    {member ? (
                      <>
                        <Image
                          className="hud-team__avatar"
                          src={member.previewUrl}
                          alt={member.name}
                          width={40}
                          height={40}
                          unoptimized
                        />
                        <div className="hud-team__info">
                          <p className="hud-team__name">
                            {member.name}
                            {isActive ? ' · Ativo' : ''}
                          </p>
                          <div className="hud-team__actions">
                            {!isActive ? (
                              <button
                                type="button"
                                className="hud-team__btn"
                                onClick={() => switchActiveCharacter(member.id)}
                              >
                                Tornar principal
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="hud-team__btn hud-team__btn--danger"
                              onClick={() => teamStore.removeFromTeam(member.id)}
                            >
                              Remover
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="hud-team__empty">Slot vazio</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="hud-team__section" aria-label="Coleção">
            <h3 className="hud-team__title">Coleção ({collection.length})</h3>
            <ul className="hud-team__collection">
              {collection.map((member) => {
                const inTeam = teamIds.includes(member.id);
                return (
                  <li key={member.id} className="hud-team__collection-item">
                    <Image
                      className="hud-team__avatar"
                      src={member.previewUrl}
                      alt={member.name}
                      width={36}
                      height={36}
                      unoptimized
                    />
                    <div className="hud-team__info">
                      <p className="hud-team__name">{member.name}</p>
                      <div className="hud-team__actions">
                        {inTeam ? (
                          <span className="hud-team__badge">Na equipe</span>
                        ) : (
                          <button
                            type="button"
                            className="hud-team__btn"
                            onClick={() => teamStore.addToTeam(member.id)}
                          >
                            Adicionar
                          </button>
                        )}
                        {inTeam && member.id !== activeId ? (
                          <button
                            type="button"
                            className="hud-team__btn"
                            onClick={() => switchActiveCharacter(member.id)}
                          >
                            Tornar principal
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </HudPanel>
  );
}
