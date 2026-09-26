package com.kamisado.app.ui

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/** Thin wrapper over the platform Vibrator so the rest of the UI can just
 * say "play a place click" / "play a sumo pulse" without touching the
 * Build.VERSION branching every time. */
class Haptics(context: Context) {
    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    private fun oneShot(durationMs: Long, amplitude: Int) {
        val v = vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createOneShot(durationMs, amplitude))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(durationMs)
        }
    }

    /** Light rumble while a piece drags over a valid tile. */
    fun dragTick() = oneShot(8, 60)

    /** Crisp snap when a piece locks into its destination. */
    fun placeSnap() = oneShot(20, 160)

    /** Heavy dual-pulse for a Sumo push. */
    fun sumoPush() {
        val v = vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 45, 60, 60), intArrayOf(0, 255, 0, 220), -1))
        } else {
            @Suppress("DEPRECATION")
            v.vibrate(longArrayOf(0, 45, 60, 60), -1)
        }
    }

    /** Soft blocked/pass notification. */
    fun passNotice() = oneShot(15, 40)
}
