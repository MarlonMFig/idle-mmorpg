/** Logs compactos do save DEV. Não logar payloads. */
export function saveLog(step: string, extra?: string): void {
  if (process.env.NODE_ENV === 'production') return;
  console.info(`[SAVE] ${step}${extra ? ` ${extra}` : ''}`);
}
