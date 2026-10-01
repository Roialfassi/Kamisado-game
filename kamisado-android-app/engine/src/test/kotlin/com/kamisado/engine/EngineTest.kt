package com.kamisado.engine

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

private fun fresh(format: MatchFormat = MatchFormat.STANDARD): GameState = createGame(format, 0)

/** Returns a new state with one tower's position (and optionally rank) overridden. */
private fun place(state: GameState, side: PlayerSide, color: Color, row: Int, col: Int, sumoRank: SumoRank = SumoRank.NORMAL): GameState {
    val id = towerId(side, color)
    val existing = state.towers.getValue(id)
    return state.copy(towers = state.towers + (id to existing.copy(position = Coordinate(row, col), sumoRank = sumoRank)))
}

private fun tower(state: GameState, side: PlayerSide, color: Color): Tower =
    findTower(state, side, color) ?: error("missing tower $side $color")

private fun standardMove(side: PlayerSide, color: Color, from: Pair<Int, Int>, to: Pair<Int, Int>): Move =
    Move(MoveType.STANDARD, side, color, Coordinate(from.first, from.second), Coordinate(to.first, to.second))

private fun pushMove(side: PlayerSide, color: Color, from: Pair<Int, Int>, to: Pair<Int, Int>): Move =
    Move(MoveType.SUMO_PUSH, side, color, Coordinate(from.first, from.second), Coordinate(to.first, to.second))

private fun passMove(side: PlayerSide, color: Color, at: Pair<Int, Int>): Move =
    Move(MoveType.PASS, side, color, Coordinate(at.first, at.second), Coordinate(at.first, at.second))

class EngineTest {

    // ---- Suite 1: Movement & Geometric Validation ----

    @Test
    fun `Test 1 legal forward straight move`() {
        val state = fresh()
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 3 to 0))
        assertTrue(result.success)
        assertEquals(Coordinate(3, 0), tower(result.state!!, PlayerSide.BLACK, Color.BROWN).position)
        assertEquals(colorAt(BOARD_LAYOUT, 3, 0), result.state.requiredColor)
    }

    @Test
    fun `Test 2 legal forward diagonal move`() {
        val state = fresh()
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.RED, 0 to 2, 3 to 5))
        assertTrue(result.success)
        assertEquals(Coordinate(3, 5), tower(result.state!!, PlayerSide.BLACK, Color.RED).position)
    }

    @Test
    fun `Test 3 backward move rejection`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 4, 4)
        state = state.copy(requiredColor = null)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 4 to 4, 3 to 4))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.ILLEGAL_DIRECTION, result.errorCode)
    }

    @Test
    fun `Test 4 sideways move rejection`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 4, 4)
        state = state.copy(requiredColor = null)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 4 to 4, 4 to 5))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.ILLEGAL_DIRECTION, result.errorCode)
    }

    @Test
    fun `Test 5 obstruction jumping over pieces rejected`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.YELLOW, 0, 3)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 2, 3)
        state = state.copy(requiredColor = null)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.YELLOW, 0 to 3, 4 to 3))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.PATH_OBSTRUCTED, result.errorCode)
    }

    @Test
    fun `Test 6 destination occupied rejected`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.YELLOW, 0, 3)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 3)
        state = state.copy(requiredColor = null)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.YELLOW, 0 to 3, 3 to 3))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.DESTINATION_OCCUPIED, result.errorCode)
    }

    @Test
    fun `Test 7 corner touching diagonal clearance Rule M4`() {
        var state = fresh()
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 3)
        state = place(state, PlayerSide.BLACK, Color.GREEN, 4, 4)
        state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 3)
        state = state.copy(requiredColor = null, activePlayer = PlayerSide.GOLD)
        val result = applyMove(state, standardMove(PlayerSide.GOLD, Color.BLUE, 4 to 3, 3 to 4))
        assertTrue(result.success)
        assertEquals(Coordinate(3, 4), tower(result.state!!, PlayerSide.GOLD, Color.BLUE).position)
    }

    // ---- Suite 2: Color Forcing & Turn Constraints ----

    @Test
    fun `Test 8 opening move freedom`() {
        val state = fresh()
        for (color in listOf(Color.YELLOW, Color.ORANGE, Color.GREEN)) {
            val t = tower(state, PlayerSide.BLACK, color)
            val result = applyMove(state, standardMove(PlayerSide.BLACK, color, t.position.row to t.position.col, (t.position.row + 1) to t.position.col))
            assertTrue(result.success)
        }
    }

    @Test
    fun `Test 9 strict color forcing on subsequent turns`() {
        var state = fresh()
        val landingColor = colorAt(BOARD_LAYOUT, 3, 2)
        state = state.copy(activePlayer = PlayerSide.GOLD, requiredColor = landingColor, lastPhysicalMover = PlayerSide.BLACK)
        val wrong = tower(state, PlayerSide.GOLD, Color.BLUE)
        val mismatch = applyMove(state, standardMove(PlayerSide.GOLD, Color.BLUE, wrong.position.row to wrong.position.col, (wrong.position.row - 1) to wrong.position.col))
        assertEquals(false, mismatch.success)
        assertEquals(EngineErrorCode.COLOR_MISMATCH, mismatch.errorCode)

        val right = tower(state, PlayerSide.GOLD, landingColor)
        val correct = applyMove(state, standardMove(PlayerSide.GOLD, landingColor, right.position.row to right.position.col, (right.position.row - 1) to right.position.col))
        assertTrue(correct.success)
    }

    @Test
    fun `Test 10 mandatory move rule`() {
        var state = fresh()
        state = place(state, PlayerSide.GOLD, Color.PURPLE, 4, 4)
        state = state.copy(activePlayer = PlayerSide.GOLD, requiredColor = Color.PURPLE)
        assertTrue(getLegalMoves(state, Color.PURPLE).isNotEmpty())

        val passAttempt = applyMove(state, passMove(PlayerSide.GOLD, Color.PURPLE, 4 to 4))
        assertEquals(false, passAttempt.success)
        assertEquals(EngineErrorCode.MANDATORY_MOVE, passAttempt.errorCode)

        val differentTower = tower(state, PlayerSide.GOLD, Color.BLUE)
        val switchAttempt = applyMove(
            state,
            standardMove(PlayerSide.GOLD, Color.BLUE, differentTower.position.row to differentTower.position.col, (differentTower.position.row - 1) to differentTower.position.col),
        )
        assertEquals(false, switchAttempt.success)
    }

    // ---- Suite 3: Stymie (Pass) & Deadlock Adjudication ----

    @Test
    fun `Test 11 stymie pass automation`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.PURPLE, 2, 4)
        state = place(state, PlayerSide.GOLD, Color.RED, 3, 3)
        state = place(state, PlayerSide.GOLD, Color.YELLOW, 3, 4)
        state = place(state, PlayerSide.GOLD, Color.PINK, 3, 5)
        assertTrue(getLegalMoves(state.copy(activePlayer = PlayerSide.BLACK), Color.PURPLE).isEmpty())

        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.PURPLE, lastPhysicalMover = PlayerSide.GOLD)
        val result = handlePassOrDeadlock(state)
        assertTrue(result.success)
        assertEquals(false, result.isRoundOver)
        assertEquals(PlayerSide.GOLD, result.state!!.activePlayer)
        assertEquals(colorAt(BOARD_LAYOUT, 2, 4), result.state.requiredColor)
    }

    @Test
    fun `Test 12 two-tower deadlock causes last mover loss`() {
        var state = fresh()
        // Gold's Blue tower sits on an Orange square (3,4); Black's Orange tower sits
        // on a Blue square (2,0) - mirrors the TypeScript fixture on the authentic board.
        assertEquals(Color.ORANGE, colorAt(BOARD_LAYOUT, 3, 4))
        assertEquals(Color.BLUE, colorAt(BOARD_LAYOUT, 2, 0))

        state = place(state, PlayerSide.GOLD, Color.BLUE, 3, 4)
        state = place(state, PlayerSide.BLACK, Color.ORANGE, 2, 0)

        // Block Gold's Blue tower at (3,4): forward cells are (2,3), (2,4), (2,5)
        state = place(state, PlayerSide.GOLD, Color.GREEN, 2, 3)
        state = place(state, PlayerSide.GOLD, Color.RED, 2, 4)
        state = place(state, PlayerSide.GOLD, Color.YELLOW, 2, 5)

        // Block Black's Orange tower at (2,0): forward cells are (3,0), (3,1)
        state = place(state, PlayerSide.BLACK, Color.PINK, 3, 0)
        state = place(state, PlayerSide.BLACK, Color.PURPLE, 3, 1)

        state = state.copy(activePlayer = PlayerSide.GOLD, requiredColor = Color.BLUE, lastPhysicalMover = PlayerSide.BLACK)
        val result = handlePassOrDeadlock(state)
        assertEquals(true, result.isRoundOver)
        assertEquals(PlayerSide.GOLD, result.roundWinner)
        assertEquals(RoundOverReason.DEADLOCK, result.state!!.roundOverReason)
    }

    @Test
    fun `Test 13 multi-tower circular deadlock`() {
        var state = fresh()
        // Chain: (BLACK,BROWN)@(1,0) -> pass -> (GOLD,PURPLE)@(6,4) -> pass ->
        // (BLACK,BLUE)@(2,3) -> pass -> back to (GOLD,PURPLE): a repeated impasse.
        assertEquals(Color.PURPLE, colorAt(BOARD_LAYOUT, 1, 0))
        assertEquals(Color.BLUE, colorAt(BOARD_LAYOUT, 6, 4))
        assertEquals(Color.PURPLE, colorAt(BOARD_LAYOUT, 2, 3))

        state = place(state, PlayerSide.BLACK, Color.BROWN, 1, 0)
        state = place(state, PlayerSide.GOLD, Color.PURPLE, 6, 4)
        state = place(state, PlayerSide.BLACK, Color.BLUE, 2, 3)

        // Block BLACK_BROWN@(1,0): forward cells (2,0),(2,1).
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 2, 0)
        state = place(state, PlayerSide.GOLD, Color.YELLOW, 2, 1)

        // Block GOLD_PURPLE@(6,4): forward cells (5,3),(5,4),(5,5).
        state = place(state, PlayerSide.BLACK, Color.GREEN, 5, 3)
        state = place(state, PlayerSide.BLACK, Color.RED, 5, 4)
        state = place(state, PlayerSide.BLACK, Color.PINK, 5, 5)

        // Block BLACK_BLUE@(2,3): forward cells (3,2),(3,3),(3,4).
        state = place(state, PlayerSide.GOLD, Color.PINK, 3, 2)
        state = place(state, PlayerSide.GOLD, Color.BROWN, 3, 3)
        state = place(state, PlayerSide.GOLD, Color.RED, 3, 4)

        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN, lastPhysicalMover = PlayerSide.GOLD)
        val result = handlePassOrDeadlock(state)
        assertEquals(true, result.isRoundOver)
        assertEquals(PlayerSide.BLACK, result.roundWinner)
        assertEquals(RoundOverReason.DEADLOCK, result.state!!.roundOverReason)
    }

    // ---- Suite 4: Victory Conditions & Round Scoring ----

    @Test
    fun `Test 14 baseline reach immediate victory`() {
        var state = fresh()
        state = place(state, PlayerSide.GOLD, Color.PURPLE, 1, 7)
        state = place(state, PlayerSide.BLACK, Color.BROWN, 6, 2)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 6 to 2, 7 to 2))
        assertTrue(result.success)
        assertEquals(true, result.isRoundOver)
        assertEquals(PlayerSide.BLACK, result.roundWinner)
        assertEquals(false, result.isMatchOver)
        assertEquals(SumoRank.SINGLE, tower(result.state!!, PlayerSide.BLACK, Color.BROWN).sumoRank)
        assertEquals(1, result.state.scores.getValue(PlayerSide.BLACK).points)
    }

    @Test
    fun `Test 15 match victory point threshold`() {
        var state = fresh(MatchFormat.STANDARD)
        state = state.copy(scores = state.scores + (PlayerSide.BLACK to PlayerScore(PlayerSide.BLACK, 2, 2)))
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 1, 6)
        state = place(state, PlayerSide.BLACK, Color.GREEN, 6, 0)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.GREEN)
        val result = applyMove(state, standardMove(PlayerSide.BLACK, Color.GREEN, 6 to 0, 7 to 0))
        assertTrue(result.success)
        assertEquals(true, result.isMatchOver)
        assertEquals(PlayerSide.BLACK, result.matchWinner)
        assertEquals(3, result.state!!.scores.getValue(PlayerSide.BLACK).points)
    }

    // ---- Suite 5: Sumo Mechanics & Sumo Pushing ----

    @Test
    fun `Test 16 single sumo movement range limit max 5`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.SINGLE)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val tooFar = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 6 to 0))
        assertEquals(false, tooFar.success)
        assertEquals(EngineErrorCode.EXCEEDS_SUMO_RANGE, tooFar.errorCode)
        val ok = applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 5 to 0))
        assertTrue(ok.success)
    }

    @Test
    fun `Test 17 double and triple sumo range limits`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.DOUBLE)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        assertEquals(false, applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 4 to 0)).success)
        assertTrue(applyMove(state, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 3 to 0)).success)

        var state2 = fresh()
        state2 = place(state2, PlayerSide.BLACK, Color.BROWN, 0, 0, SumoRank.TRIPLE)
        state2 = state2.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        assertEquals(false, applyMove(state2, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 2 to 0)).success)
        assertTrue(applyMove(state2, standardMove(PlayerSide.BLACK, Color.BROWN, 0 to 0, 1 to 0)).success)
    }

    @Test
    fun `Test 18 legal sumo push execution`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 3 to 3, 4 to 3))
        assertTrue(result.success)
        assertEquals(Coordinate(4, 3), tower(result.state!!, PlayerSide.BLACK, Color.BROWN).position)
        assertEquals(Coordinate(5, 3), tower(result.state, PlayerSide.GOLD, Color.ORANGE).position)
        assertEquals(PlayerSide.BLACK, result.state.activePlayer)
        assertEquals(colorAt(BOARD_LAYOUT, 5, 3), result.state.requiredColor)
    }

    @Test
    fun `Test 19 sumo push diagonal attempt rejected`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 4)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 3 to 3, 4 to 4))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.ILLEGAL_SUMO_PUSH_DIRECTION, result.errorCode)
    }

    @Test
    fun `Test 20 sumo push with occupied rear cell rejected`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3)
        state = place(state, PlayerSide.BLACK, Color.GREEN, 5, 3)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 3 to 3, 4 to 3))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.SUMO_PUSH_BLOCKED, result.errorCode)
    }

    @Test
    fun `Test 21 sumo push on home row rejected Rule S6`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 6, 3, SumoRank.SINGLE)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 6 to 3, 7 to 3))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.CANNOT_PUSH_OFF_BOARD, result.errorCode)
    }

    @Test
    fun `Test 22 sumo immunity equal rank push rejected Rule S8`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3, SumoRank.SINGLE)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 3 to 3, 4 to 3))
        assertEquals(false, result.success)
        assertEquals(EngineErrorCode.SUMO_IMMUNITY, result.errorCode)
    }

    @Test
    fun `Test 23 sumo rank superiority push allowed`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.DOUBLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3, SumoRank.SINGLE)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 3 to 3, 4 to 3))
        assertTrue(result.success)
        assertEquals(Coordinate(5, 3), tower(result.state!!, PlayerSide.GOLD, Color.ORANGE).position)
    }

    @Test
    fun `Test 24 multi-piece push by double sumo`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 2, 2, SumoRank.DOUBLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 3, 2)
        state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 2)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        val result = applyMove(state, pushMove(PlayerSide.BLACK, Color.BROWN, 2 to 2, 3 to 2))
        assertTrue(result.success)
        assertEquals(Coordinate(3, 2), tower(result.state!!, PlayerSide.BLACK, Color.BROWN).position)
        assertEquals(Coordinate(4, 2), tower(result.state, PlayerSide.GOLD, Color.ORANGE).position)
        assertEquals(Coordinate(5, 2), tower(result.state, PlayerSide.GOLD, Color.BLUE).position)
    }

    @Test
    fun `Test 25 forced sumo push Rule S11`() {
        var state = fresh()
        state = place(state, PlayerSide.BLACK, Color.BROWN, 3, 3, SumoRank.SINGLE)
        state = place(state, PlayerSide.GOLD, Color.ORANGE, 4, 3)
        state = place(state, PlayerSide.GOLD, Color.GREEN, 4, 2)
        state = place(state, PlayerSide.GOLD, Color.RED, 4, 4)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
        assertEquals(1, getLegalMoves(state, Color.BROWN).size)
        val passAttempt = applyMove(state, passMove(PlayerSide.BLACK, Color.BROWN, 3 to 3))
        assertEquals(false, passAttempt.success)
        assertEquals(EngineErrorCode.MANDATORY_PUSH, passAttempt.errorCode)
    }

    // ---- Between rounds: reseatForNextRound (house rule) ----

    private fun finishedRound(): GameState {
        var state = fresh(MatchFormat.STANDARD)
        state = place(state, PlayerSide.BLACK, Color.RED, 7, 2, SumoRank.SINGLE)
        state = place(state, PlayerSide.BLACK, Color.PINK, 3, 4)
        state = place(state, PlayerSide.GOLD, Color.BLUE, 4, 6)
        state = place(state, PlayerSide.GOLD, Color.GREEN, 1, 0, SumoRank.DOUBLE)
        return state.copy(
            status = GameStatus.ROUND_OVER,
            roundWinner = PlayerSide.BLACK,
            roundOverReason = RoundOverReason.BASELINE_REACHED,
            requiredColor = Color.BLUE,
            lastPhysicalMover = PlayerSide.BLACK,
        )
    }

    @Test
    fun `reseat puts every tower back on the home square of its own colour`() {
        val next = reseatForNextRound(finishedRound())
        val opening = fresh()
        for ((id, t) in opening.towers) assertEquals(t.position, next.towers.getValue(id).position)
        for (t in next.towers.values) assertEquals(t.color, colorAt(BOARD_LAYOUT, t.position.row, t.position.col))
    }

    @Test
    fun `reseat keeps sumo ranks and scores, advances the round, and the loser opens`() {
        val before = finishedRound()
        val next = reseatForNextRound(before)
        assertEquals(SumoRank.SINGLE, tower(next, PlayerSide.BLACK, Color.RED).sumoRank)
        assertEquals(SumoRank.DOUBLE, tower(next, PlayerSide.GOLD, Color.GREEN).sumoRank)
        assertEquals(before.scores, next.scores)
        assertEquals(before.currentRound + 1, next.currentRound)
        assertEquals(GameStatus.IN_PROGRESS, next.status)
        assertEquals(PlayerSide.GOLD, next.activePlayer)
        assertNull(next.requiredColor)
        assertNull(next.roundWinner)
    }

    // ---- Deadlock wins score (mirrors the TypeScript suite) ----

    private fun deadlockState(format: MatchFormat): GameState {
        var state = fresh(format)
        state = place(state, PlayerSide.GOLD, Color.BLUE, 3, 4)
        state = place(state, PlayerSide.BLACK, Color.ORANGE, 2, 0)
        state = place(state, PlayerSide.GOLD, Color.GREEN, 2, 3)
        state = place(state, PlayerSide.GOLD, Color.RED, 2, 4)
        state = place(state, PlayerSide.GOLD, Color.YELLOW, 2, 5)
        state = place(state, PlayerSide.BLACK, Color.PINK, 3, 0)
        state = place(state, PlayerSide.BLACK, Color.PURPLE, 3, 1)
        return state.copy(activePlayer = PlayerSide.GOLD, requiredColor = Color.BLUE, lastPhysicalMover = PlayerSide.BLACK)
    }

    @Test
    fun `a deadlock win awards the winner one point and ends the round`() {
        val result = handlePassOrDeadlock(deadlockState(MatchFormat.STANDARD))
        assertTrue(result.isRoundOver)
        assertEquals(false, result.isMatchOver)
        assertEquals(GameStatus.ROUND_OVER, result.state!!.status)
        assertEquals(1, result.state.scores.getValue(PlayerSide.GOLD).points)
        assertEquals(0, result.state.scores.getValue(PlayerSide.BLACK).points)
        assertEquals(SumoRank.NORMAL, tower(result.state, PlayerSide.GOLD, Color.BLUE).sumoRank)
    }

    @Test
    fun `a deadlock win can decide the match`() {
        val result = handlePassOrDeadlock(deadlockState(MatchFormat.SINGLE_ROUND))
        assertTrue(result.isMatchOver)
        assertEquals(PlayerSide.GOLD, result.matchWinner)
        assertEquals(GameStatus.MATCH_OVER, result.state!!.status)
    }

    @Test
    fun `reseat is a no-op unless the round is over`() {
        val playing = fresh(MatchFormat.STANDARD)
        assertEquals(playing, reseatForNextRound(playing))
        val once = reseatForNextRound(finishedRound())
        assertEquals(GameStatus.IN_PROGRESS, once.status)
        assertEquals(once, reseatForNextRound(once)) // a double tap must not skip another round
    }
}
