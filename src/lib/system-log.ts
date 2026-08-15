import { createStore } from '@/stores/create-store';

const MAX_LINES = 60;

export interface SystemLogState {
  lines: string[];
}

const store = createStore<SystemLogState>({
  lines: ['[Sistema] Bem-vindo à jornada.', '[Sistema] Chat pronto — digite abaixo.'],
});

export function emitSystemMessage(message: string): void {
  const line = message.startsWith('[') ? message : `[Sistema] ${message}`;
  const state = store.getSnapshot();
  const lines = [...state.lines, line].slice(-MAX_LINES);
  store.setState({ lines });
}

export function emitChatMessage(nickname: string, text: string): void {
  const safeNick = nickname.trim() || 'Shinobi';
  const safeText = text.trim();
  if (!safeText) return;
  emitSystemMessage(`[${safeNick}] ${safeText}`);
}

export const systemLogStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      lines: ['[Sistema] Bem-vindo à jornada.', '[Sistema] Chat pronto — digite abaixo.'],
    });
  },
};
