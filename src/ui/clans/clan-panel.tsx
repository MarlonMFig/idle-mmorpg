'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  CHARACTER_CLAN_LABELS,
  CLAN_SYSTEM_UNLOCK_LEVEL,
} from '@/constants/character-progression';
import { CLAN_CATALOG, getClanCatalogEntry } from '@/data/clans';
import { useStore } from '@/hooks/use-store';
import { accountStore } from '@/stores/account-store';
import { vitalsStore } from '@/stores/vitals-store';
import type { CharacterClanId } from '@/types/character-meta';

/**
 * Menu Clãs — lista + detalhe (abre pelo ícone Clã do hub).
 */
export function ClanPanel() {
  const isOpen = useStore(accountStore, (s) => s.isOpen);
  const memberClanId = useStore(accountStore, (s) => s.clanId);
  const level = useStore(vitalsStore, (s) => s.level);
  const unlocked = level >= CLAN_SYSTEM_UNLOCK_LEVEL;

  const [selectedId, setSelectedId] = useState<CharacterClanId>(
    memberClanId ?? CLAN_CATALOG[0].id,
  );

  useEffect(() => {
    if (!isOpen) return;
    if (memberClanId) setSelectedId(memberClanId);
  }, [isOpen, memberClanId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        event.preventDefault();
        accountStore.setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  const selected = getClanCatalogEntry(selectedId);
  const isMember = memberClanId === selected.id;
  const canJoin = unlocked && memberClanId == null;

  return (
    <div
      className="clan-mgr-overlay"
      role="presentation"
      onClick={() => accountStore.setOpen(false)}
    >
      <div
        className="clan-mgr"
        role="dialog"
        aria-modal="true"
        aria-label="Clãs"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="clan-mgr__top">
          <div className="clan-mgr__brand">
            <span className="clan-mgr__brand-icon" aria-hidden>
              🛡
            </span>
            <h2 className="clan-mgr__title">Clãs</h2>
          </div>
          <div className="clan-mgr__top-right">
            <span className="clan-mgr__level-chip" title="Nível de conta">
              Nv. {level}
            </span>
            <button
              type="button"
              className="clan-mgr__close"
              aria-label="Fechar clãs"
              onClick={() => accountStore.setOpen(false)}
            >
              ×
            </button>
          </div>
        </header>

        <div className="clan-mgr__body">
          <aside className="clan-mgr__list-pane" aria-label="Lista de clãs">
            <ul className="clan-mgr__list">
              {CLAN_CATALOG.map((clan) => {
                const isSel = clan.id === selectedId;
                const mine = clan.id === memberClanId;
                return (
                  <li key={clan.id}>
                    <button
                      type="button"
                      className={`clan-mgr__list-item${isSel ? ' is-selected' : ''}${mine ? ' is-member' : ''}`}
                      style={{ ['--clan' as string]: clan.color }}
                      onClick={() => setSelectedId(clan.id)}
                    >
                      <span className="clan-mgr__list-icon" aria-hidden>
                        <Image
                          src={clan.iconSrc}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                        />
                      </span>
                      <span className="clan-mgr__list-name">{clan.name}</span>
                      {mine ? <span className="clan-mgr__member-tag">VOCÊ</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="clan-mgr__detail" aria-label={`Detalhe ${selected.name}`}>
            <div
              className="clan-mgr__hero"
              style={{ ['--clan' as string]: selected.color }}
            >
              <span className="clan-mgr__hero-icon" aria-hidden>
                <Image
                  src={selected.iconSrc}
                  alt=""
                  width={96}
                  height={96}
                  unoptimized
                  priority
                />
              </span>
              <div className="clan-mgr__hero-text">
                <h3 className="clan-mgr__hero-name" style={{ color: selected.color }}>
                  {selected.name}
                </h3>
                <div className="clan-mgr__tags">
                  {selected.tags.map((tag) => (
                    <span
                      key={tag}
                      className="clan-mgr__tag"
                      style={{
                        borderColor: selected.color,
                        color: selected.color,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {!unlocked ? (
              <p className="clan-mgr__status clan-mgr__status--locked">
                Clãs liberam no nível {CLAN_SYSTEM_UNLOCK_LEVEL} (atual: {level}).
              </p>
            ) : isMember ? (
              <p className="clan-mgr__status clan-mgr__status--ok">
                Você é membro do Clã {CHARACTER_CLAN_LABELS[selected.id]}. Troca ainda não
                disponível.
              </p>
            ) : memberClanId ? (
              <p className="clan-mgr__status">
                Você já representa o Clã {CHARACTER_CLAN_LABELS[memberClanId]}.
              </p>
            ) : (
              <p className="clan-mgr__status clan-mgr__status--pick">
                Escolha este clã. A decisão é única por enquanto.
              </p>
            )}

            <p className="clan-mgr__blurb">{selected.blurb}</p>

            <div className="clan-mgr__bonus">
              <p className="clan-mgr__bonus-title">Bônus de combate</p>
              <p className="clan-mgr__bonus-text">
                Ainda não definido — a estrutura de clã está pronta; percentuais chegam em
                atualização futura.
              </p>
            </div>

            {canJoin ? (
              <button
                type="button"
                className="clan-mgr__join"
                style={{ ['--clan' as string]: selected.color }}
                onClick={() => accountStore.chooseClan(selected.id)}
              >
                Entrar no Clã {selected.name}
              </button>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
