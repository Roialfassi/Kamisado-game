package com.kamisado.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.kamisado.engine.GameStatus
import com.kamisado.engine.MatchFormat
import com.kamisado.engine.PlayerSide

@Composable
fun BattlefieldScreen(
    format: MatchFormat,
    blackController: Controller,
    goldController: Controller,
    onExit: () -> Unit,
) {
    val viewModel = remember(format, blackController, goldController) {
        GameViewModel(format, blackController, goldController)
    }
    DisposableEffect(viewModel) {
        onDispose { viewModel.dispose() }
    }
    val ui by viewModel.state.collectAsState()
    val context = LocalContext.current
    val haptics = remember { Haptics(context) }

    var tabletopFlipped by remember { mutableStateOf(false) }
    var symbolsEnabled by remember { mutableStateOf(false) }

    LaunchedEffect(ui.lastFeedback) {
        when (ui.lastFeedback) {
            FeedbackEvent.PLACE -> haptics.placeSnap()
            FeedbackEvent.SUMO_PUSH -> haptics.sumoPush()
            FeedbackEvent.PASS -> haptics.passNotice()
            FeedbackEvent.ROUND_OVER -> haptics.sumoPush()
            FeedbackEvent.NONE -> {}
        }
        if (ui.lastFeedback != FeedbackEvent.NONE) viewModel.consumeFeedback()
    }

    val perspective = if (blackController == Controller.HUMAN) PlayerSide.BLACK else PlayerSide.GOLD

    Column(
        modifier = Modifier
            .fillMaxSize()
            .rotate(if (tabletopFlipped) 180f else 0f)
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            TextButton(onClick = onExit) { Text("< Dojo Hub") }
            Row {
                TextButton(onClick = { symbolsEnabled = !symbolsEnabled }) { Text(if (symbolsEnabled) "Symbols: On" else "Symbols: Off") }
                TextButton(onClick = { tabletopFlipped = !tabletopFlipped }) { Text("Flip for Tabletop") }
            }
        }

        Spacer(Modifier.height(8.dp))
        TurnBanner(ui.game)
        Spacer(Modifier.height(12.dp))

        Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
            KamisadoBoard(
                game = ui.game,
                perspective = perspective,
                selected = ui.selected,
                legalDestinations = ui.legalDestinations,
                symbolsEnabled = symbolsEnabled,
                interactive = ui.game.status == GameStatus.IN_PROGRESS,
                rotate180 = false,
                onSquareClick = viewModel::selectSquare,
                modifier = Modifier.fillMaxWidth(0.95f),
            )
        }

        if (ui.game.status != GameStatus.IN_PROGRESS) {
            Spacer(Modifier.height(12.dp))
            RoundOverCard(ui.game, onStartNextRound = viewModel::startNextRound)
        }
    }
}

@Composable
private fun TurnBanner(game: com.kamisado.engine.GameState) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.2f))) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Gold: ${game.scores.getValue(PlayerSide.GOLD).points} pts")
            Text(
                when {
                    game.status != GameStatus.IN_PROGRESS -> "Round ${game.currentRound} finished"
                    game.requiredColor == null -> "Opening move"
                    else -> "Move: ${game.requiredColor}"
                },
            )
            Text("Black: ${game.scores.getValue(PlayerSide.BLACK).points} pts")
        }
    }
}

@Composable
private fun RoundOverCard(game: com.kamisado.engine.GameState, onStartNextRound: () -> Unit) {
    Card {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val winnerLabel = if (game.roundWinner == PlayerSide.BLACK) "Black" else "Gold"
            Text(if (game.status == GameStatus.MATCH_OVER) "$winnerLabel wins the match!" else "$winnerLabel wins round ${game.currentRound}!")
            if (game.status == GameStatus.ROUND_OVER) {
                Spacer(Modifier.height(8.dp))
                Button(onClick = onStartNextRound) { Text("Start round ${game.currentRound + 1}") }
            }
        }
    }
}
