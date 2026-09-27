import {
  Color,
  GameState,
  GameStatus,
  MatchFormat,
  Move,
  MoveResult,
  MoveType,
  PlayerSide,
  applyMove,
  createGame,
  handlePassOrDeadlock,
  otherSide,
  regroupForNextRound,
} from '@kamisado/engine';
import type { RoundFinishedReason } from '@kamisado/protocol';
import type { WebSocket } from 'ws';

export interface Seat {
  playerId: string;
  playerName: string;
  ws: WebSocket | null;
}

export interface Room {
  id: string;
  format: MatchFormat;
  gameState: GameState;
  black: Seat | null;
  gold: Seat | null;
  spectators: Set<WebSocket>;
  /** Pending 60s disconnect-grace forfeiture timers, keyed by the
   * disconnected seat's side. Cleared on reconnect. */
  graceTimers: Partial<Record<PlayerSide, ReturnType<typeof setTimeout>>>;
}

const rooms = new Map<string, Room>();

export function getOrCreateRoom(roomId: string, format: MatchFormat = MatchFormat.STANDARD): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      format,
      gameState: createGame(format, 5 * 60 * 1000),
      black: null,
      gold: null,
      spectators: new Set(),
      graceTimers: {},
    };
    rooms.set(roomId, room);
  }
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/** True if `side`'s disconnect-grace forfeiture timer was pending (and just
 * cancelled) - callers use this to know a reconnect interrupted a countdown. */
export function clearGraceTimer(room: Room, side: PlayerSide): boolean {
  const timer = room.graceTimers[side];
  if (!timer) return false;
  clearTimeout(timer);
  delete room.graceTimers[side];
  return true;
}

export function deleteRoomIfEmpty(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const hasPendingGrace = Object.keys(room.graceTimers).length > 0;
  const empty = !room.black?.ws && !room.gold?.ws && room.spectators.size === 0;
  if (empty && !hasPendingGrace) rooms.delete(roomId);
}

export interface ApplyMoveOutcome {
  moveResult: MoveResult;
  finished?: {
    winner: PlayerSide;
    reason: RoundFinishedReason;
    promotedTower: Color | null;
    matchOver: boolean;
    matchWinner: PlayerSide | null;
  };
}

/** Applies a submitted move, then auto-resolves any forced pass/deadlock
 * chain, folding both into the room's authoritative state. */
export function applyRoomMove(room: Room, move: Move): ApplyMoveOutcome | { error: string } {
  const result = applyMove(room.gameState, move);
  if (!result.success || !result.state) {
    return { error: result.error ?? 'Illegal move' };
  }

  let finalState = result.state;
  let finished: ApplyMoveOutcome['finished'];

  if (finalState.status === GameStatus.IN_PROGRESS) {
    const resolved = handlePassOrDeadlock(finalState);
    if (resolved.state) finalState = resolved.state;
    if (resolved.isRoundOver && resolved.roundWinner) {
      finished = { winner: resolved.roundWinner, reason: 'DEADLOCK', promotedTower: null, matchOver: false, matchWinner: null };
    }
  } else {
    const winner = finalState.roundWinner;
    if (winner) {
      finished = {
        winner,
        reason: 'BASELINE_REACHED',
        promotedTower: move.type !== MoveType.PASS ? move.towerColor : null,
        matchOver: finalState.status === GameStatus.MATCH_OVER,
        matchWinner: finalState.matchWinner ?? null,
      };
    }
  }

  room.gameState = finalState;
  return { moveResult: { ...result, state: finalState }, finished };
}

/** Resignation is a digital-play convenience (fair-play/rage-quit
 * protection), not a Burley Games rule - handled here at the room layer
 * rather than in the pure engine. The opponent is awarded the round (and the
 * match, if that reaches the format's point threshold), with no Sumo
 * promotion since no tower physically reached the home row. */
export function applyResignation(room: Room, resigningSide: PlayerSide): ApplyMoveOutcome {
  const winner = otherSide(resigningSide);
  const prevScore = room.gameState.scores[winner];
  const nextScore = { ...prevScore, points: prevScore.points + 1, roundsWon: prevScore.roundsWon + 1 };
  const threshold = { SINGLE_ROUND: 1, STANDARD: 3, LONG: 7, MARATHON: 15 }[room.gameState.matchFormat];
  const matchOver = nextScore.points >= threshold;

  room.gameState = {
    ...room.gameState,
    scores: { ...room.gameState.scores, [winner]: nextScore },
    status: matchOver ? GameStatus.MATCH_OVER : GameStatus.ROUND_OVER,
    roundWinner: winner,
    roundOverReason: 'RESIGN',
    matchWinner: matchOver ? winner : undefined,
  };

  return {
    moveResult: { success: true, state: room.gameState },
    finished: { winner, reason: 'RESIGN', promotedTower: null, matchOver, matchWinner: matchOver ? winner : null },
  };
}

export function applyRoomRegroup(room: Room, fillFromLeft: boolean): void {
  room.gameState = regroupForNextRound(room.gameState, fillFromLeft);
}
