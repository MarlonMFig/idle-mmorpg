'use client';

import { useEffect } from 'react';
import { DAILY_LOGIN_GEMS, GEM_PACKAGES } from '@/constants/aiw-gems';
import {
  REFINEMENT_CRYSTAL_GEM_PRICE,
  REFINEMENT_CRYSTAL_WEEKLY_LIMIT_F2P,
} from '@/constants/aiw-potential';
import { useStore } from '@/hooks/use-store';
import { gemStore } from '@/stores/gem-store';
import { vipStore } from '@/stores/vip-store';

/** Loja Geral — gemas, login diário, cristais semanais (spec AIW). */
export function PremiumShopPanel() {
  const isOpen = useStore(gemStore, (s) => s.isOpen);
  const balance = useStore(gemStore, (s) => s.balance);
  const lastLoginDay = useStore(gemStore, (s) => s.lastLoginDay);
  const claimed = useStore(gemStore, (s) => s.claimedAchievements);
  const vipActive = useStore(vipStore, (s) => s.active);
  const crystalLeft = gemStore.weeklyCrystalRemaining();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        gemStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const today = new Date().toISOString().slice(0, 10);
  const loginClaimed = lastLoginDay === today;

  return (
    <div
      className="premium-shop-overlay"
      role="presentation"
      onClick={() => gemStore.close()}
    >
      <div
        className="premium-shop"
        role="dialog"
        aria-modal="true"
        aria-label="Loja Geral"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="premium-shop__head">
          <div>
            <p className="premium-shop__eyebrow">Economia premium</p>
            <h2>Loja Geral</h2>
          </div>
          <div className="premium-shop__balance">
            <span>💎</span>
            <strong>{balance.toLocaleString('pt-BR')}</strong>
          </div>
          <button type="button" className="premium-shop__close" onClick={() => gemStore.close()}>
            ×
          </button>
        </header>

        <section className="premium-shop__section">
          <h3>Login diário</h3>
          <p>+{DAILY_LOGIN_GEMS} Gemas/dia — F2P e VIP.</p>
          <button
            type="button"
            className="premium-shop__btn"
            disabled={loginClaimed}
            onClick={() => gemStore.claimDailyLogin()}
          >
            {loginClaimed ? 'Coletado hoje' : `Coletar ${DAILY_LOGIN_GEMS} Gemas`}
          </button>
        </section>

        <section className="premium-shop__section">
          <h3>Loja semanal</h3>
          <p>
            Cristal de Refinamento — {REFINEMENT_CRYSTAL_GEM_PRICE} Gemas (
            {crystalLeft} restantes; limite {vipActive ? 3 : REFINEMENT_CRYSTAL_WEEKLY_LIMIT_F2P}
            /sem)
          </p>
          <button
            type="button"
            className="premium-shop__btn"
            disabled={crystalLeft <= 0}
            onClick={() => gemStore.buyWeeklyRefinementCrystal()}
          >
            Comprar cristal
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
          <ul className="premium-shop__achievements">
            {gemStore.listAchievements().map((ach) => (
              <li key={ach.id} className={claimed[ach.id] ? 'is-done' : ''}>
                <strong>{ach.title}</strong>
                <span>{ach.description}</span>
                <em>{claimed[ach.id] ? '✓' : `+${ach.gems} 💎`}</em>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
