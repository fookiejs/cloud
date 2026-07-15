package com.taskbridge.mobile.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.TextMuted

@Composable
fun ExpandableMarkdown(
    text: String,
    modifier: Modifier = Modifier,
    collapsedMaxLines: Int = 5,
    collapsedCharHint: Int = 220,
    color: Color = MaterialTheme.colorScheme.onSurface,
    style: TextStyle = MaterialTheme.typography.bodyLarge,
) {
    if (text.isBlank()) {
        Text(
            text = "—",
            color = TextMuted,
            style = style,
            modifier = modifier.fillMaxWidth(),
        )
        return
    }

    var expanded by rememberSaveable(text) { mutableStateOf(false) }
    val seedLong = remember(text) {
        text.length > collapsedCharHint || text.lines().size > collapsedMaxLines
    }
    var layoutLong by remember(text) { mutableStateOf(false) }
    val collapsible = seedLong || layoutLong
    val toggle = { expanded = !expanded }

    Column(modifier = modifier.fillMaxWidth()) {
        MarkdownText(
            text = text,
            color = color,
            style = style,
            maxLines = if (expanded || !collapsible) Int.MAX_VALUE else collapsedMaxLines,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier
                .fillMaxWidth()
                .then(
                    if (collapsible) {
                        Modifier.clickable(onClick = toggle)
                    } else {
                        Modifier
                    },
                ),
            onTextLayout = { result ->
                if (!expanded) {
                    val overflow = result.hasVisualOverflow || result.lineCount >= collapsedMaxLines
                    if (overflow) {
                        layoutLong = true
                    }
                }
            },
        )
        if (collapsible) {
            Text(
                text = if (expanded) "Show less" else "Show more",
                style = MaterialTheme.typography.labelLarge,
                color = AccentSoft,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = toggle),
            )
        }
    }
}
