package com.kamisado.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kamisado.app.ui.theme.KamisadoColorHex
import com.kamisado.app.ui.theme.KamisadoColorSymbol
import com.kamisado.engine.*

private fun visualRows(perspective: PlayerSide): List<Int> =
    if (perspective == PlayerSide.BLACK) (7 downTo 0).toList() else (0..7).toList()

private fun visualCols(perspective: PlayerSide): List<Int> =
    if (perspective == PlayerSide.BLACK) (0..7).toList() else (7 downTo 0).toList()

/**
 * The 8x8 board. `rotate180` implements Tabletop (face-to-face) mode: the
 * whole board - and each tower's own reading orientation - is spun 180
 * degrees so the player sitting on the opposite side of a table sees their
 * own pieces upright.
 */
@Composable
fun KamisadoBoard(
    game: GameState,
    perspective: PlayerSide,
    selected: Coordinate?,
    legalDestinations: List<Move>,
    symbolsEnabled: Boolean,
    interactive: Boolean,
    rotate180: Boolean,
    onSquareClick: (Coordinate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val rows = visualRows(perspective)
    val cols = visualCols(perspective)
    val destinations = legalDestinations.associateBy { it.to }

    Column(
        modifier = modifier
            .aspectRatio(1f)
            .border(3.dp, Color(0xFF4A2E1A))
            .rotate(if (rotate180) 180f else 0f),
    ) {
        for (row in rows) {
            Row(modifier = Modifier.weight(1f).fillMaxWidth()) {
                for (col in cols) {
                    val squareColor = game.boardLayout[row][col]
                    val tower = findTowerAt(game, row, col)
                    val isSelected = selected?.row == row && selected.col == col
                    val destMove = destinations[Coordinate(row, col)]

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxHeight()
                            .background(KamisadoColorHex.getValue(squareColor))
                            .then(if (interactive) Modifier.clickable { onSquareClick(Coordinate(row, col)) } else Modifier),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (symbolsEnabled) {
                            Text(
                                text = KamisadoColorSymbol.getValue(squareColor),
                                fontSize = 10.sp,
                                color = Color.White.copy(alpha = 0.6f),
                                modifier = Modifier.align(Alignment.TopStart).padding(2.dp),
                            )
                        }
                        if (destMove != null) {
                            if (destMove.type == MoveType.SUMO_PUSH) {
                                Box(Modifier.fillMaxSize().background(Color.Red.copy(alpha = 0.35f)))
                            } else {
                                Box(Modifier.fillMaxSize(0.35f).clip(CircleShape).background(Color(0xFFFDE68A).copy(alpha = 0.55f)))
                            }
                        }
                        if (isSelected) {
                            Box(Modifier.fillMaxSize().border(3.dp, Color(0xFFFDE68A)))
                        }
                        if (tower != null) {
                            TowerGlyph(side = tower.side, color = tower.color, sumoRank = tower.sumoRank, symbolsEnabled = symbolsEnabled)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TowerGlyph(side: PlayerSide, color: com.kamisado.engine.Color, sumoRank: SumoRank, symbolsEnabled: Boolean) {
    val hex = KamisadoColorHex.getValue(color)
    Box(
        modifier = Modifier
            .fillMaxSize(0.72f)
            .background(hex, shape = CircleShape)
            .border(width = if (side == PlayerSide.BLACK) 3.dp else 2.dp, color = if (side == PlayerSide.BLACK) Color(0xFF0D0D0D) else Color(0xFFFDF6E3), shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (symbolsEnabled) {
            Text(text = KamisadoColorSymbol.getValue(color), fontWeight = FontWeight.Bold, color = Color.White)
        }
        if (sumoRank != SumoRank.NORMAL) {
            Text(
                text = "I".repeat(sumoRank.ordinal),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFFFDE68A),
                modifier = Modifier.align(Alignment.BottomEnd),
            )
        }
    }
}
