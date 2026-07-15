package com.taskbridge.mobile.speech

import com.taskbridge.mobile.domain.models.TaskComment
import java.time.Instant

private val fencedCode = Regex("```[\\s\\S]*?```")
private val inlineCode = Regex("`[^`]+`")
private val markdownLink = Regex("\\[([^\\]]+)]\\([^)]+\\)")
private val heading = Regex("^#+\\s+", RegexOption.MULTILINE)
private val bold = Regex("\\*\\*([^*]+)\\*\\*")
private val italic = Regex("\\*([^*]+)\\*")
private val underscore = Regex("_([^_]+)_")
private val listMarker = Regex("^[-*+]\\s+", RegexOption.MULTILINE)
private val whitespace = Regex("\\s+")

fun plainSpeechText(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    return raw
        .replace(fencedCode, " ")
        .replace(inlineCode, " ")
        .replace(markdownLink, "$1")
        .replace(heading, "")
        .replace(bold, "$1")
        .replace(italic, "$1")
        .replace(underscore, "$1")
        .replace(listMarker, "")
        .replace(whitespace, " ")
        .trim()
}

fun descriptionDisplayText(
    title: String,
    description: String?,
    request: String,
    isEpic: Boolean,
): String {
    val body = description?.takeIf { it.isNotBlank() } ?: request.takeIf { it.isNotBlank() }
    if (!body.isNullOrBlank()) return body
    return if (isEpic) title else ""
}

fun detailSpeechText(
    title: String,
    description: String?,
    request: String,
    isEpic: Boolean,
): String {
    val bodySource = description?.takeIf { it.isNotBlank() } ?: request
    val body = plainSpeechText(bodySource)
    val titlePlain = plainSpeechText(title)
    if (!isEpic) {
        return body.ifBlank { titlePlain }
    }
    return when {
        body.isNotBlank() && titlePlain.isNotBlank() -> "$titlePlain. $body"
        body.isNotBlank() -> body
        titlePlain.isNotBlank() -> titlePlain
        else -> ""
    }
}

fun commentSpeechText(comment: TaskComment, index: Int, author: String): String {
    val body = plainSpeechText(comment.text)
    if (body.isBlank()) return ""
    return "Comment ${index + 1}. $author: $body"
}

fun commentsSpeechText(
    comments: List<TaskComment>,
    authorOf: (TaskComment) -> String,
): String {
    return comments
        .sortedBy { parseCommentTime(it.at) }
        .mapIndexed { index, comment ->
            commentSpeechText(comment, index, authorOf(comment))
        }
        .filter { it.isNotBlank() }
        .joinToString(". ")
}

private fun parseCommentTime(value: String?): Long {
    if (value.isNullOrBlank()) return 0L
    return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(0L)
}

fun splitForTts(text: String, maxChunkSize: Int = 3500): List<String> {
    val trimmed = text.trim()
    if (trimmed.isEmpty()) return emptyList()
    if (trimmed.length <= maxChunkSize) return listOf(trimmed)
    val chunks = mutableListOf<String>()
    var start = 0
    while (start < trimmed.length) {
        val end = (start + maxChunkSize).coerceAtMost(trimmed.length)
        if (end >= trimmed.length) {
            chunks.add(trimmed.substring(start).trim())
            break
        }
        val splitAt = trimmed.lastIndexOf('.', end)
            .takeIf { it > start + maxChunkSize / 2 }
            ?: trimmed.lastIndexOf(' ', end)
                .takeIf { it > start + maxChunkSize / 2 }
            ?: end
        chunks.add(trimmed.substring(start, splitAt).trim())
        start = splitAt
        while (start < trimmed.length && trimmed[start].isWhitespace()) start++
    }
    return chunks.filter { it.isNotEmpty() }
}
