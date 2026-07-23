'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { STARTERS } from '@/data/starters';
import { getVillage, VILLAGES } from '@/data/villages';
import type {
  PlayerCreation,
  StarterCharacterId,
  VillageId,
} from '@/types/player-creation';
import { VillageIcon } from '@/ui/new-game/village-icon';

interface NewGameScreenProps {
  onCreatePlayer: (player: PlayerCreation) => void;
}

export function NewGameScreen({ onCreatePlayer }: NewGameScreenProps) {
  const [nickname, setNickname] = useState('');
  const [villageId, setVillageId] = useState<VillageId>('konoha');
  const [starterCharacterId, setStarterCharacterId] =
    useState<StarterCharacterId | null>(null);

  const village = useMemo(() => getVillage(villageId), [villageId]);
  const starter = useMemo(
    () => STARTERS.find((entry) => entry.id === starterCharacterId) ?? null,
    [starterCharacterId],
  );

  const trimmed = nickname.trim();
  const canStart = trimmed.length >= 2 && starterCharacterId != null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canStart || starterCharacterId == null) return;

    onCreatePlayer({
      nickname: trimmed,
      villageId,
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
        <legend className="new-game__label">Escolha sua vila ninja de origem:</legend>
        <div
          className="new-game__options new-game__options--villages"
          role="radiogroup"
          aria-label="Vila de origem"
        >
          {VILLAGES.map((entry) => {
            const selected = villageId === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="radio"
                className={`new-game__option new-game__option--village${selected ? ' is-selected' : ''}`}
                style={{ ['--option-accent' as string]: entry.accent }}
                aria-checked={selected}
                onClick={() => setVillageId(entry.id)}
              >
                {selected ? <span className="new-game__check" aria-hidden /> : null}
                <VillageIcon kind={entry.icon} className="new-game__option-icon" />
                <span className="new-game__option-name">{entry.fullName}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <aside className="new-game__detail" aria-live="polite">
        <div className="new-game__detail-head">
          <p className="new-game__detail-title">{village.passiveTitle}</p>
          <span className="new-game__detail-tag">{village.elementsLabel}</span>
        </div>
        <p className="new-game__detail-bonus">{village.passiveBonus}</p>
        <p className="new-game__detail-lore">{village.lore}</p>
        <p className="new-game__detail-loot">
          <span className="new-game__detail-star" aria-hidden />
          Você receberá: {village.startingItems}
        </p>
      </aside>

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
                <span
                  className="new-game__starter-badge"
                  style={{ background: entry.accent }}
                  aria-hidden
                >
                  {entry.name.slice(0, 1)}
                </span>
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
