import { useCallback, useMemo, useState } from 'react';
import {
  Coordinate,
  GameState,
  GameStatus,
  Move,
  PlayerSide,
  applyMove,
  findTowerAt,
  getLegalMoves,
  handlePassOrDeadlock,
} from '@kamisado/engine';
import { Puzzle } from './data.js';

export type PuzzleStatus = 'PLAYING' | 'SOLVED' | 'FAILED';

/** Runs Gold's turn(s) to completion automatically: these puzzle positions
 * are constructed so Gold is either fully stymied (handled by
 * handlePassOrDeadlock) or has exactly one legal reply at every step, so
 * there is no real choice for a human to make on Gold's behalf. */
function resolveGoldAndPasses(state: GameState): GameState {
  let next = state;
  if (next.status === GameStatus.IN_PROGRESS) {
    const resolved = handlePassOrDeadlock(next);
    next = resolved.state ?? next;
  }
  while (next.status === GameStatus.IN_PROGRESS && next.activePlayer === PlayerSide.GOLD) {
    const goldMoves = next.requiredColor ? getLegalMoves(next, next.requiredColor) : [];
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

export function usePuzzle(puzzle: Puzzle) {
  const [state, setState] = useState<GameState>(() => puzzle.build());
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [movesUsed, setMovesUsed] = useState(0);
  const [status, setStatus] = useState<PuzzleStatus>('PLAYING');

  const legalDestinations = useMemo<Move[]>(() => {
    if (!selected || status !== 'PLAYING') return [];
    const tower = findTowerAt(state, selected.row, selected.col);
    if (!tower || tower.side !== PlayerSide.BLACK || tower.side !== state.activePlayer) return [];
    return getLegalMoves(state, tower.color);
  }, [state, selected, status]);

  const reset = useCallback(() => {
    setState(puzzle.build());
    setSelected(null);
    setMovesUsed(0);
    setStatus('PLAYING');
  }, [puzzle]);

  const commitMove = useCallback(
    (move: Move) => {
      const applied = applyMove(state, move);
      if (!applied.success || !applied.state) return;

      const usedNow = movesUsed + 1;
      const resolved = resolveGoldAndPasses(applied.state);

      setState(resolved);
      setMovesUsed(usedNow);
      setSelected(null);

      if (resolved.status !== GameStatus.IN_PROGRESS) {
        setStatus(resolved.roundWinner === PlayerSide.BLACK ? 'SOLVED' : 'FAILED');
      } else if (usedNow >= puzzle.mateIn) {
        setStatus('FAILED');
      }
    },
    [state, movesUsed, puzzle.mateIn],
  );

  const selectSquare = useCallback(
    (coord: Coordinate) => {
      if (status !== 'PLAYING' || state.activePlayer !== PlayerSide.BLACK) return;

      if (selected) {
        const match = legalDestinations.find((m) => m.to.row === coord.row && m.to.col === coord.col);
        if (match) {
          commitMove(match);
          return;
        }
      }

      const tower = findTowerAt(state, coord.row, coord.col);
      if (!tower || tower.side !== PlayerSide.BLACK) {
        setSelected(null);
        return;
      }
      if (state.requiredColor !== null && tower.color !== state.requiredColor) {
        setSelected(null);
        return;
      }
      setSelected(coord);
    },
    [state, selected, legalDestinations, status, commitMove],
  );

  return {
    state,
    selected,
    legalDestinations,
    movesUsed,
    status,
    movesRemaining: Math.max(0, puzzle.mateIn - movesUsed),
    selectSquare,
    reset,
  };
}
