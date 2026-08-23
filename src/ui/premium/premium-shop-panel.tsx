'use client';

import { useEffect, useState } from 'react';
import { GEM_PACKAGES } from '@/constants/aiw-gems';
import { useStore } from '@/hooks/use-store';
import { achievementsStore } from '@/stores/achievements-store';
import { dailyLoginStore } from '@/stores/daily-login-store';
import { gemStore } from '@/stores/gem-store';
import { MgrWindow } from '@/ui/mgr';

/** Loja Geral — gemas e pacotes. Achievements → painel oficial (Item 38). */
export function PremiumShopPanel() {
  const isOpen = useStore(gemStore, (s) => s.isOpen);
  const balance = useStore(gemStore, (s) => s.balance);
  const dailyTick = useStore(
    dailyLoginStore,
    (s) => `${s.lastClaimCycleId ?? ''}:${s.currentDay}:${s.totalClaims}`,
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        gemStore.close();
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  void tick;
  void dailyTick;
  const loginClaimed = !dailyLoginStore.isAvailable();

  return (
    <MgrWindow
      title="Loja Geral"
      lede="Economia premium"
      size="md"
      ariaLabel="Loja Geral"
      onClose={() => gemStore.close()}
      status={
        <span className="mgr-window__pill" title="Gemas">
          💎 {balance.toLocaleString('pt-BR')}
        </span>
      }
    >
      <section className="premium-shop__section">
        <h3>Recompensa Diária</h3>
        <p>Ciclo de 7 dias — mesma recompensa do menu principal.</p>
        <button
          type="button"
          className="premium-shop__btn"
          onClick={() => {
            gemStore.close();
            dailyLoginStore.setOpen(true);
          }}
        >
          {loginClaimed ? 'Abrir (já coletada hoje)' : 'Abrir Recompensa Diária'}
        </button>
      </section>

      <section className="premium-shop__section">
        <h3>Pacotes (dev)</h3>
        <ul className="premium-shop__packs">
          {GEM_PACKAGES.map((pack) => (
            <li key={pack.id}>
              <button type="button" onClick={() => gemStore.grantDevPackage(pack.id)}>
                {pack.name} — {pack.gems}
                {pack.bonusPercent ? ` (+${pack.bonusPercent}%)` : ''}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="premium-shop__section">
        <h3>Conquistas</h3>
        <p>As conquistas ficam no painel oficial (menu Achievements).</p>
        <button
          type="button"
          className="premium-shop__btn"
          onClick={() => {
            gemStore.close();
            achievementsStore.setOpen(true);
          }}
        >
          Abrir Conquistas
        </button>
      </section>
    </MgrWindow>
  );
}
