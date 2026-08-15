/** Chaves e URLs dos mapas Tiled (.tmx). */
export const MAP_KEYS = {
  leafVillage: 'leafVillage',
  /** Hub ilustrado Konoha (PNG + colisão TMX). */
  leafVillageHub: 'leafVillageHub',
  /** Hub lateral interdimensional (PNG + colisão TMX). */
  hubInterdimensional: 'hubInterdimensional',
  forest: 'forest',
  /** Arena visual de clareira (fallback / legado). */
  huntForestClearing: 'huntForestClearing',
  huntArenaExameChunnin: 'huntArenaExameChunnin',
  /** Arena Exame Chunin (lateral 4K — MAPAS 3). */
  huntArenaExameChunin: 'huntArenaExameChunin',
  huntCampoTreinamento: 'huntCampoTreinamento',
  huntEsconderijoAkatsuki: 'huntEsconderijoAkatsuki',
  huntKonohaDestruida: 'huntKonohaDestruida',
  huntLabOrochimaru: 'huntLabOrochimaru',
  huntPaisDoVento: 'huntPaisDoVento',
  huntPontePaisOnda: 'huntPontePaisOnda',
  huntValeDoFim: 'huntValeDoFim',
  /** Teste: combate lateral 1v1 (Itachi → Rock Lee). */
  huntValeDoFimLateral: 'huntValeDoFimLateral',
  /** Teste: Vale do Fim em vídeo loop. */
  huntValeLoop: 'huntValeLoop',
  huntMonteMyoboku: 'huntMonteMyoboku',
  huntDistritoUchiha: 'huntDistritoUchiha',
  huntCampoGuerraNinja: 'huntCampoGuerraNinja',
  /** Arredores do Reino Clover (arena lateral Black Clover). */
  huntArredoresReinoClover: 'huntArredoresReinoClover',
  huntNamekusei: 'huntNamekusei',
  huntJogosCell: 'huntJogosCell',
  huntTorneioArtesMarciais: 'huntTorneioArtesMarciais',
  huntSalaDoTempo: 'huntSalaDoTempo',
  /** Deserto rochoso Saiyajin (lateral 4K). */
  huntDesertoSaiyajin: 'huntDesertoSaiyajin',
  academy: 'academy',
  wonsrKonoha: 'wonsrKonoha',
} as const;

export type MapKey = (typeof MAP_KEYS)[keyof typeof MAP_KEYS];

export const MAP_FILES: Record<MapKey, string> = {
  leafVillage: '/maps/leafVillage.tmx',
  leafVillageHub: '/maps/leaf-village-hub.tmx',
  hubInterdimensional: '/maps/hub-interdimensional.tmx',
  // Área de caça = recorte de floresta do WONSR (render PNG + colisão do TMX).
  forest: '/maps/wonsr-forest.tmx',
  huntForestClearing: '/maps/hunt-forest-clearing.tmx',
  huntArenaExameChunnin: '/maps/hunt-arena-exame-chunnin.tmx',
  huntArenaExameChunin: '/maps/hunt-arena-exame-chunin.tmx',
  huntCampoTreinamento: '/maps/hunt-campo-treinamento.tmx',
  huntEsconderijoAkatsuki: '/maps/hunt-esconderijo-akatsuki.tmx',
  huntKonohaDestruida: '/maps/hunt-konoha-destruida.tmx',
  huntLabOrochimaru: '/maps/hunt-lab-orochimaru.tmx',
  huntPaisDoVento: '/maps/hunt-pais-do-vento.tmx',
  huntPontePaisOnda: '/maps/hunt-ponte-pais-onda.tmx',
  huntValeDoFim: '/maps/hunt-vale-do-fim.tmx',
  huntValeDoFimLateral: '/maps/hunt-vale-do-fim-lateral.tmx',
  huntValeLoop: '/maps/hunt-vale-loop.tmx',
  huntMonteMyoboku: '/maps/hunt-monte-myoboku.tmx',
  huntDistritoUchiha: '/maps/hunt-distrito-uchiha.tmx',
  huntCampoGuerraNinja: '/maps/hunt-campo-guerra-ninja.tmx',
  huntArredoresReinoClover: '/maps/hunt-arredores-reino-clover.tmx',
  huntNamekusei: '/maps/hunt-namekusei.tmx',
  huntJogosCell: '/maps/hunt-jogos-cell.tmx',
  huntTorneioArtesMarciais: '/maps/hunt-torneio-artes-marciais.tmx',
  huntSalaDoTempo: '/maps/hunt-sala-do-tempo.tmx',
  huntDesertoSaiyajin: '/maps/hunt-deserto-saiyajin.tmx',
  academy: '/maps/academy.tmx',
  wonsrKonoha: '/maps/wonsr-konoha.tmx',
};
