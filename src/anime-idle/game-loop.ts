import { setCurrentZone, simulateElapsed, tickState } from './progression';
import { loadState, saveState } from './save';
import type { GameState, ReturnSummary } from './types';

export type LoopSpeed = 1 | 100 | 10000;

export class GameLoop {
  private state: GameState;
  private speed: LoopSpeed = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastSummary: ReturnSummary | null = null;
  private listeners = new Set<(state: GameState, summary: ReturnSummary | null) => void>();

  constructor(state?: GameState) {
    this.state = state ?? loadState();
  }

  getState(): GameState {
    return this.state;
  }

  getSpeed(): LoopSpeed {
    return this.speed;
  }

  getLastSummary(): ReturnSummary | null {
    return this.lastSummary;
  }

  subscribe(listener: (state: GameState, summary: ReturnSummary | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.state, this.lastSummary);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.state, this.lastSummary);
  }

  setState(state: GameState): void {
    this.state = state;
    saveState(this.state);
    this.emit();
  }

  setSpeed(speed: LoopSpeed): void {
    this.speed = speed;
    this.emit();
  }

  start(): void {
    if (this.timer) return;
    const resumed = tickState(this.state);
    this.state = resumed.state;
    if (resumed.summary.absentSeconds > 2) this.lastSummary = resumed.summary;
    saveState(this.state);
    this.emit();
    this.timer = setInterval(() => this.pulse(), 250);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    saveState(this.state);
  }

  private pulse(): void {
    const now = Date.now();
    const realDt = Math.max(0, (now - this.state.lastTickAt) / 1000);
    const { state, summary } = simulateElapsed(this.state, realDt * this.speed);
    this.state = { ...state, lastTickAt: now };
    if (summary.absentSeconds > 2 && summary.xpTotal.gt(0)) this.lastSummary = summary;
    saveState(this.state);
    this.emit();
  }

  skipHours(hours: number): ReturnSummary {
    const { state, summary } = simulateElapsed(this.state, Math.max(0, hours) * 3600);
    this.state = { ...state, lastTickAt: Date.now(), lastReturnAt: Date.now() };
    this.lastSummary = summary;
    saveState(this.state);
    this.emit();
    return summary;
  }

  setZone(zoneId: string): void {
    this.setState({ ...setCurrentZone(this.state, zoneId), lastTickAt: Date.now() });
  }
}
