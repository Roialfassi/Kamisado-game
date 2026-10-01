package com.kamisado.app.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun DojoHubScreen(
    onStartHotseat: () -> Unit,
    onStartTabletop: () -> Unit,
    onStartSkirmish: (Controller) -> Unit,
) {
    Column(
        // scrolls when the eight buttons do not fit (landscape, short phones)
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("KAMISADO", fontSize = 32.sp, fontWeight = FontWeight.Black)
        Text("The Dojo Hub", modifier = Modifier.padding(bottom = 32.dp))

        HubButton("Pass & Play (Portrait)", onStartHotseat)
        Spacer(Modifier.height(12.dp))
        HubButton("Tabletop Mode (Face-to-Face)", onStartTabletop)
        Spacer(Modifier.height(12.dp))
        Text("AI Skirmish", modifier = Modifier.padding(bottom = 8.dp))
        for (controller in Controller.entries) {
            val tier = controller.tier ?: continue
            HubButton("${"★".repeat(tier.ordinal + 1)}  ${tier.label}") { onStartSkirmish(controller) }
            Spacer(Modifier.height(8.dp))
        }

        Spacer(Modifier.height(32.dp))
        Text(
            "The Dragon's Ascent campaign, daily puzzles, cloud sync, and push-notification " +
                "correspondence play are on the roadmap but not built in this pass.",
            modifier = Modifier.padding(horizontal = 8.dp),
        )
    }
}

@Composable
private fun HubButton(label: String, onClick: () -> Unit) {
    Button(onClick = onClick, modifier = Modifier.fillMaxWidth(0.85f)) {
        Text(label)
    }
}
