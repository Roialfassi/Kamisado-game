package com.kamisado.ai

import com.kamisado.engine.Color
import com.kamisado.engine.Coordinate
import com.kamisado.engine.GameState
import com.kamisado.engine.GameStatus
import com.kamisado.engine.MatchFormat
import com.kamisado.engine.Move
import com.kamisado.engine.PlayerSide
import com.kamisado.engine.createGame
import com.kamisado.engine.towerId
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Can `me` force a round win within `plies` more physical moves? (plain minimax on the reference engine) */
private fun forcedWin(state: GameState, me: PlayerSide, plies: Int): Boolean {
    val moves = refMoves(state)
    if (moves.isEmpty()) return false
    val mine = state.activePlayer == me
    for (m in moves) {
        val next = refStep(state, m)
        val good = when {
            next.status != GameStatus.IN_PROGRESS -> next.roundWinner == me
            plies <= 1 -> false
            else -> forcedWin(next, me, plies - 1)
        }
        if (mine && good) return true
        if (!mine && !good) return false
    }
    return !mine
}

class SearchAndLevelsTest {

    @Test
    fun `depth-limited search finds exactly the forced wins a brute-force solver finds`() {
        val rng = Random(2024)
        var winsSeen = 0
        var checked = 0
        var i = 0
        while (checked < 160 && i < 4000) {
            i++
            val state = resolved(if (i % 2 == 0) densePosition(rng) else randomPosition(rng, sumo = i % 4 == 1)) ?: continue
            checked++
            val me = state.activePlayer
            for (depth in 1..3) {
                clearTranspositionTable()
                val pos = Position.fromState(state)
                val result = findBestMove(pos, depth)
                val searchSaysWin = result.score >= MATE_BOUND
                val brute = forcedWin(state, me, depth)
                assertEquals(brute, searchSaysWin, "forced win within $depth plies (i=$i)")
                if (brute) winsSeen++
            }
        }
        assertTrue(winsSeen > 10, "the sample must contain forced wins (saw $winsSeen)")
    }

    @Test
    fun `search leaves the position untouched and returns a legal move`() {
        val rng = Random(5)
        repeat(30) {
            val state = resolved(randomPosition(rng, sumo = true)) ?: return@repeat
            val pos = Position.fromState(state)
            val before = listOf(pos.occ.toList(), pos.pos.toList(), pos.active, pos.required, pos.lastMover, pos.hashLo, pos.hashHi)
            clearTranspositionTable()
            val r = findBestMove(pos, 5)
            assertEquals(before, listOf(pos.occ.toList(), pos.pos.toList(), pos.active, pos.required, pos.lastMover, pos.hashLo, pos.hashHi))
            assertTrue(refMoves(state).any { enc(it) == r.move })
        }
    }

    private fun winInOne(): GameState {
        var state = createGame(MatchFormat.SINGLE_ROUND)
        fun put(side: PlayerSide, color: Color, row: Int, col: Int) {
            val id = towerId(side, color)
            state = state.copy(towers = state.towers + (id to state.towers.getValue(id).copy(position = Coordinate(row, col))))
        }
        put(PlayerSide.BLACK, Color.BROWN, 5, 4)
        put(PlayerSide.GOLD, Color.PURPLE, 1, 7)
        return state.copy(activePlayer = PlayerSide.BLACK, requiredColor = Color.BROWN)
    }

    @Test
    fun `every level except the Apprentice takes a win in one`() {
        val rng = Random(1)
        val state = winInOne()
        for (level in BotLevel.entries.filter { it != BotLevel.APPRENTICE }) {
            repeat(20) {
                val m = chooseMove(state, level, rng, deterministicDepth = true, override = if (level == BotLevel.DRAGON_MASTER) LevelConfig(4, 0, 0.0) else null)
                assertNotNull(m)
                assertEquals(7, m.to.row, "$level must finish the round")
            }
        }
    }

    @Test
    fun `every level always returns a legal move`() {
        val rng = Random(77)
        val states = mutableListOf(createGame(MatchFormat.STANDARD))
        repeat(40) { i ->
            val s = resolved(if (i % 3 == 0) densePosition(rng) else if (i % 3 == 1) pushPosition(rng) else randomPosition(rng, true))
            if (s != null) states.add(s)
        }
        for (state in states) {
            val legal = refMoves(state)
            for (level in BotLevel.entries) {
                val move: Move? = chooseMove(state, level, rng, deterministicDepth = true, override = if (level == BotLevel.DRAGON_MASTER) LevelConfig(6, 0, 0.0) else null)
                assertNotNull(move, "$level")
                assertTrue(legal.any { enc(it) == enc(move) }, "$level chose an illegal move")
            }
        }
    }

    @Test
    fun `a level is reproducible for a given random seed`() {
        val state = resolved(randomPosition(Random(3)))!!
        for (level in BotLevel.entries) {
            val cfg = LevelConfig(4, 0, if (level == BotLevel.DRAGON_MASTER) 0.0 else 90.0)
            val a = chooseMove(state, level, Random(9), deterministicDepth = true, override = cfg)
            val b = chooseMove(state, level, Random(9), deterministicDepth = true, override = cfg)
            assertEquals(a, b, "$level")
        }
    }

    @Test
    fun `a full bot-versus-bot round completes with only legal moves`() {
        val rng = Random(123)
        var state = createGame(MatchFormat.SINGLE_ROUND)
        var plies = 0
        while (state.status == GameStatus.IN_PROGRESS && plies < 200) {
            val level = if (state.activePlayer == PlayerSide.BLACK) BotLevel.RONIN else BotLevel.STUDENT
            val m = chooseMove(state, level, rng, deterministicDepth = true, override = LevelConfig(3, 0, 60.0))
            assertNotNull(m)
            state = refStep(state, m)
            plies++
        }
        assertTrue(state.status != GameStatus.IN_PROGRESS, "the round must end")
    }

    @Test
    fun `Dragon Master strictly beats a shallow searcher over a short series`() {
        // Deep noise-free search vs a shallow noisy one, alternating colours: the deep side should win most rounds.
        val rng = Random(2025)
        var deepWins = 0
        val games = 12
        for (g in 0 until games) {
            val deepIsBlack = g % 2 == 0
            var state = createGame(MatchFormat.SINGLE_ROUND)
            // a couple of random opening plies so games differ
            repeat(2) {
                val moves = refMoves(state)
                if (state.status == GameStatus.IN_PROGRESS && moves.isNotEmpty()) state = refStep(state, moves[rng.nextInt(moves.size)])
            }
            var plies = 0
            while (state.status == GameStatus.IN_PROGRESS && plies < 300) {
                val deepTurn = (state.activePlayer == PlayerSide.BLACK) == deepIsBlack
                val cfg = if (deepTurn) LevelConfig(8, 0, 0.0) else LevelConfig(2, 0, 160.0)
                val level = if (deepTurn) BotLevel.DRAGON_MASTER else BotLevel.STUDENT
                state = refStep(state, chooseMove(state, level, rng, deterministicDepth = true, override = cfg)!!)
                plies++
            }
            if (state.status != GameStatus.IN_PROGRESS) {
                val deepSide = if (deepIsBlack) PlayerSide.BLACK else PlayerSide.GOLD
                if (state.roundWinner == deepSide) deepWins++
            }
        }
        assertTrue(deepWins >= 9, "depth-8 search should win most rounds against depth-2 noise (won $deepWins/$games)")
    }
}
