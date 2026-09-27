package com.kamisado.app.ai

import com.kamisado.engine.*

enum class BotTier { APPRENTICE, RONIN }

/** All legal moves the active player can currently choose from: every color
 * if it's a free-choice turn, otherwise just the one required tower. */
fun enumerateChoices(state: GameState): List<Move> {
    if (state.requiredColor != null) return getLegalMoves(state, state.requiredColor)
    return ALL_COLORS.flatMap { getLegalMoves(state, it) }
}

private fun step(state: GameState, move: Move): GameState {
    val applied = applyMove(state, move)
    if (!applied.success || applied.state == null) return state
    if (applied.state.status != GameStatus.IN_PROGRESS) return applied.state
    val resolved = handlePassOrDeadlock(applied.state)
    return resolved.state ?: applied.state
}

private fun advancement(t: Tower): Int = if (t.side == PlayerSide.BLACK) t.position.row else 7 - t.position.row

private fun evaluate(state: GameState, side: PlayerSide): Double {
    if (state.status == GameStatus.ROUND_OVER || state.status == GameStatus.MATCH_OVER) {
        if (state.roundWinner == side) return 100_000.0
        if (state.roundWinner == side.other()) return -100_000.0
    }
    var score = 0.0
    for (tower in state.towers.values) {
        val sign = if (tower.side == side) 1 else -1
        score += sign * (advancement(tower) * 3 + tower.sumoRank.ordinal * 6)
    }
    return score
}

/** Chooses a move for `side` given the current state, per the bot's tier.
 * Only two tiers are implemented here (a lightweight on-device skirmish
 * opponent) - the full 5-level roadmap from PLAN.md is not built. */
fun chooseBotMove(state: GameState, side: PlayerSide, tier: BotTier): Move? {
    val choices = enumerateChoices(state)
    if (choices.isEmpty()) return null
    return when (tier) {
        BotTier.APPRENTICE -> choices.random()
        BotTier.RONIN -> choices.maxByOrNull { evaluate(step(state, it), side) + (Math.random() * 2) }
    }
}
