package com.taskbridge.mobile.speech

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

class SpeechRecognizerHelper(context: Context) {
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())
    private val beepSuppressor = SpeechBeepSuppressor(appContext)

    private val recognizer: SpeechRecognizer? =
        if (SpeechRecognizer.isRecognitionAvailable(context)) {
            SpeechRecognizer.createSpeechRecognizer(context)
        } else null

    private val _segments = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val segments: SharedFlow<String> = _segments

    private val _partials = MutableSharedFlow<String>(extraBufferCapacity = 8)
    val partials: SharedFlow<String> = _partials

    private val _sessionEnded = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val sessionEnded: SharedFlow<Unit> = _sessionEnded

    private val _errors = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val errors: SharedFlow<String> = _errors

    private var sessionActive = false
    private var listening = false
    private var endingSession = false
    private var useSegmentedSession = false
    private var lastPartial: String? = null

    private val restartRunnable = Runnable {
        if (sessionActive && !endingSession) {
            startListeningInternal()
        }
    }

    private fun emitSessionEnded() {
        mainHandler.post { _sessionEnded.tryEmit(Unit) }
    }

    init {
        recognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                beepSuppressor.restoreAfterReady()
            }

            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {}

            override fun onError(error: Int) {
                listening = false
                beepSuppressor.restoreNow()
                if (endingSession) {
                    endingSession = false
                    emitSessionEnded()
                    return
                }
                if (sessionActive && isRecoverableError(error)) {
                    scheduleRestart()
                    return
                }
                if (!sessionActive) {
                    emitSessionEnded()
                    return
                }
                _errors.tryEmit("Speech error: $error")
            }

            override fun onResults(results: Bundle?) {
                listening = false
                beepSuppressor.restoreNow()
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim()
                if (!text.isNullOrEmpty()) {
                    lastPartial = null
                    _segments.tryEmit(text)
                } else if (endingSession) {
                    val pending = lastPartial
                    lastPartial = null
                    if (!pending.isNullOrBlank()) {
                        _segments.tryEmit(pending)
                    }
                }
                if (useSegmentedSession) {
                    if (endingSession) {
                        endingSession = false
                        emitSessionEnded()
                    } else if (sessionActive) {
                        scheduleRestart()
                    } else {
                        emitSessionEnded()
                    }
                    return
                }
                if (endingSession) {
                    endingSession = false
                    emitSessionEnded()
                    return
                }
                if (sessionActive) {
                    scheduleRestart()
                } else {
                    emitSessionEnded()
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim()
                if (!text.isNullOrEmpty()) {
                    lastPartial = text
                    _partials.tryEmit(text)
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}

            override fun onSegmentResults(segmentResults: Bundle) {
                if (!useSegmentedSession || endingSession) return
                val matches = segmentResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim()
                if (!text.isNullOrEmpty()) {
                    _segments.tryEmit(text)
                }
            }

            override fun onEndOfSegmentedSession() {
                if (!useSegmentedSession) return
                listening = false
                beepSuppressor.restoreNow()
                if (endingSession) {
                    val pending = lastPartial
                    lastPartial = null
                    if (!pending.isNullOrBlank()) {
                        _segments.tryEmit(pending)
                    }
                }
                if (endingSession) {
                    endingSession = false
                    emitSessionEnded()
                    return
                }
                if (sessionActive) {
                    scheduleRestart()
                } else {
                    emitSessionEnded()
                }
            }
        })
    }

    fun startSession() {
        if (recognizer == null) return
        mainHandler.removeCallbacks(restartRunnable)
        endingSession = false
        sessionActive = true
        listening = false
        lastPartial = null
        useSegmentedSession = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
        startListeningInternal()
    }

    fun endSession() {
        if (!sessionActive && !listening && !endingSession) return
        mainHandler.removeCallbacks(restartRunnable)
        endingSession = true
        sessionActive = false
        if (listening) {
            recognizer?.stopListening()
        } else {
            endingSession = false
            beepSuppressor.restoreNow()
            val pending = lastPartial
            lastPartial = null
            if (!pending.isNullOrBlank()) {
                _segments.tryEmit(pending)
            }
            emitSessionEnded()
        }
    }

    private fun scheduleRestart() {
        mainHandler.removeCallbacks(restartRunnable)
        mainHandler.postDelayed(restartRunnable, RESTART_DELAY_MS)
    }

    private fun startListeningInternal() {
        if (!sessionActive || endingSession || listening || recognizer == null) return
        beepSuppressor.suppress()
        listening = true
        val speechLocale = java.util.Locale.getDefault().toLanguageTag()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, speechLocale)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, speechLocale)
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, true)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, SILENCE_TIMEOUT_MS)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, SILENCE_TIMEOUT_MS)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, SILENCE_TIMEOUT_MS)
            putExtra(SPEECH_INPUT_BEEP_EXTRA, false)
            if (useSegmentedSession) {
                putExtra(
                    RecognizerIntent.EXTRA_SEGMENTED_SESSION,
                    RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS,
                )
            }
        }
        recognizer.startListening(intent)
    }

    private fun isRecoverableError(error: Int): Boolean {
        return error == SpeechRecognizer.ERROR_NO_MATCH ||
            error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
            error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ||
            error == SpeechRecognizer.ERROR_CLIENT
    }

    fun destroy() {
        mainHandler.removeCallbacks(restartRunnable)
        sessionActive = false
        endingSession = false
        beepSuppressor.restoreNow()
        recognizer?.destroy()
    }

    companion object {
        private const val RESTART_DELAY_MS = 120L
        private const val SILENCE_TIMEOUT_MS = 600_000L
        private const val SPEECH_INPUT_BEEP_EXTRA = "android.speech.extras.SPEECH_INPUT_BEEP"
    }
}
