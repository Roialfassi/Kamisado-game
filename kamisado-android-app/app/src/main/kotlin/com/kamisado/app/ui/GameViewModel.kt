package com.kamisado.app.ui

import com.kamisado.app.ai.BotTier
import com.kamisado.app.ai.chooseBotMove
import com.kamisado.engine.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

enum class Controller(val tier: BotTier?) {
    HUMAN(null),
    APPRENTICE_BOT(BotTier.APPRENTICE),
    STUDENT_BOT(BotTier.STUDENT),
    RONIN_BOT(BotTier.RONIN),
    SAMURAI_BOT(BotTier.SAMURAI),
    DRAGON_MASTER_BOT(BotTier.DRAGON_MASTER),
}

data class HistoryEntry(val move: Move, val notation: String)

/** What the UI should do in response to a just-applied move, so it can fire
 * the matching haptic/sound feedback exactly once per real action. */
enum class FeedbackEvent { NONE, PLACE, SUMO_PUSH, PASS, ROUND_OVER }

data class GameUiState(
    val game: GameState,
    val history: List<HistoryEntry> = emptyList(),
    val selected: Coordinate? = null,
    val legalDestinations: List<Move> = emptyList(),
    val lastFeedback: FeedbackEvent = FeedbackEvent.NONE,
)

/**
 * Plain (non-androidx.lifecycle) state holder: the caller `remember`s one
 * instance per game setup and disposes its coroutine scope when done. There
 * is no need for a real ViewModel here since MainActivity's Activity already
 * declares configChanges for rotation, so nothing needs to survive process-
 * level recreation - and a plain remembered instance sidesteps the
 * cache-by-class-and-key semantics of androidx.lifecycle.viewmodel.compose's
 * viewModel(), which would otherwise reuse stale state across two games
 * started with identical settings back to back.
 */
class GameViewModel(
    format: MatchFormat = MatchFormat.STANDARD,
    private val blackController: Controller = Controller.HUMAN,
    private val goldController: Controller = Controller.HUMAN,
) {
    private val scope = CoroutineScope(Dispatchers.Main.immediate + SupervisorJob())
    private var moveCounter = 1
    private val _state = MutableStateFlow(GameUiState(game = createGame(format)))
    val state: StateFlow<GameUiState> = _state.asStateFlow()

    init {
        maybeTriggerBot()
    }

    fun dispose() {
        scope.cancel()
    }

    private fun controllerFor(side: PlayerSide): Controller =
        if (side == PlayerSide.BLACK) blackController else goldController

    fun selectSquare(coord: Coordinate) {
        val current = _state.value
        val g = current.game
        if (g.status != GameStatus.IN_PROGRESS) return
        if (controllerFor(g.activePlayer) != Controller.HUMAN) return

        val selected = current.selected
        if (selected != null) {
            val match = current.legalDestinations.firstOrNull { it.to == coord }
            if (match != null) {
                commitMove(match)
                return
            }
        }

        val tower = findTowerAt(g, coord.row, coord.col)
        if (tower == null || tower.side != g.activePlayer) {
            _state.value = current.copy(selected = null, legalDestinations = emptyList())
            return
        }
        if (g.requiredColor != null && tower.color != g.requiredColor) {
            _state.value = current.copy(selected = null, legalDestinations = emptyList())
            return
        }
        _state.value = current.copy(selected = coord, legalDestinations = getLegalMoves(g, tower.color))
    }

    fun commitMove(move: Move) {
        val before = _state.value.game
        val applied = applyMove(before, move)
        if (!applied.success || applied.state == null) return

        var next = applied.state
        val entries = mutableListOf(HistoryEntry(move, formatNotation(moveCounter, move, next.requiredColor)))
        moveCounter += 1

        var feedback = if (move.type == MoveType.SUMO_PUSH) FeedbackEvent.SUMO_PUSH else FeedbackEvent.PLACE

        if (next.status == GameStatus.IN_PROGRESS) {
            val resolved = handlePassOrDeadlock(next)
            if (resolved.state != null) {
                if (resolved.state.lastMove?.type == MoveType.PASS && resolved.state.lastMove !== next.lastMove) {
                    feedback = FeedbackEvent.PASS
                }
                next = resolved.state
                if (resolved.isRoundOver) feedback = FeedbackEvent.ROUND_OVER
            }
        } else {
            feedback = FeedbackEvent.ROUND_OVER
        }

        _state.value = _state.value.copy(
            game = next,
            history = _state.value.history + entries,
            selected = null,
            legalDestinations = emptyList(),
            lastFeedback = feedback,
        )
        maybeTriggerBot()
    }

    /** Starts the next round: every tower returns to its own colour square (house rule). */
    fun startNextRound() {
        if (_state.value.game.status != GameStatus.ROUND_OVER) return // ignore double taps
        val next = reseatForNextRound(_state.value.game)
        moveCounter = 1
        _state.value = _state.value.copy(game = next, history = emptyList(), selected = null, legalDestinations = emptyList())
        maybeTriggerBot()
    }

    fun consumeFeedback() {
        _state.value = _state.value.copy(lastFeedback = FeedbackEvent.NONE)
    }

    private fun maybeTriggerBot() {
        val g = _state.value.game
        if (g.status != GameStatus.IN_PROGRESS) return
        val controller = controllerFor(g.activePlayer)
        val tier = controller.tier ?: return
        scope.launch {
            delay(450)
            // the search can take a second or more at the top level: keep it off the main thread
            val snapshot = _state.value.game
            val move = withContext(Dispatchers.Default) { chooseBotMove(snapshot, g.activePlayer, tier) }
            if (move != null) commitMove(move)
        }
    }
}

private fun squareName(c: Coordinate): String = "${('a' + c.col)}${c.row + 1}"

private fun formatNotation(n: Int, move: Move, nextColor: Color?): String {
    val player = if (move.playerSide == PlayerSide.BLACK) "Black" else "Gold"
    val suffix = nextColor?.let { " ($it)" } ?: ""
    return when (move.type) {
        MoveType.PASS -> "$n. $player ${move.towerColor} PASS$suffix"
        MoveType.SUMO_PUSH -> {
            val pushed = move.pushedTowers?.lastOrNull()
            "$n. $player ${move.towerColor} ${squareName(move.from)} PUSH ${squareName(move.to)}->${pushed?.let { squareName(it.position) } ?: ""}$suffix"
        }
        MoveType.STANDARD -> "$n. $player ${move.towerColor} ${squareName(move.from)}-${squareName(move.to)}$suffix"
    }
}
