import {
  ALL_COLORS,
  Coordinate,
  GameState,
  GameStatus,
  Tower,
  findTower,
  findTowerAt,
  getLegalMoves,
} from '@kamisado/engine';

/** The active player's tower that the colour lock forces them to move, or
 * null on a free-choice turn (the opening move of a round) / a finished round. */
export function getMustMoveTower(state: GameState): Tower | null {
  if (state.status !== GameStatus.IN_PROGRESS || state.requiredColor === null) return null;
  return findTower(state, state.activePlayer, state.requiredColor) ?? null;
}

/** On a free-choice turn: every tower of the active player that has at least
 * one legal move (empty when the colour lock decides, or the round is over). */
export function getPickableTowers(state: GameState): Tower[] {
  if (state.status !== GameStatus.IN_PROGRESS || state.requiredColor !== null) return [];
  return ALL_COLORS.flatMap((color) => {
    const tower = findTower(state, state.activePlayer, color);
    return tower && getLegalMoves(state, color).length > 0 ? [tower] : [];
  });
}

/**
 * The square that should currently read as "clicked" for a player who can act.
 * A valid explicit click wins; otherwise the forced tower is auto-selected so
 * the colour lock is visible without the player having to hunt for the tower.
 * Returns null when it is not the viewer's turn or there is no forced tower.
 */
export function resolveSelection(state: GameState, explicit: Coordinate | null, canAct: boolean): Coordinate | null {
  if (!canAct || state.status !== GameStatus.IN_PROGRESS) return null;
  const forced = getMustMoveTower(state);
  if (explicit) {
    const clicked = findTowerAt(state, explicit.row, explicit.col);
    if (clicked && clicked.side === state.activePlayer && (forced === null || clicked.id === forced.id)) {
      return explicit;
    }
  }
  return forced ? { ...forced.position } : null;
}
