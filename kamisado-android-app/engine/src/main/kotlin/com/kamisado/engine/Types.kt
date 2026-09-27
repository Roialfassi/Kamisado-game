package com.kamisado.engine

enum class Color {
    BROWN, GREEN, RED, YELLOW, PINK, PURPLE, BLUE, ORANGE;
}

val ALL_COLORS: List<Color> = Color.entries

enum class PlayerSide {
    BLACK, GOLD;

    fun other(): PlayerSide = if (this == BLACK) GOLD else BLACK
}

enum class SumoRank {
    NORMAL, SINGLE, DOUBLE, TRIPLE;

    val ordinalValue: Int get() = ordinal

    fun promoted(): SumoRank = when (this) {
        NORMAL -> SINGLE
        SINGLE -> DOUBLE
        DOUBLE -> TRIPLE
        TRIPLE -> TRIPLE // capped; a 4th win is handled as an instant match win by the caller
    }
}

data class Coordinate(val row: Int, val col: Int)

data class Tower(
    val id: String,
    val side: PlayerSide,
    val color: Color,
    val sumoRank: SumoRank,
    val position: Coordinate,
)

enum class MoveType { STANDARD, SUMO_PUSH, PASS }

data class Move(
    val type: MoveType,
    val playerSide: PlayerSide,
    val towerColor: Color,
    val from: Coordinate,
    val to: Coordinate,
    val pushedTowers: List<Tower>? = null,
)

enum class MatchFormat(val pointsToWin: Int) {
    SINGLE_ROUND(1), STANDARD(3), LONG(7), MARATHON(15),
}

enum class GameStatus { NOT_STARTED, IN_PROGRESS, ROUND_OVER, MATCH_OVER }

enum class RoundOverReason { BASELINE_REACHED, DEADLOCK, RESIGN }

data class PlayerScore(val side: PlayerSide, val points: Int, val roundsWon: Int)

data class GameState(
    val matchFormat: MatchFormat,
    val status: GameStatus,
    val currentRound: Int,
    val scores: Map<PlayerSide, PlayerScore>,
    val boardLayout: List<List<Color>>,
    val towers: Map<String, Tower>,
    val activePlayer: PlayerSide,
    val requiredColor: Color?,
    val lastMove: Move?,
    val lastPhysicalMover: PlayerSide?,
    val consecutivePasses: Int,
    val clocks: Map<PlayerSide, Long>,
    val lastClockUpdate: Long,
    val roundWinner: PlayerSide? = null,
    val roundOverReason: RoundOverReason? = null,
    val matchWinner: PlayerSide? = null,
)

enum class EngineErrorCode {
    GAME_NOT_IN_PROGRESS, NOT_ACTIVE_PLAYER, NO_SUCH_TOWER, COLOR_MISMATCH, FROM_MISMATCH,
    MANDATORY_MOVE, MANDATORY_PUSH, ILLEGAL_DIRECTION, PATH_OBSTRUCTED, DESTINATION_OCCUPIED,
    EXCEEDS_SUMO_RANGE, ILLEGAL_SUMO_PUSH_DIRECTION, SUMO_PUSH_BLOCKED, CANNOT_PUSH_OFF_BOARD,
    SUMO_IMMUNITY, INVALID_MOVE,
}

data class MoveResult(
    val success: Boolean,
    val state: GameState? = null,
    val error: String? = null,
    val errorCode: EngineErrorCode? = null,
    val isRoundOver: Boolean = false,
    val isMatchOver: Boolean = false,
    val roundWinner: PlayerSide? = null,
    val matchWinner: PlayerSide? = null,
)

fun towerId(side: PlayerSide, color: Color): String = "${side}_$color"
