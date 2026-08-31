/**
 * PartyKit room — one instance per mapKey (room id).
 * Relays player presence/state and chat between browsers.
 */
import type * as Party from 'partykit/server';
import { jwtVerify } from 'jose';

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
const MAX_COORDINATE = 100_000;
const MAX_MOVE_PER_SECOND = 600;

type ConnectionIdentity = { playerId: string; nickname: string };

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
    typeof o.villageId === 'string' &&
    typeof o.mapKey === 'string' &&
    typeof o.x === 'number' &&
    Number.isFinite(o.x) &&
    typeof o.y === 'number' &&
    Number.isFinite(o.y)
  );
}

export default class WorldRoom implements Party.Server {
  private readonly players = new Map<string, PlayerNetState>();
  private readonly connToPlayer = new Map<string, string>();
  private readonly connIdentity = new Map<string, ConnectionIdentity>();
  private readonly lastChatAt = new Map<string, number>();

  constructor(readonly room: Party.Room) {}

  async onConnect(conn: Party.Connection, ctx: Party.ConnectionContext): Promise<void> {
    const url = new URL(ctx.request.url);
    const secret = process.env.MULTIPLAYER_AUTH_SECRET;
    const token = url.searchParams.get('token');
    if (!secret || !token) {
      conn.close();
      return;
    }

    let identity: ConnectionIdentity;
    try {
      const verified = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ['HS256'],
      });
      const playerId =
        typeof verified.payload.playerId === 'string'
          ? verified.payload.playerId
          : verified.payload.sub;
      if (!playerId || !/^p-neon-[a-zA-Z0-9_-]+$/.test(playerId)) {
        conn.close();
        return;
      }
      identity = {
        playerId,
        nickname:
          typeof verified.payload.nickname === 'string'
            ? verified.payload.nickname.trim().slice(0, 24) || 'Shinobi'
            : 'Shinobi',
      };
    } catch {
      conn.close();
      return;
    }

    const playerId = identity.playerId;

    this.connToPlayer.set(conn.id, playerId);
    this.connIdentity.set(conn.id, identity);

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
        const player = this.normalizeState(msg.player, sender);
        const isNew = !this.players.has(boundId);
        this.players.set(boundId, player);
        this.broadcast({ type: isNew ? 'player_join' : 'player_state', player }, sender.id);
        break;
      }
      case 'player_state': {
        if (!isPlayerState(msg.player)) return;
        if (msg.player.playerId !== boundId) return;
        const player = this.normalizeState(msg.player, sender);
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
          this.connIdentity.get(sender.id)?.nickname ||
          this.players.get(boundId)?.nickname ||
          'Shinobi';
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
    this.connIdentity.delete(conn.id);
    if (!playerId) return;
    // Only leave if no other connections for this player.
    for (const id of this.connToPlayer.values()) {
      if (id === playerId) return;
    }
    this.players.delete(playerId);
    this.lastChatAt.delete(playerId);
    this.broadcast({ type: 'player_leave', playerId });
  }

  private normalizeState(raw: PlayerNetState, sender: Party.Connection): PlayerNetState {
    const identity = this.connIdentity.get(sender.id);
    const previous = identity ? this.players.get(identity.playerId) : undefined;
    const now = Date.now();
    let x = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, raw.x));
    let y = Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, raw.y));
    if (previous) {
      const elapsed = Math.max(0.05, (now - previous.updatedAt) / 1_000);
      const maxDistance = MAX_MOVE_PER_SECOND * elapsed;
      x = Math.max(previous.x - maxDistance, Math.min(previous.x + maxDistance, x));
      y = Math.max(previous.y - maxDistance, Math.min(previous.y + maxDistance, y));
    }
    return {
      playerId: identity?.playerId ?? raw.playerId,
      nickname: identity?.nickname ?? 'Shinobi',
      villageId: raw.villageId,
      mapKey: this.room.id,
      characterId: raw.characterId || 'naruto-classic',
      x,
      y,
      direction:
        raw.direction === 'up' ||
        raw.direction === 'down' ||
        raw.direction === 'left' ||
        raw.direction === 'right'
          ? raw.direction
          : 'down',
      anim: raw.anim === 'walk' ? 'walk' : 'idle',
      updatedAt: now,
    };
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
