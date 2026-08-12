'use client';

import Image from 'next/image';
import { useEffect, type RefObject } from 'react';
import {
  SEALING_SCROLL_TIERS,
  type SealingScrollTierId,
} from '@/constants/sealing';
import {
  HELPER_POTION_IDS,
  HP_POTION_ITEM_ID,
  REVIVE_ITEM_ID,
  type HelperPotionId,
} from '@/data/helper-items';
import { getItem } from '@/data/items';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import {
  HELPER_HP_THRESHOLDS,
  helperStore,
  type HelperHpThresholdPct,
} from '@/stores/helper-store';
import { inventoryStore } from '@/stores/inventory-store';

function formatQty(n: number): string {
  return n.toLocaleString('pt-BR');
}

/**
 * Auto-Helper — Auto Cura, Auto Selamento, Auto Revive.
 * Arrastável pelo cabeçalho; preferências em localStorage.
 */
export function HelperPanel() {
  const isOpen = useStore(helperStore, (s) => s.isOpen);
  const autoPotion = useStore(helperStore, (s) => s.autoPotion);
  const autoSeal = useStore(helperStore, (s) => s.autoSeal);
  const autoRevive = useStore(helperStore, (s) => s.autoRevive);
  const potionItemId = useStore(helperStore, (s) => s.potionItemId);
  const hpThresholdPct = useStore(helperStore, (s) => s.hpThresholdPct);
  const scrollItemId = useStore(helperStore, (s) => s.scrollItemId);
  const slots = useStore(inventoryStore, (s) => s.slots);

  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('helper', {
    zIndex: 83,
    dragZIndex: 97,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        helperStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  // Reconta a cada mudança de slots (inventário).
  void slots;
  const potionCount = inventoryStore.countItem(potionItemId);
  const reviveCount = inventoryStore.countItem(REVIVE_ITEM_ID);
  const potionIcon = getItem(HP_POTION_ITEM_ID)?.iconSrc;
  const reviveIcon = getItem(REVIVE_ITEM_ID)?.iconSrc;

  return (
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`helper${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="Auto-Helper"
    >
      <header
        className="helper__head helper__head--drag"
        title="Arrastar para mover"
        {...handleProps}
      >
        <div className="helper__head-main">
          <Image
            className="helper__logo"
            src="/ui/hub-menu/medico.png"
            alt=""
            width={28}
            height={28}
            draggable={false}
            unoptimized
          />
          <h2 className="helper__title">Auto-Helper</h2>
        </div>
        <button
          type="button"
          className="helper__icon-btn"
          data-no-drag
          title="Fechar"
          aria-label="Fechar Helper"
          onClick={() => helperStore.close()}
        >
          ×
        </button>
      </header>

      <div className="helper__body">
        <section className="helper__row">
          <label className="helper__toggle">
            <input
              type="checkbox"
              checked={autoPotion}
              onChange={(e) => helperStore.setAutoPotion(e.target.checked)}
            />
            <span className="helper__toggle-box" aria-hidden />
            <span className="helper__row-icon" aria-hidden>
              {potionIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={potionIcon} alt="" width={22} height={22} draggable={false} />
              ) : (
                '🧪'
              )}
            </span>
            <span className="helper__row-text">
              <strong>Auto Cura</strong>
            </span>
          </label>

          <div className={`helper__controls${autoPotion ? '' : ' is-dim'}`}>
            <label className="helper__field">
              <span className="helper__field-label">Poção:</span>
              <select
                className="helper__select"
                value={potionItemId}
                disabled={!autoPotion}
                onChange={(e) =>
                  helperStore.setPotionItemId(e.target.value as HelperPotionId)
                }
              >
                {HELPER_POTION_IDS.map((id) => {
                  const def = getItem(id);
                  const qty = inventoryStore.countItem(id);
                  return (
                    <option key={id} value={id}>
                      {def?.name ?? id} ×{formatQty(qty)}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="helper__field">
              <span className="helper__field-label">Curar com HP ≤</span>
              <select
                className="helper__select helper__select--sm"
                value={hpThresholdPct}
                disabled={!autoPotion}
                onChange={(e) =>
                  helperStore.setHpThresholdPct(
                    Number(e.target.value) as HelperHpThresholdPct,
                  )
                }
              >
                {HELPER_HP_THRESHOLDS.map((pct) => (
                  <option key={pct} value={pct}>
                    {pct}%
                  </option>
                ))}
              </select>
            </label>
            {autoPotion && potionCount < 1 ? (
              <p className="helper__hint helper__hint--warn">
                Sem poções — compre no market.
              </p>
            ) : null}
          </div>
        </section>

        <section className="helper__row">
          <label className="helper__toggle">
            <input
              type="checkbox"
              checked={autoRevive}
              onChange={(e) => helperStore.setAutoRevive(e.target.checked)}
            />
            <span className="helper__toggle-box" aria-hidden />
            <span className="helper__row-icon" aria-hidden>
              {reviveIcon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={reviveIcon} alt="" width={22} height={22} draggable={false} />
              ) : (
                '📜'
              )}
            </span>
            <span className="helper__row-text">
              <strong>Auto Revive</strong>
              <span className="helper__sub">
                usa Revive ao desmaiar ×{formatQty(reviveCount)}
              </span>
            </span>
          </label>
          {autoRevive && reviveCount < 1 ? (
            <p className="helper__hint helper__hint--warn">
              Sem Revive — compre no market. Sem o item você não revive na caça.
            </p>
          ) : (
            <p className="helper__hint">
              Desligado ou sem item: Voltar ao hub para recuperar.
            </p>
          )}
        </section>

        <section className="helper__row">
          <label className="helper__toggle">
            <input
              type="checkbox"
              checked={autoSeal}
              onChange={(e) => helperStore.setAutoSeal(e.target.checked)}
            />
            <span className="helper__toggle-box" aria-hidden />
            <span className="helper__row-icon" aria-hidden>
              📜
            </span>
            <span className="helper__row-text">
              <strong>Auto Selamento</strong>
              <span className="helper__sub">ao derrotar inimigo</span>
            </span>
          </label>

          <div className={`helper__controls${autoSeal ? '' : ' is-dim'}`}>
            <span className="helper__field-label">Pergaminho:</span>
            <div className="helper__chips" role="listbox" aria-label="Pergaminho">
              {SEALING_SCROLL_TIERS.map((tier) => {
                const qty = inventoryStore.countItem(tier.itemId);
                const selected = scrollItemId === tier.itemId;
                return (
                  <button
                    key={tier.itemId}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`helper__chip${selected ? ' is-selected' : ''}`}
                    disabled={!autoSeal}
                    title={`${tier.label} (~${Math.round(tier.successChance * 100)}%)`}
                    onClick={() =>
                      helperStore.setScrollItemId(tier.itemId as SealingScrollTierId)
                    }
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={tier.iconSrc} alt="" width={28} height={28} draggable={false} />
                    <span className="helper__chip-qty">{formatQty(qty)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
