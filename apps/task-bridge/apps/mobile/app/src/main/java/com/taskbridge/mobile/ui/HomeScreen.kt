package com.taskbridge.mobile.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Keyboard
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.FloatingActionButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.taskbridge.mobile.domain.models.RecentTask
import com.taskbridge.mobile.ui.components.AppBackground
import com.taskbridge.mobile.ui.theme.Accent
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.Error
import com.taskbridge.mobile.ui.theme.MicActive
import com.taskbridge.mobile.ui.theme.MicIdle
import com.taskbridge.mobile.ui.theme.MicRing
import com.taskbridge.mobile.ui.theme.Primary
import com.taskbridge.mobile.ui.theme.PrimarySoft
import com.taskbridge.mobile.ui.theme.Success
import com.taskbridge.mobile.ui.theme.SurfaceBorder
import com.taskbridge.mobile.ui.theme.SurfaceElevated
import com.taskbridge.mobile.ui.theme.TextMuted
import com.taskbridge.mobile.ui.theme.TextPrimary
import com.taskbridge.mobile.ui.theme.TextSecondary

private enum class RecordMode {
    Voice,
    Text,
}

@Composable
fun HomeScreen(
    state: AppUiState,
    onPushToTalkStart: () -> Unit,
    onPushToTalkStop: () -> Unit,
    onSubmitPending: () -> Unit,
    onDiscardPending: () -> Unit,
    onTextChange: (String) -> Unit,
    onSubmitText: () -> Unit,
    onNavigateAnswers: () -> Unit,
    onNavigateEpics: () -> Unit,
    onNavigateSettings: () -> Unit,
    onOpenRecent: (Int) -> Unit,
) {
    var recordMode by rememberSaveable { mutableStateOf(RecordMode.Voice.name) }
    val mode = runCatching { RecordMode.valueOf(recordMode) }.getOrDefault(RecordMode.Voice)

    val projectName = state.projects.find { it.id == state.selectedProjectId }?.name
    val recentTasks = state.recentTasks.take(2)
    val showModeSwitch = !state.isListening && !state.isSending

    AppBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 20.dp),
        ) {
            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Task Bridge",
                        style = MaterialTheme.typography.titleLarge,
                        color = TextPrimary,
                    )
                    if (!projectName.isNullOrBlank()) {
                        Text(
                            text = projectName,
                            style = MaterialTheme.typography.labelMedium,
                            color = TextMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Row {
                    IconButton(onClick = onNavigateEpics) {
                        Icon(Icons.Default.ListAlt, contentDescription = "Epics", tint = TextSecondary)
                    }
                    IconButton(onClick = onNavigateAnswers) {
                        Icon(Icons.Default.Inbox, contentDescription = "Answers", tint = TextSecondary)
                    }
                    IconButton(onClick = onNavigateSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = TextSecondary)
                    }
                }
            }

            val statusMessage = state.statusMessage
            if (statusMessage != null && (
                    state.isSending || state.isListening ||
                        statusMessage.startsWith("Failed")
                    )
            ) {
                Spacer(modifier = Modifier.height(8.dp))
                StatusChip(
                    text = statusMessage,
                    color = when {
                        state.isSending -> Accent
                        state.isListening -> Primary
                        statusMessage.startsWith("Failed") -> Error
                        else -> TextSecondary
                    },
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = SurfaceElevated.copy(alpha = 0.55f)),
                border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                ) {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                    ) {
                        val liveTranscript = state.liveTranscript
                        if (state.isListening && !liveTranscript.isNullOrBlank()) {
                            val scrollState = rememberScrollState()
                            Column(
                                modifier = Modifier
                                    .align(Alignment.TopStart)
                                    .fillMaxWidth()
                                    .height(120.dp)
                                    .verticalScroll(scrollState),
                            ) {
                                Text(
                                    text = liveTranscript,
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = TextPrimary,
                                )
                            }
                        }

                        AnimatedContent(
                            targetState = mode,
                            transitionSpec = {
                                val forward = targetState == RecordMode.Text
                                if (forward) {
                                    (slideInVertically(
                                        animationSpec = spring(dampingRatio = 0.82f, stiffness = 400f),
                                    ) { it / 4 } + fadeIn(tween(220))) togetherWith
                                        (slideOutVertically(
                                            animationSpec = tween(180),
                                        ) { -it / 4 } + fadeOut(tween(160)))
                                } else {
                                    (slideInVertically(
                                        animationSpec = spring(dampingRatio = 0.82f, stiffness = 400f),
                                    ) { -it / 4 } + fadeIn(tween(220))) togetherWith
                                        (slideOutVertically(
                                            animationSpec = tween(180),
                                        ) { it / 4 } + fadeOut(tween(160)))
                                }
                            },
                            label = "recordMode",
                            modifier = Modifier.align(Alignment.Center),
                        ) { currentMode ->
                            when (currentMode) {
                                RecordMode.Voice -> {
                                    MicButton(
                                        isListening = state.isListening,
                                        isSending = state.isSending,
                                        onStart = onPushToTalkStart,
                                        onStop = onPushToTalkStop,
                                    )
                                }
                                RecordMode.Text -> {
                                    TextInputBar(
                                        text = state.textMessage.orEmpty(),
                                        isSending = state.isSending,
                                        onTextChange = onTextChange,
                                        onSubmit = onSubmitText,
                                    )
                                }
                            }
                        }
                    }

                    if (showModeSwitch) {
                        ModeSwitchBar(
                            mode = mode,
                            onVoice = { recordMode = RecordMode.Voice.name },
                            onText = { recordMode = RecordMode.Text.name },
                        )
                    }
                }
            }

            val pendingTranscript = state.pendingTranscript
            if (!pendingTranscript.isNullOrBlank() && !state.isListening) {
                PendingTranscriptCard(
                    transcript = pendingTranscript,
                    onSend = onSubmitPending,
                    onDiscard = onDiscardPending,
                )
            }

            if (recentTasks.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "Recent",
                    style = MaterialTheme.typography.labelLarge,
                    color = TextMuted,
                )
                Spacer(modifier = Modifier.height(8.dp))
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(96.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(recentTasks, key = { it.taskId }) { task ->
                        RecentTaskRow(task = task, onClick = { onOpenRecent(task.taskId) })
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
private fun ModeSwitchBar(
    mode: RecordMode,
    onVoice: () -> Unit,
    onText: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
        horizontalArrangement = Arrangement.Center,
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(28.dp))
                .background(SurfaceElevated.copy(alpha = 0.75f))
                .border(1.dp, SurfaceBorder, RoundedCornerShape(28.dp))
                .padding(horizontal = 8.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            ModeSwitchFab(
                icon = Icons.Default.Mic,
                contentDescription = "Voice",
                selected = mode == RecordMode.Voice,
                onClick = onVoice,
            )
            ModeSwitchFab(
                icon = Icons.Default.Keyboard,
                contentDescription = "Chat",
                selected = mode == RecordMode.Text,
                onClick = onText,
            )
        }
    }
}

@Composable
private fun ModeSwitchFab(
    icon: ImageVector,
    contentDescription: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.08f else 1f,
        animationSpec = spring(dampingRatio = 0.6f, stiffness = 400f),
        label = "fabScale",
    )
    val containerColor by animateColorAsState(
        targetValue = if (selected) PrimarySoft else Color.Transparent,
        animationSpec = tween(200),
        label = "fabColor",
    )
    val iconTint by animateColorAsState(
        targetValue = if (selected) Color.White else TextSecondary,
        animationSpec = tween(200),
        label = "fabTint",
    )

    SmallFloatingActionButton(
        onClick = onClick,
        modifier = Modifier.scale(scale),
        containerColor = containerColor,
        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 0.dp, pressedElevation = 0.dp),
    ) {
        Icon(
            imageVector = icon,
            contentDescription = contentDescription,
            tint = iconTint,
            modifier = Modifier.size(22.dp),
        )
    }
}

@Composable
private fun TextInputBar(
    text: String,
    isSending: Boolean,
    onTextChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(SurfaceElevated.copy(alpha = 0.85f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(28.dp))
            .padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        TextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Message...", color = TextMuted) },
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary,
            ),
            maxLines = 4,
            enabled = !isSending,
        )
        IconButton(
            onClick = onSubmit,
            enabled = text.isNotBlank() && !isSending,
            modifier = Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(if (text.isNotBlank()) Primary else SurfaceBorder),
        ) {
            if (isSending) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
            } else {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = Color.White)
            }
        }
    }
}

@Composable
private fun RecentTaskRow(
    task: RecentTask,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceElevated.copy(alpha = 0.65f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(12.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = textSnippet(task.title.ifBlank { "Task #${task.taskId}" }),
            style = MaterialTheme.typography.bodyMedium,
            color = TextPrimary,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)
    }
}

@Composable
private fun MicButton(
    isListening: Boolean,
    isSending: Boolean,
    onStart: () -> Unit,
    onStop: () -> Unit,
) {
    val infiniteTransition = rememberInfiniteTransition(label = "mic")
    val pulse by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.18f,
        animationSpec = infiniteRepeatable(animation = tween(900), repeatMode = RepeatMode.Reverse),
        label = "pulse",
    )
    val ringPulse by infiniteTransition.animateFloat(
        initialValue = 0.4f,
        targetValue = 0.85f,
        animationSpec = infiniteRepeatable(animation = tween(1200), repeatMode = RepeatMode.Reverse),
        label = "ring",
    )

    Box(contentAlignment = Alignment.Center) {
        if (isListening) {
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .scale(pulse)
                    .clip(CircleShape)
                    .background(MicRing.copy(alpha = ringPulse)),
            )
        }
        FloatingActionButton(
            onClick = {
                when {
                    isSending -> Unit
                    isListening -> onStop()
                    else -> onStart()
                }
            },
            modifier = Modifier.size(120.dp),
            shape = CircleShape,
            containerColor = Color.Transparent,
            elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 0.dp),
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(
                        if (isListening) {
                            Brush.radialGradient(listOf(MicActive, PrimarySoft, AccentSoft.copy(alpha = 0.6f)))
                        } else {
                            Brush.radialGradient(listOf(MicIdle, SurfaceElevated))
                        },
                    )
                    .border(
                        width = 1.5.dp,
                        color = if (isListening) Accent.copy(alpha = 0.6f) else SurfaceBorder,
                        shape = CircleShape,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                when {
                    isSending -> CircularProgressIndicator(modifier = Modifier.size(40.dp), color = Accent, strokeWidth = 3.dp)
                    isListening -> Icon(Icons.Default.Stop, contentDescription = "Stop", tint = Color.White, modifier = Modifier.size(48.dp))
                    else -> Icon(Icons.Default.Mic, contentDescription = "Start", tint = Color.White, modifier = Modifier.size(48.dp))
                }
            }
        }
    }
}

@Composable
private fun PendingTranscriptCard(
    transcript: String,
    onSend: () -> Unit,
    onDiscard: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceElevated.copy(alpha = 0.78f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = transcript, style = MaterialTheme.typography.bodyLarge, color = TextPrimary)
            Spacer(modifier = Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OutlinedButton(onClick = onDiscard, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.Close, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Discard")
                }
                OutlinedButton(onClick = onSend, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Send")
                }
            }
        }
    }
}
