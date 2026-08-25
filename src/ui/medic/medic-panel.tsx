'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { TEAM_SLOT_COUNT, SHOP_CURRENCY_ITEM_ID } from '@/constants/sealing';
import { CHARACTER_QUALITY_COLORS } from '@/constants/character-progression';
import { useStore } from '@/hooks/use-store';
import { quoteMedicRecovery, recoverTeamAtMedic } from '@/lib/medic-service';
import { medicStore } from '@/stores/medic-store';
import { inventoryStore } from '@/stores/inventory-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { formatStat } from '@/lib/format-stat';
import { Decimal, d, hpRatio } from '@/lib/decimal';
import { MgrWindow } from '@/ui/mgr';

export const MEDIC_ICON_SRC = '/ui/hub-menu/medico.png?v=color';

/**
 * @deprecated Item 42 — use `recoverTeamAtMedic`. Mantido para imports legados.
 */
export function healTeamFully(): void {
  recoverTeamAtMedic();
}

export function MedicPanel() {
  const isOpen = useStore(medicStore, (s) => s.isOpen);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);
  const copper = useStore(inventoryStore, () => inventoryStore.countItem(SHOP_CURRENCY_ITEM_ID));
  const [feedback, setFeedback] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        medicStore.close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const members = useMemo(
    () =>
      Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
        const id = teamIds[index];
        if (!id) return null;
        return collection.find((entry) => entry.id === id) ?? null;
      }).filter((entry) => entry != null),
    [teamIds, collection],
  );

  const quote = useMemo(() => quoteMedicRecovery(), [vitals.hp, vitals.hpMax, copper, isOpen]);

  if (!isOpen) return null;

  const hpPct = Math.round(hpRatio(vitals.hp, Decimal.max(d(1), vitals.hpMax)) * 100);
  const needsCare = quote.needsRecovery;
  const disabled = pending || !needsCare || !quote.canAfford || members.length === 0;

  const onRecover = () => {
    if (disabled) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = recoverTeamAtMedic();
      if (result.ok) {
        setFeedback(`Equipe recuperada (−${result.cost} Copper).`);
      } else if (result.reason === 'insufficient-copper') {
        setFeedback('Copper insuficiente.');
      } else if (result.reason === 'full') {
        setFeedback('Equipe já recuperada.');
      } else if (result.reason === 'busy') {
        setFeedback(null);
      } else {
        setFeedback('Não foi possível recuperar agora.');
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <MgrWindow
      title="Centro de Cura"
      lede="Recuperação de HP da equipe. Energia de combate regenera na Hunt."
      pill="Hub"
      icon={<Image src={MEDIC_ICON_SRC} alt="" width={40} height={40} unoptimized />}
      size="sm"
      ariaLabel="Centro de Cura Ninja"
      onClose={() => medicStore.close()}
      status={
        <span className="mgr-window__pill" title="Copper">
          {quote.copperBalance.toLocaleString('pt-BR')} Cu
        </span>
      }
      footer={
        <>
          <p className="mgr-window__hint">
            Poções e Revive continuam valendo durante a Hunt. O Centro de Cura atende só no Hub.
          </p>
          <button type="button" className="mgr-window__btn mgr-window__btn--ghost" onClick={() => medicStore.close()}>
            Sair
          </button>
        </>
      }
    >
      <div className="mgr-window__pane-head">
        <span className="mgr-window__pane-icon" aria-hidden>
          ✚
        </span>
        <div>
          <h3 className="mgr-window__pane-title">Recuperação da Equipe</h3>
          <p className="mgr-window__pane-lede">
            Restaura o HP dos ninjas da equipe (incluindo KO). Não consome Revive e não altera Energia
            nem cooldowns de Skills.
          </p>
        </div>
      </div>

      <div className="hud-medic__status">
        <p className="hud-medic__status-label">Status atual da equipe</p>
        <ul className="hud-medic__status-list">
          {members.length === 0 ? (
            <li className="hud-medic__status-empty">Nenhum ninja na equipe.</li>
          ) : (
            members.map((member) => {
              const isActive = member.id === activeId;
              const memberHpPct = isActive ? hpPct : 100;
              const memberHpLabel = isActive
                ? `${formatStat(vitals.hp)}/${formatStat(vitals.hpMax)} HP`
                : `HP (reserva)`;
              return (
                <li key={member.id} className="hud-medic__status-item">
                  <span
                    className="hud-medic__status-name"
                    style={{ ['--q' as string]: CHARACTER_QUALITY_COLORS[member.quality] }}
                  >
                    {member.name}
                    {isActive ? ' · ativo' : ''}
                  </span>
                  <span className="hud-medic__status-vitals">
                    {memberHpPct}% · {memberHpLabel}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <p className="mgr-window__hint">
        {needsCare
          ? `Custo da recuperação: ${quote.cost} Copper (saldo: ${quote.copperBalance})`
          : 'Equipe já recuperada.'}
      </p>

      <button type="button" className="mgr-window__btn" disabled={disabled} onClick={onRecover}>
        {!needsCare
          ? 'Equipe recuperada'
          : !quote.canAfford
            ? 'Copper insuficiente'
            : pending
              ? 'Recuperando…'
              : 'Recuperar equipe'}
      </button>
      {feedback ? <p className="mgr-window__hint">{feedback}</p> : null}
    </MgrWindow>
  );
}
