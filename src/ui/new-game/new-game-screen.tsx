'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { RANDOM_NICKNAMES, STARTERS } from '@/data/starters';
import type {
  PlayerCreation,
  StarterCharacterId,
  VillageId,
} from '@/types/player-creation';

/** Vila padrão — seleção de vila removida da UI (modelo). */
const DEFAULT_VILLAGE: VillageId = 'konoha';

interface NewGameScreenProps {
  onCreatePlayer: (player: PlayerCreation) => void;
}

export function NewGameScreen({ onCreatePlayer }: NewGameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [starterCharacterId, setStarterCharacterId] =
    useState<StarterCharacterId>('naruto-classic');
  const [direction, setDirection] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const currentIndex = useMemo(
    () => Math.max(0, STARTERS.findIndex((entry) => entry.id === starterCharacterId)),
    [starterCharacterId],
  );

  const starter = STARTERS[currentIndex] ?? STARTERS[0];

  const selectByIndex = useCallback((index: number, dir: number) => {
    const next = STARTERS[index];
    if (!next) return;
    setDirection(dir);
    setStarterCharacterId(next.id);
  }, []);

  const goPrev = useCallback(() => {
    const nextIdx = (currentIndex - 1 + STARTERS.length) % STARTERS.length;
    selectByIndex(nextIdx, -1);
  }, [currentIndex, selectByIndex]);

  const goNext = useCallback(() => {
    const nextIdx = (currentIndex + 1) % STARTERS.length;
    selectByIndex(nextIdx, 1);
  }, [currentIndex, selectByIndex]);

  const handleRandomNickname = useCallback(() => {
    const base = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)] ?? 'Shinobi';
    const suffix = Math.floor(Math.random() * 90 + 10);
    setNickname(`${base}${suffix}`);
    setValidationError(null);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT') return;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goPrev, goNext]);

  const trimmed = nickname.trim();
  const canStart = trimmed.length >= 2;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (trimmed.length < 2) {
      setValidationError('Informe um nome shinobi com pelo menos 2 caracteres.');
      return;
    }
    setValidationError(null);
    onCreatePlayer({
      nickname: trimmed,
      villageId: DEFAULT_VILLAGE,
      starterCharacterId,
    });
  }

  return (
    <form
      className="new-game"
      onSubmit={handleSubmit}
      style={
        {
          ['--ng-accent' as string]: starter.accent,
          ['--ng-accent-soft' as string]: starter.accentSoft,
        } as CSSProperties
      }
    >
      <header className="new-game__header">
        <div className="new-game__header-copy">
          <span className="new-game__protocol">Seleção de personagem</span>
          <h1 className="new-game__title">Iniciar jornada</h1>
        </div>
        <div
          className="new-game__element-badge"
          aria-hidden
          title={starter.element}
        >
          <span>{starter.elementIcon}</span>
        </div>
      </header>

      <div className="new-game__field">
        <div className="new-game__field-row">
          <label className="new-game__label" htmlFor="player-name-input">
            Identificação do ninja
          </label>
          <button
            type="button"
            className="new-game__random"
            onClick={handleRandomNickname}
          >
            Nome aleatório
          </button>
        </div>
        <div className="new-game__input-wrap">
          <input
            id="player-name-input"
            className={`new-game__input${validationError ? ' is-invalid' : ''}`}
            type="text"
            name="nickname"
            autoComplete="username"
            maxLength={20}
            placeholder="Digite seu nome ninja..."
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              if (validationError) setValidationError(null);
            }}
          />
          {nickname.length > 0 ? (
            <span className="new-game__counter" aria-hidden>
              {nickname.length}/20
            </span>
          ) : null}
        </div>
        {validationError ? (
          <p className="new-game__error" role="alert">
            {validationError}
          </p>
        ) : null}
      </div>

      <section className="new-game__carousel" aria-label="Personagem inicial">
        <div className="new-game__carousel-meta">
          <span className="new-game__carousel-count">
            Agente {currentIndex + 1} de {STARTERS.length}
          </span>
          <span className="new-game__carousel-element">
            Elemento: <strong>{starter.element}</strong>
          </span>
        </div>

        <div className="new-game__stage">
          <button
            type="button"
            className="new-game__nav new-game__nav--prev"
            aria-label="Personagem anterior"
            onClick={goPrev}
          >
            ‹
          </button>

          <div
            key={`${starter.id}-${direction}`}
            className={`new-game__hero new-game__hero--dir-${direction >= 0 ? 'next' : 'prev'}`}
          >
            <div className="new-game__hero-ring">
              <div className="new-game__hero-glow" aria-hidden />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="new-game__hero-sprite"
                src={starter.previewUrl}
                alt=""
                width={160}
                height={192}
                draggable={false}
              />
            </div>
            <h2 className="new-game__hero-name">{starter.name}</h2>
            <p className="new-game__hero-epithet">{starter.epithet}</p>
          </div>

          <button
            type="button"
            className="new-game__nav new-game__nav--next"
            aria-label="Próximo personagem"
            onClick={goNext}
          >
            ›
          </button>
        </div>

        <div className="new-game__thumbs" role="radiogroup" aria-label="Roster inicial">
          {STARTERS.map((entry, index) => {
            const selected = entry.id === starterCharacterId;
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`new-game__thumb${selected ? ' is-selected' : ''}`}
                style={{ ['--thumb-accent' as string]: entry.accent }}
                onClick={() => selectByIndex(index, index > currentIndex ? 1 : -1)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.previewUrl}
                  alt=""
                  width={40}
                  height={48}
                  draggable={false}
                />
                <span>{entry.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <button className="new-game__cta" type="submit" disabled={!canStart}>
        <span className="new-game__cta-inner">
          <svg className="new-game__cta-sword" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.5 4.5l5 5M13 6l-8.5 8.5L3 21l6.5-1.5L18 11M9.5 14.5l2 2"
            />
          </svg>
          <span>Iniciar jornada</span>
          <svg className="new-game__cta-sword" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.5 4.5l5 5M13 6l-8.5 8.5L3 21l6.5-1.5L18 11M9.5 14.5l2 2"
            />
          </svg>
        </span>
      </button>

      <p className="new-game__hint">Navegue com as setas ← →</p>
    </form>
  );
}
