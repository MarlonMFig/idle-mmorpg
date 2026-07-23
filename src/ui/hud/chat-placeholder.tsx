const PLACEHOLDER_LINES = [
  '[Sistema] Bem-vindo à jornada.',
  '[Sistema] Chat em breve.',
] as const;

export function ChatPlaceholder() {
  return (
    <section className="hud-panel hud-chat" aria-label="Chat">
      <header className="hud-panel__head">
        <h2 className="hud-panel__title">Chat</h2>
      </header>
      <div className="hud-chat__log" aria-live="polite">
        {PLACEHOLDER_LINES.map((line) => (
          <p key={line} className="hud-chat__line">
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
