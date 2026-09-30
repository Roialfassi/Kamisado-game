package com.kamisado.ai

import com.kamisado.engine.ALL_COLORS
import com.kamisado.engine.Color
import com.kamisado.engine.Coordinate
import com.kamisado.engine.GameState
import com.kamisado.engine.GameStatus
import com.kamisado.engine.MatchFormat
import com.kamisado.engine.MoveType
import com.kamisado.engine.PlayerSide
import com.kamisado.engine.RoundOverReason
import com.kamisado.engine.createGame
import com.kamisado.engine.findTower
import com.kamisado.engine.towerId
import kotlin.random.Random
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun snapshot(p: Position): String =
    listOf(p.occ.contentToString(), p.pos.contentToString(), p.active, p.required, p.lastMover, p.hashLo, p.hashHi).joinToString("|")

private fun genSorted(p: Position): List<Int> {
    val buf = IntArray(160)
    val n = p.genMoves(buf)
    return buf.copyOf(n).sorted()
}

/** The fast Kotlin `Position` must agree with the Kotlin reference engine (mirror of the TS differential suite). */
class PositionDifferentialTest {

    @Test
    fun `legal moves, hasMove and canReachGoal agree on 600 random positions`() {
        for (sumo in listOf(false, true)) {
            val rng = Random(if (sumo) 7 else 3)
            repeat(600) {
                val state = randomPosition(rng, sumo)
                val pos = Position.fromState(state)
                assertEquals(refMoves(state).map(::enc).sorted(), genSorted(pos), "move list (sumo=$sumo)")
                for (side in PlayerSide.entries) {
                    for (color in ALL_COLORS) {
                        val t = sideIndex(side) * 8 + color.ordinal
                        val legal = legalFor(state, side, color)
                        assertEquals(legal.isNotEmpty(), pos.hasMove(t), "hasMove $side $color")
                        val goal = if (side == PlayerSide.BLACK) 7 else 0
                        val tower = findTower(state, side, color)!!
                        val refReach = legal.any { it.type == MoveType.STANDARD && it.to.row == goal } && tower.position.row != goal
                        assertEquals(refReach, pos.canReachGoal(t), "canReachGoal $side $color")
                    }
                }
            }
        }
    }

    @Test
    fun `every move gives the same resulting state, pass chains, deadlocks, winners and hashes`() {
        for (sumo in listOf(false, true)) {
            val rng = Random(if (sumo) 21 else 11)
            var terminals = 0
            var deadlocks = 0
            var pushes = 0
            var passes = 0
            repeat(600) { i ->
                val state = when {
                    i % 3 == 0 -> densePosition(rng)
                    sumo && i % 2 == 0 -> pushPosition(rng)
                    else -> randomPosition(rng, sumo)
                }
                val pos = Position.fromState(state)
                val before = snapshot(pos)
                val buf = IntArray(160)
                val n = pos.genMoves(buf)
                val ref = refMoves(state)
                for (k in 0 until n) {
                    val m = buf[k]
                    val refMove = ref.first { enc(it) == m }
                    val next = refStep(state, refMove)
                    if (refMove.type == MoveType.SUMO_PUSH) pushes++
                    val winner = pos.make(m)
                    if (next.status != GameStatus.IN_PROGRESS) {
                        terminals++
                        if (next.roundOverReason == RoundOverReason.DEADLOCK) deadlocks++
                        assertEquals(sideIndex(next.roundWinner!!), winner, "winner")
                    } else {
                        assertEquals(-1, winner)
                        assertEquals(sideIndex(next.activePlayer), pos.active)
                        assertEquals(next.requiredColor?.ordinal ?: -1, pos.required)
                        if (next.lastMove?.type == MoveType.PASS) passes++
                        val rebuilt = Position.fromState(next)
                        assertEquals(rebuilt.occ.toList(), pos.occ.toList())
                        assertEquals(rebuilt.pos.toList(), pos.pos.toList())
                        assertEquals(rebuilt.lastMover, pos.lastMover)
                        assertEquals(rebuilt.hashLo, pos.hashLo, "incremental hash lo")
                        assertEquals(rebuilt.hashHi, pos.hashHi, "incremental hash hi")
                    }
                    pos.unmake()
                    assertEquals(before, snapshot(pos), "unmake restores the position")
                }
            }
            // the fuzz has to actually exercise the interesting rules
            assertTrue(terminals > 50, "terminals=$terminals")
            assertTrue(passes > 20, "passes=$passes")
            if (sumo) assertTrue(pushes > 50, "pushes=$pushes")
            println("  [sumo=$sumo] terminals=$terminals deadlocks=$deadlocks pushes=$pushes passes=$passes")
        }
    }

    @Test
    fun `random playouts stay in lock-step for whole rounds`() {
        val rng = Random(99)
        repeat(60) { g ->
            var state: GameState = if (g % 3 == 0) pushPosition(rng) else randomPosition(rng, g % 2 == 0)
            state = resolved(state) ?: return@repeat
            val pos = Position.fromState(state)
            var ply = 0
            while (ply < 80 && state.status == GameStatus.IN_PROGRESS) {
                val ref = refMoves(state)
                assertTrue(ref.isNotEmpty())
                assertEquals(ref.map(::enc).sorted(), genSorted(pos))
                val pick = ref[rng.nextInt(ref.size)]
                val winner = pos.make(enc(pick))
                state = refStep(state, pick)
                if (state.status != GameStatus.IN_PROGRESS) {
                    assertEquals(sideIndex(state.roundWinner!!), winner)
                } else {
                    assertEquals(-1, winner)
                    assertEquals(Position.fromState(state).hashLo, pos.hashLo)
                }
                ply++
            }
        }
    }

    @Test
    fun `a move that walks into a deadlock is adjudicated the same way`() {
        // Engine Test 12's interlock with Black to move freely: landing any Black tower on a BLUE square
        // forces Gold's boxed-in BLUE tower, whose square forces Black's boxed-in ORANGE tower, whose
        // square is BLUE again - a repeated impasse. Black made the last physical move, so Black loses.
        var state = createGame(MatchFormat.STANDARD)
        fun put(side: PlayerSide, color: Color, row: Int, col: Int) {
            val id = towerId(side, color)
            state = state.copy(towers = state.towers + (id to state.towers.getValue(id).copy(position = Coordinate(row, col))))
        }
        put(PlayerSide.GOLD, Color.BLUE, 3, 4)
        put(PlayerSide.BLACK, Color.ORANGE, 2, 0)
        put(PlayerSide.GOLD, Color.GREEN, 2, 3)
        put(PlayerSide.GOLD, Color.RED, 2, 4)
        put(PlayerSide.GOLD, Color.YELLOW, 2, 5)
        put(PlayerSide.BLACK, Color.PINK, 3, 0)
        put(PlayerSide.BLACK, Color.PURPLE, 3, 1)
        state = state.copy(activePlayer = PlayerSide.BLACK, requiredColor = null, lastPhysicalMover = PlayerSide.GOLD)

        val pos = Position.fromState(state)
        val buf = IntArray(160)
        val n = pos.genMoves(buf)
        val ref = refMoves(state)
        var deadlocks = 0
        for (i in 0 until n) {
            val m = buf[i]
            val next = refStep(state, ref.first { enc(it) == m })
            val winner = pos.make(m)
            if (next.roundOverReason == RoundOverReason.DEADLOCK) {
                deadlocks++
                assertEquals(PlayerSide.GOLD, next.roundWinner)
                assertEquals(1, winner)
            } else if (next.status == GameStatus.IN_PROGRESS) {
                assertEquals(-1, winner)
            }
            pos.unmake()
        }
        assertTrue(deadlocks > 0, "the fixture must reach at least one deadlock")
    }

    @Test
    fun `deadlock adjudication matches the engine across 8000 dense positions`() {
        val rng = Random(424242)
        var deadlocks = 0
        repeat(8000) {
            val state = densePosition(rng)
            val pos = Position.fromState(state)
            val buf = IntArray(160)
            val n = pos.genMoves(buf)
            if (n == 0) return@repeat
            val ref = refMoves(state)
            for (k in 0 until n) {
                val m = buf[k]
                val next = refStep(state, ref.first { enc(it) == m })
                val winner = pos.make(m)
                if (next.status != GameStatus.IN_PROGRESS) {
                    if (next.roundOverReason == RoundOverReason.DEADLOCK) deadlocks++
                    assertEquals(sideIndex(next.roundWinner!!), winner)
                } else {
                    assertEquals(-1, winner)
                    assertEquals(sideIndex(next.activePlayer), pos.active)
                }
                pos.unmake()
            }
        }
        assertTrue(deadlocks > 5, "deadlocks=$deadlocks")
    }
}
