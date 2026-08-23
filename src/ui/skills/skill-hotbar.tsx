'use client';

import { useEffect, useState } from 'react';
import { SKILL_ELEMENT_CSS, SKILL_ELEMENT_LABELS } from '@/constants/skill';
import { resolveSkillElement } from '@/data/damage-elements';
import { getSkill } from '@/data/skills';
import { useStore } from '@/hooks/use-store';
import { skillsStore } from '@/stores/skills-store';
import { teamStore } from '@/stores/team-store';
import { HudPanel } from '@/ui/hud/hud-panel';

/**
 * Hotbar de jutsus — oculta enquanto o personagem não tiver nenhum.
 */
export function SkillHotbar() {
  const hotbar = useStore(skillsStore, (s) => s.hotbar);
  const cooldownReadyAt = useStore(skillsStore, (s) => s.cooldownReadyAt);
  const level = useStore(teamStore, (s) => {
    const active = s.collection.find((entry) => entry.id === s.activeId);
    return Math.max(1, active?.level || 1);
  });
  const [now, setNow] = useState(() => Date.now());

  const filled = hotbar.filter((id): id is string => id != null);
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

  if (filled.length === 0) return null;

  return (
    <HudPanel
      title="Jutsus"
      badge="auto"
      ariaLabel="Habilidades automáticas"
      className="hud-skills"
    >
      <div className="hud-skills__bar" role="list" aria-label="Jutsus automáticos">
        {hotbar.map((skillId, index) => {
          const skill = skillId ? getSkill(skillId) : undefined;
          const locked = Boolean(skill && level < (skill.requiredLevel ?? 1));
          const remaining =
            skillId && !locked ? skillsStore.getCooldownRemainingMs(skillId, now) : 0;
          const onCooldown = remaining > 0;
          const cdRatio = skill && onCooldown ? remaining / skill.cooldownMs : 0;

          return (
            <div
              key={index}
              role="listitem"
              className={`hud-skills__slot has-skill${onCooldown ? ' is-cooldown' : ''}${
                locked ? ' is-locked' : ''
              }`}
              title={
                skill
                  ? `${skill.name} · Nv. ${skill.requiredLevel ?? 1} · ${
                      SKILL_ELEMENT_LABELS[resolveSkillElement(skill)]
                    } · ${
                      skill.effect === 'heal'
                        ? `Cura ${Math.round((skill.healPercent ?? 0) * 100)}% HP`
                        : `${skill.damage} DMG${skill.areaRadius ? ' · Área' : ''}`
                    } (automático)`
                  : `Slot ${index + 1} vazio`
              }
              aria-label={
                skill
                  ? `${skill.name}${locked ? ` (libera no nível ${skill.requiredLevel})` : ' (automático)'}`
                  : `Jutsu ${index + 1} vazio`
              }
            >
              <span className="hud-skills__key">{index + 1}</span>
              {skill ? (
                <>
                  <span
                    className="hud-skills__icon"
                    style={{
                      backgroundColor: SKILL_ELEMENT_CSS[resolveSkillElement(skill)],
                      backgroundImage: `url(${skill.icon})`,
                    }}
                    aria-hidden
                  />
                  {locked ? (
                    <span className="hud-skills__lock">Nv {skill.requiredLevel}</span>
                  ) : onCooldown ? (
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
