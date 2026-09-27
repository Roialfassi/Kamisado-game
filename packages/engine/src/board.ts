import { Color } from './types.js';

/**
 * The authentic official 8x8 Kamisado color matrix, indexed [row][col]:
 * - row 0 = Black's home row (file a [col 0] to file h [col 7])
 * - row 7 = Gold's home row
 *
 * This is the authentic, historical Latin-square layout designed by Peter Burley
 * (matching the official physical game and verified from the standard game board):
 * - Exactly 180° rotational symmetry: color(r, c) === color(7-r, 7-c).
 * - The entire main diagonal from (0,0) to (7,7) is BROWN.
 * - Every row and column contains all 8 colors exactly once.
 */
export const BOARD_LAYOUT: Color[][] = [
  // Rank 1 (Row 0 - Black Home Row):
  [Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW, Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE],
  // Rank 2 (Row 1):
  [Color.PURPLE, Color.BROWN, Color.YELLOW, Color.BLUE, Color.GREEN, Color.PINK, Color.ORANGE, Color.RED],
  // Rank 3 (Row 2):
  [Color.BLUE, Color.YELLOW, Color.BROWN, Color.PURPLE, Color.RED, Color.ORANGE, Color.PINK, Color.GREEN],
  // Rank 4 (Row 3):
  [Color.YELLOW, Color.RED, Color.GREEN, Color.BROWN, Color.ORANGE, Color.BLUE, Color.PURPLE, Color.PINK],
  // Rank 5 (Row 4):
  [Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE, Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW],
  // Rank 6 (Row 5):
  [Color.GREEN, Color.PINK, Color.ORANGE, Color.RED, Color.PURPLE, Color.BROWN, Color.YELLOW, Color.BLUE],
  // Rank 7 (Row 6):
  [Color.RED, Color.ORANGE, Color.PINK, Color.GREEN, Color.BLUE, Color.YELLOW, Color.BROWN, Color.PURPLE],
  // Rank 8 (Row 7 - Gold Home Row):
  [Color.ORANGE, Color.BLUE, Color.PURPLE, Color.PINK, Color.YELLOW, Color.RED, Color.GREEN, Color.BROWN],
];

export const BOARD_SIZE = 8;

export function colorAt(board: Color[][], row: number, col: number): Color {
  const rowArr = board[row];
  if (!rowArr) throw new Error(`Row ${row} out of bounds`);
  const c = rowArr[col];
  if (!c) throw new Error(`Col ${col} out of bounds`);
  return c;
}

export function isInBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

export function cloneBoard(board: Color[][]): Color[][] {
  return board.map((row) => row.slice());
}
