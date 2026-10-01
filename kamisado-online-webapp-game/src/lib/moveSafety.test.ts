import { describe, expect, it } from 'vitest';
import { Color, MatchFormat, PlayerSide, createGame, getLegalMoves, towerId } from '@kamisado/engine';
import type { GameState } from '@kamisado/engine';
import { allowsImmediateLoss } from './moveSafety.js';

function place(state: GameState, side: PlayerSide, color: Color, row: number, col: number): GameState {
  const id = towerId(side, color);
  return { ...state, towers: { ...state.towers, [id]: { ...state.towers[id]!, position: { row, col } } } };
}

describe('allowsImmediateLoss', () => {
  // Gold's GREEN tower on (1,6) has a clear slide to (0,6) once Black's BLUE has left home.
  let state = createGame(MatchFormat.STANDARD);
  state = place(state, PlayerSide.GOLD, Color.GREEN, 1, 6);
  state = place(state, PlayerSide.BLACK, Color.BLUE, 3, 3);
  state = { ...state, activePlayer: PlayerSide.BLACK, requiredColor: Color.RED };
  const moves = getLegalMoves(state, Color.RED);

  it('flags a move that lands on the colour of a tower with a clear path home', () => {
    const toGreen = moves.find((m) => m.to.row === 3 && m.to.col === 2)!; // (3,2) is a GREEN square
    expect(allowsImmediateLoss(state, toGreen)).toBe(true);
  });

  it('does not flag a move onto a colour whose tower cannot win at once', () => {
    const toBlue = moves.find((m) => m.to.row === 3 && m.to.col === 5)!; // (3,5) is BLUE: Gold BLUE is still at home
    expect(allowsImmediateLoss(state, toBlue)).toBe(false);
  });

  it('never flags a winning move', () => {
    let s = createGame(MatchFormat.SINGLE_ROUND);
    s = place(s, PlayerSide.BLACK, Color.BROWN, 5, 4);
    s = place(s, PlayerSide.GOLD, Color.PURPLE, 1, 7);
    s = { ...s, activePlayer: PlayerSide.BLACK, requiredColor: Color.BROWN };
    const win = getLegalMoves(s, Color.BROWN).find((m) => m.to.row === 7)!;
    expect(allowsImmediateLoss(s, win)).toBe(false);
  });
});
