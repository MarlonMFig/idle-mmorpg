/**
 * PartyKit room — one instance per mapKey (room id).
 * Relays player presence/state and chat between browsers.
 */
import type * as Party from 'partykit/server';

type PlayerNetState = {
  playerId: string;
  nickname: string;
  villageId: string;
  mapKey: string;
  characterId: string;
  x: number;
  y: number;
  direction: string;
  anim: string;
  updatedAt: number;
};

type NetMessage =
  | { type: 'session_welcome'; playerId: string; serverTime: number }
  | { type: 'player_join'; player: PlayerNetState }
  | { type: 'player_leave'; playerId: string }
  | { type: 'player_state'; player: PlayerNetState }
  | { type: 'player_state_batch'; players: PlayerNetState[] }
  | {
      type: 'chat_message';
      playerId: string;
      nickname: string;
      text: string;
      at: number;
    };

const CHAT_COOLDOWN_MS = 300;
const MAX_CHAT_LEN = 120;

function parseMessage(raw: string): NetMessage | null {
  try {
    const data = JSON.parse(raw) as NetMessage;
    if (!data || typeof data !== 'object' || !('type' in data)) return null;
    return data;
  } catch {
    return null;
  }
}

function isPlayerState(p: unknown): p is PlayerNetState {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.playerId === 'string' &&
    typeof o.nickname === 'string' &&
    typeof o.mapKey === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number'
  );
}

export default class WorldRoom implements Party.Server {
  private readonly players = new Map<string, PlayerNetState>();
  private readonly connToPlayer = new Map<string, string>();
  private readonly lastChatAt = new Map<string, number>();

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): void {
    const url = new URL(ctx.request.url);
    const playerId =
      url.searchParams.get('playerId')?.trim() || `anon-${conn.id.slice(0, 8)}`;

    this.connToPlayer.set(conn.id, playerId);

    conn.send(
      JSON.stringify({
        type: 'session_welcome',
        playerId,
        serverTime: Date.now(),
      } satisfies NetMessage),
    );

    const others = [...this.players.values()].filter((p) => p.playerId !== playerId);
    if (others.length > 0) {
      conn.send(
        JSON.stringify({
          type: 'player_state_batch',
          players: others,
        } satisfies NetMessage),
      );
    }
  }

  onMessage(message: string | ArrayBuffer, sender: Party.Connection): void {
    if (typeof message !== 'string') return;
    const msg = parseMessage(message);
    if (!msg) return;

    const boundId = this.connToPlayer.get(sender.id);
    if (!boundId) return;

    switch (msg.type) {
      case 'player_join': {
        if (!isPlayerState(msg.player)) return;
        if (msg.player.playerId !== boundId) return;
        const player: PlayerNetState = {
          ...msg.player,
          characterId:
            typeof msg.player.characterId === 'string' && msg.player.characterId
              ? msg.player.characterId
              : 'naruto-classic',
          mapKey: this.room.id,
        };
        const isNew = !this.players.has(boundId);
        this.players.set(boundId, player);
        this.broadcast(
          { type: isNew ? 'player_join' : 'player_state', player },
          sender.id,
        );
        break;
      }
      case 'player_state': {
        if (!isPlayerState(msg.player)) return;
        if (msg.player.playerId !== boundId) return;
        const player: PlayerNetState = {
          ...msg.player,
          characterId:
            typeof msg.player.characterId === 'string' && msg.player.characterId
              ? msg.player.characterId
              : 'naruto-classic',
          mapKey: this.room.id,
        };
        this.players.set(boundId, player);
        this.broadcast({ type: 'player_state', player }, sender.id);
        break;
      }
      case 'chat_message': {
        const text = typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_CHAT_LEN) : '';
        if (!text) return;
        const now = Date.now();
        const last = this.lastChatAt.get(boundId) ?? 0;
        if (now - last < CHAT_COOLDOWN_MS) return;
        this.lastChatAt.set(boundId, now);
        const nickname =
          this.players.get(boundId)?.nickname ||
          (typeof msg.nickname === 'string' ? msg.nickname : 'Shinobi');
        this.broadcast({
          type: 'chat_message',
          playerId: boundId,
          nickname,
          text,
          at: now,
        });
        break;
      }
      default:
        break;
    }
  }

  onClose(conn: Party.Connection): void {
    const playerId = this.connToPlayer.get(conn.id);
    this.connToPlayer.delete(conn.id);
    if (!playerId) return;
    // Only leave if no other connections for this player.
    for (const id of this.connToPlayer.values()) {
      if (id === playerId) return;
    }
    this.players.delete(playerId);
    this.lastChatAt.delete(playerId);
    this.broadcast({ type: 'player_leave', playerId });
  }

  private broadcast(message: NetMessage, exceptConnId?: string): void {
    const payload = JSON.stringify(message);
    for (const conn of this.room.getConnections()) {
      if (exceptConnId && conn.id === exceptConnId) continue;
      conn.send(payload);
    }
  }
}

WorldRoom satisfies Party.Worker;
