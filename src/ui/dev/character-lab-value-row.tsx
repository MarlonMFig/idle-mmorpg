'use client';

import { useEffect, useState } from 'react';

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function formatNum(value: number, step: number): string {
  if (step >= 1) return String(value);
  return String(roundTo(value, 2));
}

export function ValueRow({
  label,
  original,
  value,
  presets,
  step = 0.05,
  suffix = '',
  disabled = false,
  onChange,
}: {
  label: string;
  original: number;
  value: number;
  presets: number[];
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const dirty = value !== original;
  const digits = step >= 1 ? 0 : 2;
  const [draft, setDraft] = useState(formatNum(value, step));

  useEffect(() => {
    setDraft(formatNum(value, step));
  }, [value, step]);

  const commit = (raw: string) => {
    const parsed = Number(raw.replace(',', '.'));
    if (!Number.isFinite(parsed)) {
      setDraft(formatNum(value, step));
      return;
    }
    onChange(roundTo(parsed, digits));
  };

  return (
    <div className={`character-lab__value${dirty ? ' is-dirty' : ''}${disabled ? ' is-disabled' : ''}`}>
      <div className="character-lab__value-head">
        <span>{label}</span>
        <span>
          Original {formatNum(original, step)}
          {suffix}
          {' · '}
          Test {formatNum(value, step)}
          {suffix}
        </span>
      </div>
      <div className="character-lab__stepper">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Diminuir ${label}`}
          onClick={() => onChange(roundTo(value - step, digits))}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(roundTo(value + step, digits))}
        >
          +
        </button>
      </div>
      <div className="character-lab__chips">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={disabled}
            className={value === preset ? 'is-active' : undefined}
            onClick={() => onChange(preset)}
          >
            {preset > 0 && label.includes('Offset') ? `+${preset}` : String(preset)}
          </button>
        ))}
      </div>
    </div>
  );
}
