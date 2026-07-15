package com.taskbridge.mobile.speech

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

class TextToSpeechHelper(context: Context) {
    private var tts: TextToSpeech? = null
    private var ready = false
    private val utterancePrefix = "task-bridge-tts"
    private var pendingChunks = 0
    private var queuedText: String? = null

    private val _isSpeaking = MutableStateFlow(false)
    val isSpeaking: StateFlow<Boolean> = _isSpeaking.asStateFlow()

    init {
        tts = TextToSpeech(context.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) {
                applyLocale()
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {
                        _isSpeaking.value = true
                    }

                    override fun onDone(utteranceId: String?) {
                        pendingChunks = (pendingChunks - 1).coerceAtLeast(0)
                        if (pendingChunks == 0) {
                            _isSpeaking.value = false
                        }
                    }

                    @Deprecated("Deprecated in Java")
                    override fun onError(utteranceId: String?) {
                        pendingChunks = 0
                        _isSpeaking.value = false
                    }

                    override fun onStop(utteranceId: String?, interrupted: Boolean) {
                        pendingChunks = 0
                        _isSpeaking.value = false
                    }
                })
                queuedText?.let { text ->
                    queuedText = null
                    speak(text)
                }
            } else {
                queuedText = null
                _isSpeaking.value = false
            }
        }
    }

    fun speak(text: String) {
        if (text.isBlank()) return
        if (!ready) {
            queuedText = text
            _isSpeaking.value = true
            return
        }
        val chunks = splitForTts(text)
        if (chunks.isEmpty()) return
        pendingChunks = chunks.size
        _isSpeaking.value = true
        chunks.forEachIndexed { index, chunk ->
            val mode = if (index == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD
            val params = Bundle()
            tts?.speak(chunk, mode, params, "$utterancePrefix-$index")
        }
    }

    fun stop() {
        queuedText = null
        tts?.stop()
        pendingChunks = 0
        _isSpeaking.value = false
    }

    fun destroy() {
        queuedText = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        ready = false
        _isSpeaking.value = false
    }

    private fun applyLocale() {
        val engine = tts ?: return
        val candidates = listOf(Locale.getDefault(), Locale.US, Locale.UK)
        for (locale in candidates) {
            if (engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) {
                engine.language = locale
                return
            }
        }
    }
}
