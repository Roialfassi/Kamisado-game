package com.kamisado.engine

/** +1 for Black (toward increasing row), -1 for Gold (toward decreasing row). */
fun forwardDir(side: PlayerSide): Int = if (side == PlayerSide.BLACK) 1 else -1

/** The row a tower must reach to win the round (the opponent's home row). */
fun opponentHomeRow(side: PlayerSide): Int = if (side == PlayerSide.BLACK) 7 else 0

/** The row this side's towers started on (its own home row). */
fun ownHomeRow(side: PlayerSide): Int = if (side == PlayerSide.BLACK) 0 else 7

fun maxRange(rank: SumoRank): Int = when (rank) {
    SumoRank.NORMAL -> 7
    SumoRank.SINGLE -> 5
    SumoRank.DOUBLE -> 3
    SumoRank.TRIPLE -> 1
}

fun maxPushes(rank: SumoRank): Int = when (rank) {
    SumoRank.NORMAL -> 0
    SumoRank.SINGLE -> 1
    SumoRank.DOUBLE -> 2
    SumoRank.TRIPLE -> 3
}

fun findTowerAt(state: GameState, row: Int, col: Int): Tower? =
    state.towers.values.firstOrNull { it.position.row == row && it.position.col == col }

fun findTower(state: GameState, side: PlayerSide, color: Color): Tower? =
    state.towers.values.firstOrNull { it.side == side && it.color == color }

/** The three forward unit vectors: straight, diagonal-left, diagonal-right. */
private fun forwardVectors(side: PlayerSide): List<Coordinate> {
    val dr = forwardDir(side)
    return listOf(Coordinate(dr, 0), Coordinate(dr, -1), Coordinate(dr, 1))
}

/**
 * All legal STANDARD move destinations for a tower: any distance along the
 * three forward vectors, up to the tower's sumo-rank range limit, over a
 * clear path, landing on an empty square.
 */
fun standardDestinations(state: GameState, tower: Tower): List<Coordinate> {
    val results = mutableListOf<Coordinate>()
    val range = maxRange(tower.sumoRank)
    for (vec in forwardVectors(tower.side)) {
        for (k in 1..range) {
            val row = tower.position.row + vec.row * k
            val col = tower.position.col + vec.col * k
            if (!isInBounds(row, col)) break
            if (findTowerAt(state, row, col) != null) break
            results.add(Coordinate(row, col))
        }
    }
    return results
}

fun standardMovesFor(state: GameState, tower: Tower): List<Move> =
    standardDestinations(state, tower).map { to ->
        Move(type = MoveType.STANDARD, playerSide = tower.side, towerColor = tower.color, from = tower.position, to = to)
    }
