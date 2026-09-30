package com.kamisado.ai

import com.kamisado.engine.ALL_COLORS
import com.kamisado.engine.GameState
import com.kamisado.engine.Move
import com.kamisado.engine.MoveType
import com.kamisado.engine.PlayerSide

/**
 * A mutable, allocation-free twin of the engine's rules, built for search - the Kotlin port of the
 * TypeScript `Position` (packages/ai/src/position.ts). It re-implements the reference engine's move
 * generation (standard moves + the single Sumo push), turn flow (colour lock, Sumo extra turn,
 * stymie pass chains, deadlock adjudication) and terminal detection, and is checked against the
 * reference engine by `PositionDifferentialTest`.
 *
 * Encoding: cells are `row * 8 + col`; towers are `side * 8 + colourIndex` (side 0 = BLACK,
 * 1 = GOLD; colourIndex = ordinal in ALL_COLORS); a move is `from | to shl 6 | push shl 12`.
 */
const val NO_TOWER = -1
private val RANGE = intArrayOf(7, 5, 3, 1)
private val CAPACITY = intArrayOf(0, 1, 2, 3)

fun sideIndex(side: PlayerSide): Int = if (side == PlayerSide.BLACK) 0 else 1
fun dirOf(side: Int): Int = if (side == 0) 1 else -1
fun goalRow(side: Int): Int = if (side == 0) 7 else 0

private object Zobrist {
    val towerLo = IntArray(16 * 64)
    val towerHi = IntArray(16 * 64)
    val rankLo = IntArray(16 * 4)
    val rankHi = IntArray(16 * 4)
    val activeLo = IntArray(2)
    val activeHi = IntArray(2)
    val reqLo = IntArray(9)
    val reqHi = IntArray(9)
    val lastLo = IntArray(3)
    val lastHi = IntArray(3)

    init {
        var a = 0x4B414D49
        fun next(): Int {
            a += 0x6D2B79F5
            var t = a
            t = (t xor (t ushr 15)) * (t or 1)
            t = t xor (t + (t xor (t ushr 7)) * (t or 61))
            return t xor (t ushr 14)
        }
        for (arr in listOf(towerLo, towerHi, rankLo, rankHi, activeLo, activeHi, reqLo, reqHi, lastLo, lastHi)) {
            for (i in arr.indices) arr[i] = next()
        }
    }
}

private const val MAX_PLY = 256

class Position {
    val occ = IntArray(64) { NO_TOWER }
    val pos = IntArray(16)
    val rank = IntArray(16)
    val colorOf = IntArray(64)
    var active = 0
    /** Colour index the active side must move, or -1 on a free-choice turn. */
    var required = -1
    /** Side that made the last physical move (-1 if none yet this round). */
    var lastMover = -1
    private var towerHashLo = 0
    private var towerHashHi = 0

    private var sp = 0
    private val uActive = IntArray(MAX_PLY)
    private val uRequired = IntArray(MAX_PLY)
    private val uLast = IntArray(MAX_PLY)
    private val uMove = IntArray(MAX_PLY)
    private val uChain = IntArray(MAX_PLY)
    private val uHashLo = IntArray(MAX_PLY)
    private val uHashHi = IntArray(MAX_PLY)

    companion object {
        fun fromState(state: GameState): Position {
            val p = Position()
            for (r in 0 until 8) for (c in 0 until 8) p.colorOf[r * 8 + c] = state.boardLayout[r][c].ordinal
            for (t in state.towers.values) {
                val idx = sideIndex(t.side) * 8 + t.color.ordinal
                val cell = t.position.row * 8 + t.position.col
                p.pos[idx] = cell
                p.rank[idx] = t.sumoRank.ordinal
                p.occ[cell] = idx
            }
            p.active = sideIndex(state.activePlayer)
            p.required = state.requiredColor?.ordinal ?: -1
            p.lastMover = state.lastPhysicalMover?.let { sideIndex(it) } ?: -1
            p.rehash()
            return p
        }
    }

    private fun rehash() {
        var lo = 0
        var hi = 0
        for (t in 0 until 16) {
            val k = t * 64 + pos[t]
            lo = lo xor Zobrist.towerLo[k] xor Zobrist.rankLo[t * 4 + rank[t]]
            hi = hi xor Zobrist.towerHi[k] xor Zobrist.rankHi[t * 4 + rank[t]]
        }
        towerHashLo = lo
        towerHashHi = hi
    }

    val hashLo: Int get() = towerHashLo xor Zobrist.activeLo[active] xor Zobrist.reqLo[required + 1] xor Zobrist.lastLo[lastMover + 1]
    val hashHi: Int get() = towerHashHi xor Zobrist.activeHi[active] xor Zobrist.reqHi[required + 1] xor Zobrist.lastHi[lastMover + 1]

    // ---- move generation ------------------------------------------------

    /** True if the tower has at least one legal move (cheap: first steps + push). */
    fun hasMove(t: Int): Boolean {
        val cell = pos[t]
        val row = cell shr 3
        val col = cell and 7
        val nr = row + dirOf(t shr 3)
        if (nr in 0..7) {
            val base = nr * 8
            if (occ[base + col] == NO_TOWER) return true
            if (col > 0 && occ[base + col - 1] == NO_TOWER) return true
            if (col < 7 && occ[base + col + 1] == NO_TOWER) return true
        }
        return pushChain(t) > 0
    }

    /** Length of the chain the tower could push (>0 means a legal push), else 0. */
    fun pushChain(t: Int): Int {
        val rk = rank[t]
        if (rk == 0) return 0
        val side = t shr 3
        val cell = pos[t]
        val dr = dirOf(side)
        val col = cell and 7
        var r = (cell shr 3) + dr
        if (r < 0 || r > 7) return 0
        val first = occ[r * 8 + col]
        if (first == NO_TOWER || first shr 3 == side) return 0
        val capacity = CAPACITY[rk]
        var n = 0
        while (true) {
            val o = occ[r * 8 + col]
            if (o == NO_TOWER) return n
            if (o shr 3 == side) return 0
            if (rank[o] >= rk) return 0
            n++
            if (n > capacity) return 0
            r += dr
            if (r < 0 || r > 7) return 0
        }
    }

    /** Appends the tower's legal moves to `out` (engine order: straight, left, right; then the push). */
    fun genTowerMoves(t: Int, out: IntArray, start: Int): Int {
        var n = start
        val cell = pos[t]
        val row = cell shr 3
        val col = cell and 7
        val dr = dirOf(t shr 3)
        val range = RANGE[rank[t]]
        for (v in 0 until 3) {
            val dc = if (v == 0) 0 else if (v == 1) -1 else 1
            var r = row
            var c = col
            for (k in 1..range) {
                r += dr
                c += dc
                if (r < 0 || r > 7 || c < 0 || c > 7) break
                val to = r * 8 + c
                if (occ[to] != NO_TOWER) break
                out[n++] = cell or (to shl 6)
            }
        }
        if (pushChain(t) > 0) out[n++] = cell or (((row + dr) * 8 + col) shl 6) or (1 shl 12)
        return n
    }

    /** All legal moves for the side to move (the forced tower, or any tower on a free-choice turn). */
    fun genMoves(out: IntArray): Int {
        if (required >= 0) return genTowerMoves(active * 8 + required, out, 0)
        var n = 0
        for (c in 0 until 8) n = genTowerMoves(active * 8 + c, out, n)
        return n
    }

    /** Can the tower slide straight onto the goal row right now? (a winning move if its colour is forced) */
    fun canReachGoal(t: Int): Boolean {
        val side = t shr 3
        val cell = pos[t]
        val row = cell shr 3
        val col = cell and 7
        val dr = dirOf(side)
        val steps = Math.abs(goalRow(side) - row)
        if (steps == 0 || steps > RANGE[rank[t]]) return false
        for (v in 0 until 3) {
            val dc = if (v == 0) 0 else if (v == 1) -1 else 1
            var r = row
            var c = col
            var ok = true
            for (k in 1..steps) {
                r += dr
                c += dc
                if (c < 0 || c > 7 || occ[r * 8 + c] != NO_TOWER) {
                    ok = false
                    break
                }
            }
            if (ok) return true
        }
        return false
    }

    // ---- make / unmake --------------------------------------------------

    /**
     * Plays `m` and resolves the turn flow that follows it (colour lock, Sumo extra turn, stymie
     * passes). Returns the winning side if the round ended (goal reached, or a deadlock), else -1.
     * Always undo with [unmake].
     */
    fun make(m: Int): Int {
        val s = sp++
        uActive[s] = active
        uRequired[s] = required
        uLast[s] = lastMover
        uMove[s] = m
        uHashLo[s] = towerHashLo
        uHashHi[s] = towerHashHi

        val from = m and 63
        val to = (m shr 6) and 63
        val isPush = (m shr 12) and 1
        val t = occ[from]
        val side = t shr 3
        val dr = dirOf(side)
        var landingCell = to

        if (isPush == 1) {
            val col = from and 7
            val startRow = to shr 3
            var n = 0
            var r = startRow
            while (occ[r * 8 + col] != NO_TOWER) {
                n++
                r += dr
            }
            uChain[s] = n
            for (i in n downTo 1) {
                val fromCell = (startRow + (i - 1) * dr) * 8 + col
                val toCell = (startRow + i * dr) * 8 + col
                moveTower(occ[fromCell], fromCell, toCell, true)
            }
            landingCell = (startRow + n * dr) * 8 + col
        } else {
            uChain[s] = 0
        }
        moveTower(t, from, to, true)
        lastMover = side

        if ((to shr 3) == goalRow(side)) return side

        if (isPush == 1) {
            active = side
            required = colorOf[landingCell]
        } else {
            active = 1 - side
            required = colorOf[to]
        }

        var seen = 0
        while (true) {
            val tt = active * 8 + required
            if (hasMove(tt)) return -1
            val bit = 1 shl tt
            if (seen and bit != 0) {
                val loser = if (lastMover >= 0) lastMover else active
                return 1 - loser
            }
            seen = seen or bit
            required = colorOf[pos[tt]]
            active = 1 - active
        }
    }

    fun unmake() {
        val s = --sp
        val m = uMove[s]
        val from = m and 63
        val to = (m shr 6) and 63
        val isPush = (m shr 12) and 1
        val t = occ[to]
        val side = t shr 3
        val dr = dirOf(side)
        moveTower(t, to, from, false)
        if (isPush == 1) {
            val n = uChain[s]
            val col = from and 7
            val startRow = to shr 3
            for (i in 1..n) {
                val fromCell = (startRow + i * dr) * 8 + col
                val toCell = (startRow + (i - 1) * dr) * 8 + col
                moveTower(occ[fromCell], fromCell, toCell, false)
            }
        }
        active = uActive[s]
        required = uRequired[s]
        lastMover = uLast[s]
        towerHashLo = uHashLo[s]
        towerHashHi = uHashHi[s]
    }

    private fun moveTower(t: Int, from: Int, to: Int, hash: Boolean) {
        occ[from] = NO_TOWER
        occ[to] = t
        pos[t] = to
        if (hash) {
            towerHashLo = towerHashLo xor Zobrist.towerLo[t * 64 + from] xor Zobrist.towerLo[t * 64 + to]
            towerHashHi = towerHashHi xor Zobrist.towerHi[t * 64 + from] xor Zobrist.towerHi[t * 64 + to]
        }
    }

    /** Finds the reference engine's own [Move] matching an encoded move. */
    fun toEngineMove(m: Int, legal: List<Move>): Move? {
        val from = m and 63
        val to = (m shr 6) and 63
        val isPush = (m shr 12) and 1
        return legal.firstOrNull {
            it.from.row * 8 + it.from.col == from &&
                it.to.row * 8 + it.to.col == to &&
                (it.type == MoveType.SUMO_PUSH) == (isPush == 1)
        }
    }
}

internal fun legalMovesOf(state: GameState): List<Move> {
    val colors = state.requiredColor?.let { listOf(it) } ?: ALL_COLORS
    return colors.flatMap { com.kamisado.engine.getLegalMoves(state, it) }
}
