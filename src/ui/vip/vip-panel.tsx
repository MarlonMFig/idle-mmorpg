'use client';

import Image from 'next/image';
import { useEffect, type RefObject } from 'react';
import { VIP_BENEFITS } from '@/constants/vip';
import { useDraggablePanel } from '@/hooks/use-draggable-panel';
import { useStore } from '@/hooks/use-store';
import { emitSystemMessage } from '@/lib/system-log';
import { vipStore } from '@/stores/vip-store';

export const VIP_ICON_SRC = '/ui/hub-menu/vip.png?v=color';

function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return '';
  return new Date(expiresAt).toLocaleDateString('pt-BR');
}

/**
 * Central VIP — benefícios ativos e ativação local (PIX depois).
 */
export function VipPanel() {
  const isOpen = useStore(vipStore, (s) => s.isOpen);
  const active = useStore(vipStore, (s) => s.active);
  const expiresAt = useStore(vipStore, (s) => s.expiresAt);

  const { panelRef, style, isDragging, handleProps } = useDraggablePanel('vip', {
    zIndex: 83,
    dragZIndex: 97,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        vipStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef as RefObject<HTMLDivElement>}
      className={`vip-panel${isDragging ? ' is-dragging' : ''}`}
      style={style}
      role="dialog"
      aria-modal="false"
      aria-label="VIP Shinobi"
    >
      <header
        className="vip-panel__head vip-panel__head--drag"
        title="Arrastar para mover"
        {...handleProps}
      >
        <div className="vip-panel__head-main">
          <Image
            className="vip-panel__logo"
            src={VIP_ICON_SRC}
            alt=""
            width={28}
            height={28}
            draggable={false}
            unoptimized
          />
          <div>
            <p className="vip-panel__eyebrow">Central Premium</p>
            <h2 className="vip-panel__title">VIP Shinobi</h2>
          </div>
        </div>
        <button
          type="button"
          className="vip-panel__icon-btn"
          data-no-drag
          title="Fechar"
          aria-label="Fechar VIP"
          onClick={() => vipStore.close()}
        >
          ×
        </button>
      </header>

      <div className="vip-panel__body">
        <div className={`vip-panel__status${active ? ' is-on' : ''}`}>
          {active ? (
            <>
              <strong>VIP ATIVO</strong>
              {expiresAt ? <span>até {formatExpiry(expiresAt)}</span> : null}
            </>
          ) : (
            <>
              <strong>VIP INATIVO</strong>
              <span>Ative para receber os bônus</span>
            </>
          )}
        </div>

        <ul className="vip-panel__benefits">
          {VIP_BENEFITS.map((benefit) => (
            <li key={benefit.id}>
              <strong>{benefit.label}</strong>
              <span>{benefit.detail}</span>
            </li>
          ))}
        </ul>

        {!active ? (
          <button
            type="button"
            className="vip-panel__activate"
            data-no-drag
            onClick={() => {
              vipStore.activate();
              emitSystemMessage('VIP Shinobi ativado — bônus de EXP, loot e poção.');
            }}
          >
            Ativar VIP
          </button>
        ) : (
          <p className="vip-panel__hint">PIX e pacotes entram numa próxima etapa.</p>
        )}
      </div>
    </div>
  );
}
