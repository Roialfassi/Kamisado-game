import { Color } from './types.js';

/**
 * The official 8x8 Kamisado color matrix, indexed [row][col], row 0 = Black's
 * home row, row 7 = Gold's home row (col 0 = file a .. col 7 = file h).
 *
 * Constructed from the four "opposite color pairs" implied by the fixed home
 * rows (BROWN<->ORANGE, GREEN<->BLUE, RED<->PURPLE, YELLOW<->PINK): each row is
 * a cyclic rotation of those four pairs across the four (col, 7-col) slots,
 * which guarantees the Latin-square property (every row/column contains each
 * color exactly once) and exact 180 degree rotational symmetry
 * (color(r,c) === color(7-r,7-c)) by construction. Verified programmatically.
 */
export const BOARD_LAYOUT: Color[][] = [
  [Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW, Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE],
  [Color.GREEN, Color.RED, Color.YELLOW, Color.BROWN, Color.ORANGE, Color.PINK, Color.PURPLE, Color.BLUE],
  [Color.RED, Color.YELLOW, Color.BROWN, Color.GREEN, Color.BLUE, Color.ORANGE, Color.PINK, Color.PURPLE],
  [Color.YELLOW, Color.BROWN, Color.GREEN, Color.RED, Color.PURPLE, Color.BLUE, Color.ORANGE, Color.PINK],
  [Color.PINK, Color.ORANGE, Color.BLUE, Color.PURPLE, Color.RED, Color.GREEN, Color.BROWN, Color.YELLOW],
  [Color.PURPLE, Color.PINK, Color.ORANGE, Color.BLUE, Color.GREEN, Color.BROWN, Color.YELLOW, Color.RED],
  [Color.BLUE, Color.PURPLE, Color.PINK, Color.ORANGE, Color.BROWN, Color.YELLOW, Color.RED, Color.GREEN],
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
