'use client';

import {
  EQUIP_SLOT_LABELS,
  EQUIP_SLOT_ORDER,
  INVENTORY_COLUMNS,
  INVENTORY_SLOT_COUNT,
} from '@/constants/inventory';
import { formatItemBonuses, getItem, isEquippable, RARITY_CSS } from '@/data/items';
import { useStore } from '@/hooks/use-store';
import { inventoryStore } from '@/stores/inventory-store';
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
 * Painel de inventário + equipamentos (6 slots).
 * Atributos totais ficam no AttributesPanel da HUD.
 */
export function InventoryPanel() {
  const isOpen = useStore(inventoryStore, (s) => s.isOpen);
  const slots = useStore(inventoryStore, (s) => s.slots);
  const equipment = useStore(inventoryStore, (s) => s.equipment);
  const selectedIndex = useStore(inventoryStore, (s) => s.selectedIndex);

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

  return (
    <HudPanel
      title="Inventário"
      badge="I"
      ariaLabel="Inventário"
      className="hud-inventory"
      onClose={() => inventoryStore.setOpen(false)}
    >
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
    </HudPanel>
  );
}
