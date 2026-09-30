package com.kamisado.ai

import com.kamisado.engine.ALL_COLORS
import com.kamisado.engine.Color
import com.kamisado.engine.Coordinate
import com.kamisado.engine.GameState
import com.kamisado.engine.GameStatus
import com.kamisado.engine.MatchFormat
import com.kamisado.engine.Move
import com.kamisado.engine.MoveType
import com.kamisado.engine.PlayerSide
import com.kamisado.engine.SumoRank
import com.kamisado.engine.applyMove
import com.kamisado.engine.createGame
import com.kamisado.engine.getLegalMoves
import com.kamisado.engine.handlePassOrDeadlock
import com.kamisado.engine.towerId
import kotlin.random.Random

/** Encoded form of an engine move (same layout the fast [Position] uses). */
fun enc(m: Move): Int =
    (m.from.row * 8 + m.from.col) or ((m.to.row * 8 + m.to.col) shl 6) or (if (m.type == MoveType.SUMO_PUSH) 1 shl 12 else 0)

/** Reference-engine legal moves for whoever is to move. */
fun refMoves(state: GameState): List<Move> = legalMovesOf(state)

/** Reference-engine "step": apply a move, then resolve stymies / deadlock. */
fun refStep(state: GameState, move: Move): GameState {
    val applied = applyMove(state, move)
    check(applied.success && applied.state != null) { "reference rejected $move: ${applied.error}" }
    val s = applied.state!!
    if (s.status != GameStatus.IN_PROGRESS) return s
    return handlePassOrDeadlock(s).state ?: s
}

/** Resolves any pending stymie/deadlock and returns the state if the round is still going. */
fun resolved(state: GameState): GameState? {
    val s = handlePassOrDeadlock(state).state ?: state
    return if (s.status == GameStatus.IN_PROGRESS) s else null
}

private fun GameState.withTower(side: PlayerSide, color: Color, row: Int, col: Int, rank: SumoRank? = null): GameState {
    val id = towerId(side, color)
    val t = towers.getValue(id)
    return copy(towers = towers + (id to t.copy(position = Coordinate(row, col), sumoRank = rank ?: t.sumoRank)))
}

private fun GameState.withRank(id: String, rank: SumoRank): GameState =
    copy(towers = towers + (id to towers.getValue(id).copy(sumoRank = rank)))

private fun sideOf(b: Boolean) = if (b) PlayerSide.BLACK else PlayerSide.GOLD
private fun otherOf(s: PlayerSide) = s.other()
private fun rank(i: Int) = SumoRank.entries[i]

/** A random mid-round position: random tower placement, random Sumo ranks, random forced colour. */
fun randomPosition(rng: Random, sumo: Boolean = false): GameState {
    var state = createGame(MatchFormat.STANDARD)
    val used = HashSet<String>()
    for (id in state.towers.keys.toList()) {
        val t = state.towers.getValue(id)
        if (rng.nextDouble() < 0.55) {
            for (tries in 0 until 30) {
                val row = 1 + rng.nextInt(6)
                val col = rng.nextInt(8)
                if (!used.add("$row,$col")) continue
                state = state.copy(towers = state.towers + (id to t.copy(position = Coordinate(row, col))))
                break
            }
        }
        if (sumo && rng.nextDouble() < 0.25) state = state.withRank(id, rank(rng.nextInt(4)))
    }
    val active = sideOf(rng.nextBoolean())
    val free = rng.nextDouble() < 0.1
    return state.copy(
        activePlayer = active,
        requiredColor = if (free) null else ALL_COLORS[rng.nextInt(8)],
        lastPhysicalMover = if (rng.nextDouble() < 0.7) otherOf(active) else null,
    )
}

/** A ranked tower with a chain of opponents directly in front of it. */
fun pushPosition(rng: Random): GameState {
    var state = createGame(MatchFormat.STANDARD)
    val side = sideOf(rng.nextBoolean())
    val other = otherOf(side)
    val dr = if (side == PlayerSide.BLACK) 1 else -1
    val rk = 1 + rng.nextInt(3)
    val col = rng.nextInt(8)
    val chainLen = 1 + rng.nextInt(3)
    val startRow = if (dr == 1) 1 + rng.nextInt(5 - chainLen) else 6 - rng.nextInt(5 - chainLen)
    val pusherColor = ALL_COLORS[rng.nextInt(8)]
    state = state.withTower(side, pusherColor, startRow, col, rank(rk))
    val victims = ALL_COLORS.shuffled(rng).take(chainLen)
    victims.forEachIndexed { i, color ->
        val vRank = if (rng.nextDouble() < 0.8) rng.nextInt(rk) else rng.nextInt(4)
        state = state.withTower(other, color, startRow + dr * (i + 1), col, rank(vRank))
    }
    if (rng.nextDouble() < 0.2) {
        val friendly = ALL_COLORS.first { it != pusherColor }
        val row = startRow + dr * (chainLen + 1)
        if (row in 0..7) state = state.withTower(side, friendly, row, col)
    }
    return state.copy(activePlayer = side, requiredColor = pusherColor, lastPhysicalMover = other)
}

/** Towers packed into a few central rows: lots of stymies, pass chains and deadlocks. */
fun densePosition(rng: Random): GameState {
    var state = createGame(MatchFormat.STANDARD)
    val cells = ArrayList<Pair<Int, Int>>()
    for (r in 2..5) for (c in 0 until 8) cells.add(r to c)
    cells.shuffle(rng)
    val ids = state.towers.keys.toList().shuffled(rng).take(8 + rng.nextInt(6))
    ids.forEachIndexed { i, id ->
        val t = state.towers.getValue(id)
        state = state.copy(towers = state.towers + (id to t.copy(position = Coordinate(cells[i].first, cells[i].second))))
    }
    val active = sideOf(rng.nextBoolean())
    return state.copy(
        activePlayer = active,
        requiredColor = ALL_COLORS[rng.nextInt(8)],
        lastPhysicalMover = if (rng.nextDouble() < 0.85) otherOf(active) else null,
    )
}

/** Sanity: which legal moves does the reference engine offer for a colour (used by tower-level checks). */
fun legalFor(state: GameState, side: PlayerSide, color: Color): List<Move> = getLegalMoves(state.copy(activePlayer = side), color)
