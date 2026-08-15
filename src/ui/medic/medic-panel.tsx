'use client';

import Image from 'next/image';
import { useEffect, useMemo } from 'react';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { CHARACTER_QUALITY_COLORS } from '@/constants/character-progression';
import { useStore } from '@/hooks/use-store';
import { emitSystemMessage } from '@/lib/system-log';
import { medicStore } from '@/stores/medic-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';

export const MEDIC_ICON_SRC = '/ui/hub-menu/medico.png?v=modelo2';

/**
 * Cura completa da equipe: HP cheio no personagem em campo e chakra
 * (cooldown dos jutsus) zerado para todos. Sempre gratuito.
 */
export function healTeamFully(): void {
  vitalsStore.healFull();
  skillsStore.clearCooldowns();
  medicStore.markHealed();
  emitSystemMessage('Centro de Cura: equipe restaurada — HP e chakra cheios.');
}

export function MedicPanel() {
  const isOpen = useStore(medicStore, (s) => s.isOpen);
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);
  const cooldownReadyAt = useStore(skillsStore, (s) => s.cooldownReadyAt);

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

  if (!isOpen) return null;

  const now = Date.now();
  const chakraReady = Object.values(cooldownReadyAt).every((readyAt) => now >= readyAt);
  const hpPct = Math.max(
    0,
    Math.min(100, Math.round((vitals.hp / Math.max(1, vitals.hpMax)) * 100)),
  );
  const needsCare = hpPct < 100 || !chakraReady;

  return (
    <div
      className="hud-modal-layer hud-modal-layer--medic"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) medicStore.close();
      }}
    >
      <section className="hud-medic" aria-label="Centro de Cura Ninja">
        <header className="hud-medic__head">
          <span className="hud-medic__head-icon">
            <Image src={MEDIC_ICON_SRC} alt="" width={44} height={44} unoptimized />
          </span>
          <div className="hud-medic__head-text">
            <h2 className="hud-medic__title">
              Centro de Cura Ninja
              <span className="hud-medic__tag">Disponível</span>
            </h2>
            <p className="hud-medic__subtitle">
              Santuário de Ninjutsu Médico e restauração de energia vital.
            </p>
          </div>
          <button
            type="button"
            className="hud-medic__close"
            onClick={() => medicStore.close()}
            aria-label="Fechar centro de cura"
          >
            ×
          </button>
        </header>

        <div className="hud-medic__body">
          <span className="hud-medic__seal">
            <Image src={MEDIC_ICON_SRC} alt="" width={96} height={96} unoptimized />
          </span>

          <h3 className="hud-medic__headline">Restauração Total da Equipe</h3>
          <p className="hud-medic__lead">
            Invoque a técnica da Criação do Renascimento para curar instantaneamente 100% da
            vida (HP) e do chakra de todos os ninjas da sua equipe.
          </p>

          <div className="hud-medic__status">
            <p className="hud-medic__status-label">Status atual da equipe</p>
            <ul className="hud-medic__status-list">
              {members.length === 0 ? (
                <li className="hud-medic__status-empty">Nenhum ninja na equipe.</li>
              ) : (
                members.map((member) => {
                  const isActive = member.id === activeId;
                  const memberHp = isActive ? hpPct : 100;
                  const memberChakra = chakraReady ? 100 : 0;
                  return (
                    <li key={member.id} className="hud-medic__status-item">
                      <span
                        className="hud-medic__status-name"
                        style={{ ['--q' as string]: CHARACTER_QUALITY_COLORS[member.quality] }}
                      >
                        {member.name}
                      </span>
                      <span className="hud-medic__status-vitals">
                        {memberHp}% HP <i>|</i> {memberChakra}% Chakra
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <button
            type="button"
            className="hud-medic__heal"
            onClick={() => healTeamFully()}
          >
            Curar toda a equipe (gratuito)
          </button>
          {!needsCare ? (
            <p className="hud-medic__ready">A equipe já está em plena forma.</p>
          ) : null}
        </div>

        <footer className="hud-medic__foot">
          <p className="hud-medic__foot-hint">
            O Centro de Cura está sempre aberto para todos os ninjas da vila.
          </p>
          <button
            type="button"
            className="hud-medic__leave"
            onClick={() => medicStore.close()}
          >
            Sair
          </button>
        </footer>
      </section>
    </div>
  );
}
