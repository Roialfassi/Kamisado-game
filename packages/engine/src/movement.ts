import { isInBounds } from './board.js';
import { Color, Coordinate, GameState, MoveType, PlayerSide, SumoRank, Tower, Move } from './types.js';

/** +1 for Black (moves toward increasing row), -1 for Gold (toward decreasing row). */
export function forwardDir(side: PlayerSide): 1 | -1 {
  return side === PlayerSide.BLACK ? 1 : -1;
}

/** The row a tower must reach to win the round (the opponent's home row). */
export function opponentHomeRow(side: PlayerSide): number {
  return side === PlayerSide.BLACK ? 7 : 0;
}

/** The row this side's towers started on (its own home row). */
export function ownHomeRow(side: PlayerSide): number {
  return side === PlayerSide.BLACK ? 0 : 7;
}

export function maxRange(rank: SumoRank): number {
  switch (rank) {
    case SumoRank.NORMAL:
      return 7;
    case SumoRank.SINGLE:
      return 5;
    case SumoRank.DOUBLE:
      return 3;
    case SumoRank.TRIPLE:
      return 1;
  }
}

export function maxPushes(rank: SumoRank): number {
  switch (rank) {
    case SumoRank.NORMAL:
      return 0;
    case SumoRank.SINGLE:
      return 1;
    case SumoRank.DOUBLE:
      return 2;
    case SumoRank.TRIPLE:
      return 3;
  }
}

export function findTowerAt(state: GameState, row: number, col: number): Tower | undefined {
  for (const t of Object.values(state.towers)) {
    if (t.position.row === row && t.position.col === col) return t;
  }
  return undefined;
}

export function findTower(state: GameState, side: PlayerSide, color: Color): Tower | undefined {
  for (const t of Object.values(state.towers)) {
    if (t.side === side && t.color === color) return t;
  }
  return undefined;
}

/** The three forward unit vectors: straight, diagonal-left, diagonal-right. */
function forwardVectors(side: PlayerSide): Coordinate[] {
  const dr = forwardDir(side);
  return [
    { row: dr, col: 0 },
    { row: dr, col: -1 },
    { row: dr, col: 1 },
  ];
}

/**
 * All legal STANDARD move destinations for a tower: any distance along the
 * three forward vectors (straight, diagonal-left, diagonal-right), up to the
 * tower's sumo-rank range limit, over a clear path, landing on an empty square.
 */
export function getStandardDestinations(state: GameState, tower: Tower): Coordinate[] {
  const results: Coordinate[] = [];
  const range = maxRange(tower.sumoRank);
  for (const vec of forwardVectors(tower.side)) {
    for (let k = 1; k <= range; k++) {
      const row = tower.position.row + vec.row * k;
      const col = tower.position.col + vec.col * k;
      if (!isInBounds(row, col)) break;
      if (findTowerAt(state, row, col)) break; // occupied: blocks further travel, and can't land here
      results.push({ row, col });
    }
  }
  return results;
}

export function standardMovesFor(state: GameState, tower: Tower): Move[] {
  return getStandardDestinations(state, tower).map((to) => ({
    type: MoveType.STANDARD,
    playerSide: tower.side,
    towerColor: tower.color,
    from: { ...tower.position },
    to,
  }));
}
