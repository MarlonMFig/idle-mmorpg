'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useStore } from '@/hooks/use-store';
import {
  formatHuntDuration,
  huntAnalyzerStore,
} from '@/stores/hunt-analyzer-store';

/**
 * Hunt Analyzer — estatísticas da sessão de caça (abre pelo menu do hub).
 */
export function HuntAnalyzerPanel() {
  const isOpen = useStore(huntAnalyzerStore, (s) => s.isOpen);
  const kills = useStore(huntAnalyzerStore, (s) => s.kills);
  const sealed = useStore(huntAnalyzerStore, (s) => s.sealed);
  const xpGained = useStore(huntAnalyzerStore, (s) => s.xpGained);
  const lootCopper = useStore(huntAnalyzerStore, (s) => s.lootCopper);
  const lootItems = useStore(huntAnalyzerStore, (s) => s.lootItems);
  const scrollsUsed = useStore(huntAnalyzerStore, (s) => s.scrollsUsed);
  const sealLogs = useStore(huntAnalyzerStore, (s) => s.sealLogs);
  const sessionStartedAt = useStore(huntAnalyzerStore, (s) => s.sessionStartedAt);

  const [now, setNow] = useState(() => Date.now());
  const [showLog, setShowLog] = useState(false);

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

  return (
    <div
      className="hunt-analyzer-overlay"
      role="presentation"
      onClick={() => huntAnalyzerStore.close()}
    >
      <div
        className="hunt-analyzer"
        role="dialog"
        aria-modal="true"
        aria-label="Hunt Analyzer"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="hunt-analyzer__top">
          <div className="hunt-analyzer__brand">
            <Image
              className="hunt-analyzer__brand-icon"
              src="/ui/hub-menu/hunt-analyzer.png"
              alt=""
              width={36}
              height={36}
              unoptimized
            />
            <h2 className="hunt-analyzer__title">Hunt Analyzer</h2>
          </div>
          <button
            type="button"
            className="hunt-analyzer__close"
            aria-label="Fechar Hunt Analyzer"
            onClick={() => huntAnalyzerStore.close()}
          >
            ×
          </button>
        </header>

        <ul className="hunt-analyzer__stats">
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              ⚔
            </span>
            <span>
              <strong>{kills}</strong> Derrotados
            </span>
          </li>
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              ⏱
            </span>
            <span>
              <strong>{elapsedLabel}</strong> Tempo na hunt
            </span>
          </li>
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              ★
            </span>
            <span>
              <strong>{xpGained.toLocaleString('pt-BR')}</strong> XP ganha
            </span>
          </li>
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              🌀
            </span>
            <span>
              <strong>{sealed}</strong> Selados
            </span>
          </li>
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ui/items/copper-coin.png" alt="" width={18} height={18} />
            </span>
            <span>
              <strong>+{lootCopper.toLocaleString('pt-BR')}</strong> Loot (
              {lootItems} itens)
            </span>
          </li>
          <li>
            <span className="hunt-analyzer__stat-icon" aria-hidden>
              📜
            </span>
            <span>
              <strong>−{scrollsUsed}</strong> Supply ({scrollsUsed} pergaminhos)
            </span>
          </li>
        </ul>

        <section className="hunt-analyzer__balance" aria-label="Saldo da sessão">
          <div className="hunt-analyzer__balance-main">
            <span className="hunt-analyzer__balance-label">Saldo</span>
            <strong className="hunt-analyzer__balance-value hunt-analyzer__balance-value--pos">
              +{rates.balance.toLocaleString('pt-BR')} Cobre
            </strong>
          </div>
          <div className="hunt-analyzer__rates">
            <span>+{rates.copperPerHour.toLocaleString('pt-BR')} Cu/h</span>
            <span>{rates.xpPerHour.toLocaleString('pt-BR')} XP/h</span>
            <span>{rates.killsPerHour.toLocaleString('pt-BR')} kills/h</span>
          </div>
        </section>

        <div className="hunt-analyzer__actions">
          <button
            type="button"
            className="hunt-analyzer__btn"
            onClick={() => setShowLog((v) => !v)}
          >
            {showLog ? 'Ocultar log de selamentos' : 'Ver log de selamentos'}
          </button>
          <button
            type="button"
            className="hunt-analyzer__btn hunt-analyzer__btn--ghost"
            onClick={() => huntAnalyzerStore.resetSession()}
          >
            Zerar sessão
          </button>
        </div>

        {showLog ? (
          <div className="hunt-analyzer__log" role="log">
            {sealLogs.length === 0 ? (
              <p className="hunt-analyzer__log-empty">Nenhum selamento nesta sessão.</p>
            ) : (
              <ul>
                {sealLogs.map((line, index) => (
                  <li key={`${line}-${index}`}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
