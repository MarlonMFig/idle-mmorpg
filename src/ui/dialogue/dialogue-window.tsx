'use client';

import { useEffect } from 'react';
import { getQuest } from '@/data/quests';
import { useDialogueStore } from '@/hooks/use-dialogue-store';
import { dialogueStore } from '@/stores/dialogue-store';

/**
 * Janela de conversa — páginas, retrato e ações de missão.
 */
export function DialogueWindow() {
  const { session } = useDialogueStore();

  useEffect(() => {
    if (!session) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const last = session.pageIndex >= session.pages.length - 1;
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        if (last && session.questAction) {
          dialogueStore.resolveQuestAction();
        } else {
          dialogueStore.continue();
        }
      }
      if (event.code === 'Escape') {
        dialogueStore.close();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);

  if (!session) return null;

  const page = session.pages[session.pageIndex];
  const isLast = session.pageIndex >= session.pages.length - 1;
  const pageLabel = `${session.pageIndex + 1}/${session.pages.length}`;
  const quest = session.questHook?.questId ? getQuest(session.questHook.questId) : undefined;
  const actionLabel =
    session.questAction?.type === 'accept'
      ? 'Aceitar missão'
      : session.questAction?.type === 'turnIn'
        ? 'Entregar missão'
        : null;

  return (
    <div
      className="dialogue-root"
      role="dialog"
      aria-modal="true"
      aria-label="Diálogo"
      data-quest-id={session.questHook?.questId}
    >
      <div className="dialogue-window">
        <div className="dialogue-window__portrait">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={session.portraitUrl} alt="" width={96} height={96} />
        </div>

        <div className="dialogue-window__body">
          <header className="dialogue-window__head">
            <h2 className="dialogue-window__name">{session.npcName}</h2>
            <span className="dialogue-window__page">{pageLabel}</span>
          </header>

          {quest ? <p className="dialogue-window__quest">{quest.name}</p> : null}

          <p className="dialogue-window__text">{page?.text}</p>

          <div className="dialogue-window__actions">
            {isLast && actionLabel ? (
              <>
                <button
                  type="button"
                  className="dialogue-window__continue"
                  onClick={() => dialogueStore.resolveQuestAction()}
                >
                  {actionLabel}
                </button>
                <button
                  type="button"
                  className="dialogue-window__secondary"
                  onClick={() => dialogueStore.close()}
                >
                  Agora não
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dialogue-window__continue"
                onClick={() => dialogueStore.continue()}
              >
                {isLast ? 'Fechar' : 'Continuar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
