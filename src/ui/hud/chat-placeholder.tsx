'use client';

import { useCallback, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useStore } from '@/hooks/use-store';
import { systemLogStore } from '@/lib/system-log';
import { multiplayerStore } from '@/stores/multiplayer-store';

/**
 * Log de sistema + chat multiplayer (quando conectado).
 */
export function ChatPlaceholder() {
  const lines = useStore(systemLogStore, (s) => s.lines);
  const status = useStore(multiplayerStore, (s) => s.status);
  const [draft, setDraft] = useState('');
  const canSend = status === 'connected';

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || !canSend) return;
    if (multiplayerStore.sendChat(text)) {
      setDraft('');
    }
  }, [draft, canSend]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  };

  return (
    <section className="hud-panel hud-chat" aria-label="Chat">
      <header className="hud-panel__head">
        <h2 className="hud-panel__title">Chat</h2>
      </header>
      <div className="hud-chat__log" aria-live="polite">
        {lines.map((line, index) => (
          <p key={`${index}-${line}`} className="hud-chat__line">
            {line}
          </p>
        ))}
      </div>
      <form className="hud-chat__compose" onSubmit={onSubmit}>
        <input
          className="hud-chat__input"
          type="text"
          maxLength={120}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={canSend ? 'Mensagem…' : 'Conectando…'}
          disabled={!canSend}
          aria-disabled={!canSend}
        />
        <button className="hud-chat__send" type="submit" disabled={!canSend || !draft.trim()}>
          Enviar
        </button>
      </form>
    </section>
  );
}
