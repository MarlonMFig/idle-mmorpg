'use client';

import Image from 'next/image';
import {
  GUILD_COLORS,
  GUILD_DEFAULT_EMBLEM,
  GUILD_EMBLEMS,
  isGuildEmblemIcon,
} from '@/constants/guild';

export function crestGlow(color: string): string {
  return `radial-gradient(circle, ${color}88 0%, ${color}2b 45%, transparent 72%)`;
}

export function GuildEmblem({
  value,
  className = '',
}: {
  value: string;
  className?: string;
}) {
  if (!value.startsWith('/')) return <span className={className}>{value}</span>;
  const src = isGuildEmblemIcon(value) ? value : GUILD_DEFAULT_EMBLEM;
  return <Image src={src} alt="" width={256} height={256} className={className} unoptimized />;
}

export function resolveEmblemIndex(icon: string | undefined): number {
  const idx = GUILD_EMBLEMS.findIndex((entry) => entry.icon === icon);
  return idx >= 0 ? idx : 0;
}

export function GuildBannerPicker({
  emblemIdx,
  emblemColor,
  onEmblemIdx,
  onEmblemColor,
}: {
  emblemIdx: number;
  emblemColor: string;
  onEmblemIdx: (idx: number) => void;
  onEmblemColor: (color: string) => void;
}) {
  const emblem = GUILD_EMBLEMS[emblemIdx] ?? GUILD_EMBLEMS[0];
  return (
    <div className="guild-win__identity-builder">
      <div
        className="guild-win__identity-preview"
        style={{ background: crestGlow(emblemColor) }}
        aria-label={`Preview: ${emblem?.label ?? 'Banner'}`}
      >
        <GuildEmblem value={emblem?.icon ?? GUILD_DEFAULT_EMBLEM} />
      </div>
      <div className="guild-win__identity-options">
        <div className="guild-win__emblem-picks">
          <span>Banner</span>
          <div>
            {GUILD_EMBLEMS.map((em, i) => (
              <button
                key={em.icon}
                type="button"
                className={`guild-win__emblem-btn${emblemIdx === i ? ' is-on' : ''}`}
                title={em.label}
                aria-label={em.label}
                aria-pressed={emblemIdx === i}
                onClick={() => onEmblemIdx(i)}
              >
                <GuildEmblem value={em.icon} />
              </button>
            ))}
          </div>
        </div>
        <div className="guild-win__color-picks">
          <span>Cor do brilho</span>
          <div>
            {GUILD_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={emblemColor === color ? 'is-on' : ''}
                style={{ background: color }}
                title={color}
                aria-label={`Cor ${color}`}
                aria-pressed={emblemColor === color}
                onClick={() => onEmblemColor(color)}
              />
            ))}
            <label className="guild-win__color-custom" title="Escolher outra cor">
              <input
                type="color"
                value={emblemColor}
                onChange={(event) => onEmblemColor(event.target.value)}
                aria-label="Escolher outra cor"
              />
              <span>+</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
