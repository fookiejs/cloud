package com.taskbridge.mobile.ui



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

import androidx.compose.foundation.rememberScrollState

import androidx.compose.foundation.shape.RoundedCornerShape

import androidx.compose.foundation.verticalScroll

import androidx.compose.material.icons.Icons

import androidx.compose.material.icons.automirrored.filled.ArrowBack

import androidx.compose.material.icons.filled.ChevronRight

import androidx.compose.material.icons.filled.Stop

import androidx.compose.material.icons.filled.VolumeUp

import androidx.compose.material3.CircularProgressIndicator

import androidx.compose.material3.Icon

import androidx.compose.material3.IconButton

import androidx.compose.material3.MaterialTheme

import androidx.compose.material3.OutlinedTextField

import androidx.compose.material3.Text

import androidx.compose.material3.TextButton

import androidx.compose.runtime.Composable

import androidx.compose.runtime.LaunchedEffect

import androidx.compose.runtime.getValue

import androidx.compose.runtime.mutableStateOf

import androidx.compose.runtime.rememberCoroutineScope

import androidx.compose.runtime.saveable.rememberSaveable

import androidx.compose.runtime.setValue

import androidx.compose.ui.Alignment

import com.taskbridge.mobile.domain.models.TaskComment

import com.taskbridge.mobile.speech.commentSpeechText

import com.taskbridge.mobile.speech.commentsSpeechText

import com.taskbridge.mobile.speech.descriptionDisplayText
import com.taskbridge.mobile.speech.detailSpeechText

import com.taskbridge.mobile.ui.components.ExpandableMarkdown

import com.taskbridge.mobile.ui.components.MarkdownText

import com.taskbridge.mobile.ui.components.ScrollToTopFab

import java.time.Instant

import kotlinx.coroutines.launch

import androidx.compose.ui.Modifier

import androidx.compose.ui.draw.clip

import androidx.compose.ui.unit.dp

import com.taskbridge.mobile.ui.components.AppBackground

import com.taskbridge.mobile.ui.theme.AccentSoft

import com.taskbridge.mobile.ui.theme.Error

import com.taskbridge.mobile.ui.theme.SurfaceBorder

import com.taskbridge.mobile.ui.theme.SurfaceElevated

import com.taskbridge.mobile.ui.theme.TextMuted

import com.taskbridge.mobile.ui.theme.TextPrimary

import com.taskbridge.mobile.ui.theme.TextSecondary



@Composable

fun AnswerDetailScreen(

    taskId: Int,

    state: AppUiState,

    onBack: () -> Unit,

    onLoad: (Int) -> Unit,

    onSendComment: (Int, String) -> Unit,

    onListen: (String, String) -> Unit,

    onOpenLinkedTask: (Int) -> Unit = {},

    onCreateEpicTask: (Int, Int, String?, String, String) -> Unit = { _, _, _, _, _ -> },

) {

    LaunchedEffect(taskId) { onLoad(taskId) }



    val detail = state.activeDetail



    AppBackground {

        Box(modifier = Modifier.fillMaxSize()) {

            Column(

                modifier = Modifier

                    .fillMaxSize()

                    .padding(20.dp),

            ) {

                Row(verticalAlignment = Alignment.CenterVertically) {

                    IconButton(onClick = onBack) {

                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = TextPrimary)

                    }

                    Column(modifier = Modifier.weight(1f)) {

                        Text(

                            text = "#$taskId",

                            style = MaterialTheme.typography.headlineSmall,

                            color = TextPrimary,

                        )

                        val kindLabel = when (detail?.isEpic) {

                            true -> "Epic"

                            false -> "Task"

                            null -> null

                        }

                        if (kindLabel != null) {

                            Text(

                                text = kindLabel,

                                style = MaterialTheme.typography.labelMedium,

                                color = TextMuted,

                            )

                        }

                    }

                }



                val stageMeta = detail?.let {

                    listOfNotNull(

                        it.stageTitle,

                        it.workStatusLabel,

                        it.assignee?.let { name -> "@$name" },

                    ).joinToString(" · ")

                }?.takeIf { it.isNotBlank() }

                if (stageMeta != null) {

                    Text(

                        text = stageMeta,

                        style = MaterialTheme.typography.labelLarge,

                        color = TextMuted,

                        modifier = Modifier.padding(start = 8.dp, bottom = 4.dp),

                    )

                }



                if (state.isLoadingDetail && detail == null) {

                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {

                        CircularProgressIndicator(color = AccentSoft)

                    }

                    return@Column

                }



                val detailError = state.detailError

                if (detailError != null && detail == null) {

                    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {

                        Text(detailError, color = Error)

                    }

                    return@Column

                }



                if (detail == null) return@Column



                val scrollState = rememberScrollState()

                val scope = rememberCoroutineScope()

                var commentText by rememberSaveable { mutableStateOf("") }

                val sortedComments = detail.comments.sortedBy { parseCommentTime(it.at) }

                val descriptionDisplay = descriptionDisplayText(
                    title = detail.title,
                    description = detail.description,
                    request = detail.request,
                    isEpic = detail.isEpic,
                )
                val descriptionSpeech = detailSpeechText(
                    title = detail.title,
                    description = detail.description,
                    request = detail.request,
                    isEpic = detail.isEpic,
                )

                val commentsSpeech = commentsSpeechText(sortedComments, ::commentAuthor)



                Box(modifier = Modifier.weight(1f)) {

                    Column(

                        modifier = Modifier

                            .fillMaxSize()

                            .verticalScroll(scrollState)

                            .padding(bottom = 8.dp),

                        verticalArrangement = Arrangement.spacedBy(14.dp),

                    ) {

                        Spacer(modifier = Modifier.height(8.dp))



                        if (detail.title.isNotBlank()) {

                            DetailSection(title = "Title") {

                                Text(

                                    text = detail.title,

                                    style = MaterialTheme.typography.bodyLarge,

                                    color = TextPrimary,

                                )

                            }

                        }



                        detail.parent?.let { parent ->

                            DetailSection(title = "Epic") {

                                Row(

                                    modifier = Modifier

                                        .fillMaxWidth()

                                        .clip(RoundedCornerShape(12.dp))

                                        .clickable { onOpenLinkedTask(parent.taskId) }

                                        .padding(vertical = 4.dp),

                                    verticalAlignment = Alignment.CenterVertically,

                                ) {

                                    Column(modifier = Modifier.weight(1f)) {

                                        Text(

                                            text = "#${parent.taskId}",

                                            style = MaterialTheme.typography.titleSmall,

                                            color = AccentSoft,

                                        )

                                        if (parent.title.isNotBlank()) {

                                            Text(

                                                text = parent.title,

                                                style = MaterialTheme.typography.bodyMedium,

                                                color = TextSecondary,

                                            )

                                        }

                                    }

                                    Icon(Icons.Default.ChevronRight, contentDescription = null, tint = TextMuted)

                                }

                            }

                        }



                        DetailSection(

                            title = "Description",

                            listenKey = "description-$taskId",

                            listenText = descriptionSpeech,

                            speakingKey = state.speakingKey,

                            onListen = onListen,

                        ) {

                            ExpandableMarkdown(

                                text = descriptionDisplay,

                                color = TextPrimary,

                            )

                        }



                        if (detail.isEpic) {

                            EpicWorkflowSection(

                                epicId = taskId,

                                epicStageId = detail.stageId,

                                subtasks = detail.subtasks,

                                stages = state.workflowStages,

                                isLoadingStages = state.isLoadingWorkflowStages,

                                stagesError = state.workflowStagesError,

                                isCreatingTask = state.isCreatingEpicTask,

                                onCreateTask = { parentId, stageId, title, description ->

                                    onCreateEpicTask(taskId, parentId, stageId, title, description)

                                },

                                onOpenTask = onOpenLinkedTask,

                            )

                        }



                        DetailSection(

                            title = if (sortedComments.isEmpty()) "Comments" else "Comments (${sortedComments.size})",

                            listenKey = "comments-$taskId",

                            listenText = commentsSpeech,

                            speakingKey = state.speakingKey,

                            onListen = onListen,

                        ) {

                            if (sortedComments.isEmpty()) {

                                Text(

                                    text = "No comments yet.",

                                    style = MaterialTheme.typography.bodyMedium,

                                    color = TextMuted,

                                )

                            } else {

                                Column(modifier = Modifier.fillMaxWidth()) {

                                    sortedComments.forEachIndexed { index, comment ->

                                        if (index > 0) {

                                            Box(

                                                modifier = Modifier

                                                    .fillMaxWidth()

                                                    .padding(vertical = 8.dp)

                                                    .height(1.dp)

                                                    .background(SurfaceBorder),

                                            )

                                        }

                                        FlatCommentRow(

                                            comment = comment,

                                            index = index,

                                            speakingKey = state.speakingKey,

                                            onListen = onListen,

                                        )

                                    }

                                }

                            }

                            if (sortedComments.isNotEmpty()) {

                                Box(

                                    modifier = Modifier

                                        .fillMaxWidth()

                                        .padding(top = 12.dp, bottom = 4.dp)

                                        .height(1.dp)

                                        .background(SurfaceBorder),

                                )

                            }

                            OutlinedTextField(

                                value = commentText,

                                onValueChange = { commentText = it },

                                modifier = Modifier.fillMaxWidth(),

                                placeholder = { Text("Add a comment…") },

                                enabled = !state.isSendingComment,

                                minLines = 2,

                            )

                            Row(

                                modifier = Modifier.fillMaxWidth(),

                                horizontalArrangement = Arrangement.End,

                            ) {

                                TextButton(

                                    onClick = {

                                        val text = commentText.trim()

                                        if (text.isNotBlank()) {

                                            onSendComment(taskId, text)

                                            commentText = ""

                                        }

                                    },

                                    enabled = !state.isSendingComment && commentText.isNotBlank(),

                                ) {

                                    Text(if (state.isSendingComment) "Saving…" else "Comment")

                                }

                            }

                        }



                        Spacer(modifier = Modifier.height(24.dp))

                    }



                    ScrollToTopFab(

                        visible = scrollState.value > 200,

                        onClick = { scope.launch { scrollState.animateScrollTo(0) } },

                        modifier = Modifier

                            .align(Alignment.BottomStart)

                            .padding(bottom = 8.dp),

                    )

                }

            }

        }

    }

}



private fun parseCommentTime(value: String?): Long {

    if (value.isNullOrBlank()) return 0L

    return runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(0L)

}



private fun commentAuthor(comment: TaskComment): String {

    val name = comment.by.trim()

    if (name.isNotEmpty()) return name

    return if (comment.isUser) "User" else comment.by.ifBlank { "System" }

}



@Composable

private fun FlatCommentRow(

    comment: TaskComment,

    index: Int,

    speakingKey: String?,

    onListen: (String, String) -> Unit,

) {

    val name = commentAuthor(comment)

    val listenKey = "comment-${comment.id}"

    val speechText = commentSpeechText(comment, index, name)

    Row(

        modifier = Modifier.fillMaxWidth(),

        verticalAlignment = Alignment.Top,

    ) {

        Column(modifier = Modifier.weight(1f)) {

            Text(

                text = buildString {

                    append(name)

                    if (comment.at.isNotBlank()) {

                        append(" · ")

                        append(formatTimestamp(comment.at))

                    }

                },

                style = MaterialTheme.typography.labelMedium,

                color = TextMuted,

            )

            Spacer(modifier = Modifier.height(4.dp))

            MarkdownText(

                text = comment.text,

                color = TextPrimary,

            )

        }

        if (speechText.isNotBlank()) {

            ListenButton(

                listenKey = listenKey,

                speakingKey = speakingKey,

                onClick = { onListen(listenKey, speechText) },

                modifier = Modifier.padding(start = 4.dp),

            )

        }

    }

}



@Composable

private fun ListenButton(

    listenKey: String,

    speakingKey: String?,

    onClick: () -> Unit,

    modifier: Modifier = Modifier,

) {

    val isActive = speakingKey == listenKey

    IconButton(

        onClick = onClick,

        modifier = modifier.size(36.dp),

    ) {

        Icon(

            imageVector = if (isActive) Icons.Default.Stop else Icons.Default.VolumeUp,

            contentDescription = if (isActive) "Stop" else "Listen",

            tint = if (isActive) AccentSoft else TextMuted,

            modifier = Modifier.size(20.dp),

        )

    }

}



@Composable

private fun DetailSection(

    title: String,

    listenKey: String? = null,

    listenText: String? = null,

    speakingKey: String? = null,

    onListen: ((String, String) -> Unit)? = null,

    content: @Composable () -> Unit,

) {

    val canListen = !listenText.isNullOrBlank() && onListen != null && listenKey != null

    Column(

        modifier = Modifier

            .fillMaxWidth()

            .clip(RoundedCornerShape(16.dp))

            .background(SurfaceElevated.copy(alpha = 0.75f))

            .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))

            .padding(16.dp),

    ) {

        Row(

            modifier = Modifier

                .fillMaxWidth()

                .padding(bottom = 10.dp),

            horizontalArrangement = Arrangement.SpaceBetween,

            verticalAlignment = Alignment.CenterVertically,

        ) {

            Text(

                text = title,

                style = MaterialTheme.typography.labelLarge,

                color = TextMuted,

            )

            if (canListen) {

                ListenButton(

                    listenKey = listenKey,

                    speakingKey = speakingKey,

                    onClick = { onListen(listenKey, listenText) },

                )

            }

        }

        content()

    }

}


