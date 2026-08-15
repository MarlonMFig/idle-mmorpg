/**
 * Altura visual (px de mundo) de qualquer personagem: jogador, jogadores
 * remotos, NPCs e monstros. Medida sobre o desenho visível, nunca sobre a
 * moldura do frame — as folhas vêm de origens diferentes e com molduras de
 * 32 a 256 px, então normalizar pela moldura deixaria os tamanhos desiguais.
 *
 * ~52px com zoom 2 aproxima o peso visual dos sprites pixel do vídeo ref.
 * (luta idle top-down) sem cobrir o mapa.
 */
export const CHARACTER_DISPLAY_HEIGHT = 62;

/**
 * Multiplicador visual no hub ilustrado.
 * 2.1 → ~130px de altura, ~80% das portas do hub lateral (160px na clínica,
 * 165px na casa central), que é a proporção de uma pessoa em pé numa porta.
 */
export const HUB_CHARACTER_SCALE = 2.1;

/**
 * Layout 1024→3840. No combate contain (zoom 0.5 em 1080p) mantém o
 * personagem no mesmo tamanho de tela que o mapa 1024 antigo.
 */
export const COMBAT_MAP_LAYOUT_SCALE = 3840 / 1024;

/**
 * Pegada física no chão (px de mundo), igual para todos. Convertida para
 * pixels de textura na hora de configurar o corpo, porque o Phaser multiplica
 * o tamanho e o offset do corpo pela escala do sprite.
 */
export const CHARACTER_BODY_WIDTH = 14;
export const CHARACTER_BODY_HEIGHT = 10;
