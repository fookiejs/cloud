package com.taskbridge.mobile.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val displayFormatter = DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.ENGLISH)

fun formatTimestamp(raw: String?): String {
    if (raw.isNullOrBlank()) return "—"
    return runCatching {
        val instant = Instant.parse(raw)
        displayFormatter.format(instant.atZone(ZoneId.systemDefault()))
    }.getOrDefault(raw)
}

fun formatDuration(ms: Long?): String {
    if (ms == null || ms < 0) return "—"
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return when {
        hours > 0 -> "${hours}h ${minutes}m"
        minutes > 0 -> "${minutes}m ${seconds}s"
        else -> "${seconds}s"
    }
}

fun textSnippet(text: String, maxLength: Int = 18): String {
    val trimmed = text.trim().replace('\n', ' ')
    if (trimmed.isEmpty()) return "—"
    return if (trimmed.length <= maxLength) trimmed else trimmed.take(maxLength) + "…"
}
