import { isDevMode } from '@/config/devConfig';
import { isCharacterLabSession } from '@/stores/character-lab-store';

type VfxLifecycleEvent =
  | 'spawn'
  | 'effect start'
  | 'arrival'
  | 'animation finished'
  | 'cleanup'
  | 'spawn failed';

/** Logs DEV reduzidos: Lab aberto, ou NODE_ENV development. */
export function logVfxLifecycle(
  event: VfxLifecycleEvent,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!isDevMode()) return;
  if (process.env.NODE_ENV === 'production' && !isCharacterLabSession()) return;
  const extra = detail
    ? Object.entries(detail)
        .filter(([, value]) => value != null && value !== '')
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')
    : '';
  console.debug(`[VFX] ${event}${extra ? ` ${extra}` : ''}`);
}
