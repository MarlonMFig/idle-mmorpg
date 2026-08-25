/**
 * Design System resource / progress bars.
 * Wraps the same contract as hud/ResourceBar and extends variants —
 * does not replace the Hunt HUD implementation (migration later).
 */

export type ResourceBarVariant = 'hp' | 'energy' | 'xp' | 'boss' | 'progress';

export interface ResourceBarProps {
  label: string;
  value: number;
  max: number;
  variant?: ResourceBarVariant;
  className?: string;
  /** Hide numeric readout when only the fill matters. */
  showValues?: boolean;
}

export function ResourceBar({
  label,
  value,
  max,
  variant = 'progress',
  className = '',
  showValues = true,
}: ResourceBarProps) {
  const safeMax = Math.max(1, max);
  const ratio = Math.max(0, Math.min(1, value / safeMax));
  const percent = Math.round(ratio * 100);

  return (
    <div className={['aiw-bar', `aiw-bar--${variant}`, className].filter(Boolean).join(' ')}>
      <div className="aiw-bar__meta">
        <span className="aiw-bar__label">{label}</span>
        {showValues ? (
          <span className="aiw-bar__values aiw-nums">
            {value}/{max}
          </span>
        ) : null}
      </div>
      <div
        className="aiw-bar__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className="aiw-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Alias for generic progress usage. */
export function ProgressBar(props: Omit<ResourceBarProps, 'variant'> & { variant?: 'progress' }) {
  return <ResourceBar {...props} variant={props.variant ?? 'progress'} />;
}
