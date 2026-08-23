'use client';

import { useEffect, useMemo, useState } from 'react';
import { applyForcedHuntLevels } from '@/constants/combat';
import { useStore } from '@/hooks/use-store';
import { useVitalsStore } from '@/hooks/use-vitals-store';
import { huntStore } from '@/stores/hunt-store';
import { locationStore } from '@/stores/location-store';
import type {
  HuntCatalog,
  HuntDefinition,
  HuntSelectorTab,
  PhaserAtlasData,
  PhaserAtlasFrame,
} from '@/types/hunt';
import { getCuratedPortraitUrl } from '@/data/curated-map-sprites';

const HUNTS_URL = '/data/wonsr/hunts.json?v=wonsr-10maps';
const ATLAS_URL = '/sprites/wonsr-hunts/characters.json';
const ATLAS_IMAGE_URL = '/sprites/wonsr-hunts/characters.png';

interface CharacterSpriteProps {
  lookType: number;
  frame?: PhaserAtlasFrame;
  name: string;
}

function CharacterSprite({ lookType, frame, name }: CharacterSpriteProps) {
  const curatedUrl = getCuratedPortraitUrl(lookType);
  if (curatedUrl) {
    return (
      <span
        className="hunt-selector__sprite hunt-selector__sprite--curated"
        role="img"
        aria-label={name}
        title={name}
        style={{
          backgroundImage: `url(${curatedUrl})`,
          backgroundPosition: 'center bottom',
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
        }}
      />
    );
  }
  if (frame) {
    return (
      <span
        className="hunt-selector__sprite"
        role="img"
        aria-label={name}
        title={`${name} · lookType ${lookType}`}
        style={{
          backgroundImage: `url(${ATLAS_IMAGE_URL})`,
          backgroundPosition: `-${frame.frame.x}px -${frame.frame.y}px`,
        }}
      />
    );
  }
  return (
    <span
      className="hunt-selector__sprite hunt-selector__sprite--outfit"
      role="img"
      aria-label={name}
      title={`${name} · lookType ${lookType}`}
      style={{
        backgroundImage: `url(/sprites/wonsr/outfits/${lookType}.png)`,
        backgroundPosition: 'center bottom',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

export function HuntSelector() {
  const open = useStore(huntStore, (state) => state.open);
  const { level } = useVitalsStore();
  const [catalog, setCatalog] = useState<HuntCatalog | null>(null);
  const [atlas, setAtlas] = useState<PhaserAtlasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  const [tab, setTab] = useState<HuntSelectorTab>('wonsr');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(HUNTS_URL).then((response) => {
        if (!response.ok) throw new Error(`Catálogo de caças: HTTP ${response.status}`);
        return response.json() as Promise<HuntCatalog>;
      }),
      fetch(ATLAS_URL).then((response) => {
        if (!response.ok) throw new Error(`Atlas de caças: HTTP ${response.status}`);
        return response.json() as Promise<PhaserAtlasData>;
      }),
    ])
      .then(([nextCatalog, nextAtlas]) => {
        if (cancelled) return;
        setCatalog(applyForcedHuntLevels(nextCatalog));
        setAtlas(nextAtlas);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Falha ao carregar caças');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Escape') huntStore.close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const huntsOnTab = useMemo(
    () =>
      catalog?.hunts.filter((hunt) => (hunt.tab ?? 'naruto') === tab) ?? [],
    [catalog, tab],
  );
  const unlockedCount = useMemo(
    () => huntsOnTab.filter((hunt) => level >= hunt.requiredLevel).length,
    [huntsOnTab, level],
  );
  const visibleHunts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return huntsOnTab.filter((hunt) => {
      if (onlyUnlocked && level < hunt.requiredLevel) return false;
      if (!normalizedQuery) return true;
      const target = hunt.targets[0];
      return `${hunt.name} ${target?.name ?? ''} ${target?.category ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery);
    });
  }, [huntsOnTab, level, onlyUnlocked, query]);
  const displayedHunts = useMemo(() => visibleHunts.slice(0, 120), [visibleHunts]);

  if (!open) return null;

  function enterHunt(hunt: HuntDefinition): void {
    if (level < hunt.requiredLevel) return;
    huntStore.close();
    locationStore.enterCombat(hunt.mapKey, hunt.id);
  }

  return (
    <div className="hunt-selector" role="dialog" aria-modal="true" aria-label="Selecionar caça">
      <div className="hunt-selector__backdrop" onClick={() => huntStore.close()} />
      <section className="hunt-selector__panel">
        <header className="hunt-selector__header">
          <div>
            <p className="hunt-selector__eyebrow">Mapa-múndi</p>
            <h2>
              {tab === 'wonsr' ? 'WONSR' : tab === 'bosses' ? 'Bosses' : 'Mapa Naruto World'}
            </h2>
            <p>
              Seu nível: <strong>{level}</strong> · {unlockedCount}/{huntsOnTab.length || '—'} mapas
              liberados · um personagem por mapa
            </p>
          </div>
          <button type="button" className="hunt-selector__close" onClick={() => huntStore.close()}>
            ×
          </button>
        </header>

        {error ? <p className="hunt-selector__status">{error}</p> : null}
        {!catalog && !error ? <p className="hunt-selector__status">Carregando caças…</p> : null}

        <div className="hunt-selector__tabs" role="tablist" aria-label="Universo das caças">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'naruto'}
            className={`hunt-selector__tab${tab === 'naruto' ? ' hunt-selector__tab--active' : ''}`}
            onClick={() => setTab('naruto')}
          >
            Naruto World
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'wonsr'}
            className={`hunt-selector__tab${tab === 'wonsr' ? ' hunt-selector__tab--active' : ''}`}
            onClick={() => setTab('wonsr')}
          >
            WONSR
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'bosses'}
            className={`hunt-selector__tab${tab === 'bosses' ? ' hunt-selector__tab--active' : ''}`}
            onClick={() => setTab('bosses')}
          >
            Bosses
          </button>
        </div>

        <div className="hunt-selector__filters">
          <label>
            <span>Buscar personagem</span>
            <input
              type="search"
              value={query}
              placeholder="Naruto, Kurama, Gyuki…"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="hunt-selector__unlocked">
            <input
              type="checkbox"
              checked={onlyUnlocked}
              onChange={(event) => setOnlyUnlocked(event.target.checked)}
            />
            Somente liberados
          </label>
          <span>
            {visibleHunts.length} mapas encontrados
            {visibleHunts.length > displayedHunts.length ? ' · refine a busca' : ''}
          </span>
        </div>

        <div className="hunt-selector__map">
          {displayedHunts.map((hunt) => {
            const locked = level < hunt.requiredLevel;
            const target = hunt.targets[0];
            if (!target) return null;
            return (
              <article
                key={hunt.id}
                className={`hunt-selector__node${locked ? ' hunt-selector__node--locked' : ''}`}
              >
                <div className="hunt-selector__node-portrait" aria-hidden="true">
                  <CharacterSprite
                    lookType={target.lookType}
                    name={target.name}
                    frame={atlas?.frames[`look-${target.lookType}`]}
                  />
                </div>
                <div className="hunt-selector__node-body">
                  <h3>{target.name}</h3>
                  <span className="hunt-selector__level">Nv {hunt.requiredLevel}</span>
                  <p>{target.category}</p>
                </div>
                <button type="button" disabled={locked} onClick={() => enterHunt(hunt)}>
                  {locked ? `Nível ${hunt.requiredLevel}` : 'Caçar'}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
