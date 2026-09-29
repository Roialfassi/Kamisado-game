package com.kamisado.engine

/**
 * The authentic 8x8 Kamisado color matrix, indexed [row][col], row 0 = Black's
 * home row, row 7 = Gold's home row. Must stay identical to the TypeScript
 * engine's board.ts (every row and every column contains each of the eight
 * colors exactly once).
 */
val BOARD_LAYOUT: List<List<Color>> = listOf(
    // Rank 1 (Row 0 - Black Home Row):
    listOf(Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW, Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE),
    // Rank 2 (Row 1):
    listOf(Color.PURPLE, Color.BROWN, Color.YELLOW, Color.BLUE, Color.GREEN, Color.PINK, Color.ORANGE, Color.RED),
    // Rank 3 (Row 2):
    listOf(Color.BLUE, Color.YELLOW, Color.BROWN, Color.PURPLE, Color.RED, Color.ORANGE, Color.PINK, Color.GREEN),
    // Rank 4 (Row 3):
    listOf(Color.YELLOW, Color.RED, Color.GREEN, Color.BROWN, Color.ORANGE, Color.BLUE, Color.PURPLE, Color.PINK),
    // Rank 5 (Row 4):
    listOf(Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE, Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW),
    // Rank 6 (Row 5):
    listOf(Color.GREEN, Color.PINK, Color.ORANGE, Color.RED, Color.PURPLE, Color.BROWN, Color.YELLOW, Color.BLUE),
    // Rank 7 (Row 6):
    listOf(Color.RED, Color.ORANGE, Color.PINK, Color.GREEN, Color.BLUE, Color.YELLOW, Color.BROWN, Color.PURPLE),
    // Rank 8 (Row 7 - Gold Home Row):
    listOf(Color.ORANGE, Color.BLUE, Color.PURPLE, Color.PINK, Color.YELLOW, Color.RED, Color.GREEN, Color.BROWN),
)

const val BOARD_SIZE = 8

fun colorAt(board: List<List<Color>>, row: Int, col: Int): Color = board[row][col]

fun isInBounds(row: Int, col: Int): Boolean = row in 0 until BOARD_SIZE && col in 0 until BOARD_SIZE
