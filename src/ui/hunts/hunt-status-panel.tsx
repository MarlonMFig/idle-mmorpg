'use client';

import { useEffect, useState } from 'react';
import { applyForcedHuntLevels, huntEnemyStatsForLevel } from '@/constants/combat';
import { useStore } from '@/hooks/use-store';
import { locationStore } from '@/stores/location-store';
import type { HuntCatalog, HuntDefinition, PhaserAtlasData } from '@/types/hunt';
import { getCuratedPortraitUrl } from '@/data/curated-map-sprites';

const HUNTS_URL = '/data/wonsr/hunts.json?v=wonsr-10maps';
const ATLAS_URL = '/sprites/wonsr-hunts/characters.json';
const ATLAS_IMAGE_URL = '/sprites/wonsr-hunts/characters.png';

export function HuntStatusPanel() {
  const huntId = useStore(locationStore, (state) => state.huntId);
  const [hunt, setHunt] = useState<HuntDefinition | null>(null);
  const [atlas, setAtlas] = useState<PhaserAtlasData | null>(null);

  useEffect(() => {
    if (!huntId) {
      setHunt(null);
      return;
    }

    let cancelled = false;
    Promise.all([
      fetch(HUNTS_URL).then((response) => response.json() as Promise<HuntCatalog>),
      fetch(ATLAS_URL).then((response) => response.json() as Promise<PhaserAtlasData>),
    ]).then(([catalog, atlasData]) => {
      if (cancelled) return;
      const forced = applyForcedHuntLevels(catalog);
      setHunt(forced.hunts.find((entry) => entry.id === huntId) ?? null);
      setAtlas(atlasData);
    });
    return () => {
      cancelled = true;
    };
  }, [huntId]);

  const target = hunt?.targets[0];
  if (!hunt || !target) return null;

  const displayStats = {
    level: target.level,
    hp: target.hp,
    xp: huntEnemyStatsForLevel(target.level).xp,
  };

  const curatedUrl = getCuratedPortraitUrl(target.lookType);
  const frame = atlas?.frames[`look-${target.lookType}`]?.frame;

  return (
    <section className="hunt-status" aria-label="Alvo da caça">
      <header>
        <span>Alvo da caça</span>
        <strong>IA ativa</strong>
      </header>
      <div className="hunt-status__target">
        <div className="hunt-status__portrait">
          {curatedUrl ? (
            <span
              role="img"
              aria-label={target.name}
              style={{
                backgroundImage: `url(${curatedUrl})`,
                backgroundPosition: 'center bottom',
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
              }}
            />
          ) : frame ? (
            <span
              role="img"
              aria-label={target.name}
              style={{
                backgroundImage: `url(${ATLAS_IMAGE_URL})`,
                backgroundPosition: `-${frame.x}px -${frame.y}px`,
              }}
            />
          ) : (
            <span className="hunt-status__portrait-fallback">?</span>
          )}
        </div>
        <div>
          <h3>{target.name}</h3>
          <p>Nível {displayStats.level}</p>
          <small>{target.category}</small>
        </div>
      </div>
      <dl>
        <div>
          <dt>HP</dt>
          <dd>{displayStats.hp.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{displayStats.xp.toLocaleString('pt-BR')}</dd>
        </div>
        <div>
          <dt>Respawn</dt>
          <dd>5s</dd>
        </div>
      </dl>
      <p className="hunt-status__automation">Busca, combate, jutsus e coleta automáticos</p>
    </section>
  );
}
