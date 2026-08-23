'use client';

import { useEffect, useState } from 'react';
import { getItem } from '@/data/items';
import { DAILY_LOGIN_REWARDS } from '@/data/daily-login/daily-login-rewards';
import { formatResetCountdown, gameNow, getNextDailyResetMs } from '@/lib/mission-cycle';
import { useStore } from '@/hooks/use-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import type { DailyLoginDay, DailyLoginReward, DailyLoginSlotStatus } from '@/types/daily-login';

const DAY_SUBTITLES: Record<DailyLoginDay, string> = {
  1: 'Primeiro Passo',
  2: 'Suprimentos Básicos',
  3: 'Provisões da Guarda',
  4: 'Elixir Refinado',
  5: 'Arcano Antigo',
  6: 'Graça da Fênix',
  7: 'Grande Tesouro',
};

function formatRewardLine(reward: DailyLoginReward): string {
  if (reward.type === 'copper') return `${reward.amount} Copper`;
  const item = getItem(reward.id);
  return `${reward.amount}× ${item?.name ?? reward.id}`;
}

function slotKind(status: DailyLoginSlotStatus): 'claimed' | 'today' | 'locked' {
  if (status === 'claimed' || status === 'collected-today') return 'claimed';
  if (status === 'today') return 'today';
  return 'locked';
}

export function DailyLoginPanel() {
  const isOpen = useStore(dailyLoginStore, (s) => s.isOpen);
  const currentDay = useStore(dailyLoginStore, (s) => s.currentDay);
  const tick = useStore(
    dailyLoginStore,
    (s) => `${s.currentDay}:${s.lastClaimCycleId ?? ''}:${s.totalClaims}`,
  );
  const [now, setNow] = useState(() => gameNow());
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const refresh = () => setNow(gameNow());
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        dailyLoginStore.setOpen(false);
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    const timer = window.setInterval(refresh, 1_000);
    refresh();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(timer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  void tick;
  const available = dailyLoginStore.isAvailable();
  const countdown = formatResetCountdown(getNextDailyResetMs(now), now);
  const claimedInCycle =
    !available && currentDay === 1 ? 7 : Math.max(0, currentDay - 1);

  function handleClaim(): void {
    if (claiming || !available) return;
    setClaiming(true);
    dailyLoginStore.claim();
    setClaiming(false);
  }

  return (
    <div
      className="daily-login-overlay"
      role="presentation"
      onClick={() => dailyLoginStore.setOpen(false)}
    >
      <div
        className="daily-login-panel"
        role="dialog"
        aria-label="Recompensa Diária"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="daily-login-panel__beam" aria-hidden />

        <header className="daily-login-panel__top">
          <div className="daily-login-panel__brand">
            <p className="daily-login-panel__eyebrow">Bônus de login</p>
            <h2 className="daily-login-panel__title">Recompensa Diária</h2>
            <p className="daily-login-panel__lede">
              Volte todos os dias para desbloquear itens e fortalecer sua jornada
            </p>
          </div>
          <button
            type="button"
            className="daily-login-panel__close"
            aria-label="Fechar"
            onClick={() => dailyLoginStore.setOpen(false)}
          >
            ×
          </button>
        </header>

        <div className="daily-login-panel__meta">
          <span className="daily-login-panel__streak">
            Sequência: {claimedInCycle} / 7 dias
          </span>
          <span className="daily-login-panel__timer">
            {available ? 'Disponível agora' : `Próximo ciclo em ${countdown}`}
          </span>
        </div>

        <div className="daily-login-panel__grid">
          {DAILY_LOGIN_REWARDS.map((row) => {
            const day = row.day as DailyLoginDay;
            const status = dailyLoginStore.getSlotStatus(day);
            const kind = slotKind(status);
            const isGrand = day === 7;
            const lines = row.rewards.map(formatRewardLine);

            return (
              <article
                key={day}
                className={[
                  'daily-login-card',
                  `daily-login-card--${kind}`,
                  isGrand ? 'daily-login-card--grand' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {kind === 'today' ? (
                  <span className="daily-login-card__pill">Hoje</span>
                ) : null}
                {kind === 'claimed' ? (
                  <span className="daily-login-card__check" aria-label="Coletado">
                    ✓
                  </span>
                ) : null}
                {kind === 'locked' ? (
                  <span className="daily-login-card__lock" aria-hidden>
                    🔒
                  </span>
                ) : null}

                <div className="daily-login-card__icon" aria-hidden>
                  {isGrand ? '🎁' : day === 1 || day === 3 || day === 5 ? '🪙' : '🧪'}
                </div>

                <h3 className="daily-login-card__day">Dia {day}</h3>
                <p className="daily-login-card__subtitle">{DAY_SUBTITLES[day]}</p>
                <ul className="daily-login-card__rewards">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>

                {kind === 'today' ? (
                  <button
                    type="button"
                    className="daily-login-card__claim"
                    disabled={claiming}
                    onClick={handleClaim}
                  >
                    Resgatar
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>

        <footer className="daily-login-panel__foot">
          {available ? (
            <button
              type="button"
              className="daily-login-panel__cta"
              disabled={claiming}
              onClick={handleClaim}
            >
              Resgatar recompensa (Dia {currentDay})
            </button>
          ) : (
            <p className="daily-login-panel__cta daily-login-panel__cta--disabled">
              Coletado hoje · Retorne amanhã
            </p>
          )}

          <div className="daily-login-panel__legend" aria-hidden>
            <span>
              <i className="daily-login-dot daily-login-dot--claimed" /> Coletado
            </span>
            <span>
              <i className="daily-login-dot daily-login-dot--today" /> Disponível
            </span>
            <span>
              <i className="daily-login-dot daily-login-dot--locked" /> Bloqueado
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
