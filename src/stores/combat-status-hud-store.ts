import { createStore } from '@/stores/create-store';

export interface CombatStatusHudIcon {
  statusId: string;
  icon: string;
  stacks: number;
  remainingMs?: number;
}

export interface LabStatusDebugRow {
  instanceId: string;
  name: string;
  statusId: string;
  stacks: number;
  remainingMs: number;
  nextTickMs: number | null;
  targetId: string;
}

interface CombatStatusHudState {
  playerIcons: CombatStatusHudIcon[];
  debug: LabStatusDebugRow[];
}

const store = createStore<CombatStatusHudState>({ playerIcons: [], debug: [] });

export const combatStatusHudStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,
  setPlayerIcons(playerIcons: CombatStatusHudIcon[]): void {
    const prev = store.getSnapshot();
    store.setState({ ...prev, playerIcons });
  },
  setDebug(debug: LabStatusDebugRow[]): void {
    const prev = store.getSnapshot();
    store.setState({ ...prev, debug });
  },
  clear(): void {
    store.setState({ playerIcons: [], debug: [] });
  },
};
