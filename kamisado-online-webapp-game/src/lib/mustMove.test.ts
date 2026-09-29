import { describe, expect, it } from 'vitest';
import { Color, GameStatus, MatchFormat, PlayerSide, applyMove, createGame, getLegalMoves, towerId } from '@kamisado/engine';
import { getMustMoveTower, getPickableTowers, resolveSelection } from './mustMove.js';

/** Black opens with BROWN a1 -> a4; the colour of that square then forces Gold. */
function afterOpening() {
  const start = createGame(MatchFormat.STANDARD);
  const move = getLegalMoves(start, Color.BROWN).find((m) => m.to.row === 3 && m.to.col === 0)!;
  const result = applyMove(start, move);
  expect(result.success).toBe(true);
  return result.state!;
}

describe('must-move helpers', () => {
  it('free-choice opening: nothing is forced, every movable tower is pickable', () => {
    const state = createGame(MatchFormat.STANDARD);
    expect(getMustMoveTower(state)).toBeNull();
    expect(getPickableTowers(state).length).toBeGreaterThan(0);
    expect(resolveSelection(state, null, true)).toBeNull();
  });

  it("after Black's move, Gold's forced tower is found and auto-selected", () => {
    const state = afterOpening();
    expect(state.activePlayer).toBe(PlayerSide.GOLD);
    const forced = getMustMoveTower(state)!;
    expect(forced.side).toBe(PlayerSide.GOLD);
    expect(forced.color).toBe(state.requiredColor);
    expect(getPickableTowers(state)).toEqual([]);
    expect(resolveSelection(state, null, true)).toEqual(forced.position);
  });

  it('a click on a different tower cannot override the forced tower', () => {
    const state = afterOpening();
    const forced = getMustMoveTower(state)!;
    const other = state.towers[towerId(PlayerSide.GOLD, forced.color === Color.RED ? Color.BLUE : Color.RED)]!;
    expect(resolveSelection(state, other.position, true)).toEqual(forced.position);
    expect(resolveSelection(state, { row: 4, col: 4 }, true)).toEqual(forced.position);
    expect(resolveSelection(state, forced.position, true)).toEqual(forced.position);
  });

  it('nothing is selected when the viewer cannot act or the round is over', () => {
    const state = afterOpening();
    expect(resolveSelection(state, null, false)).toBeNull();
    expect(resolveSelection({ ...state, status: GameStatus.ROUND_OVER }, null, true)).toBeNull();
    expect(getMustMoveTower({ ...state, status: GameStatus.ROUND_OVER })).toBeNull();
  });
});
