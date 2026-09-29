import {
  ALL_COLORS,
  GameState,
  GameStatus,
  Move,
  PlayerSide,
  applyMove,
  getLegalMoves,
  handlePassOrDeadlock,
} from '@kamisado/engine';

/** Runs Gold's turn(s) to completion automatically: puzzle positions are
 * constructed so Gold is either fully stymied (handled by
 * handlePassOrDeadlock) or has exactly one legal reply at every step, so
 * there is no real choice for a human to make on Gold's behalf.
 *
 * With `strict`, returns `null` the moment Gold would have more than one
 * legal reply - used by the puzzle verifier to prove a position really is
 * forced. */
export function resolveGoldAndPasses(state: GameState, strict = false): GameState | null {
  let next = state;
  if (next.status === GameStatus.IN_PROGRESS) {
    const resolved = handlePassOrDeadlock(next);
    next = resolved.state ?? next;
  }
  while (next.status === GameStatus.IN_PROGRESS && next.activePlayer === PlayerSide.GOLD) {
    const goldMoves = next.requiredColor ? getLegalMoves(next, next.requiredColor) : [];
    if (strict && (goldMoves.length !== 1 || next.requiredColor === null)) return null;
    const forced = goldMoves[0];
    if (!forced) break; // defensive: shouldn't happen, handlePassOrDeadlock above covers true stymie
    const applied = applyMove(next, forced);
    if (!applied.success || !applied.state) break;
    next = applied.state;
    if (next.status === GameStatus.IN_PROGRESS) {
      const resolved = handlePassOrDeadlock(next);
      next = resolved.state ?? next;
    }
  }
  return next;
}

function blackChoices(state: GameState): Move[] {
  if (state.requiredColor !== null) return getLegalMoves(state, state.requiredColor);
  return ALL_COLORS.flatMap((color) => getLegalMoves(state, color));
}

/** Outcome of Black playing `move` from a Black-to-move position. */
function afterBlackMove(state: GameState, move: Move): { next: GameState; won: boolean; lost: boolean; forced: boolean } {
  const applied = applyMove(state, move);
  if (!applied.success || !applied.state) return { next: state, won: false, lost: true, forced: true };
  const decided = (s: GameState) => s.status !== GameStatus.IN_PROGRESS;
  if (decided(applied.state)) {
    const won = applied.state.roundWinner === PlayerSide.BLACK;
    return { next: applied.state, won, lost: !won, forced: true };
  }
  const resolved = resolveGoldAndPasses(applied.state, true);
  if (resolved === null) return { next: applied.state, won: false, lost: false, forced: false };
  if (decided(resolved)) {
    const won = resolved.roundWinner === PlayerSide.BLACK;
    return { next: resolved, won, lost: !won, forced: true };
  }
  return { next: resolved, won: false, lost: false, forced: true };
}

/** True if Black (to move) can force a win within `movesLeft` of its own
 * moves, with Gold's replies fully forced at every step. */
export function blackForcesWin(state: GameState, movesLeft: number): boolean {
  for (const move of blackChoices(state)) {
    const out = afterBlackMove(state, move);
    if (!out.forced || out.lost) continue;
    if (out.won) return true;
    if (movesLeft > 1 && out.next.activePlayer === PlayerSide.BLACK && blackForcesWin(out.next, movesLeft - 1)) {
      return true;
    }
  }
  return false;
}

/** Every first move that leads to a forced win within `movesLeft` Black moves. */
export function winningFirstMoves(state: GameState, movesLeft: number): Move[] {
  const wins: Move[] = [];
  for (const move of blackChoices(state)) {
    const out = afterBlackMove(state, move);
    if (!out.forced || out.lost) continue;
    if (out.won || (movesLeft > 1 && out.next.activePlayer === PlayerSide.BLACK && blackForcesWin(out.next, movesLeft - 1))) {
      wins.push(move);
    }
  }
  return wins;
}

/** Smallest n <= maxMoves for which Black has a forced win in n moves, or
 * null if there is none within the horizon. */
export function shortestForcedWin(state: GameState, maxMoves: number): number | null {
  for (let n = 1; n <= maxMoves; n++) {
    if (winningFirstMoves(state, n).length > 0) return n;
  }
  return null;
}
