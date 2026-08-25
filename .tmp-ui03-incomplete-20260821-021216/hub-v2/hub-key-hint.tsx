'use client';

export interface HubKeyHintProps {
  keys: string | string[];
  label?: string;
  className?: string;
}

/** Consistent keyboard hint chrome (E, ESC, F8, …). */
export function HubKeyHint({ keys, label, className = '' }: HubKeyHintProps) {
  const list = Array.isArray(keys) ? keys : [keys];
  return (
    <span className={['hub-v2__keyhint', className].filter(Boolean).join(' ')}>
      {list.map((key) => (
        <kbd key={key} className="hub-v2__kbd">
          {key}
        </kbd>
      ))}
      {label ? <span className="hub-v2__keyhint-label">{label}</span> : null}
    </span>
  );
}
