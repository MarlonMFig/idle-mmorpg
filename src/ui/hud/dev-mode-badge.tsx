'use client';

import {
  isDevMode,
  isDevLabSessionActive,
  listActiveDevOverrides,
  getXpMultiplier,
  getEnemyHpMultiplier,
} from '@/config/devConfig';
import { characterLabStore } from '@/stores/character-lab-store';
import { useStore } from '@/hooks/use-store';

/** Indicador DEV — Lab / overrides / save isolado. Sem redesign. */
export function DevModeBadge() {
  const labOpen = useStore(characterLabStore, (s) => s.isOpen);
  if (!isDevMode()) return null;

  const overrides = labOpen ? listActiveDevOverrides() : [];
  const label = labOpen
    ? overrides.length > 0
      ? `DEV OVERRIDES ACTIVE (${overrides.length})`
      : 'DEV SAVE'
    : 'DEV LAB';

  const title = labOpen
    ? [
        'Character Test Lab aberto — save oficial isolado',
        `XP ×${getXpMultiplier()} · Enemy HP ×${getEnemyHpMultiplier()}`,
        ...overrides,
      ].join('\n')
    : 'Character Test Lab (F8)';

  return (
    <button
      type="button"
      className="dev-mode-badge"
      aria-label={label}
      title={title}
      onClick={() => characterLabStore.toggle()}
    >
      {label}
      {isDevLabSessionActive() ? ' · ISOLATED' : ''}
    </button>
  );
}
