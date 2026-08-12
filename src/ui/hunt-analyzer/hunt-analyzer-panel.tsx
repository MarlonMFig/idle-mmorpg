'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { getItem, RARITY_CSS } from '@/data/items';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import {
  formatCopper,
  formatHuntDuration,
  huntAnalyzerStore,
  huntItemNpcValue,
} from '@/stores/hunt-analyzer-store';

/**
 * Hunt Analyzer — painel denso de sessão de caça (kills, loot, supply, rates).
 * Arrastável pelo cabeçalho; posição salva no localStorage.
 */
export function HuntAnalyzerPanel() {
  const isOpen = useStore(huntAnalyzerStore, (s) => s.isOpen);
  const kills = useStore(huntAnalyzerStore, (s) => s.kills);
  const sealed = useStore(huntAnalyzerStore, (s) => s.sealed);
  const xpGained = useStore(huntAnalyzerStore, (s) => s.xpGained);
  const lootItems = useStore(huntAnalyzerStore, (s) => s.lootItems);
  const scrollsUsed = useStore(huntAnalyzerStore, (s) => s.scrollsUsed);
  const supplyCopper = useStore(huntAnalyzerStore, (s) => s.supplyCopper);
  const sealLogs = useStore(huntAnalyzerStore, (s) => s.sealLogs);
  const dropsMap = useStore(huntAnalyzerStore, (s) => s.drops);
  const sessionStartedAt = useStore(huntAnalyzerStore, (s) => s.sessionStartedAt);

  const [now, setNow] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(false);
  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('hunt-analyzer', {
    zIndex: 82,
    dragZIndex: 96,
  });

  const drops = useMemo(() => {
    return Object.entries(dropsMap)
      .map(([itemId, quantity]) => {
        const unitValue = huntItemNpcValue(itemId);
        return {
          itemId,
          quantity,
          unitValue,
          totalValue: unitValue * quantity,
        };
      })
      .filter((e) => e.quantity > 0)
      .sort(
        (a, b) =>
          b.totalValue - a.totalValue ||
          b.quantity - a.quantity ||
          a.itemId.localeCompare(b.itemId),
      );
  }, [dropsMap]);

  useEffect(() => {
    if (!isOpen) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        huntAnalyzerStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const rates = huntAnalyzerStore.getRates(now);
  const elapsedLabel =
    sessionStartedAt == null ? '0s' : formatHuntDuration(rates.elapsedMs);
  const balancePositive = rates.balance >= 0;

  const formatMoney = (value: number, signed = false) => {
    const abs = formatCopper(Math.abs(value));
    if (!signed) return `$${abs}`;
    if (value > 0) return `+$${abs}`;
    if (value < 0) return `−$${abs}`;
    return `$${abs}`;
  };

  return (
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`hunt-analyzer${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="Hunt Analyzer"
    >
      <header
        className="hunt-analyzer__head hunt-analyzer__head--drag"
        title="Arrastar para mover"
        {...handleProps}
      >
        <div className="hunt-analyzer__head-main">
          <Image
            className="hunt-analyzer__logo"
            src="/ui/hub-menu/hunt-analyzer.png"
            alt=""
            width={32}
            height={32}
            draggable={false}
            unoptimized
          />
          <div className="hunt-analyzer__head-text">
            <h2 className="hunt-analyzer__title">
              <span className="hunt-analyzer__title-bars" aria-hidden />
              Hunt Analyzer
            </h2>
            <p className="hunt-analyzer__session">• sessão atual</p>
          </div>
        </div>
        <div className="hunt-analyzer__head-actions" data-no-drag>
          <button
            type="button"
            className="hunt-analyzer__icon-btn"
            title="Zerar sessão"
            aria-label="Zerar sessão"
            onClick={() => huntAnalyzerStore.resetSession()}
          >
            🗑
          </button>
          <button
            type="button"
            className="hunt-analyzer__icon-btn"
            title="Fechar"
            aria-label="Fechar Hunt Analyzer"
            onClick={() => huntAnalyzerStore.close()}
          >
            ×
          </button>
        </div>
      </header>

      <div className="hunt-analyzer__grid" role="list">
        <StatCard
          tone="kill"
          icon="⚔"
          value={formatCopper(kills)}
          label="Derrotados"
        />
        <StatCard
          tone="time"
          icon="⏱"
          value={elapsedLabel}
          label="Tempo na hunt"
        />
        <StatCard
          tone="xp"
          icon="★"
          value={formatCopper(xpGained)}
          label="XP ganha"
        />
        <StatCard
          tone="seal"
          icon="🌀"
          value={formatCopper(sealed)}
          label="Selados"
        />
        <StatCard
          tone="loot"
          iconSrc="/ui/items/copper-coin.png"
          value={formatMoney(rates.lootValue, true)}
          valueClass="is-pos"
          label={`Loot (${lootItems} itens)`}
        />
        <StatCard
          tone="supply"
          icon="📜"
          value={supplyCopper > 0 ? `−$${formatCopper(supplyCopper)}` : '$0'}
          valueClass={supplyCopper > 0 ? 'is-neg' : undefined}
          label={`Supply (${scrollsUsed} pergaminhos)`}
        />
      </div>

      <section className="hunt-analyzer__balance" aria-label="Saldo da sessão">
        <span className="hunt-analyzer__balance-label">
          Saldo (Loot NPC − Supply)
        </span>
        <strong
          className={`hunt-analyzer__balance-value${
            balancePositive ? ' is-pos' : ' is-neg'
          }`}
        >
          {formatMoney(rates.balance, true)}
        </strong>
      </section>

      <div className="hunt-analyzer__rates" role="list">
        <div className="hunt-analyzer__rate" role="listitem">
          <span className="hunt-analyzer__rate-icon" aria-hidden>
            ↗
          </span>
          <span
            className={`hunt-analyzer__rate-value${
              rates.balancePerHour >= 0 ? ' is-pos' : ' is-neg'
            }`}
          >
            {formatMoney(rates.balancePerHour, true)}/h
          </span>
        </div>
        <div className="hunt-analyzer__rate" role="listitem">
          <span className="hunt-analyzer__rate-icon" aria-hidden>
            ★
          </span>
          <span className="hunt-analyzer__rate-value is-xp">
            {formatCopper(rates.xpPerHour)} XP/h
          </span>
        </div>
        <div className="hunt-analyzer__rate" role="listitem">
          <span className="hunt-analyzer__rate-icon" aria-hidden>
            ⚔
          </span>
          <span className="hunt-analyzer__rate-value is-kill">
            {formatCopper(rates.killsPerHour)}/h
          </span>
        </div>
      </div>

      <section className="hunt-analyzer__drops" aria-label="Drops da sessão">
        <h3 className="hunt-analyzer__section-title">Drops da sessão</h3>
        {drops.length === 0 ? (
          <p className="hunt-analyzer__empty">Nenhum drop nesta sessão ainda.</p>
        ) : (
          <ul className="hunt-analyzer__drop-list">
            {drops.map((drop) => {
              const def = getItem(drop.itemId);
              const name = def?.name ?? drop.itemId;
              const color = def ? RARITY_CSS[def.rarity] : undefined;
              const isCopper = drop.itemId === SHOP_CURRENCY_ITEM_ID;
              return (
                <li key={drop.itemId} className="hunt-analyzer__drop">
                  <span className="hunt-analyzer__drop-icon" aria-hidden>
                    {def?.iconSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={def.iconSrc} alt="" width={22} height={22} />
                    ) : (
                      <span className="hunt-analyzer__drop-mono" style={{ color }}>
                        {name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="hunt-analyzer__drop-main">
                    <span className="hunt-analyzer__drop-name" style={{ color }} title={name}>
                      {name}
                    </span>
                    <span className="hunt-analyzer__drop-qty">
                      ×{formatCopper(drop.quantity)}
                      {!isCopper && drop.unitValue > 0 ? (
                        <span className="hunt-analyzer__drop-unit">
                          {' '}
                          · ${formatCopper(drop.unitValue)} un
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {drop.totalValue > 0 ? (
                    <span className="hunt-analyzer__drop-value">
                      ${formatCopper(drop.totalValue)}
                    </span>
                  ) : (
                    <span className="hunt-analyzer__drop-value is-muted">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        className="hunt-analyzer__log-btn"
        onClick={() => setShowLog((v) => !v)}
      >
        {showLog ? 'Ocultar log de selamentos' : 'Ver log de selamentos'}
      </button>

      {showLog ? (
        <div className="hunt-analyzer__log" role="log">
          {sealLogs.length === 0 ? (
            <p className="hunt-analyzer__empty">Nenhum selamento nesta sessão.</p>
          ) : (
            <ul>
              {[...sealLogs].reverse().map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <p className="hunt-analyzer__footer">
        Loot em Cobre NPC: cobre dropped + venda dos materiais. Saldo = Loot − custo de
        pergaminhos. Zera ao trocar de caça.
      </p>
    </div>
  );
}

function StatCard({
  tone,
  icon,
  iconSrc,
  value,
  label,
  valueClass,
}: {
  tone: string;
  icon?: string;
  iconSrc?: string;
  value: string;
  label: string;
  valueClass?: string;
}) {
  return (
    <div className={`hunt-analyzer__card hunt-analyzer__card--${tone}`} role="listitem">
      <span className="hunt-analyzer__card-icon" aria-hidden>
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconSrc} alt="" width={20} height={20} />
        ) : (
          icon
        )}
      </span>
      <span className={`hunt-analyzer__card-value${valueClass ? ` ${valueClass}` : ''}`}>
        {value}
      </span>
      <span className="hunt-analyzer__card-label">{label}</span>
    </div>
  );
}
