import { GameStatus, PlayerSide } from '@kamisado/engine';
import { WebSocketServer, WebSocket } from 'ws';
import type { ApplyMoveOutcome } from './rooms.js';
import type { ClientMessage, RoomStateMessage, ServerMessage } from '@kamisado/protocol';
import {
  Room,
  applyResignation,
  applyRoomMove,
  applyRoomRegroup,
  clearGraceTimer,
  deleteRoomIfEmpty,
  getOrCreateRoom,
  getRoom,
} from './rooms.js';

const PORT = Number(process.env.PORT ?? 8787);

/** How long a disconnected seat's opponent has to wait before the round is
 * forfeited to them - the spec's "disconnect grace period" (Phase 3).
 * Overridable via env for fast integration tests. */
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS ?? 60_000);

interface Connection {
  roomId: string;
  playerId: string;
  playerName: string;
}

const connections = new Map<WebSocket, Connection>();

function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
}

function seatOf(room: Room, ws: WebSocket): PlayerSide | 'SPECTATOR' {
  if (room.black?.ws === ws) return PlayerSide.BLACK;
  if (room.gold?.ws === ws) return PlayerSide.GOLD;
  return 'SPECTATOR';
}

function roomStateFor(room: Room, ws: WebSocket, conn: Connection): RoomStateMessage {
  return {
    type: 'ROOM_STATE',
    roomId: room.id,
    yourPlayerId: conn.playerId,
    yourSide: seatOf(room, ws),
    blackPlayer: room.black ? { id: room.black.playerId, name: room.black.playerName, connected: !!room.black.ws } : null,
    goldPlayer: room.gold ? { id: room.gold.playerId, name: room.gold.playerName, connected: !!room.gold.ws } : null,
    spectatorCount: room.spectators.size,
    gameState: room.gameState,
  };
}

function broadcastRoomState(room: Room): void {
  const sockets: WebSocket[] = [
    ...(room.black?.ws ? [room.black.ws] : []),
    ...(room.gold?.ws ? [room.gold.ws] : []),
    ...room.spectators,
  ];
  for (const ws of sockets) {
    const conn = connections.get(ws);
    if (conn) send(ws, roomStateFor(room, ws, conn));
  }
}

function broadcast(room: Room, message: ServerMessage): void {
  const sockets: WebSocket[] = [
    ...(room.black?.ws ? [room.black.ws] : []),
    ...(room.gold?.ws ? [room.gold.ws] : []),
    ...room.spectators,
  ];
  for (const ws of sockets) send(ws, message);
}

function broadcastRoundFinished(room: Room, finished: NonNullable<ApplyMoveOutcome['finished']>): void {
  const { winner, reason, promotedTower, matchOver, matchWinner } = finished;
  broadcast(room, {
    type: 'ROUND_FINISHED',
    roomId: room.id,
    winner,
    reason,
    promotedTower,
    newScores: { [PlayerSide.BLACK]: room.gameState.scores[PlayerSide.BLACK].points, [PlayerSide.GOLD]: room.gameState.scores[PlayerSide.GOLD].points },
    matchOver,
    matchWinner,
    gameState: room.gameState,
  });
}

function handleJoin(ws: WebSocket, msg: Extract<ClientMessage, { type: 'JOIN_ROOM' }>): void {
  const room = getOrCreateRoom(msg.roomId);
  connections.set(ws, { roomId: msg.roomId, playerId: msg.playerId, playerName: msg.playerName });

  // Reconnect: this playerId already holds a seat. Cancel any pending
  // disconnect-grace forfeiture timer - they made it back in time.
  if (room.black?.playerId === msg.playerId) {
    room.black.ws = ws;
    room.black.playerName = msg.playerName;
    clearGraceTimer(room, PlayerSide.BLACK);
  } else if (room.gold?.playerId === msg.playerId) {
    room.gold.ws = ws;
    room.gold.playerName = msg.playerName;
    clearGraceTimer(room, PlayerSide.GOLD);
  } else {
    const wantsBlack = msg.preferredSide === 'BLACK' || (msg.preferredSide === 'RANDOM' && !room.black);
    const wantsGold = msg.preferredSide === 'GOLD' || (msg.preferredSide === 'RANDOM' && !room.gold && !wantsBlack);

    if (wantsBlack && !room.black) {
      room.black = { playerId: msg.playerId, playerName: msg.playerName, ws };
    } else if (wantsGold && !room.gold) {
      room.gold = { playerId: msg.playerId, playerName: msg.playerName, ws };
    } else if (msg.preferredSide === 'RANDOM' && !room.black) {
      room.black = { playerId: msg.playerId, playerName: msg.playerName, ws };
    } else if (msg.preferredSide === 'RANDOM' && !room.gold) {
      room.gold = { playerId: msg.playerId, playerName: msg.playerName, ws };
    } else {
      room.spectators.add(ws);
    }
  }

  broadcastRoomState(room);
}

function requireRoom(ws: WebSocket, roomId: string): Room | null {
  const room = getRoom(roomId);
  if (!room) {
    send(ws, { type: 'ERROR', message: `Room ${roomId} does not exist` });
    return null;
  }
  return room;
}

function handleSubmitMove(ws: WebSocket, msg: Extract<ClientMessage, { type: 'SUBMIT_MOVE' }>): void {
  const room = requireRoom(ws, msg.roomId);
  if (!room) return;
  const side = seatOf(room, ws);
  if (side === 'SPECTATOR') {
    send(ws, { type: 'ERROR', message: 'Spectators cannot move' });
    return;
  }
  if (side !== msg.move.playerSide) {
    send(ws, { type: 'ERROR', message: 'You can only move your own towers' });
    return;
  }

  const outcome = applyRoomMove(room, msg.move);
  if ('error' in outcome) {
    send(ws, { type: 'ERROR', message: outcome.error });
    return;
  }

  broadcast(room, {
    type: 'MOVE_BROADCAST',
    roomId: room.id,
    move: msg.move,
    gameState: room.gameState,
    activePlayer: room.gameState.activePlayer,
    requiredColor: room.gameState.requiredColor,
    clocks: room.gameState.clocks,
  });

  if (outcome.finished) broadcastRoundFinished(room, outcome.finished);
}

function handleResign(ws: WebSocket, msg: Extract<ClientMessage, { type: 'RESIGN' }>): void {
  const room = requireRoom(ws, msg.roomId);
  if (!room) return;
  const side = seatOf(room, ws);
  if (side === 'SPECTATOR' || side !== msg.playerSide) {
    send(ws, { type: 'ERROR', message: 'Only a seated player can resign their own side' });
    return;
  }
  const outcome = applyResignation(room, msg.playerSide);
  if (outcome.finished) broadcastRoundFinished(room, outcome.finished);
}

function handleRegroup(ws: WebSocket, msg: Extract<ClientMessage, { type: 'REGROUP' }>): void {
  const room = requireRoom(ws, msg.roomId);
  if (!room) return;
  applyRoomRegroup(room, msg.fillFromLeft);
  broadcastRoomState(room);
}

function handleEmote(ws: WebSocket, msg: Extract<ClientMessage, { type: 'SEND_EMOTE' }>): void {
  const room = requireRoom(ws, msg.roomId);
  if (!room) return;
  broadcast(room, { type: 'EMOTE_BROADCAST', roomId: room.id, playerSide: seatOf(room, ws), emoteId: msg.emoteId });
}

/** Starts (or restarts) the 60s countdown after which `side` forfeits the
 * round to their opponent for failing to reconnect in time. */
function scheduleGraceForfeit(room: Room, side: PlayerSide): void {
  clearGraceTimer(room, side);
  room.graceTimers[side] = setTimeout(() => {
    delete room.graceTimers[side];
    const seat = side === PlayerSide.BLACK ? room.black : room.gold;
    // Defensive: only forfeit if they're still gone and there's still a
    // round in progress to forfeit (a reconnect already cancels this timer,
    // but a message could theoretically race the timer firing).
    if (!seat || seat.ws || room.gameState.status !== GameStatus.IN_PROGRESS) return;

    const outcome = applyResignation(room, side);
    if (outcome.finished) broadcastRoundFinished(room, outcome.finished);
    broadcastRoomState(room);
    deleteRoomIfEmpty(room.id);
  }, DISCONNECT_GRACE_MS);
}

const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (ws) => {
  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: 'ERROR', message: 'Malformed message' });
      return;
    }
    try {
      switch (msg.type) {
        case 'JOIN_ROOM':
          return handleJoin(ws, msg);
        case 'SUBMIT_MOVE':
          return handleSubmitMove(ws, msg);
        case 'RESIGN':
          return handleResign(ws, msg);
        case 'REGROUP':
          return handleRegroup(ws, msg);
        case 'SEND_EMOTE':
          return handleEmote(ws, msg);
      }
    } catch (err) {
      send(ws, { type: 'ERROR', message: err instanceof Error ? err.message : 'Server error' });
    }
  });

  ws.on('close', () => {
    const conn = connections.get(ws);
    connections.delete(ws);
    if (!conn) return;
    const room = getRoom(conn.roomId);
    if (!room) return;

    let disconnectedSide: PlayerSide | null = null;
    if (room.black?.ws === ws) {
      room.black.ws = null;
      disconnectedSide = PlayerSide.BLACK;
    } else if (room.gold?.ws === ws) {
      room.gold.ws = null;
      disconnectedSide = PlayerSide.GOLD;
    } else {
      room.spectators.delete(ws);
    }
    broadcastRoomState(room);

    if (disconnectedSide && room.gameState.status === GameStatus.IN_PROGRESS) {
      scheduleGraceForfeit(room, disconnectedSide);
    } else {
      deleteRoomIfEmpty(conn.roomId);
    }
  });
});

console.log(`Kamisado room server listening on ws://localhost:${PORT}`);
