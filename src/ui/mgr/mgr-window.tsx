'use client';

import type { ReactNode } from 'react';

export type MgrWindowSize = 'sm' | 'md' | 'lg' | 'xl';

export interface MgrTab {
  id: string;
  label: string;
}

export interface MgrWindowProps {
  title: string;
  lede?: string;
  pill?: ReactNode;
  icon?: ReactNode;
  size?: MgrWindowSize;
  ariaLabel?: string;
  tabs?: MgrTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  status?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * Shell visual compartilhado (Equipe / Inventário).
 * Overlay blur + card escuro + brand header + close.
 */
export function MgrWindow({
  title,
  lede,
  pill,
  icon = '◆',
  size = 'md',
  ariaLabel,
  tabs,
  activeTab,
  onTabChange,
  status,
  footer,
  onClose,
  children,
  className,
  bodyClassName,
}: MgrWindowProps) {
  return (
    <div
      className="mgr-window-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'mgr-window',
          `mgr-window--${size}`,
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mgr-window__top">
          <div className="mgr-window__brand">
            <span className="mgr-window__brand-icon" aria-hidden>
              {icon}
            </span>
            <div className="mgr-window__brand-copy">
              <div className="mgr-window__brand-row">
                <h2 className="mgr-window__brand-title">{title}</h2>
                {pill != null ? <span className="mgr-window__pill">{pill}</span> : null}
              </div>
              {lede ? <p className="mgr-window__brand-lede">{lede}</p> : null}
            </div>
          </div>

          {tabs && tabs.length > 0 ? (
            <div className="mgr-window__tabs" role="tablist" aria-label={`${title} abas`}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`mgr-window__tab${activeTab === tab.id ? ' is-on' : ''}`}
                  onClick={() => onTabChange?.(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mgr-window__status">
            {status}
            <button
              type="button"
              className="mgr-window__close"
              onClick={onClose}
              aria-label={`Fechar ${title}`}
            >
              ×
            </button>
          </div>
        </header>

        <div className={['mgr-window__body', bodyClassName].filter(Boolean).join(' ')}>
          {children}
        </div>

        {footer ? <footer className="mgr-window__foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
