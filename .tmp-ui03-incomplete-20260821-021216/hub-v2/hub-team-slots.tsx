'use client';

import Image from 'next/image';
import { useMemo } from 'react';
import { TEAM_SLOT_COUNT } from '@/constants/sealing';
import { useStore } from '@/hooks/use-store';
import { switchActiveCharacter } from '@/lib/active-character';
import { locationStore } from '@/stores/location-store';
import { teamStore } from '@/stores/team-store';
import { vitalsStore } from '@/stores/vitals-store';
import { combatEnergyStore } from '@/stores/combat-energy-store';
import { RarityFrame, ResourceBar } from '@/ui/design-system';
import type { AiwRarityId } from '@/ui/design-system';
import type { SealedCharacter } from '@/types/team';
import { computePlayerAttributes } from '@/utils/attributes';

function estimateHpMax(member: SealedCharacter, level: number): number {
  return Math.max(
    1,
    Math.round(
      computePlayerAttributes({
        level,
        stars: member.stars,
        characterId: member.characterId,
        awakeningLevel: member.awakeningLevel,
      }).totals.hp,
    ),
  );
}

/**
 * Active team as portrait slots (not table rows).
 * Same data/actions as TeamCombatStrip — hub composition only.
 */
export function HubTeamSlots() {
  const collection = useStore(teamStore, (s) => s.collection);
  const teamIds = useStore(teamStore, (s) => s.teamIds);
  const activeId = useStore(teamStore, (s) => s.activeId);
  const vitals = useStore(vitalsStore, (s) => s);
  const mode = useStore(locationStore, (s) => s.mode);
  const energy = useStore(combatEnergyStore, (s) => s.currentEnergy);
  const energyMax = useStore(combatEnergyStore, (s) => s.maxEnergy);

  const slots = useMemo(
    () =>
      Array.from({ length: TEAM_SLOT_COUNT }, (_, index) => {
        const id = teamIds[index];
        if (!id) return null;
        return collection.find((entry) => entry.id === id) ?? null;
      }),
    [teamIds, collection],
  );

  return (
    <section className="hub-team" aria-label="Equipe ativa">
      <header className="hub-team__head">
        <h2 className="hub-team__title">Equipe</h2>
      </header>
      <div className="hub-team__slots">
        {slots.map((member, index) => {
          if (!member) {
            return (
              <div key={`empty-${index}`} className="hub-team__slot hub-team__slot--empty" aria-hidden>
                <span className="hub-team__empty">+</span>
              </div>
            );
          }

          const isActive = member.id === activeId;
          const level = isActive ? vitals.level : member.level;
          const hpMax = isActive ? vitals.hpMax : estimateHpMax(member, level);
          const hp = isActive ? vitals.hp : hpMax;
          const rarity = member.quality as AiwRarityId;

          return (
            <button
              key={member.id}
              type="button"
              className={['hub-team__slot', isActive ? 'is-active' : ''].filter(Boolean).join(' ')}
              onClick={() => {
                if (!isActive) switchActiveCharacter(member.id);
              }}
              aria-pressed={isActive}
              aria-label={`${member.name}, nível ${level}`}
            >
              <RarityFrame rarity={rarity} className="hub-team__frame">
                <div className="hub-team__portrait">
                  <Image
                    className="aiw-pixel hub-team__sprite"
                    src={member.previewUrl}
                    alt=""
                    width={128}
                    height={128}
                    unoptimized
                  />
                </div>
              </RarityFrame>
              <span className="hub-team__name">{member.name}</span>
              <span className="hub-team__lv aiw-nums">Nv.{level}</span>
              <div className="hub-team__bars">
                <ResourceBar label="HP" value={hp} max={hpMax} variant="hp" showValues={false} />
                {mode === 'combat' && isActive ? (
                  <ResourceBar
                    label="EN"
                    value={Math.round(energy)}
                    max={energyMax}
                    variant="energy"
                    showValues={false}
                  />
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
