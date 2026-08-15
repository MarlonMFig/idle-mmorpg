'use client';

import { useEffect, useState, type RefObject } from 'react';
import {
  SEALING_SCROLL_TIERS,
  type SealingScrollTierId,
} from '@/constants/sealing';
import { getCuratedPortraitUrl } from '@/data/curated-map-sprites';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import { captureStore, type CaptureOffer } from '@/stores/capture-store';
import { helperStore } from '@/stores/helper-store';
import { inventoryStore } from '@/stores/inventory-store';
import { locationStore } from '@/stores/location-store';
import { recordSealAnalytics, trySealEnemy } from '@/systems/sealing';

function formatQty(n: number): string {
  return n.toLocaleString('pt-BR');
}

function portraitUrl(lookType: number): string {
  return getCuratedPortraitUrl(lookType) ?? `/sprites/wonsr/outfits/${lookType}.png`;
}

function CaptureRow({
  offer,
  canThrow,
  onThrow,
}: {
  offer: CaptureOffer;
  canThrow: boolean;
  onThrow: (id: string) => void;
}) {
  return (
    <li className="captura__row">
      <span
        className="captura__sprite"
        role="img"
        aria-label={offer.name}
        style={{ backgroundImage: `url(${portraitUrl(offer.lookType)})` }}
      />
      <div className="captura__meta">
        <strong className="captura__name">{offer.name}</strong>
        <span className="captura__level">
          Caça Nv.{Math.max(1, offer.level || offer.definition.level)} · entra Nv.1
        </span>
      </div>
      <button
        type="button"
        className="captura__throw"
        disabled={!canThrow}
        onClick={() => onThrow(offer.id)}
      >
        Lançar
      </button>
    </li>
  );
}

/**
 * Selamento manual — visível na caça quando Auto Selamento está desligado.
 */
export function CapturaPanel() {
  const mode = useStore(locationStore, (s) => s.mode);
  const huntId = useStore(locationStore, (s) => s.huntId);
  const autoSeal = useStore(helperStore, (s) => s.autoSeal);
  const scrollItemId = useStore(helperStore, (s) => s.scrollItemId);
  const offers = useStore(captureStore, (s) => s.offers);
  const slots = useStore(inventoryStore, (s) => s.slots);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('captura', {
    zIndex: 81,
    dragZIndex: 96,
  });

  useEffect(() => {
    if (mode !== 'combat') captureStore.clear();
  }, [mode, huntId]);

  if (mode !== 'combat' || autoSeal) return null;

  const selectedQty = inventoryStore.countItem(scrollItemId);
  const canThrow = selectedQty >= 1 && busyId == null && slots != null;

  const onThrow = (id: string) => {
    if (busyId) return;
    const offer = captureStore.getSnapshot().offers.find((item) => item.id === id);
    if (!offer) return;

    setBusyId(id);
    const seal = trySealEnemy(offer.definition, Math.random, { manual: true });
    recordSealAnalytics(seal);

    if (seal.kind === 'skipped' && seal.reason === 'no-scroll') {
      setBusyId(null);
      return;
    }

    captureStore.remove(id);
    setBusyId(null);
  };

  return (
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`captura${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="dialog"
      aria-label="Selamento"
    >
      <header className="captura__head captura__head--drag" {...handleProps}>
        <h2 className="captura__title">Selamento</h2>
        <span className="captura__badge">
          {offers.length} no chão
        </span>
      </header>

      <div className="captura__scrolls" role="listbox" aria-label="Pergaminho">
        {SEALING_SCROLL_TIERS.map((tier) => {
          const qty = inventoryStore.countItem(tier.itemId);
          const selected = scrollItemId === tier.itemId;
          return (
            <button
              key={tier.itemId}
              type="button"
              role="option"
              aria-selected={selected}
              className={`captura__scroll${selected ? ' is-selected' : ''}`}
              title={`${tier.label} (~${Math.round(tier.successChance * 100)}%)`}
              onClick={() => helperStore.setScrollItemId(tier.itemId as SealingScrollTierId)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tier.iconSrc} alt="" width={28} height={28} draggable={false} />
              <span className="captura__scroll-qty">{formatQty(qty)}</span>
            </button>
          );
        })}
      </div>

      {offers.length === 0 ? (
        <p className="captura__empty">Nenhum alvo no chão.</p>
      ) : (
        <ul className="captura__list">
          {offers.map((offer) => (
            <CaptureRow
              key={offer.id}
              offer={offer}
              canThrow={canThrow && busyId !== offer.id}
              onThrow={onThrow}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
