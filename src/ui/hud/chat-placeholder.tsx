'use client';

import { useStore } from '@/hooks/use-store';
import { systemLogStore } from '@/lib/system-log';

/**
 * Log de sistema (compras, selamentos, feedback de equipe).
 */
export function ChatPlaceholder() {
  const lines = useStore(systemLogStore, (s) => s.lines);

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
      <div className="hud-chat__compose">
        <input
          className="hud-chat__input"
          type="text"
          placeholder="Mensagem… (em breve)"
          disabled
          aria-disabled="true"
        />
        <button className="hud-chat__send" type="button" disabled>
          Enviar
        </button>
      </div>
    </section>
  );
}
