import type { VillageIconKind } from '@/data/villages';

interface VillageIconProps {
  kind: VillageIconKind;
  className?: string;
}

/** Ícones simples das cinco grandes vilas (criação de personagem). */
export function VillageIcon({ kind, className }: VillageIconProps) {
  switch (kind) {
    case 'leaf':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden>
          <path
            fill="currentColor"
            d="M20 4c-1 8-8 12-12 18 6 2 10 6 12 14 2-8 6-12 12-14-4-6-11-10-12-18z"
          />
          <path fill="currentColor" opacity="0.55" d="M20 10v20M14 18c4 2 8 2 12 0" />
        </svg>
      );
    case 'sand':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden>
          <path
            fill="currentColor"
            d="M12 8h16l-6 10 6 10H12l6-10-6-10zm8 4.5L15.5 18 20 23.5 24.5 18 20 12.5z"
          />
        </svg>
      );
    case 'mist':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden>
          <rect x="8" y="10" width="24" height="4" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="6" y="18" width="28" height="4" rx="2" fill="currentColor" opacity="0.65" />
          <rect x="10" y="26" width="20" height="4" rx="2" fill="currentColor" opacity="0.4" />
        </svg>
      );
    case 'cloud':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden>
          <path
            fill="currentColor"
            d="M22 6 12 20h7l-3 14 14-16h-8l6-12z"
          />
        </svg>
      );
    case 'stone':
      return (
        <svg className={className} viewBox="0 0 40 40" aria-hidden>
          <path
            fill="currentColor"
            d="M8 26 14 10h12l6 16-4 6H12l-4-6zm8-12 2 8h4l2-8h-8z"
          />
        </svg>
      );
  }
}
