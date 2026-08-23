import { saveLog } from '@/lib/dev/save-log';

/** Medição DEV do save. Não faz parte da transação HTTP. */
export class SaveClock {
  private readonly started = Date.now();

  mark(label: string): number {
    const elapsed = Date.now() - this.started;
    saveLog(`${label}: ${elapsed}ms`);
    return elapsed;
  }

  done(): number {
    const elapsed = Date.now() - this.started;
    saveLog(`completed in ${elapsed}ms`);
    return elapsed;
  }
}
