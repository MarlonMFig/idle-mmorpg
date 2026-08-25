import { formatStat } from '@/lib/format-stat';
import { d } from '@/lib/decimal';
import type { Decimal } from '@/lib/decimal';

interface ResourceBarProps {
  label: string;
  value: number | Decimal;
  max: number | Decimal;
  variant: 'hp' | 'xp' | 'energy';
}

export function ResourceBar({ label, value, max, variant }: ResourceBarProps) {
  const maxDec = d(max);
  const valueDec = d(value);
  const safeMax = maxDec.lte(0) ? d(1) : maxDec;
  const ratio = valueDec.div(safeMax).toNumber();
  const percent = Math.round(Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100);

  return (
    <div className={`hud-bar hud-bar--${variant}`}>
      <div className="hud-bar__meta">
        <span className="hud-bar__label">{label}</span>
        <span className="hud-bar__values">
          {formatStat(valueDec)}/{formatStat(safeMax)}
        </span>
      </div>
      <div
        className="hud-bar__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="hud-bar__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
