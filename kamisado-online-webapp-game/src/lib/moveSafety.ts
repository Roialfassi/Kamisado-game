import { ALL_COLORS, GameState, GameStatus, Move, applyMove, getLegalMoves, handlePassOrDeadlock, opponentHomeRow } from '@kamisado/engine';

/**
 * True if playing `move` hands the opponent an immediate win: either the move
 * ends the round in their favour (e.g. it walks into a deadlock it caused), or
 * the tower its landing colour forces on them can slide straight onto your
 * home row. Used by the optional "blunder guard".
 */
export function allowsImmediateLoss(state: GameState, move: Move): boolean {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) return false;
  let next = applied.state;
  if (next.status === GameStatus.IN_PROGRESS) next = handlePassOrDeadlock(next).state ?? next;
  if (next.status !== GameStatus.IN_PROGRESS) return next.roundWinner !== move.playerSide;
  if (next.activePlayer === move.playerSide) return false; // the opponent is stymied: you move again
  const goal = opponentHomeRow(next.activePlayer);
  const colors = next.requiredColor ? [next.requiredColor] : ALL_COLORS;
  return colors.some((color) => getLegalMoves(next, color).some((m) => m.to.row === goal));
}
