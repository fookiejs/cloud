package com.taskbridge.mobile.speech

import android.content.Context
import android.media.AudioManager
import android.os.Handler
import android.os.Looper

class SpeechBeepSuppressor(context: Context) {
    private val audioManager =
        context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val mainHandler = Handler(Looper.getMainLooper())

    private var savedNotificationVolume = -1
    private var savedSystemVolume = -1
    private var restoreRunnable: Runnable? = null

    fun suppress() {
        cancelRestore()
        if (savedNotificationVolume < 0) {
            savedNotificationVolume = audioManager.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
        }
        if (savedSystemVolume < 0) {
            savedSystemVolume = audioManager.getStreamVolume(AudioManager.STREAM_SYSTEM)
        }
        audioManager.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0)
        audioManager.setStreamVolume(AudioManager.STREAM_SYSTEM, 0, 0)
    }

    fun restoreAfterReady(delayMs: Long = RESTORE_DELAY_MS) {
        cancelRestore()
        val runnable = Runnable { restoreNow() }
        restoreRunnable = runnable
        mainHandler.postDelayed(runnable, delayMs)
    }

    fun restoreNow() {
        cancelRestore()
        if (savedNotificationVolume >= 0) {
            audioManager.setStreamVolume(
                AudioManager.STREAM_NOTIFICATION,
                savedNotificationVolume,
                0,
            )
            savedNotificationVolume = -1
        }
        if (savedSystemVolume >= 0) {
            audioManager.setStreamVolume(AudioManager.STREAM_SYSTEM, savedSystemVolume, 0)
            savedSystemVolume = -1
        }
    }

    private fun cancelRestore() {
        restoreRunnable?.let { mainHandler.removeCallbacks(it) }
        restoreRunnable = null
    }

    companion object {
        private const val RESTORE_DELAY_MS = 200L
    }
}
