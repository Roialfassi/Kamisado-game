package com.kamisado.ai

import com.kamisado.engine.GameState
import com.kamisado.engine.Move
import com.kamisado.engine.PlayerSide
import kotlin.random.Random

/** The five bot levels (same names and strengths as the web app's `@kamisado/ai`). */
enum class BotLevel(val label: String, val stars: Int, val blurb: String) {
    APPRENTICE("Apprentice", 1, "Moves quickly and often without a plan. Perfect for learning the colour lock."),
    STUDENT("Student", 2, "Grabs a win when it sees one and avoids handing you one, but does not plan ahead."),
    RONIN("Ronin", 3, "Thinks a couple of moves ahead. Makes the occasional human slip."),
    SAMURAI("Samurai", 4, "Reads the position several moves deep and rarely errs. Expect real pressure."),
    DRAGON_MASTER("Dragon Master", 5, "Searches up to 20 moves ahead and finds every forced sequence within that horizon."),
}

/** Depth, product time budget and the evaluation noise that makes the lower levels human. */
data class LevelConfig(val depth: Int, val timeMs: Long, val noise: Double)

private val CONFIG = mapOf(
    BotLevel.STUDENT to LevelConfig(2, 200, 160.0),
    BotLevel.RONIN to LevelConfig(4, 300, 95.0),
    BotLevel.SAMURAI to LevelConfig(6, 500, 55.0),
    BotLevel.DRAGON_MASTER to LevelConfig(20, 1500, 0.0),
)

private fun gaussian(rng: Random): Double {
    val u = maxOf(rng.nextDouble(), 1e-12)
    val v = rng.nextDouble()
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

private fun pickApprentice(state: GameState, moves: List<Move>, rng: Random): Move {
    val goal = if (state.activePlayer == PlayerSide.BLACK) 7 else 0
    val winning = moves.filter { it.to.row == goal }
    if (winning.isNotEmpty() && rng.nextDouble() < 0.5) return winning[rng.nextInt(winning.size)]
    val dir = if (state.activePlayer == PlayerSide.BLACK) 1 else -1
    val scored = moves.map { it to ((it.to.row - it.from.row) * dir + rng.nextDouble() * 3) }.sortedByDescending { it.second }
    val top = scored.take(maxOf(1, (scored.size + 1) / 2))
    return top[rng.nextInt(top.size)].first
}

/**
 * Picks a move for the side to move in [state]; null if there is no legal move. With
 * [deterministicDepth] the wall-clock budget is ignored (reproducible, used by tests). [override]
 * replaces the level's depth/noise/time (tests and tuning).
 */
fun chooseMove(
    state: GameState,
    level: BotLevel,
    rng: Random = Random.Default,
    deterministicDepth: Boolean = false,
    override: LevelConfig? = null,
): Move? {
    val moves = legalMovesOf(state)
    if (moves.isEmpty()) return null
    if (moves.size == 1) return moves[0]
    if (level == BotLevel.APPRENTICE) return pickApprentice(state, moves, rng)

    val cfg = override ?: CONFIG.getValue(level)
    // every decision starts from a cold table so results are reproducible and levels stay independent
    clearTranspositionTable()
    val pos = Position.fromState(state)
    val encoded: Int = if (cfg.noise > 0.0) {
        val scored = scoreRootMoves(pos, cfg.depth)
        var best = scored[0]
        var bestValue = -Double.MAX_VALUE
        for (s in scored) {
            // forced results (win/loss in one, two...) are never blurred - a real beginner does see those
            val value = if (Math.abs(s.second) >= MATE_BOUND) s.second.toDouble() else s.second + gaussian(rng) * cfg.noise
            if (value > bestValue) {
                bestValue = value
                best = s
            }
        }
        best.first
    } else {
        findBestMove(pos, cfg.depth, if (deterministicDepth) Long.MAX_VALUE else cfg.timeMs, skipForced = true).move
    }
    return pos.toEngineMove(encoded, moves) ?: error("search move $encoded is not a legal engine move")
}

/** Best move for the side to move (for hints). */
fun analyze(state: GameState, maxDepth: Int = 12, timeMs: Long = 400): Pair<Move?, Int> {
    val moves = legalMovesOf(state)
    if (moves.isEmpty()) return null to 0
    clearTranspositionTable()
    val pos = Position.fromState(state)
    val r = findBestMove(pos, maxDepth, timeMs)
    return (pos.toEngineMove(r.move, moves) ?: moves[0]) to r.score
}
