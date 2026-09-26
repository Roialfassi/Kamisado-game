package com.kamisado.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import com.kamisado.engine.Color as KColor

val Lacquer = Color(0xFF2B1810)
val Amber = Color(0xFFD97706)
val AmberLight = Color(0xFFFBBF24)

val KamisadoColorHex: Map<KColor, Color> = mapOf(
    KColor.BROWN to Color(0xFF5D4037),
    KColor.GREEN to Color(0xFF2E7D32),
    KColor.RED to Color(0xFFC62828),
    KColor.YELLOW to Color(0xFFFBC02D),
    KColor.PINK to Color(0xFFEC407A),
    KColor.PURPLE to Color(0xFF7B1FA2),
    KColor.BLUE to Color(0xFF1565C0),
    KColor.ORANGE to Color(0xFFEF6C00),
)

val KamisadoColorSymbol: Map<KColor, String> = mapOf(
    KColor.BROWN to "⛰",
    KColor.GREEN to "☘",
    KColor.RED to "▲",
    KColor.YELLOW to "☀",
    KColor.PINK to "❀",
    KColor.PURPLE to "◆",
    KColor.BLUE to "≈",
    KColor.ORANGE to "✱",
)

private val KamisadoDarkScheme = darkColorScheme(
    primary = Amber,
    secondary = AmberLight,
    background = Lacquer,
    surface = Lacquer,
)

@Composable
fun KamisadoTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) KamisadoDarkScheme else KamisadoDarkScheme
    MaterialTheme(colorScheme = colors, content = content)
}
