export enum Color {
  BROWN = 'BROWN',
  GREEN = 'GREEN',
  RED = 'RED',
  YELLOW = 'YELLOW',
  PINK = 'PINK',
  PURPLE = 'PURPLE',
  BLUE = 'BLUE',
  ORANGE = 'ORANGE',
}

export const ALL_COLORS: Color[] = [
  Color.BROWN,
  Color.GREEN,
  Color.RED,
  Color.YELLOW,
  Color.PINK,
  Color.PURPLE,
  Color.BLUE,
  Color.ORANGE,
];

export enum PlayerSide {
  BLACK = 'BLACK',
  GOLD = 'GOLD',
}

export enum SumoRank {
  NORMAL = 0,
  SINGLE = 1,
  DOUBLE = 2,
  TRIPLE = 3,
}

export interface Coordinate {
  row: number;
  col: number;
}

export interface Tower {
  id: string;
  side: PlayerSide;
  color: Color;
  sumoRank: SumoRank;
  position: Coordinate;
}

export enum MoveType {
  STANDARD = 'STANDARD',
  SUMO_PUSH = 'SUMO_PUSH',
  PASS = 'PASS',
}

export interface Move {
  type: MoveType;
  playerSide: PlayerSide;
  towerColor: Color;
  from: Coordinate;
  to: Coordinate;
  pushedTowers?: Tower[];
}

export enum MatchFormat {
  SINGLE_ROUND = 'SINGLE_ROUND',
  STANDARD = 'STANDARD',
  LONG = 'LONG',
  MARATHON = 'MARATHON',
}

export const MATCH_FORMAT_POINTS: Record<MatchFormat, number> = {
  [MatchFormat.SINGLE_ROUND]: 1,
  [MatchFormat.STANDARD]: 3,
  [MatchFormat.LONG]: 7,
  [MatchFormat.MARATHON]: 15,
};

export enum GameStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ROUND_OVER = 'ROUND_OVER',
  MATCH_OVER = 'MATCH_OVER',
}

export interface PlayerScore {
  side: PlayerSide;
  points: number;
  roundsWon: number;
}

export interface GameState {
  matchFormat: MatchFormat;
  status: GameStatus;
  currentRound: number;
  scores: Record<PlayerSide, PlayerScore>;

  boardLayout: Color[][];

  towers: Record<string, Tower>;

  activePlayer: PlayerSide;
  requiredColor: Color | null;
  lastMove: Move | null;
  lastPhysicalMover: PlayerSide | null;
  consecutivePasses: number;

  clocks: Record<PlayerSide, number>;
  lastClockUpdate: number;

  /** Populated only once status becomes ROUND_OVER or MATCH_OVER. */
  roundWinner?: PlayerSide;
  roundOverReason?: 'BASELINE_REACHED' | 'DEADLOCK' | 'RESIGN';
  matchWinner?: PlayerSide;
}

export type EngineErrorCode =
  | 'GAME_NOT_IN_PROGRESS'
  | 'NOT_ACTIVE_PLAYER'
  | 'NO_SUCH_TOWER'
  | 'COLOR_MISMATCH'
  | 'FROM_MISMATCH'
  | 'MANDATORY_MOVE'
  | 'MANDATORY_PUSH'
  | 'ILLEGAL_DIRECTION'
  | 'PATH_OBSTRUCTED'
  | 'DESTINATION_OCCUPIED'
  | 'EXCEEDS_SUMO_RANGE'
  | 'ILLEGAL_SUMO_PUSH_DIRECTION'
  | 'SUMO_PUSH_BLOCKED'
  | 'CANNOT_PUSH_OFF_BOARD'
  | 'SUMO_IMMUNITY'
  | 'INVALID_MOVE';

export interface MoveResult {
  success: boolean;
  state?: GameState;
  error?: string;
  errorCode?: EngineErrorCode;
  isRoundOver?: boolean;
  isMatchOver?: boolean;
  roundWinner?: PlayerSide;
  matchWinner?: PlayerSide;
}

export interface IKamisadoEngine {
  createGame(format: MatchFormat, initialClockMs?: number): GameState;
  getLegalMoves(state: GameState, color: Color): Move[];
  applyMove(state: GameState, move: Move): MoveResult;
  handlePassOrDeadlock(state: GameState): MoveResult;
  regroupForNextRound(state: GameState, fillFromLeft: boolean): GameState;
}

export function otherSide(side: PlayerSide): PlayerSide {
  return side === PlayerSide.BLACK ? PlayerSide.GOLD : PlayerSide.BLACK;
}

export function towerId(side: PlayerSide, color: Color): string {
  return `${side}_${color}`;
}
