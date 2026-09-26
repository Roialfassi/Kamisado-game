package com.kamisado.engine

/**
 * The official 8x8 Kamisado color matrix, indexed [row][col], row 0 = Black's
 * home row, row 7 = Gold's home row. See the TypeScript engine's board.ts for
 * the derivation: constructed from the four "opposite color pairs" implied by
 * the fixed home rows, guaranteeing the Latin-square property and exact 180
 * degree rotational symmetry (verified programmatically in that port).
 */
val BOARD_LAYOUT: List<List<Color>> = listOf(
    listOf(Color.BROWN, Color.GREEN, Color.RED, Color.YELLOW, Color.PINK, Color.PURPLE, Color.BLUE, Color.ORANGE),
    listOf(Color.GREEN, Color.RED, Color.YELLOW, Color.BROWN, Color.ORANGE, Color.PINK, Color.PURPLE, Color.BLUE),
    listOf(Color.RED, Color.YELLOW, Color.BROWN, Color.GREEN, Color.BLUE, Color.ORANGE, Color.PINK, Color.PURPLE),
    listOf(Color.YELLOW, Color.BROWN, Color.GREEN, Color.RED, Color.PURPLE, Color.BLUE, Color.ORANGE, Color.PINK),
    listOf(Color.PINK, Color.ORANGE, Color.BLUE, Color.PURPLE, Color.RED, Color.GREEN, Color.BROWN, Color.YELLOW),
    listOf(Color.PURPLE, Color.PINK, Color.ORANGE, Color.BLUE, Color.GREEN, Color.BROWN, Color.YELLOW, Color.RED),
    listOf(Color.BLUE, Color.PURPLE, Color.PINK, Color.ORANGE, Color.BROWN, Color.YELLOW, Color.RED, Color.GREEN),
    listOf(Color.ORANGE, Color.BLUE, Color.PURPLE, Color.PINK, Color.YELLOW, Color.RED, Color.GREEN, Color.BROWN),
)

const val BOARD_SIZE = 8

fun colorAt(board: List<List<Color>>, row: Int, col: Int): Color = board[row][col]

fun isInBounds(row: Int, col: Int): Boolean = row in 0 until BOARD_SIZE && col in 0 until BOARD_SIZE
