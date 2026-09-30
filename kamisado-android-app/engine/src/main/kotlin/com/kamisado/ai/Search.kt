package com.kamisado.ai

data class SearchResult(
    /** Best encoded move, or -1 if there is no legal move. */
    val move: Int,
    /** Score from the side-to-move's point of view (|score| >= MATE_BOUND means a forced win/loss). */
    val score: Int,
    /** Deepest fully completed iteration. */
    val depth: Int,
    val nodes: Long,
)

private const val TT_BITS = 18
private const val TT_SIZE = 1 shl TT_BITS
private const val TT_MASK = TT_SIZE - 1
private const val EXACT = 0
private const val LOWER = 1
private const val UPPER = 2
private const val MAX_PLY = 64
private const val MAX_MOVES = 160

/**
 * The shared transposition table. Every bot decision clears it first (see [clearTranspositionTable]).
 * It is NOT thread-safe: call the search through `chooseMove` / `analyze`, which serialise access, or
 * make sure only one thread searches at a time.
 */
private object Tt {
    val key = IntArray(TT_SIZE)
    val depth = ByteArray(TT_SIZE) { -1 }
    val flag = ByteArray(TT_SIZE)
    val score = IntArray(TT_SIZE)
    val move = IntArray(TT_SIZE)
}

fun clearTranspositionTable() {
    java.util.Arrays.fill(Tt.depth, (-1).toByte())
}

private class Searcher(val pos: Position, val weights: EvalWeights) {
    var nodes = 0L
    var stopped = false
    private val moveBuf = Array(MAX_PLY) { IntArray(MAX_MOVES) }
    private val scoreBuf = Array(MAX_PLY) { IntArray(MAX_MOVES) }
    private val history = IntArray(1 shl 13)
    private var deadline = Long.MAX_VALUE

    fun setDeadline(timeMs: Long) {
        deadline = if (timeMs == Long.MAX_VALUE) Long.MAX_VALUE else System.nanoTime() + timeMs * 1_000_000L
    }

    private fun timeUp(): Boolean {
        if (deadline != Long.MAX_VALUE && System.nanoTime() >= deadline) stopped = true
        return stopped
    }

    private fun order(ply: Int, n: Int, ttBest: Int) {
        val moves = moveBuf[ply]
        val scores = scoreBuf[ply]
        val side = pos.active
        val goal = goalRow(side)
        for (i in 0 until n) {
            val m = moves[i]
            val to = (m shr 6) and 63
            var s: Int
            if ((to shr 3) == goal) {
                s = 1_000_000
            } else if (m == ttBest) {
                s = 500_000
            } else {
                s = history[m and 0x1fff]
                if (((m shr 12) and 1) == 0) {
                    val opp = (1 - side) * 8 + pos.colorOf[to]
                    if (pos.canReachGoal(opp)) s -= 10_000 else if (!pos.hasMove(opp)) s += 300
                    val oc = pos.pos[opp]
                    val nr = (oc shr 3) + (if (side == 0) -1 else 1)
                    if (nr in 0..7) {
                        val col = oc and 7
                        var free = 0
                        if (pos.occ[nr * 8 + col] == NO_TOWER) free++
                        if (col > 0 && pos.occ[nr * 8 + col - 1] == NO_TOWER) free++
                        if (col < 7 && pos.occ[nr * 8 + col + 1] == NO_TOWER) free++
                        s += (3 - free) * 40
                    }
                    s += Math.abs((to shr 3) - ((m and 63) shr 3)) * 2
                } else {
                    s += 150
                }
            }
            scores[i] = s
        }
        for (i in 1 until n) {
            val m = moves[i]
            val s = scores[i]
            var j = i - 1
            while (j >= 0 && scores[j] < s) {
                moves[j + 1] = moves[j]
                scores[j + 1] = scores[j]
                j--
            }
            moves[j + 1] = m
            scores[j + 1] = s
        }
    }

    fun negamax(depth: Int, alphaIn: Int, betaIn: Int, ply: Int): Int {
        if (stopped) return 0
        if ((++nodes and 1023L) == 0L && timeUp()) return 0
        if (depth <= 0 || ply >= MAX_PLY - 1) return evaluate(pos, weights)
        var alpha = alphaIn
        var beta = betaIn

        val keyHi = pos.hashHi
        val idx = pos.hashLo and TT_MASK
        var best = 0
        if (Tt.depth[idx] >= 0 && Tt.key[idx] == keyHi) {
            best = Tt.move[idx]
            if (Tt.depth[idx] >= depth) {
                var s = Tt.score[idx]
                if (s > MATE_BOUND) s -= ply else if (s < -MATE_BOUND) s += ply
                val f = Tt.flag[idx].toInt()
                if (f == EXACT) return s
                if (f == LOWER && s > alpha) alpha = s else if (f == UPPER && s < beta) beta = s
                if (alpha >= beta) return s
            }
        }

        val moves = moveBuf[ply]
        val n = pos.genMoves(moves)
        if (n == 0) return 0
        order(ply, n, best)

        val side = pos.active
        val alpha0 = alpha
        var bestScore = Int.MIN_VALUE
        var bestMove = moves[0]
        for (i in 0 until n) {
            val m = moves[i]
            val winner = pos.make(m)
            val score = if (winner >= 0) {
                if (winner == side) MATE - ply - 1 else -(MATE - ply - 1)
            } else if (pos.active == side) {
                negamax(depth - 1, alpha, beta, ply + 1)
            } else {
                -negamax(depth - 1, -beta, -alpha, ply + 1)
            }
            pos.unmake()
            if (stopped) return 0
            if (score > bestScore) {
                bestScore = score
                bestMove = m
                if (score > alpha) alpha = score
                if (alpha >= beta) {
                    history[m and 0x1fff] += depth * depth
                    break
                }
            }
        }

        var stored = bestScore
        if (stored > MATE_BOUND) stored += ply else if (stored < -MATE_BOUND) stored -= ply
        if (Tt.depth[idx] < 0 || Tt.key[idx] != keyHi || depth >= Tt.depth[idx]) {
            Tt.key[idx] = keyHi
            Tt.depth[idx] = depth.toByte()
            Tt.score[idx] = stored
            Tt.move[idx] = bestMove
            Tt.flag[idx] = (if (bestScore <= alpha0) UPPER else if (bestScore >= beta) LOWER else EXACT).toByte()
        }
        return bestScore
    }

    /** Score of playing `m` at the root, from the root side's view. */
    fun scoreRootMove(m: Int, depth: Int, alpha: Int = -Int.MAX_VALUE, beta: Int = Int.MAX_VALUE): Int {
        val side = pos.active
        val winner = pos.make(m)
        val score = if (winner >= 0) {
            if (winner == side) MATE - 1 else -(MATE - 1)
        } else if (pos.active == side) {
            negamax(depth - 1, alpha, beta, 1)
        } else {
            -negamax(depth - 1, -beta, -alpha, 1)
        }
        pos.unmake()
        return score
    }
}

/** Iterative-deepening alpha-beta from `pos` (side to move = pos.active). `timeMs = Long.MAX_VALUE` means depth-limited only. */
fun findBestMove(pos: Position, maxDepth: Int, timeMs: Long = Long.MAX_VALUE, weights: EvalWeights = DEFAULT_WEIGHTS, skipForced: Boolean = false): SearchResult {
    val searcher = Searcher(pos, weights)
    searcher.setDeadline(timeMs)
    val rootMoves = IntArray(MAX_MOVES)
    val n = pos.genMoves(rootMoves)
    if (n == 0) return SearchResult(-1, 0, 0, 0)
    val moves = rootMoves.copyOf(n).toMutableList()
    if (n == 1 && skipForced) return SearchResult(moves[0], 0, 0, 0)

    var bestMove = moves[0]
    var bestScore = 0
    var completed = 0
    for (depth in 1..maxDepth) {
        var iterBest = moves[0]
        var iterScore = Int.MIN_VALUE
        var alpha = -Int.MAX_VALUE
        for (i in moves.indices) {
            val score = searcher.scoreRootMove(moves[i], depth, alpha, Int.MAX_VALUE)
            if (searcher.stopped) break
            if (score > iterScore) {
                iterScore = score
                iterBest = moves[i]
                if (score > alpha) alpha = score
            }
        }
        if (searcher.stopped) break
        bestMove = iterBest
        bestScore = iterScore
        completed = depth
        val at = moves.indexOf(iterBest)
        if (at > 0) {
            moves.removeAt(at)
            moves.add(0, iterBest)
        }
        if (Math.abs(iterScore) >= MATE_BOUND) break
    }
    return SearchResult(bestMove, bestScore, completed, searcher.nodes)
}

/** Exact (full-window) score of every root move at a fixed depth - used by the noisy, human-like levels. */
fun scoreRootMoves(pos: Position, depth: Int, weights: EvalWeights = DEFAULT_WEIGHTS): List<Pair<Int, Int>> {
    val searcher = Searcher(pos, weights)
    val buf = IntArray(MAX_MOVES)
    val n = pos.genMoves(buf)
    return (0 until n).map { i -> buf[i] to searcher.scoreRootMove(buf[i], depth) }
}
