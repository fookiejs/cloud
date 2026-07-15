package com.taskbridge.mobile.ui.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle

@Composable
fun MarkdownText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
    style: androidx.compose.ui.text.TextStyle = MaterialTheme.typography.bodyMedium,
    maxLines: Int = Int.MAX_VALUE,
    overflow: androidx.compose.ui.text.style.TextOverflow = androidx.compose.ui.text.style.TextOverflow.Clip,
    onTextLayout: (androidx.compose.ui.text.TextLayoutResult) -> Unit = {},
) {
    val annotated = remember(text) { buildMarkdownAnnotatedString(stripCodeBlocks(text)) }
    Text(
        text = annotated,
        modifier = modifier,
        color = color,
        style = style,
        maxLines = maxLines,
        overflow = overflow,
        onTextLayout = onTextLayout,
    )
}

private fun stripCodeBlocks(text: String): String {
    return text
        .replace(Regex("(?s)```json.*?```"), "")
        .replace(Regex("(?s)```.*?```"), "")
        .trim()
}

private fun buildMarkdownAnnotatedString(text: String): AnnotatedString {
    return buildAnnotatedString {
        text.lines().forEachIndexed { index, line ->
            if (index > 0) append('\n')
            val trimmed = line.trimEnd()
            when {
                trimmed.startsWith("### ") -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                    append(trimmed.removePrefix("### "))
                }
                trimmed.startsWith("## ") -> withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                    append(trimmed.removePrefix("## "))
                }
                trimmed.startsWith("# ") -> withStyle(SpanStyle(fontWeight = FontWeight.Bold)) {
                    append(trimmed.removePrefix("# "))
                }
                trimmed.startsWith("- ") || trimmed.startsWith("* ") -> {
                    append("• ")
                    appendInline(trimmed.drop(2).trimStart())
                }
                else -> appendInline(trimmed)
            }
        }
    }
}

private fun AnnotatedString.Builder.appendInline(line: String) {
    var index = 0
    while (index < line.length) {
        if (line.startsWith("**", index)) {
            val end = line.indexOf("**", index + 2)
            if (end > index) {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                    append(line.substring(index + 2, end))
                }
                index = end + 2
                continue
            }
        }
        if (line.startsWith("`", index)) {
            val end = line.indexOf('`', index + 1)
            if (end > index) {
                append(line.substring(index + 1, end))
                index = end + 1
                continue
            }
        }
        append(line[index])
        index += 1
    }
}
