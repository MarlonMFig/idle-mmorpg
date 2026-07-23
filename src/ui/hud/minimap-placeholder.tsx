export function MinimapPlaceholder() {
  return (
    <section className="hud-panel hud-minimap" aria-label="Minimapa">
      <header className="hud-panel__head">
        <h2 className="hud-panel__title">Mapa</h2>
      </header>
      <div className="hud-minimap__canvas" aria-hidden="true">
        <span className="hud-minimap__marker" />
        <span className="hud-minimap__hint">Minimapa</span>
      </div>
    </section>
  );
}
