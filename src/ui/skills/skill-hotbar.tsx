'use client';

import { useEffect, useState } from 'react';
import { SKILL_ELEMENT_CSS, SKILL_ELEMENT_LABELS } from '@/constants/skill';
import { getSkill } from '@/data/skills';
import { useStore } from '@/hooks/use-store';
import { skillsStore } from '@/stores/skills-store';
import { HudPanel } from '@/ui/hud/hud-panel';

/**
 * Hotbar de 3 jutsus (display) — cast é automático no idle.
 */
export function SkillHotbar() {
  const hotbar = useStore(skillsStore, (s) => s.hotbar);
  const cooldownReadyAt = useStore(skillsStore, (s) => s.cooldownReadyAt);
  const [now, setNow] = useState(() => Date.now());

  const hasActiveCooldown = Object.values(cooldownReadyAt).some((readyAt) => readyAt > now);

  useEffect(() => {
    if (!hasActiveCooldown) return;

    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [hasActiveCooldown]);

  return (
    <HudPanel title="Jutsus" badge="auto" ariaLabel="Habilidades automáticas" className="hud-skills">
      <div className="hud-skills__bar" role="list" aria-label="Jutsus automáticos">
        {hotbar.map((skillId, index) => {
          const skill = skillId ? getSkill(skillId) : undefined;
          const remaining = skillId ? skillsStore.getCooldownRemainingMs(skillId, now) : 0;
          const onCooldown = remaining > 0;
          const cdRatio = skill && onCooldown ? remaining / skill.cooldownMs : 0;

          return (
            <div
              key={index}
              role="listitem"
              className={`hud-skills__slot has-skill${onCooldown ? ' is-cooldown' : ''}`}
              title={
                skill
                  ? `${skill.name} · ${SKILL_ELEMENT_LABELS[skill.element]} · ${skill.damage} DMG (automático)`
                  : `Slot ${index + 1} vazio`
              }
              aria-label={skill ? `${skill.name} (automático)` : `Jutsu ${index + 1} vazio`}
            >
              <span className="hud-skills__key">{index + 1}</span>
              {skill ? (
                <>
                  <span
                    className="hud-skills__icon"
                    style={{
                      backgroundColor: SKILL_ELEMENT_CSS[skill.element],
                      backgroundImage: `url(${skill.icon})`,
                    }}
                    aria-hidden
                  />
                  {onCooldown ? (
                    <span className="hud-skills__cd">{(remaining / 1000).toFixed(1)}</span>
                  ) : (
                    <span className="hud-skills__cost">{skill.damage}</span>
                  )}
                  {onCooldown ? (
                    <span
                      className="hud-skills__cd-fill"
                      style={{ transform: `scaleY(${cdRatio})` }}
                      aria-hidden
                    />
                  ) : null}
                </>
              ) : (
                <span className="hud-skills__empty">—</span>
              )}
            </div>
          );
        })}
      </div>
    </HudPanel>
  );
}
