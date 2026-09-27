import { BOARD_LAYOUT, cloneBoard, colorAt, isInBounds } from './board.js';
import {
  findTower,
  findTowerAt,
  forwardDir,
  getStandardDestinations,
  maxRange,
  opponentHomeRow,
  standardMovesFor,
} from './movement.js';
import { analyzeSumoPush } from './sumo.js';
import {
  Color,
  Coordinate,
  EngineErrorCode,
  GameState,
  GameStatus,
  IKamisadoEngine,
  MATCH_FORMAT_POINTS,
  MatchFormat,
  Move,
  MoveResult,
  MoveType,
  PlayerScore,
  PlayerSide,
  SumoRank,
  Tower,
  otherSide,
  towerId,
} from './types.js';

function fail(error: string, errorCode: EngineErrorCode): MoveResult {
  return { success: false, error, errorCode };
}

function buildInitialTowers(): Record<string, Tower> {
  const towers: Record<string, Tower> = {};
  for (let col = 0; col < 8; col++) {
    const blackColor = colorAt(BOARD_LAYOUT, 0, col);
    const goldColor = colorAt(BOARD_LAYOUT, 7, col);
    const black: Tower = {
      id: towerId(PlayerSide.BLACK, blackColor),
      side: PlayerSide.BLACK,
      color: blackColor,
      sumoRank: SumoRank.NORMAL,
      position: { row: 0, col },
    };
    const gold: Tower = {
      id: towerId(PlayerSide.GOLD, goldColor),
      side: PlayerSide.GOLD,
      color: goldColor,
      sumoRank: SumoRank.NORMAL,
      position: { row: 7, col },
    };
    towers[black.id] = black;
    towers[gold.id] = gold;
  }
  return towers;
}

export function createGame(format: MatchFormat, initialClockMs = 0): GameState {
  const blackScore: PlayerScore = { side: PlayerSide.BLACK, points: 0, roundsWon: 0 };
  const goldScore: PlayerScore = { side: PlayerSide.GOLD, points: 0, roundsWon: 0 };
  return {
    matchFormat: format,
    status: GameStatus.IN_PROGRESS,
    currentRound: 1,
    scores: { [PlayerSide.BLACK]: blackScore, [PlayerSide.GOLD]: goldScore },
    boardLayout: cloneBoard(BOARD_LAYOUT),
    towers: buildInitialTowers(),
    activePlayer: PlayerSide.BLACK,
    requiredColor: null,
    lastMove: null,
    lastPhysicalMover: null,
    consecutivePasses: 0,
    clocks: { [PlayerSide.BLACK]: initialClockMs, [PlayerSide.GOLD]: initialClockMs },
    lastClockUpdate: Date.now(),
  };
}

export function getLegalMoves(state: GameState, color: Color): Move[] {
  const tower = findTower(state, state.activePlayer, color);
  if (!tower) return [];
  const moves = standardMovesFor(state, tower);
  const push = analyzeSumoPush(state, tower);
  if (push.ok) moves.push(push.move);
  return moves;
}

function classifyStandardFailure(state: GameState, tower: Tower, to: Coordinate): EngineErrorCode {
  const dr = to.row - tower.position.row;
  const dc = to.col - tower.position.col;
  const forward = forwardDir(tower.side);
  const forwardAligned = Math.sign(dr) === forward && (dc === 0 || Math.abs(dc) === Math.abs(dr));
  if (!forwardAligned) return 'ILLEGAL_DIRECTION';
  const distance = Math.abs(dr);
  if (distance > maxRange(tower.sumoRank)) return 'EXCEEDS_SUMO_RANGE';
  if (findTowerAt(state, to.row, to.col)) return 'DESTINATION_OCCUPIED';
  return 'PATH_OBSTRUCTED';
}

/**
 * Promotes the tower that just reached the opponent's home row and scores
 * the round. `movedTower` must already carry its post-move position; only
 * its sumoRank is updated here (position is left untouched).
 */
function promoteAndScore(state: GameState, movedTower: Tower, towers: Record<string, Tower>): Partial<GameState> {
  if (movedTower.sumoRank === SumoRank.TRIPLE) {
    // Rule 5.2 "Quadruple Sumo": a fourth home-row run by an already-Triple
    // tower auto-wins the whole match outright, regardless of point totals.
    return {
      status: GameStatus.MATCH_OVER,
      roundWinner: movedTower.side,
      roundOverReason: 'BASELINE_REACHED',
      matchWinner: movedTower.side,
    };
  }
  const promoted: Tower = { ...movedTower, sumoRank: (movedTower.sumoRank + 1) as SumoRank };
  towers[promoted.id] = promoted;
  const prevScore = state.scores[movedTower.side];
  const nextScore: PlayerScore = { ...prevScore, points: prevScore.points + 1, roundsWon: prevScore.roundsWon + 1 };
  const scores = { ...state.scores, [movedTower.side]: nextScore };
  const threshold = MATCH_FORMAT_POINTS[state.matchFormat];
  const matchOver = nextScore.points >= threshold;
  return {
    scores,
    status: matchOver ? GameStatus.MATCH_OVER : GameStatus.ROUND_OVER,
    roundWinner: movedTower.side,
    roundOverReason: 'BASELINE_REACHED',
    matchWinner: matchOver ? movedTower.side : undefined,
  };
}

export function applyMove(state: GameState, move: Move): MoveResult {
  if (state.status !== GameStatus.IN_PROGRESS) {
    return fail('Game is not in progress', 'GAME_NOT_IN_PROGRESS');
  }
  if (move.playerSide !== state.activePlayer) {
    return fail('It is not this player\'s turn', 'NOT_ACTIVE_PLAYER');
  }
  if (state.requiredColor !== null && move.towerColor !== state.requiredColor) {
    return fail(`Must move the ${state.requiredColor} tower`, 'COLOR_MISMATCH');
  }
  const tower = findTower(state, move.playerSide, move.towerColor);
  if (!tower) return fail('No such tower', 'NO_SUCH_TOWER');
  if (tower.position.row !== move.from.row || tower.position.col !== move.from.col) {
    return fail('Move "from" does not match the tower\'s current position', 'FROM_MISMATCH');
  }

  const legalMoves = getLegalMoves(state, move.towerColor);

  if (move.type === MoveType.PASS) {
    if (legalMoves.length > 0) {
      const onlyPushes = legalMoves.every((m) => m.type === MoveType.SUMO_PUSH);
      return onlyPushes
        ? fail('A Sumo push is available and must be played (Rule S11)', 'MANDATORY_PUSH')
        : fail('A legal move is available and must be played', 'MANDATORY_MOVE');
    }
    return handlePassOrDeadlock(state);
  }

  if (move.type === MoveType.STANDARD) {
    const match = legalMoves.find(
      (m) => m.type === MoveType.STANDARD && m.to.row === move.to.row && m.to.col === move.to.col,
    );
    if (!match) {
      return fail('Illegal standard move', classifyStandardFailure(state, tower, move.to));
    }
    return executeStandardMove(state, tower, match);
  }

  if (move.type === MoveType.SUMO_PUSH) {
    const dr = forwardDir(tower.side);
    const expected: Coordinate = { row: tower.position.row + dr, col: tower.position.col };
    if (move.to.row !== expected.row || move.to.col !== expected.col || !isInBounds(expected.row, expected.col)) {
      return fail('A Sumo push must be exactly one square straight ahead', 'ILLEGAL_SUMO_PUSH_DIRECTION');
    }
    const analysis = analyzeSumoPush(state, tower);
    if (!analysis.ok) {
      const code = analysis.code === 'NO_CONTACT' ? 'SUMO_PUSH_BLOCKED' : analysis.code;
      return fail('Illegal Sumo push', code);
    }
    return executeSumoPush(state, tower, analysis.move, analysis.pushedTowers, analysis.landingCell);
  }

  return fail('Unknown move type', 'INVALID_MOVE');
}

function executeStandardMove(state: GameState, tower: Tower, move: Move): MoveResult {
  const towers = { ...state.towers };
  const movedTower: Tower = { ...tower, position: { ...move.to } };
  towers[movedTower.id] = movedTower;

  const reachedGoal = move.to.row === opponentHomeRow(tower.side);
  const base: GameState = {
    ...state,
    towers,
    lastMove: move,
    lastPhysicalMover: tower.side,
    consecutivePasses: 0,
  };

  if (reachedGoal) {
    const outcome = promoteAndScore(state, movedTower, towers);
    const finalState: GameState = { ...base, towers, ...outcome };
    return {
      success: true,
      state: finalState,
      isRoundOver: true,
      isMatchOver: finalState.status === GameStatus.MATCH_OVER,
      roundWinner: finalState.roundWinner,
      matchWinner: finalState.matchWinner,
    };
  }

  const landingColor = colorAt(state.boardLayout, move.to.row, move.to.col);
  const nextState: GameState = {
    ...base,
    activePlayer: otherSide(tower.side),
    requiredColor: landingColor,
  };
  return { success: true, state: nextState };
}

function executeSumoPush(
  state: GameState,
  tower: Tower,
  move: Move,
  pushedTowers: Tower[],
  landingCell: Coordinate,
): MoveResult {
  const towers = { ...state.towers };
  const movedTower: Tower = { ...tower, position: { ...move.to } };
  towers[movedTower.id] = movedTower;
  for (const pushed of pushedTowers) {
    towers[pushed.id] = pushed;
  }

  const reachedGoal = move.to.row === opponentHomeRow(tower.side);
  const base: GameState = {
    ...state,
    towers,
    lastMove: move,
    lastPhysicalMover: tower.side,
    consecutivePasses: 0,
  };

  if (reachedGoal) {
    const outcome = promoteAndScore(state, movedTower, towers);
    const finalState: GameState = { ...base, towers, ...outcome };
    return {
      success: true,
      state: finalState,
      isRoundOver: true,
      isMatchOver: finalState.status === GameStatus.MATCH_OVER,
      roundWinner: finalState.roundWinner,
      matchWinner: finalState.matchWinner,
    };
  }

  // Rule S3: the pusher moves again immediately, using the tower matching
  // the color of the square that was empty behind the pushed piece(s) (i.e.
  // the landing cell they now occupy). The opponent's turn is skipped by
  // simply never flipping `activePlayer`.
  const nextRequiredColor = colorAt(state.boardLayout, landingCell.row, landingCell.col);
  const nextState: GameState = {
    ...base,
    activePlayer: tower.side,
    requiredColor: nextRequiredColor,
  };
  return { success: true, state: nextState };
}

export function handlePassOrDeadlock(state: GameState): MoveResult {
  if (state.status !== GameStatus.IN_PROGRESS) {
    return { success: true, state };
  }
  let current = state;
  const seen = new Set<string>();

  while (true) {
    if (current.requiredColor === null) {
      return { success: true, state: current };
    }
    const legalMoves = getLegalMoves(current, current.requiredColor);
    if (legalMoves.length > 0) {
      return { success: true, state: current };
    }

    const key = `${current.activePlayer}:${current.requiredColor}`;
    if (seen.has(key)) {
      const loser = current.lastPhysicalMover ?? current.activePlayer;
      const winner = otherSide(loser);
      const finalState: GameState = {
        ...current,
        status: GameStatus.ROUND_OVER,
        roundWinner: winner,
        roundOverReason: 'DEADLOCK',
      };
      return { success: true, state: finalState, isRoundOver: true, roundWinner: winner };
    }
    seen.add(key);

    const tower = findTower(current, current.activePlayer, current.requiredColor);
    if (!tower) {
      // Defensive: every color always has a tower on each side for the
      // whole match, so this should be unreachable.
      return { success: true, state: current };
    }

    const passMove: Move = {
      type: MoveType.PASS,
      playerSide: current.activePlayer,
      towerColor: current.requiredColor,
      from: { ...tower.position },
      to: { ...tower.position },
    };
    const nextColor = colorAt(current.boardLayout, tower.position.row, tower.position.col);
    current = {
      ...current,
      activePlayer: otherSide(current.activePlayer),
      requiredColor: nextColor,
      lastMove: passMove,
      consecutivePasses: current.consecutivePasses + 1,
    };
  }
}

/**
 * Rules F1-F4 (regrouping between rounds) specify that the round's winner
 * (Defender) picks a fill direction and the loser (Challenger) fills the
 * same way, ordering towers "based on the row and column they occupied at
 * the end of the round" - the spec does not pin down the exact tie-break
 * further, so this implementation ordering is: each side's towers are
 * sorted by how far they advanced (most-advanced first), then by their
 * ending column, and re-seated onto that side's home row starting from
 * column 0 (fillFromLeft) or column 7 (!fillFromLeft) inward. Sumo ranks
 * earned so far persist; only board position resets.
 */
export function regroupForNextRound(state: GameState, fillFromLeft: boolean): GameState {
  const towers = { ...state.towers };

  for (const side of [PlayerSide.BLACK, PlayerSide.GOLD]) {
    const homeRow = side === PlayerSide.BLACK ? 0 : 7;
    const advancement = (t: Tower) => (side === PlayerSide.BLACK ? t.position.row : 7 - t.position.row);
    const sideTowers = Object.values(towers)
      .filter((t) => t.side === side)
      .sort((a, b) => advancement(b) - advancement(a) || a.position.col - b.position.col);

    sideTowers.forEach((t, index) => {
      const col = fillFromLeft ? index : 7 - index;
      towers[t.id] = { ...t, position: { row: homeRow, col } };
    });
  }

  const nextChallenger =
    state.roundWinner !== undefined ? otherSide(state.roundWinner) : state.activePlayer;

  return {
    ...state,
    towers,
    boardLayout: cloneBoard(BOARD_LAYOUT),
    currentRound: state.currentRound + 1,
    status: GameStatus.IN_PROGRESS,
    activePlayer: nextChallenger,
    requiredColor: null,
    lastMove: null,
    lastPhysicalMover: null,
    consecutivePasses: 0,
    roundWinner: undefined,
    roundOverReason: undefined,
    lastClockUpdate: Date.now(),
  };
}

/**
 * Deducts elapsed real time (since `state.lastClockUpdate`) from the active
 * player's clock and advances `lastClockUpdate` to `now`. Not part of
 * IKamisadoEngine (the spec's contract is silent on clock semantics beyond
 * the two GameState fields) - callers that use timed matches should call
 * this immediately before `applyMove` so the mover's used thinking time is
 * actually deducted, and untimed games (the default) should simply never
 * call it. Never lets a clock go negative.
 */
export function tickClock(state: GameState, now: number): GameState {
  if (state.status !== GameStatus.IN_PROGRESS) return state;
  const mover = state.activePlayer;
  const elapsed = Math.max(0, now - state.lastClockUpdate);
  const remaining = Math.max(0, state.clocks[mover] - elapsed);
  return { ...state, clocks: { ...state.clocks, [mover]: remaining }, lastClockUpdate: now };
}

/** Adds a post-move increment to the side that just moved (standard
 * "Fischer" increment semantics), e.g. Blitz's +2s per move. */
export function applyClockIncrement(state: GameState, side: PlayerSide, incrementMs: number): GameState {
  if (incrementMs <= 0) return state;
  const next = state.clocks[side] + incrementMs;
  return { ...state, clocks: { ...state.clocks, [side]: next } };
}

/**
 * Ticks the clock forward to `now` and, if that leaves the active player's
 * clock at zero, ends the round in their opponent's favor by timeout.
 * Returns `null` if the game isn't in progress or nobody has timed out.
 * Callers driving a timed match should poll this independently of move
 * submission (a player who simply stops moving still needs to lose on time).
 */
export function checkTimeout(state: GameState, now: number): MoveResult | null {
  if (state.status !== GameStatus.IN_PROGRESS) return null;
  const ticked = tickClock(state, now);
  if (ticked.clocks[ticked.activePlayer] > 0) return null;

  const winner = otherSide(ticked.activePlayer);
  const finalState: GameState = {
    ...ticked,
    status: GameStatus.ROUND_OVER,
    roundWinner: winner,
    roundOverReason: 'TIMEOUT',
  };
  return { success: true, state: finalState, isRoundOver: true, roundWinner: winner };
}

export const engine: IKamisadoEngine = {
  createGame,
  getLegalMoves,
  applyMove,
  handlePassOrDeadlock,
  regroupForNextRound,
};
