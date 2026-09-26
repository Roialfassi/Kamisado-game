# Kamisado Data Models & Network Protocol Specification

This document defines the shared TypeScript data models, pure state reducer contracts, and real-time network protocol schemas required for both the Web App and Android App implementations.

---

## 1. Core Data Models (TypeScript / JSON)

```typescript
export enum Color {
  BROWN = 'BROWN',
  GREEN = 'GREEN',
  RED = 'RED',
  YELLOW = 'YELLOW',
  PINK = 'PINK',
  PURPLE = 'PURPLE',
  BLUE = 'BLUE',
  ORANGE = 'ORANGE'
}

export enum PlayerSide {
  BLACK = 'BLACK', // Always moves first in Round 1 (+r direction)
  GOLD = 'GOLD'    // Moves second in Round 1 (-r direction)
}

export enum SumoRank {
  NORMAL = 0,      // Max move: 7, pushes: 0, points: 0
  SINGLE = 1,      // Max move: 5, pushes: 1, points: 1
  DOUBLE = 2,      // Max move: 3, pushes: 2, points: 3
  TRIPLE = 3       // Max move: 1, pushes: 3, points: 7
}

export interface Coordinate {
  row: number; // 0 to 7
  col: number; // 0 to 7
}

export interface Tower {
  id: string;             // e.g. "BLACK_RED" or "GOLD_ORANGE"
  side: PlayerSide;
  color: Color;
  sumoRank: SumoRank;
  position: Coordinate;
}

export enum MoveType {
  STANDARD = 'STANDARD',     // Normal forward orthogonal or diagonal move
  SUMO_PUSH = 'SUMO_PUSH',   // Forward push on adjacent opponent piece(s)
  PASS = 'PASS'              // Stymie zero-length pass when blocked
}

export interface Move {
  type: MoveType;
  playerSide: PlayerSide;
  towerColor: Color;
  from: Coordinate;
  to: Coordinate;
  pushedTowers?: Tower[];    // Populated if MoveType === SUMO_PUSH
}

export enum MatchFormat {
  SINGLE_ROUND = 'SINGLE_ROUND', // First to 1 point
  STANDARD = 'STANDARD',         // First to 3 points
  LONG = 'LONG',                 // First to 7 points
  MARATHON = 'MARATHON'          // First to 15 points
}

export enum GameStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ROUND_OVER = 'ROUND_OVER',
  MATCH_OVER = 'MATCH_OVER'
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
  
  // Board configuration: 8x8 array of Colors
  boardLayout: Color[][];
  
  // Active towers currently on board
  towers: Record<string, Tower>;
  
  // Active turn state
  activePlayer: PlayerSide;
  requiredColor: Color | null; // null on Turn 1 (player chooses any tower)
  lastMove: Move | null;
  lastPhysicalMover: PlayerSide | null;
  consecutivePasses: number;
  
  // Clock state (in milliseconds)
  clocks: Record<PlayerSide, number>;
  lastClockUpdate: number;
}
```

---

## 2. Pure State Reducer Interface Contracts

The game engine must be implemented as a deterministic, pure state machine with zero side effects:

```typescript
export interface MoveResult {
  success: boolean;
  state?: GameState;
  error?: string;
  isRoundOver?: boolean;
  isMatchOver?: boolean;
  roundWinner?: PlayerSide;
  matchWinner?: PlayerSide;
}

export interface IKamisadoEngine {
  /**
   * Initializes a fresh game according to the given match format.
   */
  createGame(format: MatchFormat, initialClockMs?: number): GameState;

  /**
   * Returns all legal destination coordinates for the tower of the given color.
   */
  getLegalMoves(state: GameState, color: Color): Move[];

  /**
   * Applies a move and returns the next immutable GameState.
   */
  applyMove(state: GameState, move: Move): MoveResult;

  /**
   * Automatically detects and applies a Pass if the active tower is stymied.
   * If a circular deadlock is detected, adjudicates victory to the opponent of lastPhysicalMover.
   */
  handlePassOrDeadlock(state: GameState): MoveResult;

  /**
   * Prepares the board layout for subsequent rounds (regrouping left or right).
   */
  regroupForNextRound(state: GameState, fillFromLeft: boolean): GameState;
}
```

---

## 3. Real-Time Network Room Protocol (WebSocket / WebRTC)

### 3.1 Client to Server Messages

```json
// 1. Join or Create Room
{
  "type": "JOIN_ROOM",
  "roomId": "tiger-849",
  "playerId": "user_123",
  "playerName": "Elena",
  "preferredSide": "RANDOM" // "BLACK" | "GOLD" | "RANDOM" | "SPECTATOR"
}

// 2. Submit Move
{
  "type": "SUBMIT_MOVE",
  "roomId": "tiger-849",
  "move": {
    "type": "STANDARD",
    "playerSide": "BLACK",
    "towerColor": "RED",
    "from": { "row": 0, "col": 2 },
    "to": { "row": 4, "col": 2 }
  }
}

// 3. Forfeit / Resign
{
  "type": "RESIGN",
  "roomId": "tiger-849",
  "playerSide": "BLACK"
}

// 4. Send Emote
{
  "type": "SEND_EMOTE",
  "roomId": "tiger-849",
  "emoteId": "RESPECT" // "WELL_PLAYED" | "THINKING" | "RESPECT" | "BAMBOOZLED"
}
```

### 3.2 Server to Client Messages

```json
// 1. Room State Broadcast
{
  "type": "ROOM_STATE",
  "roomId": "tiger-849",
  "blackPlayer": { "id": "user_123", "name": "Elena", "connected": true },
  "goldPlayer": { "id": "user_456", "name": "Johan", "connected": true },
  "spectatorCount": 3,
  "gameState": { /* Complete GameState JSON */ }
}

// 2. Move Broadcast
{
  "type": "MOVE_BROADCAST",
  "roomId": "tiger-849",
  "move": { /* Executed Move */ },
  "activePlayer": "GOLD",
  "requiredColor": "YELLOW",
  "clocks": { "BLACK": 58400, "GOLD": 60000 }
}

// 3. Round Finished Event
{
  "type": "ROUND_FINISHED",
  "roomId": "tiger-849",
  "winner": "BLACK",
  "reason": "BASELINE_REACHED", // "BASELINE_REACHED" | "DEADLOCK" | "TIMEOUT" | "RESIGN"
  "promotedTower": "RED",
  "newScores": { "BLACK": 1, "GOLD": 0 }
}
```

---

## 4. Standard Notation Format (Text Game Records)

Moves can be logged and replayed using an unambiguous text format:

```
[Format "Standard"]
[Black "Elena"]
[Gold "Johan"]

1. Black Brown b1-b5 (Pink)
2. Gold Pink e8-c6 (Orange)
3. Black Orange h1-f3 (Purple)
4. Gold Purple c8-c4 (Red)
5. Black Red c1-c3 (Yellow)
...
```
* **Syntax**: `<MoveNum>. <Player> <TowerColor> <FromSquare>-<ToSquare> (<TargetLandingColor>)`
* **Pass Syntax**: `<MoveNum>. <Player> <TowerColor> PASS (<CurrentSquareColor>)`
* **Sumo Push Syntax**: `<MoveNum>. <Player> <TowerColor> <FromSquare> PUSH <OpponentSquare>-><PushedSquare> (<NextColor>)`
