import { isInBounds } from './board.js';
import { Coordinate, EngineErrorCode, GameState, Move, MoveType, Tower } from './types.js';
import { findTowerAt, forwardDir, maxPushes } from './movement.js';

export type SumoPushAnalysis =
  | { ok: true; move: Move; pushedTowers: Tower[]; landingCell: Coordinate }
  | { ok: false; code: EngineErrorCode | 'NO_CONTACT' };

/**
 * Analyzes the single straight-forward Sumo push available to `tower`, if any.
 * A push shoves a contiguous chain of opponent towers (starting immediately
 * ahead) back by one square. Rules enforced: orthogonal-forward only (S3),
 * home-row immunity so nobody is pushed off the board (S6), rank immunity
 * against equal-or-higher Sumo tiers (S8), and the push-count capacity per
 * Sumo rank (5.2). `NO_CONTACT` just means there is nothing to push, which is
 * not itself illegal - it means this move option simply does not exist.
 */
export function analyzeSumoPush(state: GameState, tower: Tower): SumoPushAnalysis {
  const capacity = maxPushes(tower.sumoRank);
  if (capacity === 0) return { ok: false, code: 'NO_CONTACT' };

  const dr = forwardDir(tower.side);
  const startRow = tower.position.row + dr;
  const col = tower.position.col;
  if (!isInBounds(startRow, col)) return { ok: false, code: 'NO_CONTACT' };

  const contact = findTowerAt(state, startRow, col);
  if (!contact || contact.side === tower.side) return { ok: false, code: 'NO_CONTACT' };

  const chain: Tower[] = [];
  let row = startRow;
  while (true) {
    const occupant = findTowerAt(state, row, col);
    if (!occupant) break; // landing cell found
    if (occupant.side === tower.side) {
      // A friendly piece blocks the rear of the chain: no legal landing cell.
      return { ok: false, code: 'SUMO_PUSH_BLOCKED' };
    }
    if (occupant.sumoRank >= tower.sumoRank) {
      return { ok: false, code: 'SUMO_IMMUNITY' };
    }
    chain.push(occupant);
    if (chain.length > capacity) {
      return { ok: false, code: 'SUMO_PUSH_BLOCKED' };
    }
    row += dr;
    if (!isInBounds(row, col)) {
      // Ran off the board before finding an empty landing cell: the last
      // piece in the chain is sitting on its own home row (S6).
      return { ok: false, code: 'CANNOT_PUSH_OFF_BOARD' };
    }
  }

  // `row` now points at the verified in-bounds, empty landing cell for the
  // far end of the chain (the while loop above already rejected any
  // off-board landing, which is what home-row immunity (S6) prevents).
  const pushedTowers: Tower[] = chain.map((piece) => ({
    ...piece,
    position: { row: piece.position.row + dr, col: piece.position.col },
  }));

  const move: Move = {
    type: MoveType.SUMO_PUSH,
    playerSide: tower.side,
    towerColor: tower.color,
    from: { ...tower.position },
    to: { row: startRow, col },
    pushedTowers,
  };

  return { ok: true, move, pushedTowers, landingCell: { row, col } };
}
