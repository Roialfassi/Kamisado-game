import { Color, GameState, Move, PlayerSide } from '@kamisado/engine';

export type PreferredSide = 'BLACK' | 'GOLD' | 'RANDOM' | 'SPECTATOR';
export type EmoteId = 'WELL_PLAYED' | 'THINKING' | 'RESPECT' | 'BAMBOOZLED';
export type RoundFinishedReason = 'BASELINE_REACHED' | 'DEADLOCK' | 'TIMEOUT' | 'RESIGN';

// ---- Client -> Server (DATA_MODELS_AND_PROTOCOL_SPEC.md section 3.1) ----

export interface JoinRoomMessage {
  type: 'JOIN_ROOM';
  roomId: string;
  playerId: string;
  playerName: string;
  preferredSide: PreferredSide;
}

export interface SubmitMoveMessage {
  type: 'SUBMIT_MOVE';
  roomId: string;
  move: Move;
}

export interface ResignMessage {
  type: 'RESIGN';
  roomId: string;
  playerSide: PlayerSide;
}

export interface SendEmoteMessage {
  type: 'SEND_EMOTE';
  roomId: string;
  emoteId: EmoteId;
}

/** Pragmatic addition beyond the literal spec: a seated player asks the
 * server to start the next round once a round is over. Every round restarts
 * with each tower on its own colour square (house rule), so there is no
 * direction choice; `fillFromLeft` is accepted for older clients and ignored. */
export interface RegroupMessage {
  type: 'REGROUP';
  roomId: string;
  /** @deprecated ignored - kept so older clients still type-check. */
  fillFromLeft?: boolean;
}

export type ClientMessage = JoinRoomMessage | SubmitMoveMessage | ResignMessage | SendEmoteMessage | RegroupMessage;

// ---- Server -> Client (DATA_MODELS_AND_PROTOCOL_SPEC.md section 3.2) ----

export interface SeatInfo {
  id: string;
  name: string;
  connected: boolean;
}

export interface RoomStateMessage {
  type: 'ROOM_STATE';
  roomId: string;
  yourPlayerId: string;
  yourSide: PlayerSide | 'SPECTATOR';
  blackPlayer: SeatInfo | null;
  goldPlayer: SeatInfo | null;
  spectatorCount: number;
  gameState: GameState;
}

export interface MoveBroadcastMessage {
  type: 'MOVE_BROADCAST';
  roomId: string;
  move: Move;
  gameState: GameState;
  activePlayer: PlayerSide;
  requiredColor: Color | null;
  clocks: Record<PlayerSide, number>;
}

export interface RoundFinishedMessage {
  type: 'ROUND_FINISHED';
  roomId: string;
  winner: PlayerSide;
  reason: RoundFinishedReason;
  promotedTower: Color | null;
  newScores: Record<PlayerSide, number>;
  matchOver: boolean;
  matchWinner: PlayerSide | null;
  gameState: GameState;
}

export interface EmoteBroadcastMessage {
  type: 'EMOTE_BROADCAST';
  roomId: string;
  playerSide: PlayerSide | 'SPECTATOR';
  emoteId: EmoteId;
}

export interface ErrorMessage {
  type: 'ERROR';
  message: string;
}

export type ServerMessage =
  | RoomStateMessage
  | MoveBroadcastMessage
  | RoundFinishedMessage
  | EmoteBroadcastMessage
  | ErrorMessage;
