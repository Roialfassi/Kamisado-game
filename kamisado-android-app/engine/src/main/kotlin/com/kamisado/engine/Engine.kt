package com.kamisado.engine

private fun fail(error: String, code: EngineErrorCode): MoveResult = MoveResult(success = false, error = error, errorCode = code)

private fun buildInitialTowers(): Map<String, Tower> {
    val towers = mutableMapOf<String, Tower>()
    for (col in 0 until BOARD_SIZE) {
        val blackColor = colorAt(BOARD_LAYOUT, 0, col)
        val goldColor = colorAt(BOARD_LAYOUT, 7, col)
        val black = Tower(towerId(PlayerSide.BLACK, blackColor), PlayerSide.BLACK, blackColor, SumoRank.NORMAL, Coordinate(0, col))
        val gold = Tower(towerId(PlayerSide.GOLD, goldColor), PlayerSide.GOLD, goldColor, SumoRank.NORMAL, Coordinate(7, col))
        towers[black.id] = black
        towers[gold.id] = gold
    }
    return towers
}

fun createGame(format: MatchFormat, initialClockMs: Long = 0L): GameState {
    val blackScore = PlayerScore(PlayerSide.BLACK, 0, 0)
    val goldScore = PlayerScore(PlayerSide.GOLD, 0, 0)
    return GameState(
        matchFormat = format,
        status = GameStatus.IN_PROGRESS,
        currentRound = 1,
        scores = mapOf(PlayerSide.BLACK to blackScore, PlayerSide.GOLD to goldScore),
        boardLayout = BOARD_LAYOUT,
        towers = buildInitialTowers(),
        activePlayer = PlayerSide.BLACK,
        requiredColor = null,
        lastMove = null,
        lastPhysicalMover = null,
        consecutivePasses = 0,
        clocks = mapOf(PlayerSide.BLACK to initialClockMs, PlayerSide.GOLD to initialClockMs),
        lastClockUpdate = System.currentTimeMillis(),
    )
}

fun getLegalMoves(state: GameState, color: Color): List<Move> {
    val tower = findTower(state, state.activePlayer, color) ?: return emptyList()
    val moves = standardMovesFor(state, tower).toMutableList()
    val push = analyzeSumoPush(state, tower)
    if (push is SumoPushAnalysis.Ok) moves.add(push.move)
    return moves
}

private fun classifyStandardFailure(state: GameState, tower: Tower, to: Coordinate): EngineErrorCode {
    val dr = to.row - tower.position.row
    val dc = to.col - tower.position.col
    val forward = forwardDir(tower.side)
    val forwardAligned = (dr != 0 && Integer.signum(dr) == forward) && (dc == 0 || kotlin.math.abs(dc) == kotlin.math.abs(dr))
    if (!forwardAligned) return EngineErrorCode.ILLEGAL_DIRECTION
    val distance = kotlin.math.abs(dr)
    if (distance > maxRange(tower.sumoRank)) return EngineErrorCode.EXCEEDS_SUMO_RANGE
    if (findTowerAt(state, to.row, to.col) != null) return EngineErrorCode.DESTINATION_OCCUPIED
    return EngineErrorCode.PATH_OBSTRUCTED
}

/**
 * Promotes the tower that just reached the opponent's home row and scores
 * the round. `movedTower` must already carry its post-move position; only
 * its sumoRank is updated here (position is left untouched).
 */
private fun promoteAndScore(state: GameState, movedTower: Tower, towers: MutableMap<String, Tower>): GameState {
    if (movedTower.sumoRank == SumoRank.TRIPLE) {
        // Rule 5.2 "Quadruple Sumo": a fourth home-row run by an already-Triple
        // tower auto-wins the whole match outright, regardless of point totals.
        return state.copy(
            status = GameStatus.MATCH_OVER,
            roundWinner = movedTower.side,
            roundOverReason = RoundOverReason.BASELINE_REACHED,
            matchWinner = movedTower.side,
        )
    }
    val promoted = movedTower.copy(sumoRank = movedTower.sumoRank.promoted())
    towers[promoted.id] = promoted
    val prevScore = state.scores.getValue(movedTower.side)
    val nextScore = prevScore.copy(points = prevScore.points + 1, roundsWon = prevScore.roundsWon + 1)
    val scores = state.scores + (movedTower.side to nextScore)
    val matchOver = nextScore.points >= state.matchFormat.pointsToWin
    return state.copy(
        scores = scores,
        status = if (matchOver) GameStatus.MATCH_OVER else GameStatus.ROUND_OVER,
        roundWinner = movedTower.side,
        roundOverReason = RoundOverReason.BASELINE_REACHED,
        matchWinner = if (matchOver) movedTower.side else null,
    )
}

fun applyMove(state: GameState, move: Move): MoveResult {
    if (state.status != GameStatus.IN_PROGRESS) {
        return fail("Game is not in progress", EngineErrorCode.GAME_NOT_IN_PROGRESS)
    }
    if (move.playerSide != state.activePlayer) {
        return fail("It is not this player's turn", EngineErrorCode.NOT_ACTIVE_PLAYER)
    }
    if (state.requiredColor != null && move.towerColor != state.requiredColor) {
        return fail("Must move the ${state.requiredColor} tower", EngineErrorCode.COLOR_MISMATCH)
    }
    val tower = findTower(state, move.playerSide, move.towerColor) ?: return fail("No such tower", EngineErrorCode.NO_SUCH_TOWER)
    if (tower.position != move.from) {
        return fail("Move 'from' does not match the tower's current position", EngineErrorCode.FROM_MISMATCH)
    }

    val legalMoves = getLegalMoves(state, move.towerColor)

    if (move.type == MoveType.PASS) {
        if (legalMoves.isNotEmpty()) {
            val onlyPushes = legalMoves.all { it.type == MoveType.SUMO_PUSH }
            return if (onlyPushes) {
                fail("A Sumo push is available and must be played (Rule S11)", EngineErrorCode.MANDATORY_PUSH)
            } else {
                fail("A legal move is available and must be played", EngineErrorCode.MANDATORY_MOVE)
            }
        }
        return handlePassOrDeadlock(state)
    }

    if (move.type == MoveType.STANDARD) {
        val match = legalMoves.firstOrNull { it.type == MoveType.STANDARD && it.to == move.to }
            ?: return fail("Illegal standard move", classifyStandardFailure(state, tower, move.to))
        return executeStandardMove(state, tower, match)
    }

    if (move.type == MoveType.SUMO_PUSH) {
        val dr = forwardDir(tower.side)
        val expected = Coordinate(tower.position.row + dr, tower.position.col)
        if (move.to != expected || !isInBounds(expected.row, expected.col)) {
            return fail("A Sumo push must be exactly one square straight ahead", EngineErrorCode.ILLEGAL_SUMO_PUSH_DIRECTION)
        }
        return when (val analysis = analyzeSumoPush(state, tower)) {
            is SumoPushAnalysis.Ok -> executeSumoPush(state, tower, analysis.move, analysis.pushedTowers, analysis.landingCell)
            is SumoPushAnalysis.Fail -> {
                val code = if (analysis.code == "NO_CONTACT") EngineErrorCode.SUMO_PUSH_BLOCKED else EngineErrorCode.valueOf(analysis.code)
                fail("Illegal Sumo push", code)
            }
        }
    }

    return fail("Unknown move type", EngineErrorCode.INVALID_MOVE)
}

private fun executeStandardMove(state: GameState, tower: Tower, move: Move): MoveResult {
    val towers = state.towers.toMutableMap()
    val movedTower = tower.copy(position = move.to)
    towers[movedTower.id] = movedTower

    val reachedGoal = move.to.row == opponentHomeRow(tower.side)
    val base = state.copy(towers = towers, lastMove = move, lastPhysicalMover = tower.side, consecutivePasses = 0)

    if (reachedGoal) {
        val finalState = promoteAndScore(base, movedTower, towers).copy(towers = towers)
        return MoveResult(
            success = true,
            state = finalState,
            isRoundOver = true,
            isMatchOver = finalState.status == GameStatus.MATCH_OVER,
            roundWinner = finalState.roundWinner,
            matchWinner = finalState.matchWinner,
        )
    }

    val landingColor = colorAt(state.boardLayout, move.to.row, move.to.col)
    val nextState = base.copy(activePlayer = tower.side.other(), requiredColor = landingColor)
    return MoveResult(success = true, state = nextState)
}

private fun executeSumoPush(state: GameState, tower: Tower, move: Move, pushedTowers: List<Tower>, landingCell: Coordinate): MoveResult {
    val towers = state.towers.toMutableMap()
    val movedTower = tower.copy(position = move.to)
    towers[movedTower.id] = movedTower
    for (pushed in pushedTowers) towers[pushed.id] = pushed

    val reachedGoal = move.to.row == opponentHomeRow(tower.side)
    val base = state.copy(towers = towers, lastMove = move, lastPhysicalMover = tower.side, consecutivePasses = 0)

    if (reachedGoal) {
        val finalState = promoteAndScore(base, movedTower, towers).copy(towers = towers)
        return MoveResult(
            success = true,
            state = finalState,
            isRoundOver = true,
            isMatchOver = finalState.status == GameStatus.MATCH_OVER,
            roundWinner = finalState.roundWinner,
            matchWinner = finalState.matchWinner,
        )
    }

    // Rule S3: the pusher moves again immediately, using the tower matching
    // the color of the square that was empty behind the pushed piece(s) (the
    // landing cell they now occupy). The opponent's turn is skipped by
    // simply never flipping activePlayer.
    val nextRequiredColor = colorAt(state.boardLayout, landingCell.row, landingCell.col)
    val nextState = base.copy(activePlayer = tower.side, requiredColor = nextRequiredColor)
    return MoveResult(success = true, state = nextState)
}

fun handlePassOrDeadlock(state: GameState): MoveResult {
    if (state.status != GameStatus.IN_PROGRESS) return MoveResult(success = true, state = state)

    var current = state
    val seen = mutableSetOf<String>()

    while (true) {
        val requiredColor = current.requiredColor ?: return MoveResult(success = true, state = current)
        val legalMoves = getLegalMoves(current, requiredColor)
        if (legalMoves.isNotEmpty()) return MoveResult(success = true, state = current)

        val key = "${current.activePlayer}:$requiredColor"
        if (seen.contains(key)) {
            val loser = current.lastPhysicalMover ?: current.activePlayer
            val winner = loser.other()
            val finalState = current.copy(status = GameStatus.ROUND_OVER, roundWinner = winner, roundOverReason = RoundOverReason.DEADLOCK)
            return MoveResult(success = true, state = finalState, isRoundOver = true, roundWinner = winner)
        }
        seen.add(key)

        val tower = findTower(current, current.activePlayer, requiredColor) ?: return MoveResult(success = true, state = current)
        val passMove = Move(MoveType.PASS, current.activePlayer, requiredColor, tower.position, tower.position)
        val nextColor = colorAt(current.boardLayout, tower.position.row, tower.position.col)
        current = current.copy(
            activePlayer = current.activePlayer.other(),
            requiredColor = nextColor,
            lastMove = passMove,
            consecutivePasses = current.consecutivePasses + 1,
        )
    }
}

/**
 * Rules F1-F4 (regrouping between rounds): the round's winner (Defender)
 * picks a fill direction and the loser (Challenger) fills the same way,
 * ordering towers "based on the row and column they occupied at the end of
 * the round" - the spec does not pin down the exact tie-break further, so
 * this mirrors the TypeScript engine's interpretation: each side's towers
 * are sorted by how far they advanced (most-advanced first), then by ending
 * column, and re-seated onto that side's home row from the chosen direction
 * inward. Sumo ranks earned so far persist; only board position resets.
 */
fun regroupForNextRound(state: GameState, fillFromLeft: Boolean): GameState {
    val towers = state.towers.toMutableMap()

    for (side in listOf(PlayerSide.BLACK, PlayerSide.GOLD)) {
        val homeRow = if (side == PlayerSide.BLACK) 0 else 7
        fun advancement(t: Tower) = if (side == PlayerSide.BLACK) t.position.row else 7 - t.position.row
        val sideTowers = towers.values
            .filter { it.side == side }
            .sortedWith(compareByDescending<Tower> { advancement(it) }.thenBy { it.position.col })

        sideTowers.forEachIndexed { index, t ->
            val col = if (fillFromLeft) index else 7 - index
            towers[t.id] = t.copy(position = Coordinate(homeRow, col))
        }
    }

    return beginNextRound(state, towers)
}

/**
 * House rule (owner's choice, replacing the official F1-F4 fill-from-left/
 * right regroup for this app): every round after the first restarts with each
 * tower back on the home-row square of its own colour, exactly like round 1.
 * Sumo ranks earned so far persist; only board position resets. Mirrors the
 * TypeScript engine's `reseatForNextRound`.
 */
fun reseatForNextRound(state: GameState): GameState {
    val home = buildInitialTowers()
    val towers = state.towers.mapValues { (id, tower) ->
        val start = home[id] ?: error("unknown tower $id")
        tower.copy(position = start.position)
    }
    return beginNextRound(state, towers)
}

/** Shared "start the next round" bookkeeping: fresh board, the round's loser
 * (the Challenger) opens, and all per-round state is cleared. */
private fun beginNextRound(state: GameState, towers: Map<String, Tower>): GameState {
    val nextChallenger = state.roundWinner?.other() ?: state.activePlayer

    return state.copy(
        towers = towers,
        boardLayout = BOARD_LAYOUT,
        currentRound = state.currentRound + 1,
        status = GameStatus.IN_PROGRESS,
        activePlayer = nextChallenger,
        requiredColor = null,
        lastMove = null,
        lastPhysicalMover = null,
        consecutivePasses = 0,
        roundWinner = null,
        roundOverReason = null,
        lastClockUpdate = System.currentTimeMillis(),
    )
}
