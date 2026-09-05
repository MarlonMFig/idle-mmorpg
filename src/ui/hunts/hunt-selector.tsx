'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { applyForcedHuntLevels } from '@/constants/combat';
import { isDevMode } from '@/config/devConfig';
import { useStore } from '@/hooks/use-store';
import { useVitalsStore } from '@/hooks/use-vitals-store';
import { bossStore } from '@/stores/boss-store';
import { huntStore } from '@/stores/hunt-store';
import { locationStore } from '@/stores/location-store';
import { teamStore } from '@/stores/team-store';
import type {
  HuntCatalog,
  HuntDefinition,
  HuntSelectorTab,
  PhaserAtlasData,
  PhaserAtlasFrame,
} from '@/types/hunt';
import { getCuratedPortraitUrl } from '@/data/curated-map-sprites';
import {
  buildHuntMapPins,
  HUNT_LEVEL_FILTERS,
  HUNT_WORLD_REGIONS,
  matchesHuntLevelFilter,
  type HuntLevelFilter,
} from '@/ui/hunts/hunt-world-map';

const HUNTS_URL = '/data/wonsr/hunts.json?v=worldmap1';
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
  const collection = useStore(teamStore, (state) => state.collection);
  const defeatedBosses = useStore(bossStore, (state) => state.defeatedBosses);
  const { level } = useVitalsStore();
  const [catalog, setCatalog] = useState<HuntCatalog | null>(null);
  const [atlas, setAtlas] = useState<PhaserAtlasData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyUnlocked, setOnlyUnlocked] = useState(false);
  const [levelFilter, setLevelFilter] = useState<HuntLevelFilter>('all');
  const [tab, setTab] = useState<HuntSelectorTab>('naruto-topdown');
  const worldRef = useRef<HTMLDivElement | null>(null);
  const allHuntsUnlocked = isDevMode();

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
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : 'Falha ao carregar caças');
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
    () => catalog?.hunts.filter((hunt) => hunt.tab === tab) ?? [],
    [catalog, tab],
  );

  const capturedLookTypes = useMemo(() => {
    const set = new Set<number>();
    for (const member of collection) set.add(member.lookType);
    return set;
  }, [collection]);

  const visibleHunts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');
    return huntsOnTab.filter((hunt) => {
      if (onlyUnlocked && !allHuntsUnlocked && level < hunt.requiredLevel) return false;
      if (!matchesHuntLevelFilter(hunt.requiredLevel, levelFilter)) return false;
      if (!normalizedQuery) return true;
      const target = hunt.targets[0];
      return `${hunt.name} ${target?.name ?? ''} ${target?.category ?? ''}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery);
    });
  }, [allHuntsUnlocked, huntsOnTab, level, levelFilter, onlyUnlocked, query]);

  const pins = useMemo(() => buildHuntMapPins(visibleHunts), [visibleHunts]);

  const regionsOnMap = useMemo(() => {
    const used = new Set(pins.map((pin) => pin.region.id));
    const listed = HUNT_WORLD_REGIONS.filter((region) => used.has(region.id));
    if (listed.length) return listed;
    return HUNT_WORLD_REGIONS.slice(0, 4);
  }, [pins]);

  const unlockedCount = useMemo(
    () => huntsOnTab.filter((hunt) => allHuntsUnlocked || level >= hunt.requiredLevel).length,
    [allHuntsUnlocked, huntsOnTab, level],
  );

  const capturedCharacters = useMemo(() => {
    const unique = new Set(
      huntsOnTab
        .map((hunt) => hunt.targets[0]?.lookType)
        .filter((lookType): lookType is number => typeof lookType === 'number')
        .filter((lookType) => capturedLookTypes.has(lookType)),
    );
    return unique.size;
  }, [capturedLookTypes, huntsOnTab]);

  const completedAreas = useMemo(() => {
    const mapKeys = new Set(huntsOnTab.map((hunt) => hunt.mapKey));
    let done = 0;
    for (const mapKey of mapKeys) {
      const hunts = huntsOnTab.filter((hunt) => hunt.mapKey === mapKey);
      if (
        hunts.length > 0 &&
        hunts.every((hunt) => {
          const lookType = hunt.targets[0]?.lookType;
          return typeof lookType === 'number' && capturedLookTypes.has(lookType);
        })
      ) {
        done += 1;
      }
    }
    return { done, total: mapKeys.size };
  }, [capturedLookTypes, huntsOnTab]);

  const bossStats = useMemo(() => {
    const bossHunts = catalog?.hunts.filter((hunt) => hunt.tab === 'bosses') ?? [];
    const defeated = Object.values(defeatedBosses).filter(Boolean).length;
    return { defeated, total: Math.max(bossHunts.length, defeated) };
  }, [catalog, defeatedBosses]);

  if (!open) return null;

  function enterHunt(hunt: HuntDefinition): void {
    if (!allHuntsUnlocked && level < hunt.requiredLevel) return;
    huntStore.close();
    locationStore.enterCombat(hunt.mapKey, hunt.id);
  }

  function scrollWorld(direction: -1 | 1): void {
    const node = worldRef.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(280, node.clientWidth * 0.55), behavior: 'smooth' });
  }

  const title = tab === 'bosses' ? 'Bosses' : 'Top down';

  return (
    <div className="hunt-selector" role="dialog" aria-modal="true" aria-label="Selecionar caça">
      <div className="hunt-selector__backdrop" onClick={() => huntStore.close()} />
      <section className="hunt-selector__panel hunt-selector__panel--world">
        <header className="hunt-selector__header">
          <div>
            <p className="hunt-selector__eyebrow">Mapa de caça</p>
            <h2>{title}</h2>
            <p>
              {visibleHunts.length} personagens encontrados · nível{' '}
              <strong>{level}</strong>
              {allHuntsUnlocked ? ' (modo local)' : ''} · {unlockedCount}/{huntsOnTab.length || '—'}{' '}
              liberados
            </p>
          </div>
          <button type="button" className="hunt-selector__close" onClick={() => huntStore.close()}>
            ×
          </button>
        </header>

        <div className="hunt-selector__tabs" role="tablist" aria-label="Universo das caças">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'naruto-topdown'}
            className={`hunt-selector__tab${tab === 'naruto-topdown' ? ' hunt-selector__tab--active' : ''}`}
            onClick={() => setTab('naruto-topdown')}
          >
            Top down
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

        <div className="hunt-selector__toolbar">
          <label>
            <span>Buscar personagem</span>
            <input
              type="search"
              value={query}
              placeholder="Naruto, Neji, Gaara…"
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
        </div>

        {error ? <p className="hunt-selector__status">{error}</p> : null}
        {!catalog && !error ? <p className="hunt-selector__status">Carregando caças…</p> : null}

        <div className="hunt-selector__stage">
          <div className="hunt-selector__world-shell">
            <button
              type="button"
              className="hunt-selector__nav hunt-selector__nav--left"
              aria-label="Rolar mapa para a esquerda"
              onClick={() => scrollWorld(-1)}
            >
              ‹
            </button>
            <div className="hunt-selector__world" ref={worldRef}>
              {regionsOnMap.map((region) => {
                const regionPins = pins.filter((pin) => pin.region.id === region.id);
                return (
                  <section
                    key={region.id}
                    className="hunt-selector__region"
                    style={{ backgroundImage: `url(${region.imageUrl})` }}
                    aria-label={region.label}
                  >
                    <div className="hunt-selector__region-veil" />
                    <header className="hunt-selector__region-label">
                      <strong>{region.label}</strong>
                      <span>{region.location}</span>
                    </header>
                    <div className="hunt-selector__pin-grid">
                      {regionPins.map((pin) => {
                        const locked = !allHuntsUnlocked && level < pin.hunt.requiredLevel;
                        const captured = capturedLookTypes.has(pin.target.lookType);
                        return (
                          <button
                            key={pin.hunt.id}
                            type="button"
                            className={[
                              'hunt-selector__pin',
                              locked ? 'hunt-selector__pin--locked' : '',
                              captured ? 'hunt-selector__pin--captured' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            style={{ ['--pin-accent' as string]: pin.difficulty.accent }}
                            disabled={locked}
                            onClick={() => enterHunt(pin.hunt)}
                            aria-label={`Caçar ${pin.target.name}, nível ${pin.hunt.requiredLevel}`}
                          >
                            <span className="hunt-selector__pin-portrait">
                              <CharacterSprite
                                lookType={pin.target.lookType}
                                name={pin.target.name}
                                frame={atlas?.frames[`look-${pin.target.lookType}`]}
                              />
                            </span>
                            <span className="hunt-selector__pin-card">
                              <strong>{pin.target.name}</strong>
                              <em>NV {pin.hunt.requiredLevel}</em>
                              <span
                                className={`hunt-selector__difficulty hunt-selector__difficulty--${pin.difficulty.id}`}
                              >
                                {pin.difficulty.label}
                              </span>
                            </span>
                            {captured ? (
                              <span className="hunt-selector__pin-check" aria-hidden="true">
                                ✓
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
            <button
              type="button"
              className="hunt-selector__nav hunt-selector__nav--right"
              aria-label="Rolar mapa para a direita"
              onClick={() => scrollWorld(1)}
            >
              ›
            </button>
          </div>
        </div>

        <footer className="hunt-selector__footer">
          <div className="hunt-selector__footer-stats">
            <div>
              <span aria-hidden="true">⛩️</span>
              <div>
                <strong>
                  {completedAreas.done} / {completedAreas.total || '—'}
                </strong>
                <em>Áreas concluídas</em>
              </div>
            </div>
            <div>
              <span aria-hidden="true">👤</span>
              <div>
                <strong>
                  {capturedCharacters} / {huntsOnTab.length || '—'}
                </strong>
                <em>Personagens capturados</em>
              </div>
            </div>
            <div>
              <span aria-hidden="true">☠️</span>
              <div>
                <strong>
                  {bossStats.defeated} / {bossStats.total || '—'}
                </strong>
                <em>Bosses derrotados</em>
              </div>
            </div>
          </div>
          <div className="hunt-selector__footer-filters" role="group" aria-label="Filtrar por nível">
            {HUNT_LEVEL_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={
                  levelFilter === filter.id ? 'hunt-selector__footer-filter--active' : undefined
                }
                onClick={() => setLevelFilter(filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </footer>
      </section>
    </div>
  );
}
