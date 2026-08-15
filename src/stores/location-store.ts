import { MAP_KEYS, type MapKey } from '@/maps/map-registry';
import { createStore } from '@/stores/create-store';
import { huntAnalyzerStore } from '@/stores/hunt-analyzer-store';
import { vitalsStore } from '@/stores/vitals-store';

export type GameMode = 'hub' | 'combat';

export interface LocationState {
  mode: GameMode;
  mapKey: MapKey;
  /** Caça lógica selecionada; várias caças podem reutilizar o mesmo TMX. */
  huntId: string | null;
  /** Incrementa a cada viagem — GameScene reinicia ao mudar. */
  travelSeq: number;
  /** false até o primeiro create da sessão Phaser. */
  sessionStarted: boolean;
}

const store = createStore<LocationState>({
  mode: 'hub',
  mapKey: MAP_KEYS.leafVillage,
  huntId: null,
  travelSeq: 0,
  sessionStarted: false,
});

/**
 * Localização / modo (hub da vila vs mapa de combate).
 */
export const locationStore = {
  subscribe: store.subscribe,
  getSnapshot: store.getSnapshot,

  reset(): void {
    store.setState({
      mode: 'hub',
      mapKey: MAP_KEYS.leafVillage,
      huntId: null,
      travelSeq: 0,
      sessionStarted: false,
    });
  },

  /**
   * Restaura modo/mapa/caça após F5.
   * `sessionStarted: true` evita o GameScene re-resetar inventário/XP.
   */
  hydrate(location: {
    mode: GameMode;
    mapKey: MapKey;
    huntId: string | null;
  }): void {
    store.setState({
      mode: location.mode,
      mapKey: location.mapKey,
      huntId: location.huntId,
      travelSeq: 0,
      sessionStarted: true,
    });
    huntAnalyzerStore.onHuntChanged(location.huntId);
  },

  markSessionStarted(): void {
    const state = store.getSnapshot();
    if (state.sessionStarted) return;
    store.setState({ ...state, sessionStarted: true });
  },

  /** Alinha store com a cena atual sem disparar travel. */
  sync(mode: GameMode, mapKey: MapKey, huntId: string | null = null): void {
    const state = store.getSnapshot();
    store.setState({ ...state, mode, mapKey, huntId });
  },

  enterHub(): void {
    const state = store.getSnapshot();
    // Sem Revive na caça: Voltar ao hub recupera o personagem.
    if (vitalsStore.isDead()) {
      vitalsStore.healFull();
    }
    store.setState({
      ...state,
      mode: 'hub',
      mapKey: MAP_KEYS.leafVillage,
      huntId: null,
      travelSeq: state.travelSeq + 1,
      sessionStarted: true,
    });
  },

  enterCombat(mapKey: MapKey = MAP_KEYS.forest, huntId: string | null = null): void {
    const state = store.getSnapshot();
    huntAnalyzerStore.onHuntChanged(huntId);
    store.setState({
      ...state,
      mode: 'combat',
      mapKey,
      huntId,
      travelSeq: state.travelSeq + 1,
      sessionStarted: true,
    });
  },

  /**
   * Reinicia a GameScene sem mudar mapa/modo e sem resetar a sessão
   * (XP, inventário, progresso). Usado ao trocar o personagem ativo.
   */
  reloadScene(): void {
    const state = store.getSnapshot();
    store.setState({
      ...state,
      travelSeq: state.travelSeq + 1,
      sessionStarted: true,
    });
  },

  isHub(): boolean {
    return store.getSnapshot().mode === 'hub';
  },

  isCombat(): boolean {
    return store.getSnapshot().mode === 'combat';
  },
};
