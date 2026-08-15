/**
 * Multiplayer relay — rooms keyed by mapKey (query ?mapKey=).
 * Protocol matches party/world.ts / NetMessage types.
 *
 * Local:  npm run mp:dev
 * Prod:   node server/mp/index.mjs  (Railway / Fly / any Node host)
 */
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT || 8787);
const CHAT_COOLDOWN_MS = 300;
const MAX_CHAT_LEN = 120;

/** @typedef {{ playerId: string, nickname: string, villageId: string, mapKey: string, characterId: string, x: number, y: number, direction: string, anim: string, updatedAt: number }} PlayerNetState */

/** @type {Map<string, Map<import('ws').WebSocket, { playerId: string }>>} */
const rooms = new Map();

/** @type {WeakMap<import('ws').WebSocket, { roomId: string, playerId: string, lastChatAt: number }>} */
const meta = new WeakMap();

/** @type {Map<string, PlayerNetState>} */
const playersById = new Map();

function getRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map();
    rooms.set(roomId, room);
  }
  return room;
}

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcast(roomId, msg, except) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(msg);
  for (const client of room.keys()) {
    if (client === except) continue;
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function broadcastAll(roomId, msg) {
  const room = rooms.get(roomId);
  if (!room) return;
  const payload = JSON.stringify(msg);
  for (const client of room.keys()) {
    if (client.readyState === client.OPEN) client.send(payload);
  }
}

function isPlayerState(p) {
  return (
    p &&
    typeof p === 'object' &&
    typeof p.playerId === 'string' &&
    typeof p.nickname === 'string' &&
    typeof p.mapKey === 'string' &&
    typeof p.x === 'number' &&
    typeof p.y === 'number'
  );
}

function leave(ws) {
  const info = meta.get(ws);
  if (!info) return;
  const { roomId, playerId } = info;
  meta.delete(ws);
  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    let stillHere = false;
    for (const [, m] of room) {
      if (m.playerId === playerId) {
        stillHere = true;
        break;
      }
    }
    if (!stillHere) {
      playersById.delete(playerId);
      broadcast(roomId, { type: 'player_leave', playerId });
    }
    if (room.size === 0) rooms.delete(roomId);
  }
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('idle-mmorpg multiplayer ok\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const mapKey = url.searchParams.get('mapKey')?.trim() || 'default';
  const playerId =
    url.searchParams.get('playerId')?.trim() || `anon-${Math.random().toString(36).slice(2, 10)}`;
  const roomId = mapKey;

  const room = getRoom(roomId);
  room.set(ws, { playerId });
  meta.set(ws, { roomId, playerId, lastChatAt: 0 });

  send(ws, {
    type: 'session_welcome',
    playerId,
    serverTime: Date.now(),
  });

  const others = [];
  for (const [id, state] of playersById) {
    if (id === playerId) continue;
    if (state.mapKey === roomId) others.push(state);
  }
  if (others.length) {
    send(ws, { type: 'player_state_batch', players: others });
  }

  ws.on('message', (raw) => {
    const text = typeof raw === 'string' ? raw : raw.toString('utf8');
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object' || !msg.type) return;

    const info = meta.get(ws);
    if (!info) return;

    switch (msg.type) {
      case 'player_join':
      case 'player_state': {
        if (!isPlayerState(msg.player)) return;
        if (msg.player.playerId !== info.playerId) return;
        const player = {
          ...msg.player,
          characterId:
            typeof msg.player.characterId === 'string' && msg.player.characterId
              ? msg.player.characterId
              : 'naruto-classic',
          mapKey: roomId,
        };
        const isNew = !playersById.has(info.playerId);
        playersById.set(info.playerId, player);
        broadcast(
          roomId,
          { type: isNew || msg.type === 'player_join' ? 'player_join' : 'player_state', player },
          ws,
        );
        break;
      }
      case 'chat_message': {
        const chatText =
          typeof msg.text === 'string' ? msg.text.trim().slice(0, MAX_CHAT_LEN) : '';
        if (!chatText) return;
        const now = Date.now();
        if (now - info.lastChatAt < CHAT_COOLDOWN_MS) return;
        info.lastChatAt = now;
        const nickname =
          playersById.get(info.playerId)?.nickname ||
          (typeof msg.nickname === 'string' ? msg.nickname : 'Shinobi');
        broadcastAll(roomId, {
          type: 'chat_message',
          playerId: info.playerId,
          nickname,
          text: chatText,
          at: now,
        });
        break;
      }
      default:
        break;
    }
  });

  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

server.listen(PORT, () => {
  console.log(`[mp] listening on :${PORT}`);
});
