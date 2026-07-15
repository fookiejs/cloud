package com.taskbridge.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.taskbridge.mobile.domain.models.TaskSubtaskSummary
import com.taskbridge.mobile.domain.models.WorkflowStageItem
import com.taskbridge.mobile.ui.theme.Accent
import com.taskbridge.mobile.ui.theme.AccentSoft
import com.taskbridge.mobile.ui.theme.Primary
import com.taskbridge.mobile.ui.theme.PrimarySoft
import com.taskbridge.mobile.ui.theme.Success
import com.taskbridge.mobile.ui.theme.SurfaceBorder
import com.taskbridge.mobile.ui.theme.SurfaceElevated
import com.taskbridge.mobile.ui.theme.TextMuted
import com.taskbridge.mobile.ui.theme.TextPrimary
import com.taskbridge.mobile.ui.theme.TextSecondary

private enum class StagePhase {
    Complete,
    Current,
    Upcoming,
}

@Composable
fun EpicWorkflowSection(
    epicId: Int,
    epicStageId: String?,
    subtasks: List<TaskSubtaskSummary>,
    stages: List<WorkflowStageItem>,
    isLoadingStages: Boolean,
    stagesError: String?,
    isCreatingTask: Boolean,
    onCreateTask: (parentId: Int, stageId: String?, title: String, description: String) -> Unit,
    onOpenTask: (Int) -> Unit,
) {
    var addSheetOpen by rememberSaveable { mutableStateOf(false) }
    val canAdd = stages.isNotEmpty() || subtasks.isNotEmpty()
    val orphans = orphanTasks(stages, subtasks)

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceElevated.copy(alpha = 0.75f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Workflow",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold,
                )
                if (!isLoadingStages && stagesError == null) {
                    Text(
                        text = workflowSummary(stages.size, subtasks.size),
                        style = MaterialTheme.typography.bodySmall,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            Button(
                onClick = { addSheetOpen = true },
                enabled = !isCreatingTask && canAdd,
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = PrimarySoft,
                    contentColor = Color.White,
                    disabledContainerColor = SurfaceElevated,
                    disabledContentColor = TextMuted,
                ),
                contentPadding = ButtonDefaults.ContentPadding,
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add task", style = MaterialTheme.typography.labelLarge)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        when {
            isLoadingStages -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 20.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    CircularProgressIndicator(color = AccentSoft, modifier = Modifier.size(28.dp))
                }
            }
            stagesError != null -> {
                Text(stagesError, style = MaterialTheme.typography.bodyMedium, color = TextSecondary)
            }
            stages.isEmpty() && subtasks.isEmpty() -> {
                EmptyWorkflowHint()
            }
            stages.isEmpty() -> {
                Text(
                    text = "Tasks",
                    style = MaterialTheme.typography.labelLarge,
                    color = TextMuted,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                subtasks.forEach { subtask ->
                    WorkflowTaskCard(subtask = subtask, onOpenTask = onOpenTask)
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
            else -> {
                stages.forEachIndexed { index, stage ->
                    val phase = resolveStagePhase(stage.id, epicStageId, stages)
                    val stageTasks = tasksForStage(stage, subtasks)
                    StageStepCard(
                        stepNumber = index + 1,
                        stage = stage,
                        phase = phase,
                        tasks = stageTasks,
                        isLast = index == stages.lastIndex && orphans.isEmpty(),
                        onOpenTask = onOpenTask,
                    )
                }
                if (orphans.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(8.dp))
                    OrphanTasksBlock(tasks = orphans, onOpenTask = onOpenTask)
                }
            }
        }
    }

    if (addSheetOpen) {
        AddWorkflowTaskSheet(
            epicId = epicId,
            stages = stages,
            subtasks = subtasks,
            isCreating = isCreatingTask,
            onDismiss = { addSheetOpen = false },
            onCreate = { parentId, stageId, title, description ->
                onCreateTask(parentId, stageId, title, description)
                addSheetOpen = false
            },
        )
    }
}

@Composable
private fun EmptyWorkflowHint() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(SurfaceElevated.copy(alpha = 0.5f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(12.dp))
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "No workflow steps yet",
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
        )
        Text(
            text = "Configure stages on the web, then tasks appear here by step.",
            style = MaterialTheme.typography.bodySmall,
            color = TextMuted,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
}

@Composable
private fun StageStepCard(
    stepNumber: Int,
    stage: WorkflowStageItem,
    phase: StagePhase,
    tasks: List<TaskSubtaskSummary>,
    isLast: Boolean,
    onOpenTask: (Int) -> Unit,
) {
    val accentColor = phaseColor(phase)
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min),
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.width(28.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(accentColor.copy(alpha = 0.2f))
                        .border(2.dp, accentColor, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = stepNumber.toString(),
                        style = MaterialTheme.typography.labelMedium,
                        color = accentColor,
                        fontWeight = FontWeight.Bold,
                    )
                }
                if (!isLast) {
                    Box(
                        modifier = Modifier
                            .width(2.dp)
                            .weight(1f)
                            .padding(vertical = 4.dp)
                            .background(SurfaceBorder),
                    )
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = stage.title,
                        style = MaterialTheme.typography.titleSmall,
                        color = TextPrimary,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    PhaseBadge(phase = phase)
                }
                Text(
                    text = taskCountLabel(tasks.size),
                    style = MaterialTheme.typography.labelSmall,
                    color = TextMuted,
                    modifier = Modifier.padding(top = 2.dp, bottom = 8.dp),
                )
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceElevated.copy(alpha = 0.55f))
                        .border(1.dp, accentColor.copy(alpha = 0.25f), RoundedCornerShape(14.dp))
                        .padding(10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (tasks.isEmpty()) {
                        Text(
                            text = "No tasks in this step",
                            style = MaterialTheme.typography.bodySmall,
                            color = TextMuted,
                            modifier = Modifier.padding(vertical = 4.dp),
                        )
                    } else {
                        tasks.forEach { subtask ->
                            WorkflowTaskCard(subtask = subtask, onOpenTask = onOpenTask)
                        }
                    }
                }
            }
        }
        if (!isLast) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 8.dp, top = 4.dp, bottom = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = TextMuted,
                    modifier = Modifier.size(20.dp),
                )
            }
        } else {
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}

@Composable
private fun OrphanTasksBlock(
    tasks: List<TaskSubtaskSummary>,
    onOpenTask: (Int) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(SurfaceElevated.copy(alpha = 0.55f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(14.dp))
            .padding(12.dp),
    ) {
        Text(
            text = "Unassigned",
            style = MaterialTheme.typography.labelLarge,
            color = TextMuted,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        tasks.forEach { subtask ->
            WorkflowTaskCard(subtask = subtask, onOpenTask = onOpenTask)
            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

@Composable
private fun WorkflowTaskCard(
    subtask: TaskSubtaskSummary,
    onOpenTask: (Int) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(SurfaceElevated.copy(alpha = 0.85f))
            .border(1.dp, SurfaceBorder, RoundedCornerShape(10.dp))
            .clickable { onOpenTask(subtask.taskId) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = subtask.title.ifBlank { "Task #${subtask.taskId}" },
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary,
                fontWeight = FontWeight.Medium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = "#${subtask.taskId}",
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        StatusChip(subtask = subtask)
        Icon(
            Icons.Default.ChevronRight,
            contentDescription = null,
            tint = TextMuted,
            modifier = Modifier
                .padding(start = 4.dp)
                .size(18.dp),
        )
    }
}

@Composable
private fun StatusChip(subtask: TaskSubtaskSummary) {
    val status = resolveWorkStatus(subtask)
    val (label, color) = when (status) {
        "done" -> "Done" to Success
        "in_progress" -> "In progress" to Accent
        else -> "Todo" to TextMuted
    }
    Text(
        text = subtask.workStatusLabel?.takeIf { it.isNotBlank() } ?: label,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.15f))
            .padding(horizontal = 8.dp, vertical = 4.dp),
    )
}

@Composable
private fun PhaseBadge(phase: StagePhase) {
    val (label, color) = when (phase) {
        StagePhase.Complete -> "Done" to Success
        StagePhase.Current -> "Current" to Accent
        StagePhase.Upcoming -> "Next" to TextMuted
    }
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = color,
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddWorkflowTaskSheet(
    epicId: Int,
    stages: List<WorkflowStageItem>,
    subtasks: List<TaskSubtaskSummary>,
    isCreating: Boolean,
    onDismiss: () -> Unit,
    onCreate: (parentId: Int, stageId: String?, title: String, description: String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val defaultTarget = placementKey(stages, subtasks)
    var selectedKey by rememberSaveable(stages, subtasks) { mutableStateOf(defaultTarget) }
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    val orphans = orphanTasks(stages, subtasks)
    val canSubmit = title.trim().isNotBlank() && selectedKey.isNotBlank()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = SurfaceElevated,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "New task",
                style = MaterialTheme.typography.titleLarge,
                color = TextPrimary,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = "Add to",
                style = MaterialTheme.typography.titleSmall,
                color = TextPrimary,
                fontWeight = FontWeight.Medium,
            )
            Text(
                text = "Pick a workflow step or nest under an existing task.",
                style = MaterialTheme.typography.bodySmall,
                color = TextMuted,
            )

            if (stages.isEmpty() && subtasks.isEmpty()) {
                Text("Nothing to attach to yet.", style = MaterialTheme.typography.bodyMedium, color = TextMuted)
            } else if (stages.isEmpty()) {
                subtasks.forEach { subtask ->
                    val key = taskPlacementKey(subtask.taskId)
                    PlacementRow(
                        title = subtask.title.ifBlank { "Task #${subtask.taskId}" },
                        subtitle = "#${subtask.taskId}",
                        selected = selectedKey == key,
                        indent = 0.dp,
                        onClick = { selectedKey = key },
                    )
                }
            } else {
                stages.forEachIndexed { index, stage ->
                    val stepKey = stepPlacementKey(stage.id)
                    PlacementRow(
                        title = "${index + 1}. ${stage.title}",
                        subtitle = "New task in this step",
                        selected = selectedKey == stepKey,
                        indent = 0.dp,
                        onClick = { selectedKey = stepKey },
                    )
                    tasksForStage(stage, subtasks).forEach { subtask ->
                        val key = taskPlacementKey(subtask.taskId)
                        PlacementRow(
                            title = subtask.title.ifBlank { "Task #${subtask.taskId}" },
                            subtitle = "Subtask · #${subtask.taskId}",
                            selected = selectedKey == key,
                            indent = 16.dp,
                            onClick = { selectedKey = key },
                        )
                    }
                }
                if (orphans.isNotEmpty()) {
                    Text(
                        text = "Unassigned",
                        style = MaterialTheme.typography.labelLarge,
                        color = TextMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    orphans.forEach { subtask ->
                        val key = taskPlacementKey(subtask.taskId)
                        PlacementRow(
                            title = subtask.title.ifBlank { "Task #${subtask.taskId}" },
                            subtitle = "Subtask · #${subtask.taskId}",
                            selected = selectedKey == key,
                            indent = 0.dp,
                            onClick = { selectedKey = key },
                        )
                    }
                }
            }

            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Title") },
                enabled = !isCreating,
                singleLine = true,
            )
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Description (optional)") },
                enabled = !isCreating,
                minLines = 3,
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End),
            ) {
                TextButton(onClick = onDismiss, enabled = !isCreating) {
                    Text("Cancel")
                }
                Button(
                    onClick = {
                        resolvePlacement(selectedKey, epicId, stages, subtasks)?.let { placement ->
                            onCreate(placement.parentId, placement.stageId, title, description)
                        }
                    },
                    enabled = !isCreating && canSubmit,
                    colors = ButtonDefaults.buttonColors(containerColor = Primary),
                ) {
                    Text(if (isCreating) "Creating…" else "Create task")
                }
            }
        }
    }
}

@Composable
private fun PlacementRow(
    title: String,
    subtitle: String,
    selected: Boolean,
    indent: Dp,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = indent)
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (selected) AccentSoft.copy(alpha = 0.12f) else SurfaceElevated.copy(alpha = 0.4f),
            )
            .border(
                1.dp,
                if (selected) AccentSoft.copy(alpha = 0.45f) else SurfaceBorder,
                RoundedCornerShape(12.dp),
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                color = if (selected) TextPrimary else TextSecondary,
                fontWeight = if (selected) FontWeight.Medium else FontWeight.Normal,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = TextMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
    }
}

private data class ResolvedPlacement(
    val parentId: Int,
    val stageId: String?,
)

private fun stepPlacementKey(stageId: String) = "step:$stageId"

private fun taskPlacementKey(taskId: Int) = "task:$taskId"

private fun placementKey(
    stages: List<WorkflowStageItem>,
    subtasks: List<TaskSubtaskSummary>,
): String {
    val firstStage = stages.firstOrNull()
    if (firstStage != null) return stepPlacementKey(firstStage.id)
    val firstTask = subtasks.firstOrNull()
    if (firstTask != null) return taskPlacementKey(firstTask.taskId)
    return ""
}

private fun resolvePlacement(
    key: String,
    epicId: Int,
    stages: List<WorkflowStageItem>,
    subtasks: List<TaskSubtaskSummary>,
): ResolvedPlacement? {
    if (key.startsWith("step:")) {
        val stageId = key.removePrefix("step:")
        if (stageId.isBlank() || stages.none { it.id == stageId }) return null
        return ResolvedPlacement(parentId = epicId, stageId = stageId)
    }
    if (key.startsWith("task:")) {
        val taskId = key.removePrefix("task:").toIntOrNull() ?: return null
        val task = subtasks.find { it.taskId == taskId } ?: return null
        return ResolvedPlacement(
            parentId = taskId,
            stageId = task.stageId?.takeIf { it.isNotBlank() },
        )
    }
    return null
}

private fun workflowSummary(stageCount: Int, taskCount: Int): String {
    val stagePart = if (stageCount == 1) "1 step" else "$stageCount steps"
    val taskPart = if (taskCount == 1) "1 task" else "$taskCount tasks"
    return "$stagePart · $taskPart"
}

private fun taskCountLabel(count: Int): String {
    return if (count == 1) "1 task" else "$count tasks"
}

private fun resolveStagePhase(
    stageId: String,
    epicStageId: String?,
    stages: List<WorkflowStageItem>,
): StagePhase {
    if (epicStageId.isNullOrBlank()) return StagePhase.Upcoming
    val epicIndex = stages.indexOfFirst { it.id == epicStageId }
    val stageIndex = stages.indexOfFirst { it.id == stageId }
    if (epicIndex < 0 || stageIndex < 0) return StagePhase.Upcoming
    return when {
        stageIndex < epicIndex -> StagePhase.Complete
        stageIndex == epicIndex -> StagePhase.Current
        else -> StagePhase.Upcoming
    }
}

private fun phaseColor(phase: StagePhase): Color {
    return when (phase) {
        StagePhase.Complete -> Success
        StagePhase.Current -> Accent
        StagePhase.Upcoming -> TextMuted
    }
}

private fun tasksForStage(
    stage: WorkflowStageItem,
    subtasks: List<TaskSubtaskSummary>,
): List<TaskSubtaskSummary> {
    return subtasks.filter { task ->
        task.stageId == stage.id ||
            (
                task.stageId.isNullOrBlank() &&
                    task.stageTitle?.equals(stage.title, ignoreCase = true) == true
                )
    }
}

private fun orphanTasks(
    stages: List<WorkflowStageItem>,
    subtasks: List<TaskSubtaskSummary>,
): List<TaskSubtaskSummary> {
    if (stages.isEmpty()) return emptyList()
    return subtasks.filter { task ->
        stages.none { stage -> tasksForStage(stage, listOf(task)).isNotEmpty() }
    }
}

private fun resolveWorkStatus(subtask: TaskSubtaskSummary): String {
    subtask.workStatus?.trim()?.lowercase()?.takeIf { it.isNotBlank() }?.let { return it }
    if (subtask.done) return "done"
    return "todo"
}
