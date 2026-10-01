import { ALL_COLORS, GameState, GameStatus, Move, applyMove, getLegalMoves, handlePassOrDeadlock, opponentHomeRow } from '@kamisado/engine';

/**
 * True if playing `move` hands the opponent an immediate win: either the move
 * ends the round in their favour (e.g. it walks into a deadlock it caused), or
 * the tower its landing colour forces on them can slide straight onto your
 * home row. If the opponent is stymied (or you pushed) and you must move again,
 * the move is flagged only when *every* continuation loses at once. Used by the
 * optional "blunder guard".
 */
export function allowsImmediateLoss(state: GameState, move: Move, depth = 0): boolean {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) return false;
  let next = applied.state;
  if (next.status === GameStatus.IN_PROGRESS) next = handlePassOrDeadlock(next).state ?? next;
  if (next.status !== GameStatus.IN_PROGRESS) return next.roundWinner !== move.playerSide;
  if (next.activePlayer === move.playerSide) {
    // the opponent is stymied (or you pushed): you move again - a blunder only if nothing you can do saves you
    if (depth >= 2) return false;
    const mine = (next.requiredColor ? [next.requiredColor] : ALL_COLORS).flatMap((color) => getLegalMoves(next, color));
    return mine.length > 0 && mine.every((m) => allowsImmediateLoss(next, m, depth + 1));
  }
  const goal = opponentHomeRow(next.activePlayer);
  const colors = next.requiredColor ? [next.requiredColor] : ALL_COLORS;
  return colors.some((color) => getLegalMoves(next, color).some((m) => m.to.row === goal));
}
