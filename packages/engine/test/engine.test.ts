import { describe, expect, it } from 'vitest';
import {
  BOARD_LAYOUT,
  Color,
  GameState,
  GameStatus,
  MatchFormat,
  Move,
  MoveType,
  PlayerSide,
  SumoRank,
  Tower,
  applyClockIncrement,
  applyMove,
  checkTimeout,
  colorAt,
  createGame,
  findTower,
  getLegalMoves,
  handlePassOrDeadlock,
  regroupForNextRound,
  reseatForNextRound,
  tickClock,
  towerId,
} from '../src/index.js';

function fresh(format: MatchFormat = MatchFormat.STANDARD): GameState {
  return createGame(format, 0);
}

/** Returns a new state with one tower's position (and optionally rank) overridden. */
function place(
  state: GameState,
  side: PlayerSide,
  color: Color,
  row: number,
  col: number,
  sumoRank: SumoRank = SumoRank.NORMAL,
): GameState {
  const id = towerId(side, color);
  const existing = state.towers[id];
  if (!existing) throw new Error(`missing tower ${id}`);
  return { ...state, towers: { ...state.towers, [id]: { ...existing, position: { row, col }, sumoRank } } };
}

function patch(state: GameState, partial: Partial<GameState>): GameState {
  return { ...state, ...partial };
}

function tower(state: GameState, side: PlayerSide, color: Color): Tower {
  const t = findTower(state, side, color);
  if (!t) throw new Error(`missing tower ${side} ${color}`);
  return t;
}

function standardMove(side: PlayerSide, color: Color, from: [number, number], to: [number, number]): Move {
  return {
    type: MoveType.STANDARD,
    playerSide: side,
    towerColor: color,
    from: { row: from[0], col: from[1] },
    to: { row: to[0], col: to[1] },
  };
}

function pushMove(side: PlayerSide, color: Color, from: [number, number], to: [number, number]): Move {
  return {
    type: MoveType.SUMO_PUSH,
    playerSide: side,
    towerColor: color,
    from: { row: from[0], col: from[1] },
    to: { row: to[0], col: to[1] },
  };
}

function passMove(side: PlayerSide, color: Color, at: [number, number]): Move {
  return {
    type: MoveType.PASS,
    playerSide: side,
    towerColor: color,
    from: { row: at[0], col: at[1] },
    to: { row: at[0], col: at[1] },
  };
}

describe('Suite 1: Movement & Geometric Validation', () => {
  it('Test 1: legal forward straight move', () => {
    const state = fresh();
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [3, 0]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.BLACK, Color.BROWN).position).toEqual({ row: 3, col: 0 });
    expect(result.state!.requiredColor).toBe(colorAt(BOARD_LAYOUT, 3, 0));
  });

  it('Test 2: legal forward diagonal move', () => {
    const state = fresh();
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.RED, [0, 2], [3, 5]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.BLACK, Color.RED).position).toEqual({ row: 3, col: 5 });
  });

  it('Test 3: backward move rejection', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 4, 4);
    state = patch(state, { requiredColor: null });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [4, 4], [3, 4]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ILLEGAL_DIRECTION');
  });

  it('Test 4: sideways move rejection', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 4, 4);
    state = patch(state, { requiredColor: null });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [4, 4], [4, 5]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ILLEGAL_DIRECTION');
  });

  it('Test 5: obstruction / jumping over pieces rejected', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.YELLOW, 0, 3);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 2, 3);
    state = patch(state, { requiredColor: null });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.YELLOW, [0, 3], [4, 3]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('PATH_OBSTRUCTED');
  });

  it('Test 6: destination occupied rejected', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.YELLOW, 0, 3);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 3);
    state = patch(state, { requiredColor: null });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.YELLOW, [0, 3], [3, 3]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('DESTINATION_OCCUPIED');
  });

  it('Test 7: corner-touching diagonal clearance (Rule M4)', () => {
    let state = fresh();
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 3);
    state = place(state, PlayerSide.BLACK, Color.GREEN, 4, 4);
    state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 3);
    state = patch(state, { requiredColor: null, activePlayer: PlayerSide.GOLD });
    const result = applyMove(state, standardMove(PlayerSide.GOLD, Color.BLUE, [4, 3], [3, 4]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.GOLD, Color.BLUE).position).toEqual({ row: 3, col: 4 });
  });
});

describe('Suite 2: Color Forcing & Turn Constraints', () => {
  it('Test 8: opening move freedom', () => {
    const state = fresh();
    for (const color of [Color.YELLOW, Color.ORANGE, Color.GREEN]) {
      const t = tower(state, PlayerSide.BLACK, color);
      const dest: [number, number] = [t.position.row + 1, t.position.col];
      const result = applyMove(state, standardMove(PlayerSide.BLACK, color, [t.position.row, t.position.col], dest));
      expect(result.success).toBe(true);
    }
  });

  it('Test 9: strict color forcing on subsequent turns', () => {
    let state = fresh();
    const landingColor = colorAt(BOARD_LAYOUT, 3, 2);
    state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: landingColor, lastPhysicalMover: PlayerSide.BLACK });
    const wrong = tower(state, PlayerSide.GOLD, Color.BLUE);
    const mismatch = applyMove(
      state,
      standardMove(PlayerSide.GOLD, Color.BLUE, [wrong.position.row, wrong.position.col], [wrong.position.row - 1, wrong.position.col]),
    );
    expect(mismatch.success).toBe(false);
    expect(mismatch.errorCode).toBe('COLOR_MISMATCH');

    const right = tower(state, PlayerSide.GOLD, landingColor);
    const correct = applyMove(
      state,
      standardMove(PlayerSide.GOLD, landingColor, [right.position.row, right.position.col], [right.position.row - 1, right.position.col]),
    );
    expect(correct.success).toBe(true);
  });

  it('Test 10: mandatory move rule', () => {
    let state = fresh();
    state = place(state, PlayerSide.GOLD, Color.PURPLE, 4, 4);
    state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: Color.PURPLE });
    expect(getLegalMoves(state, Color.PURPLE).length).toBeGreaterThan(0);

    const passAttempt = applyMove(state, passMove(PlayerSide.GOLD, Color.PURPLE, [4, 4]));
    expect(passAttempt.success).toBe(false);
    expect(passAttempt.errorCode).toBe('MANDATORY_MOVE');

    const differentTower = tower(state, PlayerSide.GOLD, Color.BLUE);
    const switchAttempt = applyMove(
      state,
      standardMove(PlayerSide.GOLD, Color.BLUE, [differentTower.position.row, differentTower.position.col], [
        differentTower.position.row - 1,
        differentTower.position.col,
      ]),
    );
    expect(switchAttempt.success).toBe(false);
  });
});

describe('Suite 3: Stymie (Pass) & Deadlock Adjudication', () => {
  it('Test 11: stymie pass automation', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.PURPLE, 2, 4);
    // Block all three forward cells of the Purple tower.
    state = place(state, PlayerSide.GOLD, Color.RED, 3, 3);
    state = place(state, PlayerSide.GOLD, Color.YELLOW, 3, 4);
    state = place(state, PlayerSide.GOLD, Color.PINK, 3, 5);
    expect(getLegalMoves(patch(state, { activePlayer: PlayerSide.BLACK }), Color.PURPLE)).toHaveLength(0);

    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.PURPLE, lastPhysicalMover: PlayerSide.GOLD });
    const result = handlePassOrDeadlock(state);
    expect(result.success).toBe(true);
    expect(result.isRoundOver).toBeFalsy();
    expect(result.state!.activePlayer).toBe(PlayerSide.GOLD);
    expect(result.state!.requiredColor).toBe(colorAt(BOARD_LAYOUT, 2, 4));
  });

  it('Test 12: two-tower deadlock causes last mover loss', () => {
    let state = fresh();
    // Gold's Blue tower sits on an Orange square (3,4); Black's Orange tower sits
    // on a Blue square (2,0) (verified via colorAt).
    expect(colorAt(BOARD_LAYOUT, 3, 4)).toBe(Color.ORANGE);
    expect(colorAt(BOARD_LAYOUT, 2, 0)).toBe(Color.BLUE);

    state = place(state, PlayerSide.GOLD, Color.BLUE, 3, 4);
    state = place(state, PlayerSide.BLACK, Color.ORANGE, 2, 0);

    // Block Gold's Blue tower at (3,4): forward cells are (2,3), (2,4), (2,5)
    state = place(state, PlayerSide.GOLD, Color.GREEN, 2, 3);
    state = place(state, PlayerSide.GOLD, Color.RED, 2, 4);
    state = place(state, PlayerSide.GOLD, Color.YELLOW, 2, 5);

    // Block Black's Orange tower at (2,0): forward cells are (3,0), (3,1)
    state = place(state, PlayerSide.BLACK, Color.PINK, 3, 0);
    state = place(state, PlayerSide.BLACK, Color.PURPLE, 3, 1);

    state = patch(state, { activePlayer: PlayerSide.GOLD, requiredColor: Color.BLUE, lastPhysicalMover: PlayerSide.BLACK });
    const result = handlePassOrDeadlock(state);
    expect(result.isRoundOver).toBe(true);
    expect(result.roundWinner).toBe(PlayerSide.GOLD);
    expect(result.state!.roundOverReason).toBe('DEADLOCK');
  });

  it('Test 13: multi-tower circular deadlock', () => {
    let state = fresh();
    // Chain: (BLACK,BROWN)@(1,0) -> pass -> (GOLD,PURPLE)@(6,4) [forced, since
    // colorAt(1,0)=PURPLE] -> pass -> (BLACK,BLUE)@(2,3) [forced, since
    // colorAt(6,4)=BLUE] -> pass -> back to (GOLD,PURPLE) [colorAt(2,3)=PURPLE],
    // repeating an already-seen impasse.
    expect(colorAt(BOARD_LAYOUT, 1, 0)).toBe(Color.PURPLE);
    expect(colorAt(BOARD_LAYOUT, 6, 4)).toBe(Color.BLUE);
    expect(colorAt(BOARD_LAYOUT, 2, 3)).toBe(Color.PURPLE);

    state = place(state, PlayerSide.BLACK, Color.BROWN, 1, 0);
    state = place(state, PlayerSide.GOLD, Color.PURPLE, 6, 4);
    state = place(state, PlayerSide.BLACK, Color.BLUE, 2, 3);

    // Block BLACK_BROWN@(1,0): forward cells (2,0),(2,1).
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 2, 0);
    state = place(state, PlayerSide.GOLD, Color.YELLOW, 2, 1);

    // Block GOLD_PURPLE@(6,4): forward cells (5,3),(5,4),(5,5).
    state = place(state, PlayerSide.BLACK, Color.GREEN, 5, 3);
    state = place(state, PlayerSide.BLACK, Color.RED, 5, 4);
    state = place(state, PlayerSide.BLACK, Color.PINK, 5, 5);

    // Block BLACK_BLUE@(2,3): forward cells (3,2),(3,3),(3,4).
    state = place(state, PlayerSide.GOLD, Color.PINK, 3, 2);
    state = place(state, PlayerSide.GOLD, Color.BROWN, 3, 3);
    state = place(state, PlayerSide.GOLD, Color.RED, 3, 4);

    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN, lastPhysicalMover: PlayerSide.GOLD });
    const result = handlePassOrDeadlock(state);
    expect(result.isRoundOver).toBe(true);
    expect(result.roundWinner).toBe(PlayerSide.BLACK);
    expect(result.state!.roundOverReason).toBe('DEADLOCK');
  });
});

describe('Suite 4: Victory Conditions & Round Scoring', () => {
  it('Test 14: baseline reach immediate victory', () => {
    let state = fresh();
    state = place(state, PlayerSide.GOLD, Color.PURPLE, 1, 7); // vacate (7,2)
    state = place(state, PlayerSide.BLACK, Color.BROWN, 6, 2);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [6, 2], [7, 2]));
    expect(result.success).toBe(true);
    expect(result.isRoundOver).toBe(true);
    expect(result.roundWinner).toBe(PlayerSide.BLACK);
    expect(result.isMatchOver).toBe(false);
    expect(tower(result.state!, PlayerSide.BLACK, Color.BROWN).sumoRank).toBe(SumoRank.SINGLE);
    expect(result.state!.scores[PlayerSide.BLACK].points).toBe(1);
  });

  it('Test 15: match victory point threshold', () => {
    let state = fresh(MatchFormat.STANDARD);
    state = patch(state, {
      scores: {
        ...state.scores,
        [PlayerSide.BLACK]: { side: PlayerSide.BLACK, points: 2, roundsWon: 2 },
      },
    });
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 1, 6); // vacate (7,0)
    state = place(state, PlayerSide.BLACK, Color.GREEN, 6, 0);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.GREEN });
    const result = applyMove(state, standardMove(PlayerSide.BLACK, Color.GREEN, [6, 0], [7, 0]));
    expect(result.success).toBe(true);
    expect(result.isMatchOver).toBe(true);
    expect(result.matchWinner).toBe(PlayerSide.BLACK);
    expect(result.state!.scores[PlayerSide.BLACK].points).toBe(3);
  });
});

describe('Suite 5: Sumo Mechanics & Sumo Pushing', () => {
  it('Test 16: single sumo movement range limit (max 5)', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.SINGLE);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const tooFar = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [6, 0]));
    expect(tooFar.success).toBe(false);
    expect(tooFar.errorCode).toBe('EXCEEDS_SUMO_RANGE');
    const ok = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [5, 0]));
    expect(ok.success).toBe(true);
  });

  it('Test 17: double and triple sumo range limits', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.DOUBLE);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    expect(applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [4, 0])).success).toBe(false);
    expect(applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [3, 0])).success).toBe(true);

    let state2 = fresh();
    state2 = place(state2, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.TRIPLE);
    state2 = patch(state2, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    expect(applyMove(state2, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [2, 0])).success).toBe(false);
    expect(applyMove(state2, standardMove(PlayerSide.BLACK, Color.BROWN, [0, 0], [1, 0])).success).toBe(true);
  });

  it('Test 18: legal sumo push execution', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [3, 3], [4, 3]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.BLACK, Color.BROWN).position).toEqual({ row: 4, col: 3 });
    expect(tower(result.state!, PlayerSide.GOLD, Color.ORANGE).position).toEqual({ row: 5, col: 3 });
    expect(result.state!.activePlayer).toBe(PlayerSide.BLACK);
    expect(result.state!.requiredColor).toBe(colorAt(BOARD_LAYOUT, 5, 3));
  });

  it('Test 19: sumo push diagonal attempt rejected', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 4);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [3, 3], [4, 4]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ILLEGAL_SUMO_PUSH_DIRECTION');
  });

  it('Test 20: sumo push with occupied rear cell rejected', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3);
    state = place(state, PlayerSide.BLACK, Color.GREEN, 5, 3);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [3, 3], [4, 3]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SUMO_PUSH_BLOCKED');
  });

  it('Test 21: sumo push on home row rejected (Rule S6)', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 6, 3, SumoRank.SINGLE);
    // GOLD_PINK already defaults to (7,3), which is Gold's own home row.
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [6, 3], [7, 3]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('CANNOT_PUSH_OFF_BOARD');
  });

  it('Test 22: sumo immunity - equal rank push rejected (Rule S8)', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3, SumoRank.SINGLE);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [3, 3], [4, 3]));
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('SUMO_IMMUNITY');
  });

  it('Test 23: sumo rank superiority push allowed', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.DOUBLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3, SumoRank.SINGLE);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [3, 3], [4, 3]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.GOLD, Color.ORANGE).position).toEqual({ row: 5, col: 3 });
  });

  it('Test 24: multi-piece push by double sumo', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 2, 2, SumoRank.DOUBLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 2);
    state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 2);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    const result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, [2, 2], [3, 2]));
    expect(result.success).toBe(true);
    expect(tower(result.state!, PlayerSide.BLACK, Color.BROWN).position).toEqual({ row: 3, col: 2 });
    expect(tower(result.state!, PlayerSide.GOLD, Color.ORANGE).position).toEqual({ row: 4, col: 2 });
    expect(tower(result.state!, PlayerSide.GOLD, Color.BLUE).position).toEqual({ row: 5, col: 2 });
  });

  it('Test 25: forced sumo push (Rule S11)', () => {
    let state = fresh();
    state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE);
    state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3);
    // Block both diagonals so the push is the only legal action.
    state = place(state, PlayerSide.GOLD, Color.GREEN, 4, 2);
    state = place(state, PlayerSide.GOLD, Color.RED, 4, 4);
    state = patch(state, { activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN });
    expect(getLegalMoves(state, Color.BROWN)).toHaveLength(1);
    const passAttempt = applyMove(state, passMove(PlayerSide.BLACK, Color.BROWN, [3, 3]));
    expect(passAttempt.success).toBe(false);
    expect(passAttempt.errorCode).toBe('MANDATORY_PUSH');
  });
});

describe('Clock handling (beyond the 25 mandatory cases: tickClock/checkTimeout/applyClockIncrement)', () => {
  it('tickClock deducts elapsed time from the active player only', () => {
    let state = fresh();
    state = patch(state, { clocks: { BLACK: 60_000, GOLD: 60_000 }, lastClockUpdate: 1_000, activePlayer: PlayerSide.BLACK });
    const ticked = tickClock(state, 1_000 + 12_345);
    expect(ticked.clocks[PlayerSide.BLACK]).toBe(60_000 - 12_345);
    expect(ticked.clocks[PlayerSide.GOLD]).toBe(60_000);
    expect(ticked.lastClockUpdate).toBe(1_000 + 12_345);
  });

  it('tickClock never lets a clock go negative', () => {
    let state = fresh();
    state = patch(state, { clocks: { BLACK: 500, GOLD: 60_000 }, lastClockUpdate: 0, activePlayer: PlayerSide.BLACK });
    const ticked = tickClock(state, 10_000);
    expect(ticked.clocks[PlayerSide.BLACK]).toBe(0);
  });

  it('checkTimeout returns null while time remains', () => {
    let state = fresh();
    state = patch(state, { clocks: { BLACK: 60_000, GOLD: 60_000 }, lastClockUpdate: 0 });
    expect(checkTimeout(state, 30_000)).toBeNull();
  });

  it('checkTimeout ends the round for the opponent once the active player flags', () => {
    let state = fresh();
    state = patch(state, { clocks: { BLACK: 1_000, GOLD: 60_000 }, lastClockUpdate: 0, activePlayer: PlayerSide.BLACK });
    const result = checkTimeout(state, 5_000);
    expect(result).not.toBeNull();
    expect(result!.isRoundOver).toBe(true);
    expect(result!.roundWinner).toBe(PlayerSide.GOLD);
    expect(result!.state!.roundOverReason).toBe('TIMEOUT');
    expect(result!.state!.clocks[PlayerSide.BLACK]).toBe(0);
  });

  it('applyClockIncrement adds Fischer-style bonus time to the side that just moved', () => {
    let state = fresh();
    state = patch(state, { clocks: { BLACK: 10_000, GOLD: 10_000 } });
    const next = applyClockIncrement(state, PlayerSide.BLACK, 2_000);
    expect(next.clocks[PlayerSide.BLACK]).toBe(12_000);
    expect(next.clocks[PlayerSide.GOLD]).toBe(10_000);
  });
});

describe('Between rounds: reseatForNextRound (house rule - same colour order every round)', () => {
  /** A finished round: scattered towers, one Sumo, Black won by reaching row 7. */
  function finishedRound(): GameState {
    let state = fresh(MatchFormat.STANDARD);
    state = place(state, PlayerSide.BLACK, Color.RED, 7, 2, SumoRank.SINGLE);
    state = place(state, PlayerSide.BLACK, Color.PINK, 3, 4);
    state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 6);
    state = place(state, PlayerSide.GOLD, Color.GREEN, 1, 0, SumoRank.DOUBLE);
    return patch(state, {
      status: GameStatus.ROUND_OVER,
      roundWinner: PlayerSide.BLACK,
      roundOverReason: 'BASELINE_REACHED',
      requiredColor: Color.BLUE,
      lastPhysicalMover: PlayerSide.BLACK,
    });
  }

  it('puts every tower back on the home square of its own colour, for both sides', () => {
    const next = reseatForNextRound(finishedRound());
    const opening = fresh();
    for (const [id, t] of Object.entries(opening.towers)) {
      expect(next.towers[id]!.position).toEqual(t.position);
    }
    // each home square really is the tower's own colour (round-1 colour order)
    for (const t of Object.values(next.towers)) {
      expect(colorAt(BOARD_LAYOUT, t.position.row, t.position.col)).toBe(t.color);
    }
  });

  it('gives the same arrangement no matter where towers ended the round', () => {
    const a = reseatForNextRound(finishedRound());
    const b = reseatForNextRound(patch(fresh(MatchFormat.STANDARD), { status: GameStatus.ROUND_OVER, roundWinner: PlayerSide.BLACK }));
    expect(a.towers).toEqual({
      ...b.towers,
      [towerId(PlayerSide.BLACK, Color.RED)]: { ...b.towers[towerId(PlayerSide.BLACK, Color.RED)]!, sumoRank: SumoRank.SINGLE },
      [towerId(PlayerSide.GOLD, Color.GREEN)]: { ...b.towers[towerId(PlayerSide.GOLD, Color.GREEN)]!, sumoRank: SumoRank.DOUBLE },
    });
  });

  it('keeps sumo ranks and scores, advances the round, and lets the loser open', () => {
    const before = finishedRound();
    const next = reseatForNextRound(before);
    expect(tower(next, PlayerSide.BLACK, Color.RED).sumoRank).toBe(SumoRank.SINGLE);
    expect(tower(next, PlayerSide.GOLD, Color.GREEN).sumoRank).toBe(SumoRank.DOUBLE);
    expect(next.scores).toEqual(before.scores);
    expect(next.currentRound).toBe(before.currentRound + 1);
    expect(next.status).toBe(GameStatus.IN_PROGRESS);
    expect(next.activePlayer).toBe(PlayerSide.GOLD); // Black won, so Gold (loser) opens
    expect(next.requiredColor).toBeNull();
    expect(next.lastMove).toBeNull();
    expect(next.roundWinner).toBeUndefined();
    expect(next.roundOverReason).toBeUndefined();
  });

  it('does not mutate the finished state', () => {
    const before = finishedRound();
    const snapshot = JSON.stringify(before);
    reseatForNextRound(before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('official regroupForNextRound stays available and still mirrors with fill direction', () => {
    const before = finishedRound();
    const left = regroupForNextRound(before, true);
    const right = regroupForNextRound(before, false);
    expect(tower(left, PlayerSide.BLACK, Color.RED).position).toEqual({ row: 0, col: 0 }); // most advanced first
    expect(tower(right, PlayerSide.BLACK, Color.RED).position).toEqual({ row: 0, col: 7 });
    expect(left.currentRound).toBe(before.currentRound + 1);
  });
});
