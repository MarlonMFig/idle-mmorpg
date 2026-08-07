'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { STARTERS } from '@/data/starters';
import type {
  PlayerCreation,
  StarterCharacterId,
  VillageId,
} from '@/types/player-creation';

const DEFAULT_VILLAGE: VillageId = 'konoha';

interface NewGameScreenProps {
  onCreatePlayer: (player: PlayerCreation) => void;
}

export function NewGameScreen({ onCreatePlayer }: NewGameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [starterCharacterId, setStarterCharacterId] =
    useState<StarterCharacterId>('naruto-classic');

  const starter = useMemo(
    () => STARTERS.find((entry) => entry.id === starterCharacterId) ?? STARTERS[0],
    [starterCharacterId],
  );

  const trimmed = nickname.trim();
  const canStart = trimmed.length >= 2 && starterCharacterId != null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart) return;

    onCreatePlayer({
      nickname: trimmed,
      villageId: DEFAULT_VILLAGE,
      starterCharacterId,
    });
  }

  return (
    <form className="new-game" onSubmit={handleSubmit}>
      <header className="new-game__brand">
        <span className="new-game__logo" aria-hidden>
          <span className="new-game__logo-mark" />
        </span>
        <h1 className="new-game__title">Ninja Idle RPG</h1>
        <p className="new-game__lede">Crie sua lenda no universo shinobi</p>
      </header>

      <label className="new-game__field">
        <span className="new-game__label">Como deseja ser chamado?</span>
        <input
          className="new-game__input"
          type="text"
          name="nickname"
          autoComplete="username"
          maxLength={16}
          placeholder="Ex: NarutoUchiha, GeninBr, etc..."
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
        />
      </label>

      <fieldset className="new-game__fieldset">
        <legend className="new-game__label">Escolha seu personagem inicial:</legend>
        <div
          className="new-game__options new-game__options--starters"
          role="radiogroup"
          aria-label="Personagem inicial"
        >
          {STARTERS.map((entry) => {
            const selected = starterCharacterId === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                className={`new-game__option new-game__option--starter${selected ? ' is-selected' : ''}`}
                style={{ ['--option-accent' as string]: entry.accent }}
                aria-checked={selected}
                onClick={() => setStarterCharacterId(entry.id)}
              >
                {selected ? <span className="new-game__check" aria-hidden /> : null}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="new-game__starter-preview"
                  src={entry.previewUrl}
                  alt=""
                  width={48}
                  height={58}
                  draggable={false}
                />
                <span className="new-game__option-copy">
                  <span className="new-game__option-name">{entry.name}</span>
                  <span className="new-game__option-meta">{entry.epithet}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {starter ? (
        <p className="new-game__starter-blurb" aria-live="polite">
          {starter.blurb}
        </p>
      ) : null}

      <button className="new-game__cta" type="submit" disabled={!canStart}>
        <span className="new-game__cta-icon" aria-hidden />
        Iniciar jornada shinobi
        <span className="new-game__cta-icon" aria-hidden />
      </button>
    </form>
  );
}
