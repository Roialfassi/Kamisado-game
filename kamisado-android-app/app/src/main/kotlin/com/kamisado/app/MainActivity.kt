package com.kamisado.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.kamisado.app.ui.BattlefieldScreen
import com.kamisado.app.ui.Controller
import com.kamisado.app.ui.DojoHubScreen
import com.kamisado.app.ui.theme.KamisadoTheme
import com.kamisado.engine.MatchFormat

private sealed interface Screen {
    data object Hub : Screen
    data class Battlefield(val black: Controller, val gold: Controller) : Screen
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            KamisadoTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    KamisadoApp()
                }
            }
        }
    }
}

@Composable
private fun KamisadoApp() {
    var screen by remember { mutableStateOf<Screen>(Screen.Hub) }

    when (val s = screen) {
        is Screen.Hub -> DojoHubScreen(
            onStartHotseat = { screen = Screen.Battlefield(Controller.HUMAN, Controller.HUMAN) },
            onStartTabletop = { screen = Screen.Battlefield(Controller.HUMAN, Controller.HUMAN) },
            onStartSkirmish = { screen = Screen.Battlefield(Controller.HUMAN, Controller.RONIN_BOT) },
        )
        is Screen.Battlefield -> BattlefieldScreen(
            format = MatchFormat.STANDARD,
            blackController = s.black,
            goldController = s.gold,
            onExit = { screen = Screen.Hub },
        )
    }
}
