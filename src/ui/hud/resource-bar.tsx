interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  variant: 'hp' | 'xp' | 'energy';
}

export function ResourceBar({ label, value, max, variant }: ResourceBarProps) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const percent = Math.round(ratio * 100);

  return (
    <div className={`hud-bar hud-bar--${variant}`}>
      <div className="hud-bar__meta">
        <span className="hud-bar__label">{label}</span>
        <span className="hud-bar__values">
          {value}/{max}
        </span>
      </div>
      <div
        className="hud-bar__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="hud-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
