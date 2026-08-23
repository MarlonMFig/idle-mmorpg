import { isDevEnvironment } from '@/config/devConfig';

/** File write /api/dev — só NODE_ENV=development (não depende de flags de combate). */
export function isDevWriteAllowed(): boolean {
  return isDevEnvironment();
}

export function assertDevWriteAllowed(action = 'dev write'): void {
  if (!isDevWriteAllowed()) {
    throw new Error(`[DEV] Bloqueado em produção: ${action}`);
  }
}
