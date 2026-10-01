package com.kamisado.ai

/** Score for a mate (win of the round); shorter mates score higher. */
const val MATE = 30000
/** Any score above this is a forced win/loss found by search. */
const val MATE_BOUND = MATE - 512
private const val WIN_NEXT = 9000

class EvalWeights(
    /** Points per tower by rows advanced (0..6). */
    val advance: IntArray = intArrayOf(0, 3, 8, 16, 28, 44, 66),
    /** A tower with a clear line to the goal. */
    val threat: Int = 90,
    /** Second and further threats. */
    val extraThreat: Int = 60,
    /** Free forward squares around the towers. */
    val freedom: Int = 2,
)

val DEFAULT_WEIGHTS = EvalWeights()

private fun sideScore(pos: Position, side: Int, w: EvalWeights): Int {
    var score = 0
    var threats = 0
    val goal = goalRow(side)
    for (c in 0 until 8) {
        val t = side * 8 + c
        val row = pos.pos[t] shr 3
        val adv = Math.abs(if (goal == 7) row else 7 - row)
        score += w.advance[Math.min(adv, 6)]
        if (pos.canReachGoal(t)) threats++
    }
    if (threats > 0) score += w.threat + (threats - 1) * w.extraThreat
    return score
}

/** Static evaluation from the point of view of the side to move. */
fun evaluate(pos: Position, w: EvalWeights = DEFAULT_WEIGHTS): Int {
    val me = pos.active
    if (pos.required >= 0 && pos.canReachGoal(me * 8 + pos.required)) return WIN_NEXT
    var score = sideScore(pos, me, w) - sideScore(pos, 1 - me, w)
    if (w.freedom != 0) {
        var free = 0
        for (s in 0 until 2) {
            val sign = if (s == me) 1 else -1
            for (c in 0 until 8) {
                val cell = pos.pos[s * 8 + c]
                val nr = (cell shr 3) + (if (s == 0) 1 else -1)
                if (nr < 0 || nr > 7) continue
                val col = cell and 7
                var n = 0
                if (pos.occ[nr * 8 + col] == NO_TOWER) n++
                if (col > 0 && pos.occ[nr * 8 + col - 1] == NO_TOWER) n++
                if (col < 7 && pos.occ[nr * 8 + col + 1] == NO_TOWER) n++
                free += sign * n
            }
        }
        score += free * w.freedom
    }
    return score
}
