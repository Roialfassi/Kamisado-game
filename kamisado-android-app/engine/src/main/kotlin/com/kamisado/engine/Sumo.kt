package com.kamisado.engine

sealed class SumoPushAnalysis {
    data class Ok(val move: Move, val pushedTowers: List<Tower>, val landingCell: Coordinate) : SumoPushAnalysis()
    data class Fail(val code: String) : SumoPushAnalysis() // one of EngineErrorCode.name, or "NO_CONTACT"
}

/**
 * Analyzes the single straight-forward Sumo push available to `tower`, if
 * any. A push shoves a contiguous chain of opponent towers (starting
 * immediately ahead) back by one square. Rules enforced: orthogonal-forward
 * only (S3), home-row immunity so nobody is pushed off the board (S6), rank
 * immunity against equal-or-higher Sumo tiers (S8), and the push-count
 * capacity per Sumo rank (5.2). NO_CONTACT just means there is nothing to
 * push - that is not itself illegal, it means the move option doesn't exist.
 */
fun analyzeSumoPush(state: GameState, tower: Tower): SumoPushAnalysis {
    val capacity = maxPushes(tower.sumoRank)
    if (capacity == 0) return SumoPushAnalysis.Fail("NO_CONTACT")

    val dr = forwardDir(tower.side)
    val startRow = tower.position.row + dr
    val col = tower.position.col
    if (!isInBounds(startRow, col)) return SumoPushAnalysis.Fail("NO_CONTACT")

    val contact = findTowerAt(state, startRow, col)
    if (contact == null || contact.side == tower.side) return SumoPushAnalysis.Fail("NO_CONTACT")

    val chain = mutableListOf<Tower>()
    var row = startRow
    while (true) {
        val occupant = findTowerAt(state, row, col) ?: break
        if (occupant.side == tower.side) {
            return SumoPushAnalysis.Fail("SUMO_PUSH_BLOCKED")
        }
        if (occupant.sumoRank.ordinal >= tower.sumoRank.ordinal) {
            return SumoPushAnalysis.Fail("SUMO_IMMUNITY")
        }
        chain.add(occupant)
        if (chain.size > capacity) {
            return SumoPushAnalysis.Fail("SUMO_PUSH_BLOCKED")
        }
        row += dr
        if (!isInBounds(row, col)) {
            return SumoPushAnalysis.Fail("CANNOT_PUSH_OFF_BOARD")
        }
    }

    val pushedTowers = chain.map { it.copy(position = Coordinate(it.position.row + dr, it.position.col)) }
    val move = Move(
        type = MoveType.SUMO_PUSH,
        playerSide = tower.side,
        towerColor = tower.color,
        from = tower.position,
        to = Coordinate(startRow, col),
        pushedTowers = pushedTowers,
    )
    return SumoPushAnalysis.Ok(move, pushedTowers, Coordinate(row, col))
}
