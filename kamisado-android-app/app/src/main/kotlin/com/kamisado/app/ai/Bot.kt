package com.kamisado.app.ai

import com.kamisado.ai.BotLevel
import com.kamisado.ai.chooseMove
import com.kamisado.engine.*

/** The five levels of the shared AI (see `com.kamisado.ai` in the :engine module). */
enum class BotTier(val level: BotLevel, val label: String) {
    APPRENTICE(BotLevel.APPRENTICE, "Apprentice"),
    STUDENT(BotLevel.STUDENT, "Student"),
    RONIN(BotLevel.RONIN, "Ronin"),
    SAMURAI(BotLevel.SAMURAI, "Samurai"),
    DRAGON_MASTER(BotLevel.DRAGON_MASTER, "Dragon Master"),
}

/** All legal moves the active player can currently choose from: every color
 * if it's a free-choice turn, otherwise just the one required tower. */
fun enumerateChoices(state: GameState): List<Move> {
    if (state.requiredColor != null) return getLegalMoves(state, state.requiredColor)
    return ALL_COLORS.flatMap { getLegalMoves(state, it) }
}

/** Chooses a move for the side to move in `state` at the given level (null if there is none).
 * This is a blocking call - Dragon Master searches for up to ~1.5 s - so call it off the main thread. */
@Suppress("UNUSED_PARAMETER")
fun chooseBotMove(state: GameState, side: PlayerSide, tier: BotTier): Move? = chooseMove(state, tier.level)
